import { setRequestLocale, getTranslations } from "next-intl/server";
import { Package, ClipboardList, Truck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/session";
import {
  ensureStockReferenceData,
  getBalanceStats,
  getTopMaterialHomeStats,
  listBalances,
  listTopMaterialHomeRows,
} from "@/lib/stock";
import { getTopMaterialCodes } from "@/lib/settings/top-materials";
import { formatQuantity } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const HOME_BALANCES_LIMIT = 50;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();
  await ensureStockReferenceData();

  const t = await getTranslations("home");
  const topCodes = await getTopMaterialCodes();
  const usingTopMaterials = topCodes.length > 0;

  const [stats, topRows, fallbackBalances] = await Promise.all([
    usingTopMaterials ? getTopMaterialHomeStats() : getBalanceStats(),
    usingTopMaterials ? listTopMaterialHomeRows() : Promise.resolve([]),
    usingTopMaterials ?
      Promise.resolve([])
    : listBalances({
        take: HOME_BALANCES_LIMIT,
        orderBy: "quantity",
        baselinedOnly: true,
      }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-10">
        <h1 className="text-page-title">{t("welcome")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("description")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/stock/receipt">
              <Truck className="h-4 w-4" />
              {t("ctaReceipt")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/inventory">
              <ClipboardList className="h-4 w-4" />
              {t("ctaInventory")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/materials">
              <Package className="h-4 w-4" />
              {t("ctaMaterials")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="surface-accent-blue border-0">
          <CardHeader className="pb-2">
            <CardDescription>
              {usingTopMaterials ?
                t("stats.topMaterials")
              : t("stats.materials")}
            </CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-accent-yellow border-0">
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.tracked")}</CardDescription>
            <CardTitle className="text-2xl">{stats.tracked}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-accent-pink col-span-2 border-0 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.shortages")}</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {stats.shortages}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            {usingTopMaterials ? t("topMaterialsTitle") : t("balancesTitle")}
          </CardTitle>
          <CardDescription>
            {usingTopMaterials ?
              t("topMaterialsDescription")
            : t("balancesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usingTopMaterials ?
            topRows.length === 0 ?
              <p className="text-sm text-muted-foreground">
                {t("topMaterialsEmpty")}
              </p>
            : <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">
                        {t("colMaterial")}
                      </th>
                      <th className="pb-2 pr-4 font-medium">
                        {t("colWarehouse")}
                      </th>
                      <th className="pb-2 font-medium text-right">
                        {t("colQuantity")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRows.map((row) => (
                      <tr
                        key={row.code}
                        className="border-b last:border-0"
                      >
                        <td className="py-2.5 pr-4">
                          <span className="font-medium">
                            {row.materialName ?? row.code}
                          </span>
                          {row.found && row.materialName ? (
                            <span className="ml-2 text-muted-foreground">
                              {row.code}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {row.warehouseName}
                        </td>
                        <td
                          className={`py-2.5 text-right tabular-nums ${
                            row.isShortage ? "text-destructive" : ""
                          }`}
                        >
                          {!row.found ?
                            t("topMaterialUnknown")
                          : !row.hasBaseline ?
                            t("topMaterialNotCounted")
                          : row.quantity != null ?
                            formatQuantity(row.quantity, locale, row.unit)
                          : t("topMaterialNotCounted")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("topMaterialsManageHint")}{" "}
                  <Link
                    href="/settings"
                    className="underline underline-offset-2"
                  >
                    {t("topMaterialsManageLink")}
                  </Link>
                </p>
              </div>

          : fallbackBalances.length === 0 ?
            <p className="text-sm text-muted-foreground">{t("balancesEmpty")}</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t("colMaterial")}</th>
                    <th className="pb-2 pr-4 font-medium">{t("colWarehouse")}</th>
                    <th className="pb-2 font-medium text-right">
                      {t("colQuantity")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fallbackBalances.map((row) => (
                    <tr key={row.balanceId} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium">{row.materialName}</span>
                        {row.materialCode ? (
                          <span className="ml-2 text-muted-foreground">
                            {row.materialCode}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {row.warehouseName}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${
                          row.isShortage ? "text-destructive" : ""
                        }`}
                      >
                        {formatQuantity(row.quantity, locale, row.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats.total > fallbackBalances.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("balancesShowingLowest", {
                    shown: fallbackBalances.length,
                    total: stats.total,
                  })}
                </p>
              ) : null}
            </div>
          }
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">{t("sheetsNote")}</p>
    </div>
  );
}
