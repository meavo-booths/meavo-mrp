"use client";

import * as React from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoothMarket } from "@/lib/import/schemas";
import {
  aggregateRecipeMaterials,
  formatRecipeQty,
  topMaterialsByQuantity,
} from "@/lib/stock/bom-recipe-filter";
import type {
  BoothModelRecipe,
  BoothModelSummary,
} from "@/lib/stock/bom-recipe-view";
import { cn } from "@/lib/utils/cn";

type Labels = {
  back: string;
  selectModel: string;
  selectModelHint: string;
  panels: string;
  bomLines: string;
  noModels: string;
  loading: string;
  loadError: string;
  notFound: string;
  colour: string;
  market: string;
  marketDomestic: string;
  marketUs: string;
  noColourOption: string;
  topMaterialsTitle: string;
  topMaterialsHint: string;
  recipeTitle: string;
  recipeDescription: string;
  materialCount: string;
  wildcard: string;
  columns: {
    material: string;
    colour: string;
    market: string;
    qty: string;
    panels: string;
  };
};

type Props = {
  models: BoothModelSummary[];
  selectedModel: string | null;
  labels: Labels;
};

function CompactTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border/70 bg-background/50",
        className,
      )}
    >
      <table className="w-full text-xs">{children}</table>
    </div>
  );
}

function defaultRecipeColour(colours: string[]): string | null {
  if (colours.length === 0) return null;
  return colours.find((c) => c === "Pure White") ?? colours[0] ?? null;
}

function RecipeDetail({
  recipe,
  labels,
  onBack,
}: {
  recipe: BoothModelRecipe;
  labels: Labels;
  onBack: () => void;
}) {
  const [colour, setColour] = React.useState<string | null>(() =>
    defaultRecipeColour(recipe.availableColours),
  );
  const [market, setMarket] = React.useState<BoothMarket>(
    recipe.availableMarkets.includes("default")
      ? "default"
      : recipe.availableMarkets[0] ?? "default",
  );

  React.useEffect(() => {
    setColour(defaultRecipeColour(recipe.availableColours));
  }, [recipe.modelName, recipe.availableColours]);

  const aggregated = React.useMemo(
    () => aggregateRecipeMaterials(recipe.panels, colour, market),
    [recipe.panels, colour, market],
  );
  const topMaterials = React.useMemo(
    () => topMaterialsByQuantity(aggregated),
    [aggregated],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 px-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {labels.back}
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">{recipe.modelName}</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.colour}
          </p>
          <Select
            value={colour ?? "__none__"}
            onValueChange={(v) => setColour(v === "__none__" ? null : v)}
            disabled={recipe.availableColours.length === 0}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={labels.noColourOption} />
            </SelectTrigger>
            <SelectContent>
              {recipe.availableColours.length === 0 ? (
                <SelectItem value="__none__">{labels.noColourOption}</SelectItem>
              ) : (
                recipe.availableColours.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.market}
          </p>
          <Select
            value={market}
            onValueChange={(v) => setMarket(v as BoothMarket)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{labels.marketDomestic}</SelectItem>
              <SelectItem value="US">{labels.marketUs}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="pb-0.5 text-xs text-muted-foreground">
          {aggregated.length} {labels.materialCount}
        </p>
      </div>

      {topMaterials.length > 0 ? (
        <section className="space-y-1.5">
          <div>
            <h3 className="text-sm font-semibold">{labels.topMaterialsTitle}</h3>
            <p className="text-[11px] text-muted-foreground">
              {labels.topMaterialsHint}
            </p>
          </div>
          <CompactTable>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-8 px-2 py-1 font-medium">#</th>
                <th className="px-2 py-1 font-medium">{labels.columns.material}</th>
                <th className="px-2 py-1 text-right font-medium">
                  {labels.columns.qty}
                </th>
              </tr>
            </thead>
            <tbody>
              {topMaterials.map((item, index) => (
                <tr
                  key={item.materialCode}
                  className="border-b border-border/40 last:border-0 odd:bg-background/40"
                >
                  <td className="px-2 py-0.5 tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-2 py-0.5">
                    <span className="font-medium">{item.materialCode}</span>
                    <span className="ml-1.5 text-muted-foreground">
                      {item.materialName}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 text-right tabular-nums">
                    {formatRecipeQty(item.totalQuantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </CompactTable>
        </section>
      ) : null}

      <section className="space-y-1.5">
        <div>
          <h3 className="text-sm font-semibold">{labels.recipeTitle}</h3>
          <p className="text-[11px] text-muted-foreground">
            {labels.recipeDescription}
          </p>
        </div>
        <CompactTable>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-2 py-1 font-medium">{labels.columns.material}</th>
              <th className="px-2 py-1 text-right font-medium">
                {labels.columns.qty}
              </th>
              <th className="px-2 py-1 font-medium">{labels.columns.panels}</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-muted-foreground">
                  —
                </td>
              </tr>
            ) : (
              aggregated.map((item) => (
                <tr
                  key={item.materialCode}
                  className="border-b border-border/40 last:border-0 odd:bg-muted/20"
                >
                  <td className="px-2 py-0.5">
                    <span className="font-medium">{item.materialCode}</span>
                    <span className="ml-1.5 text-muted-foreground">
                      {item.materialName}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 text-right tabular-nums">
                    {formatRecipeQty(item.totalQuantity)}
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-0.5 text-muted-foreground">
                    {item.panels.join(", ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </CompactTable>
      </section>
    </div>
  );
}

export function RecipesBrowser({
  models,
  selectedModel,
  labels,
}: Props) {
  const router = useRouter();
  const [recipe, setRecipe] = React.useState<BoothModelRecipe | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedModel) {
      setRecipe(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setRecipe(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/recipes/${encodeURIComponent(selectedModel)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          if (res.status === 404) {
            setLoadError(labels.notFound);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as BoothModelRecipe;
        setRecipe(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof Error ? err.message : labels.loadError,
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [labels.loadError, labels.notFound, selectedModel]);

  if (selectedModel) {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1.5 px-2"
              onClick={() => router.push("/recipes")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {labels.back}
            </Button>
            <h2 className="text-xl font-semibold tracking-tight">
              {selectedModel}
            </h2>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="h-8 w-full max-w-md animate-pulse rounded-md bg-muted" />
            <div className="h-40 animate-pulse rounded-md bg-muted/70" />
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          </div>
        </div>
      );
    }

    if (loadError || !recipe) {
      return (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 px-2"
            onClick={() => router.push("/recipes")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {labels.back}
          </Button>
          <p className="text-sm text-destructive">
            {loadError ?? labels.notFound}
          </p>
        </div>
      );
    }

    return (
      <RecipeDetail
        recipe={recipe}
        labels={labels}
        onBack={() => router.push("/recipes")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{labels.selectModel}</h2>
        <p className="text-xs text-muted-foreground">{labels.selectModelHint}</p>
      </div>

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.noModels}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {models.map((model) => (
            <Link
              key={model.name}
              href={`/recipes?model=${encodeURIComponent(model.name)}`}
              className="group flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-secondary"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{model.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {model.panelCount} {labels.panels} · {model.bomLineCount}{" "}
                  {labels.bomLines}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
