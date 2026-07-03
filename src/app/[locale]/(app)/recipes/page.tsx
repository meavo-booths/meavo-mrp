import { asc, eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { RecipeExceptionsSection } from "@/components/stock/recipe-exceptions-section";
import { RecipesBrowser } from "@/components/stock/recipes-browser";
import { RecipesPageShell } from "@/components/stock/recipes-page-shell";
import { db, schema } from "@/lib/db/client";
import { requireSessionUser } from "@/lib/auth/session";
import { ensureStockReferenceData } from "@/lib/stock";
import {
  getBoothModelRecipe,
  listBoothModelsWithRecipes,
} from "@/lib/stock/bom-recipe-view";
import { listManufacturingBatchOptions } from "@/lib/stock/inventory-batch";
import { listRecipeExceptions } from "@/lib/stock/recipe-exceptions";

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
  await ensureStockReferenceData();

  const t = await getTranslations("stock.recipes");
  const te = await getTranslations("stock.recipes.exceptions");
  const tc = await getTranslations("stock.csv");

  const [
    models,
    boothModels,
    materials,
    batches,
    activeExceptions,
  ] = await Promise.all([
    listBoothModelsWithRecipes(),
    db
      .select({ id: schema.boothModels.id, name: schema.boothModels.name })
      .from(schema.boothModels)
      .where(eq(schema.boothModels.isActive, true))
      .orderBy(asc(schema.boothModels.name)),
    db
      .select({
        id: schema.materials.id,
        code: schema.materials.code,
        name: schema.materials.name,
      })
      .from(schema.materials)
      .where(eq(schema.materials.isActive, true))
      .orderBy(asc(schema.materials.name)),
    listManufacturingBatchOptions(),
    listRecipeExceptions("active"),
  ]);
  const selectedModel = modelParam?.trim() ?? null;
  const recipe =
    selectedModel != null
      ? await getBoothModelRecipe(selectedModel)
      : null;

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
        <RecipeExceptionsSection
          models={boothModels}
          batches={batches}
          materials={materials}
          activeExceptions={activeExceptions}
          labels={{
            title: te("title"),
            addException: te("addException"),
            activeTitle: te("activeTitle"),
            activeEmpty: te("activeEmpty"),
            revert: te("revert"),
            name: te("name"),
            notes: te("notes"),
            models: te("models"),
            modelsHint: te("modelsHint"),
            scopeMarket: te("scopeMarket"),
            marketAll: te("marketAll"),
            marketDomestic: t("marketDomestic"),
            marketUs: t("marketUs"),
            scopeColour: te("scopeColour"),
            scopeColourHint: te("scopeColourHint"),
            panel: te("panel"),
            sourceLine: te("sourceLine"),
            sourceLinePlaceholder: te("sourceLinePlaceholder"),
            replacements: te("replacements"),
            addReplacement: te("addReplacement"),
            quantity: te("quantity"),
            batches: te("batches"),
            batchesHint: te("batchesHint"),
            batchLabel: te("batchLabel"),
            wholeBatch: te("wholeBatch"),
            boothIds: te("boothIds"),
            boothIdsHint: te("boothIdsHint"),
            addBatch: te("addBatch"),
            submit: te("submit"),
            cancel: te("cancel"),
            error: te("error"),
            material: t("columns.material"),
            materialSearchPlaceholder: te("materialSearchPlaceholder"),
            materialUnknown: te("materialUnknown"),
            wildcard: t("wildcard"),
          }}
        />
        <RecipesBrowser
        models={models}
        recipe={recipe}
        selectedModel={
          recipe != null || selectedModel == null ? selectedModel : null
        }
        labels={{
          back: t("back"),
          selectModel: t("selectModel"),
          selectModelHint: t("selectModelHint"),
          panels: t("panels"),
          bomLines: t("bomLines"),
          noModels: t("empty"),
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
