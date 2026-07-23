import { setRequestLocale, getTranslations } from "next-intl/server";

import { BoothCostBrowser } from "@/components/stock/booth-cost-browser";
import { requireSessionUser } from "@/lib/auth/session";
import { listBoothModelsWithRecipes } from "@/lib/stock/bom-recipe-view";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();

  const t = await getTranslations("stock.costs");
  const models = await listBoothModelsWithRecipes();

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BoothCostBrowser
        models={models}
        labels={{
          model: t("model"),
          colour: t("colour"),
          noModels: t("empty"),
          noColourOption: t("noColourOption"),
          loading: t("loading"),
          loadError: t("loadError"),
          notFound: t("notFound"),
          materialCount: t("materialCount"),
          totalAverage: t("totalAverage"),
          totalLatest: t("totalLatest"),
          missingPrices: t("missingPrices"),
          recipeTitle: t("recipeTitle"),
          recipeDescription: t("recipeDescription"),
          empty: t("noMaterials"),
          columns: {
            material: t("columns.material"),
            qty: t("columns.qty"),
            avgUnit: t("columns.avgUnit"),
            latestUnit: t("columns.latestUnit"),
            avgLine: t("columns.avgLine"),
            latestLine: t("columns.latestLine"),
            panels: t("columns.panels"),
          },
        }}
      />
    </div>
  );
}
