import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";

import { Link } from "@/i18n/navigation";
import { BomMissingMaterialsBanner } from "@/components/stock/bom-missing-banner";
import { InvalidMaterialUnitsBanner } from "@/components/stock/invalid-material-units-banner";
import { CsvDataPanel } from "@/components/stock/csv-data-panel";
import { MaterialForm } from "@/components/stock/material-form";
import { MaterialsList } from "@/components/stock/materials-list";
import { TopMaterialsSection } from "@/components/stock/top-materials-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { listBomMissingMaterials } from "@/lib/stock/bom-missing";
import { listMaterialsWithInvalidUnits } from "@/lib/stock/material-unit-issues";
import { ensureStockReferenceData, listActiveWarehouses, listTopMaterialHomeRows } from "@/lib/stock";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function MaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();
  await ensureStockReferenceData();

  const t = await getTranslations("stock.materials");
  const tc = await getTranslations("stock.csv");

  const { q: rawQuery, page: rawPage } = await searchParams;
  const q = rawQuery?.trim() ?? "";
  const requestedPage = Math.max(1, Number(rawPage) || 1);

  const where: Prisma.MrpMaterialWhereInput = {
    isActive: true,
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, bomMissing, invalidUnits, topMaterials, warehouses] =
    await Promise.all([
    prisma.mrpMaterial.count({ where }),
    listBomMissingMaterials(),
    listMaterialsWithInvalidUnits(),
    listTopMaterialHomeRows(),
    listActiveWarehouses(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const materialRows = await prisma.mrpMaterial.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      unitPriceEur: true,
      currentQuantity: true,
    },
    orderBy: { code: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const materials = materialRows.map((m) => ({
    ...m,
    unitPriceEur: m.unitPriceEur?.toString() ?? null,
    currentQuantity: m.currentQuantity.toString(),
  }));

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + materials.length;

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

      <InvalidMaterialUnitsBanner
        items={invalidUnits}
        title={t("invalidUnitsTitle")}
        description={t("invalidUnitsDescription", {
          count: invalidUnits.length,
        })}
        suggestedLabel={t("invalidUnitsSuggested")}
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
            <form method="get" className="mb-4 flex gap-2">
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
              />
              <Button type="submit" variant="outline">
                {t("search")}
              </Button>
            </form>

            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <MaterialsList
                materials={materials}
                locale={locale}
                invalidUnitIds={new Set(invalidUnits.map((item) => item.id))}
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
            )}

            {total > PAGE_SIZE ? (
              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <p className="text-muted-foreground">
                  {t("showingRange", { from, to, total })}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: "/materials",
                          query: { ...(q ? { q } : {}), page: page - 1 },
                        }}
                      >
                        {t("pagePrev")}
                      </Link>
                    </Button>
                  ) : null}
                  {page < pageCount ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: "/materials",
                          query: { ...(q ? { q } : {}), page: page + 1 },
                        }}
                      >
                        {t("pageNext")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <TopMaterialsSection
        rows={topMaterials}
        warehouses={warehouses}
        locale={locale}
        defaultOpen={topMaterials.length > 0}
        labels={{
          title: t("top20Title"),
          description: t("top20Description"),
          empty: t("top20Empty"),
          configure: t("top20Configure"),
          colMaterial: t("top20ColMaterial"),
          colQuantity: t("top20ColQuantity"),
          warehouseAll: t("top20WarehouseAll"),
          warehouseTotal: t("top20WarehouseTotal"),
          notCounted: t("top20NotCounted"),
          unknownCode: t("top20UnknownCode"),
        }}
      />
    </div>
  );
}
