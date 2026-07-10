import { setRequestLocale, getTranslations } from "next-intl/server";

import { CsvDataPanel } from "@/components/stock/csv-data-panel";
import { InventoryPanel } from "@/components/stock/inventory-panel";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { getDefaultWarehouseId } from "@/lib/stock";
import { listManufacturingBatchOptions } from "@/lib/stock/inventory-batch";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();

  const t = await getTranslations("stock.inventory");
  const tc = await getTranslations("stock.csv");
  const defaultWarehouseId = await getDefaultWarehouseId();

  const [warehouses, batches, recentCountRows] = await Promise.all([
    prisma.mrpWarehouse.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listManufacturingBatchOptions(),
    prisma.mrpInventoryCount.findMany({
      select: {
        countDate: true,
        systemQuantity: true,
        countedQuantity: true,
        variance: true,
        countedThroughBatchLabel: true,
        material: { select: { name: true, unit: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: { countDate: "desc" },
      take: 20,
    }),
  ]);
  const recentCounts = recentCountRows.map((row) => ({
    countDate: row.countDate,
    systemQuantity: row.systemQuantity.toString(),
    countedQuantity: row.countedQuantity.toString(),
    variance: row.variance.toString(),
    countedThroughBatchLabel: row.countedThroughBatchLabel,
    materialName: row.material.name,
    unit: row.material.unit,
    warehouseName: row.warehouse.name,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-6">
        <CsvDataPanel
          kind="opening-stock"
          labels={{
            title: tc("openingTitle"),
            description: tc("openingDescription"),
            help: tc("openingHelp"),
            template: tc("template"),
            export: tc("export"),
            upload: tc("upload"),
            uploading: tc("uploading"),
            created: tc("created"),
            updated: tc("updated"),
            skipped: tc("skipped"),
            errors: tc("errors"),
            warnings: tc("warnings"),
            row: tc("row"),
          }}
        />
      </div>

      <InventoryPanel
        warehouses={warehouses}
        batches={batches}
        defaultWarehouseId={defaultWarehouseId}
        initialCounts={recentCounts}
        locale={locale}
        labels={{
          formTitle: t("formTitle"),
          formDescription: t("formDescription"),
          historyTitle: t("historyTitle"),
          historyDescription: t("historyDescription"),
          historyEmpty: t("historyEmpty"),
          variance: t("variance"),
          material: t("material"),
          materialSearchPlaceholder: t("materialSearchPlaceholder"),
          materialUnknown: t("materialUnknown"),
          warehouse: t("warehouse"),
          countDate: t("countDate"),
          counted: t("counted"),
          countedThroughBatch: t("countedThroughBatch"),
          countedThroughBatchHint: t("countedThroughBatchHint"),
          countedThroughBatchManual: t("countedThroughBatchManual"),
          countedThroughBatchNone: t("countedThroughBatchNone"),
          notes: t("notes"),
          submit: t("submit"),
          error: t("error"),
        }}
      />
    </div>
  );
}
