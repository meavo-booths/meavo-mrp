import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { RecipeExceptionsSection } from "@/components/stock/recipe-exceptions-section";
import { prisma } from "@/lib/prisma";
import { listManufacturingBatchOptions } from "@/lib/stock/inventory-batch";
import { listRecipeExceptions } from "@/lib/stock/recipe-exceptions";

async function RecipeExceptionsContent({
  locale,
}: {
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "stock.recipes" });
  const te = await getTranslations({ locale, namespace: "stock.recipes.exceptions" });

  const [boothModels, materials, batches, activeExceptions] = await Promise.all([
    prisma.mrpBoothModel.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.mrpMaterial.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    listManufacturingBatchOptions(),
    listRecipeExceptions("active"),
  ]);

  return (
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
  );
}

export function RecipeExceptionsFallback() {
  return (
    <section className="mb-5">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
    </section>
  );
}

export function RecipeExceptionsPanel({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<RecipeExceptionsFallback />}>
      <RecipeExceptionsContent locale={locale} />
    </Suspense>
  );
}
