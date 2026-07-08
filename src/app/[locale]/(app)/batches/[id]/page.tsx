import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { BatchDetailView } from "@/components/stock/batch-detail-view";
import { requireSessionUser } from "@/lib/auth/session";
import { getManufacturingBatchDetail } from "@/lib/stock/manufacturing-batches";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireSessionUser();

  const batch = await getManufacturingBatchDetail(id);
  if (!batch) notFound();

  const t = await getTranslations("stock.batches");

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-6">
      <BatchDetailView
        batch={batch}
        locale={locale}
        labels={{
          back: t("back"),
          model: t("columns.model"),
          warehouse: t("columns.warehouse"),
          qty: t("columns.qty"),
          completeness: t("columns.complete"),
          synced: t("columns.synced"),
          openSheet: t("openSheet"),
          noSheet: t("noSheet"),
          boothId: t("detail.boothId"),
          colour: t("detail.colour"),
          unitProgress: t("detail.unitProgress"),
          noUnits: t("detail.noUnits"),
          ticked: t("detail.ticked"),
          notTicked: t("detail.notTicked"),
          statusPlanned: t("status.planned"),
          statusInProduction: t("status.inProduction"),
          statusCompleted: t("status.completed"),
          statusCancelled: t("status.cancelled"),
        }}
      />
    </div>
  );
}
