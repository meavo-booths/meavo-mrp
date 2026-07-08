import { setRequestLocale, getTranslations } from "next-intl/server";

import { RecipeExceptionsPanel } from "@/components/stock/recipe-exceptions-panel";
import { RecipesBrowser } from "@/components/stock/recipes-browser";
import { RecipesPageShell } from "@/components/stock/recipes-page-shell";
import { requireSessionUser } from "@/lib/auth/session";
import { listBoothModelsWithRecipes } from "@/lib/stock/bom-recipe-view";

export const dynamic = "force-dynamic";

export default async function RecipesPage({
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

  const t = await getTranslations("stock.recipes");
  const tc = await getTranslations("stock.csv");
  const models = await listBoothModelsWithRecipes();
  const selectedModel = modelParam?.trim() || null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <RecipesPageShell
        updateLabel={t("update")}
        csvLabels={{
          panelListTitle: tc("panelListTitle"),
          panelListDescription: tc("panelListDescription"),
          recipesCsvTitle: tc("recipesCsvTitle"),
          recipesCsvDescription: tc("recipesCsvDescription"),
          recipesCsvFooterHelp: tc("recipesCsvFooterHelp"),
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
        title={
          <div>
            <h1 className="text-page-title">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        }
      >
        <RecipeExceptionsPanel locale={locale} />
        <RecipesBrowser
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
            topMaterialsTitle: t("topMaterialsTitle"),
            topMaterialsHint: t("topMaterialsHint"),
            recipeTitle: t("recipeTitle"),
            recipeDescription: t("recipeDescription"),
            materialCount: t("materialCount"),
            wildcard: t("wildcard"),
            columns: {
              material: t("columns.material"),
              colour: t("columns.colour"),
              market: t("columns.market"),
              qty: t("columns.qty"),
              panels: t("columns.panels"),
            },
          }}
        />
      </RecipesPageShell>
    </div>
  );
}
