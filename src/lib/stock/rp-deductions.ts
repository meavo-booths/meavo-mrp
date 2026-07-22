import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveWarehouseId } from "@/lib/import/resolve";
import {
  computeBomCostFromRows,
  loadBomRowsForElements,
} from "@/lib/stock/bom-cost";
import {
  applyMovementsInTx,
  resolveWarehouseCodesForMovements,
  type ApplyMovementInput,
} from "@/lib/stock/movements";

export type RpDeductionLineResult = {
  rpLineItemId: string;
  rpNum: string;
  status: "posted" | "skipped" | "error";
  message?: string;
  movementsPosted?: number;
};

export type RpDeductionResult = {
  results: RpDeductionLineResult[];
  posted: number;
  skipped: number;
  errors: number;
};

function normalizePartCode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function parseQuantity(raw: string | null | undefined): number {
  const n = Number(String(raw ?? "1").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/** Map RP market string to MRP booth market filter. */
export function deriveRpBoothMarket(
  market: string | null | undefined,
): "default" | "US" {
  const m = (market ?? "").toLowerCase();
  if (
    m.includes("us") ||
    m.includes("usa") ||
    m.includes("america") ||
    m.includes("амери")
  ) {
    return "US";
  }
  return "default";
}

/** Extract factory code (AKS/VAR/KAZ/TOP) from reviewGroup. */
export function reviewGroupToWarehouseAlias(
  reviewGroup: string | null | undefined,
): string | null {
  const g = (reviewGroup ?? "").toUpperCase();
  if (g.includes("AKS")) return "AKS";
  if (g.includes("VAR")) return "VAR";
  if (g.includes("KAZ")) return "KAZ";
  if (g.includes("TOP")) return "TOP";
  return null;
}

/** Expand RP model abbreviations (SO, C2, …) to MRP booth model names. */
export function expandBoothModelName(storedModel: string): string {
  const normalized = storedModel.trim().toUpperCase();
  const lookup: Record<string, string> = {
    SO: "Soho",
    WS: "Workstation",
    C2: "Camden 2",
    C4: "Camden 4",
    "H.O": "Haven One",
    "H.F": "Haven Focus",
    "H.2": "Haven Two",
    "H.4": "Haven Four",
  };
  return lookup[normalized] ?? storedModel.trim();
}

async function resolvePartMaterialId(
  partRpCode: string,
): Promise<{ materialId: string; code: string | null } | null> {
  const mapped = await prisma.rpPartMrpMap.findUnique({
    where: { partRpCode },
    select: {
      mrpMaterialId: true,
      mrpMaterial: { select: { id: true, code: true, isActive: true } },
    },
  });
  if (mapped?.mrpMaterial?.isActive) {
    return {
      materialId: mapped.mrpMaterial.id,
      code: mapped.mrpMaterial.code,
    };
  }

  const byCode = await prisma.mrpMaterial.findFirst({
    where: { code: partRpCode, isActive: true },
    select: { id: true, code: true },
  });
  if (byCode) return { materialId: byCode.id, code: byCode.code };
  return null;
}

/**
 * Post `production_out` movements for Ready RP line items.
 * Idempotent via `RpLineItem.materialsDeductedAt`.
 * Skips panel lines fulfilled from stock.
 */
export async function postRpDeductions(input: {
  rpLineItemIds?: string[];
  rpRequestId?: string;
  createdById?: string | null;
}): Promise<RpDeductionResult> {
  const result: RpDeductionResult = {
    results: [],
    posted: 0,
    skipped: 0,
    errors: 0,
  };

  const where =
    input.rpLineItemIds && input.rpLineItemIds.length > 0
      ? { id: { in: input.rpLineItemIds } }
      : input.rpRequestId
        ? { rpRequestId: input.rpRequestId }
        : null;

  if (!where) {
    return result;
  }

  const lines = await prisma.rpLineItem.findMany({
    where,
    include: {
      rpRequest: {
        select: {
          id: true,
          rpNum: true,
          status: true,
          model: true,
          color: true,
          market: true,
          reviewGroup: true,
          partRpCode: true,
          quantity: true,
        },
      },
    },
    orderBy: [{ rpRequestId: "asc" }, { lineIndex: "asc" }],
  });

  if (lines.length === 0) return result;

  const panelElementIds = new Set<string>();
  const panelMapKey = (model: string, panel: string) =>
    `${model.trim().toLowerCase()}\0${panel.trim().toLowerCase()}`;
  const panelLookupKeys = lines
    .filter((l) => l.kind === "panel")
    .flatMap((l) => {
      const modelRaw = (l.rpRequest.model ?? "").trim();
      const modelName = expandBoothModelName(modelRaw);
      const rpPanelName = (l.panelName ?? "").trim();
      if (!rpPanelName) return [];
      const keys = [{ boothModelName: modelName, rpPanelName }];
      if (modelRaw && modelRaw !== modelName) {
        keys.push({ boothModelName: modelRaw, rpPanelName });
      }
      return keys;
    })
    .filter((m) => m.boothModelName && m.rpPanelName);

  const panelMaps =
    panelLookupKeys.length > 0
      ? await prisma.rpPanelMrpMap.findMany({
          where: { OR: panelLookupKeys },
          select: {
            boothModelName: true,
            rpPanelName: true,
            boothElementId: true,
          },
        })
      : [];
  const panelMapByKey = new Map(
    panelMaps.map((m) => [
      panelMapKey(m.boothModelName, m.rpPanelName),
      m.boothElementId,
    ]),
  );
  for (const id of panelMaps.map((m) => m.boothElementId)) {
    panelElementIds.add(id);
  }
  const bomByElement = await loadBomRowsForElements([...panelElementIds]);

  for (const line of lines) {
    const rpNum = line.rpRequest.rpNum;
    const base = { rpLineItemId: line.id, rpNum };

    if (line.materialsDeductedAt) {
      result.skipped++;
      result.results.push({
        ...base,
        status: "skipped",
        message: "Already deducted",
      });
      continue;
    }

    if ((line.rpRequest.status ?? "").trim() !== "Ready") {
      result.errors++;
      const message = `RP status is "${line.rpRequest.status ?? ""}", expected Ready`;
      await prisma.rpLineItem.update({
        where: { id: line.id },
        data: { materialsDeductionError: message },
      });
      result.results.push({ ...base, status: "error", message });
      continue;
    }

    if (line.kind === "panel" && line.fulfillment === "from_stock") {
      result.skipped++;
      result.results.push({
        ...base,
        status: "skipped",
        message: "Panel fulfilled from stock — no BOM deduction",
      });
      await prisma.rpLineItem.update({
        where: { id: line.id },
        data: {
          materialsDeductedAt: new Date(),
          materialsDeductionError: null,
        },
      });
      continue;
    }

    const warehouseAlias = reviewGroupToWarehouseAlias(
      line.rpRequest.reviewGroup,
    );
    if (!warehouseAlias) {
      result.errors++;
      const message = `No warehouse for reviewGroup "${line.rpRequest.reviewGroup ?? ""}"`;
      await prisma.rpLineItem.update({
        where: { id: line.id },
        data: { materialsDeductionError: message },
      });
      result.results.push({ ...base, status: "error", message });
      continue;
    }

    const warehouseId = await resolveWarehouseId(warehouseAlias);
    if (!warehouseId) {
      result.errors++;
      const message = `Warehouse ${warehouseAlias} not found in MRP`;
      await prisma.rpLineItem.update({
        where: { id: line.id },
        data: { materialsDeductionError: message },
      });
      result.results.push({ ...base, status: "error", message });
      continue;
    }

    try {
      const qty = parseQuantity(line.quantity ?? line.rpRequest.quantity);
      const movements: ApplyMovementInput[] = [];
      const now = new Date();

      if (line.kind === "part") {
        const code = normalizePartCode(
          line.partRpCode ?? line.rpRequest.partRpCode,
        );
        if (!/^\d{4}$/.test(code)) {
          throw new Error(`Invalid part RP code "${code}"`);
        }
        const material = await resolvePartMaterialId(code);
        if (!material) {
          throw new Error(`No MRP material mapped for part code ${code}`);
        }
        movements.push({
          warehouseId,
          materialId: material.materialId,
          movementType: "production_out",
          quantityDelta: (-Math.abs(qty)).toFixed(4),
          effectiveAt: now,
          referenceId: line.id,
          notes: `RP ${rpNum} part ${code}`,
          metadata: {
            source: "rp",
            rpNum,
            kind: "part",
            partRpCode: code,
            materialCode: material.code,
          },
          createdBy: input.createdById ?? null,
        });
      } else {
        const modelRaw = (line.rpRequest.model ?? "").trim();
        const modelName = expandBoothModelName(modelRaw);
        const panelName = (line.panelName ?? "").trim();
        if (!modelName || !panelName) {
          throw new Error("Panel line missing booth model or panel name");
        }

        let boothElementId =
          panelMapByKey.get(panelMapKey(modelName, panelName)) ??
          panelMapByKey.get(panelMapKey(modelRaw, panelName));
        if (!boothElementId) {
          // Exact-match fallback on MRP simpleName within the model
          const element = await prisma.mrpBoothElement.findFirst({
            where: {
              isActive: true,
              simpleName: panelName,
              boothModel: {
                OR: [{ name: modelName }, { name: modelRaw }],
              },
            },
            select: { id: true },
          });
          boothElementId = element?.id;
        }
        if (!boothElementId) {
          throw new Error(
            `No MRP recipe map for panel "${panelName}" on model "${modelName}"`,
          );
        }

        const boothMarket = deriveRpBoothMarket(line.rpRequest.market);
        const { lines: bomLines } = computeBomCostFromRows(
          bomByElement.get(boothElementId) ??
            (await loadBomRowsForElements([boothElementId])).get(
              boothElementId,
            ) ??
            [],
          line.rpRequest.color,
          boothMarket,
        );
        if (bomLines.length === 0) {
          throw new Error(
            `Empty BOM for panel "${panelName}" (colour=${line.rpRequest.color ?? "any"}, market=${boothMarket})`,
          );
        }

        for (const bom of bomLines) {
          const lineQty = Math.abs(Number(bom.quantity) * qty);
          movements.push({
            warehouseId,
            materialId: bom.materialId,
            movementType: "production_out",
            quantityDelta: (-lineQty).toFixed(4),
            effectiveAt: now,
            referenceId: line.id,
            notes: `RP ${rpNum} panel ${panelName}`,
            metadata: {
              source: "rp",
              rpNum,
              kind: "panel",
              boothElementId,
              materialCode: bom.materialCode,
              panelName,
              model: modelName,
            },
            createdBy: input.createdById ?? null,
          });
        }
      }

      const warehouseCodes =
        await resolveWarehouseCodesForMovements(movements);
      await prisma.$transaction(async (tx) => {
        await applyMovementsInTx(tx, movements, warehouseCodes);
        await tx.rpLineItem.update({
          where: { id: line.id },
          data: {
            materialsDeductedAt: now,
            materialsDeductionError: null,
          },
        });
      });

      result.posted++;
      result.results.push({
        ...base,
        status: "posted",
        movementsPosted: movements.length,
      });
    } catch (err) {
      result.errors++;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.rpLineItem.update({
        where: { id: line.id },
        data: { materialsDeductionError: message },
      });
      result.results.push({ ...base, status: "error", message });
    }
  }

  return result;
}

/** Ready RP lines that still need material deduction. */
export async function listReadyUndeductedLines(limit = 200) {
  return prisma.rpLineItem.findMany({
    where: {
      materialsDeductedAt: null,
      rpRequest: { status: "Ready" },
      NOT: { kind: "panel", fulfillment: "from_stock" },
    },
    include: {
      rpRequest: {
        select: {
          rpNum: true,
          model: true,
          color: true,
          market: true,
          reviewGroup: true,
          partRpCode: true,
          itemType: true,
          status: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
