import { setRequestLocale, getTranslations } from "next-intl/server";

import { requireSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ElectricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();

  const t = await getTranslations("stock.electrics");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
      </div>
    </div>
  );
}
