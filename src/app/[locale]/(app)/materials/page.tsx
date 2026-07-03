import { asc, eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { BomMissingMaterialsBanner } from "@/components/stock/bom-missing-banner";
import { CsvDataPanel } from "@/components/stock/csv-data-panel";
import { MaterialForm } from "@/components/stock/material-form";
import { MaterialRow } from "@/components/stock/material-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/lib/db/client";
import { requireSessionUser } from "@/lib/auth/session";
import { refreshBomMissingMaterialsForUi } from "@/lib/stock/bom-missing";
import { ensureStockReferenceData } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();
  await ensureStockReferenceData();

  const t = await getTranslations("stock.materials");
  const tc = await getTranslations("stock.csv");
  const [materials, bomMissing] = await Promise.all([
    db
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.isActive, true))
      .orderBy(asc(schema.materials.code)),
    refreshBomMissingMaterialsForUi(),
  ]);

  const csvLabels = {
    title: tc("materialsTitle"),
    description: tc("materialsDescription"),
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
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BomMissingMaterialsBanner
        items={bomMissing}
        title={t("bomMissingTitle")}
        description={t("bomMissingDescription", { count: bomMissing.length })}
        lineLabel={t("bomMissingLines")}
      />

      <div className="mb-6">
        <CsvDataPanel kind="materials" labels={csvLabels} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
            <CardDescription>{t("addDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialForm
              labels={{
                code: t("code"),
                name: t("name"),
                unit: t("unit"),
                unitPrice: t("unitPrice"),
                submit: t("submit"),
                success: t("success"),
                error: t("error"),
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("listTitle")}</CardTitle>
            <CardDescription>{t("listDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul>
                {materials.map((m) => (
                  <MaterialRow
                    key={m.id}
                    material={m}
                    locale={locale}
                    labels={{
                      edit: t("edit"),
                      save: t("save"),
                      cancel: t("cancel"),
                      code: t("code"),
                      name: t("name"),
                      unit: t("unit"),
                      unitPrice: t("unitPrice"),
                      error: t("error"),
                    }}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
