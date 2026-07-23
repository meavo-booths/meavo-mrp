import { setRequestLocale, getTranslations } from "next-intl/server";

import { BoothCostBrowser } from "@/components/stock/booth-cost-browser";
import { requireSessionUser } from "@/lib/auth/session";
import { listBoothModelsWithRecipes } from "@/lib/stock/bom-recipe-view";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ model?: string }>;
}) {
  const { locale } = await params;
  const { model: modelParam } = await searchParams;
  setRequestLocale(locale);
  await requireSessionUser();

  const t = await getTranslations("stock.costs");
  const models = await listBoothModelsWithRecipes();
  const selectedModel = modelParam?.trim() || null;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BoothCostBrowser
        models={models}
        selectedModel={selectedModel}
        labels={{
          back: t("back"),
          selectModel: t("selectModel"),
          selectModelHint: t("selectModelHint"),
          panels: t("panels"),
          bomLines: t("bomLines"),
          noModels: t("empty"),
          loading: t("loading"),
          loadError: t("loadError"),
          notFound: t("notFound"),
          colour: t("colour"),
          market: t("market"),
          marketDomestic: t("marketDomestic"),
          marketUs: t("marketUs"),
          noColourOption: t("noColourOption"),
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
