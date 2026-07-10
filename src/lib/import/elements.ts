import "server-only";

import { BOOTH_ELEMENTS_TEMPLATE } from "@/lib/import/booth-elements-config";
import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import { ELEMENTS_COLUMNS, parseBoolean } from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";

export function elementsTemplateCsv(): string {
  const rows = BOOTH_ELEMENTS_TEMPLATE.map((e) => [
    e.boothModel,
    e.sheetHeader,
    e.simpleName,
    String(e.sortOrder),
    e.active ? "TRUE" : "FALSE",
  ]);
  return serializeCsv([...ELEMENTS_COLUMNS], rows);
}

export async function exportElementsCsv(): Promise<string> {
  const rows = await prisma.mrpBoothElement.findMany({
    include: { boothModel: { select: { name: true } } },
    orderBy: [{ boothModel: { name: "asc" } }, { sortOrder: "asc" }],
  });

  return serializeCsv(
    [...ELEMENTS_COLUMNS],
    rows.map((r) => [
      r.boothModel.name,
      r.sheetHeader,
      r.simpleName,
      String(r.sortOrder),
      r.isActive ? "TRUE" : "FALSE",
    ]),
  );
}

export async function importElementsCsv(text: string): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  type ParsedRow = {
    rowNum: number;
    boothModel: string;
    sheetHeader: string;
    simpleName: string;
    sortOrder: number;
    isActive: boolean;
  };
  const parsedRows: ParsedRow[] = [];

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const boothModel = raw.booth_model?.trim();
    const sheetHeader = raw.sheet_header ?? "";
    const simpleName = raw.simple_name?.trim();

    if (!boothModel && !sheetHeader.trim() && !simpleName) continue;

    if (!boothModel || !sheetHeader.trim() || !simpleName) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: "booth_model, sheet_header, and simple_name are required",
      });
      continue;
    }

    parsedRows.push({
      rowNum,
      boothModel,
      sheetHeader,
      simpleName,
      sortOrder: raw.sort_order?.trim() ? Number.parseInt(raw.sort_order, 10) : 0,
      isActive: parseBoolean(raw.active ?? "", true),
    });
  }

  if (parsedRows.length === 0) return result;

  try {
    // Resolve all booth models with one read (+ one createMany for new names).
    const modelNames = [...new Set(parsedRows.map((r) => r.boothModel))];
    const existingModels = await prisma.mrpBoothModel.findMany({
      where: { name: { in: modelNames } },
      select: { id: true, name: true },
    });
    const missingNames = modelNames.filter(
      (name) => !existingModels.some((m) => m.name === name),
    );
    if (missingNames.length > 0) {
      await prisma.mrpBoothModel.createMany({
        data: missingNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    const models = missingNames.length
      ? await prisma.mrpBoothModel.findMany({
          where: { name: { in: modelNames } },
          select: { id: true, name: true },
        })
      : existingModels;
    const modelIdByName = new Map(models.map((m) => [m.name, m.id]));

    // Preload all elements for the involved models.
    const existingElements = await prisma.mrpBoothElement.findMany({
      where: { boothModelId: { in: [...modelIdByName.values()] } },
      select: {
        id: true,
        boothModelId: true,
        sheetHeader: true,
        simpleName: true,
        sortOrder: true,
        isActive: true,
      },
    });
    const byHeader = new Map(
      existingElements.map((e) => [`${e.boothModelId}\u0000${e.sheetHeader}`, e]),
    );
    const bySimple = new Map(
      existingElements.map((e) => [`${e.boothModelId}\u0000${e.simpleName}`, e]),
    );

    type ElementCreate = {
      id: string;
      boothModelId: string;
      sheetHeader: string;
      simpleName: string;
      sortOrder: number;
      isActive: boolean;
    };
    const creates: ElementCreate[] = [];
    const updates: Array<{
      id: string;
      data: Partial<Pick<ElementCreate, "sheetHeader" | "simpleName">> &
        Pick<ElementCreate, "sortOrder" | "isActive">;
    }> = [];

    for (const row of parsedRows) {
      const boothModelId = modelIdByName.get(row.boothModel)!;
      const headerKey = `${boothModelId}\u0000${row.sheetHeader}`;
      const simpleKey = `${boothModelId}\u0000${row.simpleName}`;

      const matchByHeader = byHeader.get(headerKey);
      if (matchByHeader) {
        if (
          matchByHeader.simpleName !== row.simpleName ||
          matchByHeader.sortOrder !== row.sortOrder ||
          matchByHeader.isActive !== row.isActive
        ) {
          updates.push({
            id: matchByHeader.id,
            data: {
              simpleName: row.simpleName,
              sortOrder: row.sortOrder,
              isActive: row.isActive,
            },
          });
          matchByHeader.simpleName = row.simpleName;
          matchByHeader.sortOrder = row.sortOrder;
          matchByHeader.isActive = row.isActive;
          bySimple.set(simpleKey, matchByHeader);
        }
        result.updated++;
        continue;
      }

      const matchBySimple = bySimple.get(simpleKey);
      if (matchBySimple) {
        if (
          matchBySimple.sheetHeader !== row.sheetHeader ||
          matchBySimple.sortOrder !== row.sortOrder ||
          matchBySimple.isActive !== row.isActive
        ) {
          updates.push({
            id: matchBySimple.id,
            data: {
              sheetHeader: row.sheetHeader,
              sortOrder: row.sortOrder,
              isActive: row.isActive,
            },
          });
          matchBySimple.sheetHeader = row.sheetHeader;
          matchBySimple.sortOrder = row.sortOrder;
          matchBySimple.isActive = row.isActive;
          byHeader.set(headerKey, matchBySimple);
        }
        result.updated++;
        continue;
      }

      // Placeholder (id "") registered in both maps so later duplicate CSV rows
      // mutate this same object before it is inserted.
      const created = {
        id: "",
        boothModelId,
        sheetHeader: row.sheetHeader,
        simpleName: row.simpleName,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      };
      byHeader.set(headerKey, created);
      bySimple.set(simpleKey, created);
      creates.push(created);
      result.created++;
    }

    if (creates.length > 0) {
      await prisma.mrpBoothElement.createMany({
        data: creates.map(({ id: _id, ...data }) => data),
        skipDuplicates: true,
      });
    }
    if (updates.length > 0) {
      await prisma.$transaction(
        updates
          .filter((u) => u.id !== "")
          .map((u) =>
            prisma.mrpBoothElement.update({
              where: { id: u.id },
              data: u.data,
            }),
          ),
      );
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      row: 0,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
