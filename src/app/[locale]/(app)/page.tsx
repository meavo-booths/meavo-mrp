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
import { ensureStockReferenceData, listBalances } from "@/lib/stock";
import { formatQuantity } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

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
  const balances = await listBalances();

  const lowStock = balances.filter((b) => Number(b.quantity) <= 0);

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
            <CardDescription>{t("stats.materials")}</CardDescription>
            <CardTitle className="text-2xl">{balances.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-accent-yellow border-0">
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.tracked")}</CardDescription>
            <CardTitle className="text-2xl">
              {balances.filter((b) => Number(b.quantity) > 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-accent-pink col-span-2 border-0 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.shortages")}</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {lowStock.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("balancesTitle")}</CardTitle>
          <CardDescription>{t("balancesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("balancesEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
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
                  {balances.map((row) => (
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
                          Number(row.quantity) <= 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatQuantity(row.quantity, locale, row.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">{t("sheetsNote")}</p>
    </div>
  );
}
