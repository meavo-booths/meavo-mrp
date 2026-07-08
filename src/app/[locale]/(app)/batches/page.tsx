import { setRequestLocale, getTranslations } from "next-intl/server";

import { BatchesTable } from "@/components/stock/batches-table";
import { requireSessionUser } from "@/lib/auth/session";
import { listManufacturingBatches } from "@/lib/stock/manufacturing-batches";

export const dynamic = "force-dynamic";

export default async function BatchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();

  const t = await getTranslations("stock.batches");
  const batches = await listManufacturingBatches();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BatchesTable
        batches={batches}
        locale={locale}
        labels={{
          filterAll: t("filterAll"),
          statusPlanned: t("status.planned"),
          statusInProduction: t("status.inProduction"),
          statusCompleted: t("status.completed"),
          statusCancelled: t("status.cancelled"),
          colName: t("columns.name"),
          colStatus: t("columns.status"),
          colModel: t("columns.model"),
          colQty: t("columns.qty"),
          colWarehouse: t("columns.warehouse"),
          colUnits: t("columns.units"),
          colComplete: t("columns.complete"),
          colSynced: t("columns.synced"),
          colSheet: t("columns.sheet"),
          openSheet: t("openSheet"),
          empty: t("empty"),
          noSheet: t("noSheet"),
        }}
      />
    </div>
  );
}
