import "server-only";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import { ensureBoothModelId } from "@/lib/import/resolve";
import {
  ELEMENT_BOM_COLUMNS,
  parseMarket,
  parseOptionalColour,
  parseQuantity,
  type BomLineInput,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { listAllBomLinesForExport } from "@/lib/stock/bom-cost";
import { syncBomMissingFromMaterialCodes } from "@/lib/stock/bom-missing";
import { validateBomConflicts } from "@/lib/stock/bom-match";

export function elementBomTemplateCsv(): string {
  return serializeCsv([...ELEMENT_BOM_COLUMNS], [
    ["Soho", "", "", "Таван", "0138", "1", ""],
    ["Soho", "Pure White", "", "Таван", "0138", "1.2", ""],
    ["Soho", "", "US", "Таван", "0138", "1.1", ""],
  ]);
}

export async function exportElementBomCsv(): Promise<string> {
  const rows = await listAllBomLinesForExport();

  return serializeCsv(
    [...ELEMENT_BOM_COLUMNS, "line_cost_eur"],
    rows.map((r) => {
      const lineCost =
        r.unitPriceEur != null
          ? (Number(r.quantity) * Number(r.unitPriceEur)).toFixed(4)
          : "";
      return [
        r.boothModel,
        r.colour ?? "",
        r.market ?? "",
        r.simpleName,
        r.materialCode ?? "",
        String(r.quantity),
        "",
        lineCost,
      ];
    }),
  );
}

export async function importElementBomCsv(text: string): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  const parsed: BomLineInput[] = [];

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const boothModel = raw.booth_model?.trim();
    const element = raw.element?.trim();
    const materialCode = raw.material_code?.trim();

    if (!boothModel && !element && !materialCode) continue;

    if (!boothModel || !element || !materialCode) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: "booth_model, element, and material_code are required",
      });
      continue;
    }

    try {
      parsed.push({
        row: rowNum,
        boothModel,
        element,
        materialCode,
        colour: parseOptionalColour(raw.colour ?? ""),
        market: parseMarket(raw.market ?? ""),
        quantity: parseQuantity(raw.quantity ?? ""),
      });
    } catch (err) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!result.ok) return result;

  await syncBomMissingFromMaterialCodes(parsed.map((l) => l.materialCode));

  const materials = await prisma.mrpMaterial.findMany({
    select: { id: true, code: true },
  });
  const materialByCode = new Map(
    materials
      .filter((m) => m.code)
      .map((m) => [m.code!, m.id]),
  );

  const byModel = new Map<string, BomLineInput[]>();
  for (const line of parsed) {
    const bucket = byModel.get(line.boothModel) ?? [];
    bucket.push(line);
    byModel.set(line.boothModel, bucket);
  }

  for (const [boothModel, lines] of byModel) {
    const conflicts = validateBomConflicts(lines);
    if (conflicts.length > 0) {
      result.ok = false;
      for (const c of conflicts) {
        result.errors.push({ row: c.row, message: c.message });
      }
      continue;
    }

    try {
      const boothModelId = await ensureBoothModelId(boothModel);

      const elements = await prisma.mrpBoothElement.findMany({
        where: { boothModelId },
        select: { id: true, simpleName: true },
      });

      const elementBySimple = new Map(
        elements.map((e) => [e.simpleName, e.id]),
      );
      const elementIds = elements.map((e) => e.id);

      const toInsert: {
        boothElementId: string;
        materialId: string;
        colour: string | null;
        market: string | null;
        quantity: string;
      }[] = [];
      let modelOk = true;

      for (const line of lines) {
        const materialId = materialByCode.get(line.materialCode);
        if (!materialId) {
          result.skipped++;
          result.warnings.push({
            row: line.row,
            message: `Skipped unknown material_code "${line.materialCode}"`,
          });
          continue;
        }

        const boothElementId = elementBySimple.get(line.element);
        if (!boothElementId) {
          modelOk = false;
          result.ok = false;
          result.errors.push({
            row: line.row,
            message: `unknown element "${line.element}" for model ${boothModel}`,
          });
          continue;
        }

        toInsert.push({
          boothElementId,
          materialId,
          colour: line.colour,
          market: line.market,
          quantity: line.quantity,
        });
      }

      if (!modelOk) continue;

      await prisma.$transaction(
        async (tx) => {
          if (elementIds.length > 0) {
            await tx.mrpElementBomLine.deleteMany({
              where: { boothElementId: { in: elementIds } },
            });
          }

          if (toInsert.length > 0) {
            await tx.mrpElementBomLine.createMany({ data: toInsert });
          }
        },
        { timeout: 60_000 },
      );

      result.created += toInsert.length;
    } catch (err) {
      result.ok = false;
      result.errors.push({
        row: 0,
        message: `${boothModel}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return result;
}
