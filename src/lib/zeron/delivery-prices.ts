import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ZeronUnitPrice = {
  itemCode: string;
  averageUnitCost: number;
  latestUnitCost: number;
  deliveryCount: number;
};

type DeliveryPriceRow = {
  id: string;
  itemCode: string;
  unitCost: string;
  deliveryDate: Date;
};

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Average + latest unit cost per Zeron item code, matching Material Checker
 * `getMaterialsCatalog` rules (mean of all unitCost > 0; latest by deliveryDate).
 * Reads shared Neon `ZeronDeliveryRow` (not in @meavo/db Prisma models).
 */
export async function loadZeronUnitPricesByCodes(
  codes: string[],
): Promise<Map<string, ZeronUnitPrice>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const result = new Map<string, ZeronUnitPrice>();
  if (unique.length === 0) return result;

  const rows = await prisma.$queryRaw<DeliveryPriceRow[]>(Prisma.sql`
    SELECT id, "itemCode", "unitCost", "deliveryDate"
    FROM "ZeronDeliveryRow"
    WHERE "itemCode" IN (${Prisma.join(unique)})
  `);

  const byCode = new Map<string, DeliveryPriceRow[]>();
  for (const row of rows) {
    const list = byCode.get(row.itemCode) ?? [];
    list.push(row);
    byCode.set(row.itemCode, list);
  }

  for (const [itemCode, codeRows] of byCode) {
    const prices = codeRows.map((r) => toNumber(r.unitCost)).filter((p) => p > 0);
    const averageUnitCost =
      prices.length > 0
        ? prices.reduce((sum, value) => sum + value, 0) / prices.length
        : 0;

    const latest = [...codeRows].sort((a, b) => {
      const byDate = b.deliveryDate.getTime() - a.deliveryDate.getTime();
      if (byDate !== 0) return byDate;
      return b.id.localeCompare(a.id);
    })[0]!;

    result.set(itemCode, {
      itemCode,
      averageUnitCost,
      latestUnitCost: toNumber(latest.unitCost),
      deliveryCount: codeRows.length,
    });
  }

  return result;
}
