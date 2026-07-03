import { asc, desc, eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { CsvDataPanel } from "@/components/stock/csv-data-panel";
import { InventoryForm } from "@/components/stock/inventory-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/lib/db/client";
import { requireSessionUser } from "@/lib/auth/session";
import { ensureStockReferenceData, getDefaultWarehouseId } from "@/lib/stock";
import { listManufacturingBatchOptions } from "@/lib/stock/inventory-batch";
import { formatDate, formatQuantity } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();
  await ensureStockReferenceData();

  const t = await getTranslations("stock.inventory");
  const tc = await getTranslations("stock.csv");
  const defaultWarehouseId = await getDefaultWarehouseId();

  const [materials, warehouses, batches, recentCounts] = await Promise.all([
    db
      .select({
        id: schema.materials.id,
        name: schema.materials.name,
        code: schema.materials.code,
      })
      .from(schema.materials)
      .where(eq(schema.materials.isActive, true))
      .orderBy(asc(schema.materials.name)),
    db
      .select({ id: schema.warehouses.id, name: schema.warehouses.name })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.isActive, true))
      .orderBy(asc(schema.warehouses.name)),
    listManufacturingBatchOptions(),
    db
      .select({
        countDate: schema.inventoryCounts.countDate,
        systemQuantity: schema.inventoryCounts.systemQuantity,
        countedQuantity: schema.inventoryCounts.countedQuantity,
        variance: schema.inventoryCounts.variance,
        countedThroughBatchLabel: schema.inventoryCounts.countedThroughBatchLabel,
        materialName: schema.materials.name,
        unit: schema.materials.unit,
        warehouseName: schema.warehouses.name,
      })
      .from(schema.inventoryCounts)
      .innerJoin(
        schema.materials,
        eq(schema.inventoryCounts.materialId, schema.materials.id),
      )
      .innerJoin(
        schema.warehouses,
        eq(schema.inventoryCounts.warehouseId, schema.warehouses.id),
      )
      .orderBy(desc(schema.inventoryCounts.countDate))
      .limit(20),
  ]);

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("formTitle")}</CardTitle>
            <CardDescription>{t("formDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryForm
              materials={materials}
              warehouses={warehouses}
              batches={batches}
              defaultWarehouseId={defaultWarehouseId}
            labels={{
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("historyTitle")}</CardTitle>
            <CardDescription>{t("historyDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {recentCounts.map((row, i) => (
                  <li key={i} className="space-y-1 py-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{row.materialName}</span>
                      <span className="text-muted-foreground">
                        {formatDate(row.countDate, locale)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{row.warehouseName}</p>
                    {row.countedThroughBatchLabel ? (
                      <p className="text-muted-foreground">
                        {t("countedThroughBatch")}: {row.countedThroughBatchLabel}
                      </p>
                    ) : null}
                    <p>
                      {t("counted")}:{" "}
                      {formatQuantity(row.countedQuantity, locale, row.unit)}
                      {Number(row.systemQuantity) !== 0 &&
                      Number(row.variance) !== 0 ? (
                        <>
                          {" · "}
                          {t("variance")}:{" "}
                          <span
                            className={
                              Number(row.variance) < 0
                                ? "text-destructive"
                                : "text-green-600"
                            }
                          >
                            {formatQuantity(row.variance, locale, row.unit)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
