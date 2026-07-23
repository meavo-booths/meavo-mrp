"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoothMaterialCostResult } from "@/lib/stock/booth-material-cost";
import type {
  BoothModelRecipe,
  BoothModelSummary,
} from "@/lib/stock/bom-recipe-view";
import { cn } from "@/lib/utils/cn";

const DEFAULT_MODEL = "Soho";
const DEFAULT_COLOUR = "Pure White";

type Labels = {
  model: string;
  colour: string;
  noModels: string;
  noColourOption: string;
  loading: string;
  loadError: string;
  notFound: string;
  materialCount: string;
  totalAverage: string;
  totalLatest: string;
  missingPrices: string;
  recipeTitle: string;
  recipeDescription: string;
  empty: string;
  columns: {
    material: string;
    qty: string;
    avgUnit: string;
    latestUnit: string;
    avgLine: string;
    latestLine: string;
    panels: string;
  };
};

type Props = {
  models: BoothModelSummary[];
  labels: Labels;
};

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pickDefaultModel(models: BoothModelSummary[]): string | null {
  if (models.length === 0) return null;
  return models.find((m) => m.name === DEFAULT_MODEL)?.name ?? models[0]!.name;
}

function pickDefaultColour(colours: string[]): string | null {
  if (colours.length === 0) return null;
  return colours.find((c) => c === DEFAULT_COLOUR) ?? colours[0] ?? null;
}

export function BoothCostBrowser({ models, labels }: Props) {
  const [modelName, setModelName] = React.useState<string | null>(() =>
    pickDefaultModel(models),
  );
  const [colour, setColour] = React.useState<string | null>(DEFAULT_COLOUR);
  const [availableColours, setAvailableColours] = React.useState<string[]>([]);
  const [data, setData] = React.useState<BoothMaterialCostResult | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ready" | "error">(
    models.length === 0 ? "idle" : "loading",
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!modelName) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const recipeRes = await fetch(
          `/api/recipes/${encodeURIComponent(modelName)}`,
          { signal: controller.signal },
        );
        if (!recipeRes.ok) {
          if (recipeRes.status === 404) {
            setLoadError(labels.notFound);
            setStatus("error");
            setData(null);
            setAvailableColours([]);
            return;
          }
          throw new Error(`HTTP ${recipeRes.status}`);
        }

        const recipe = (await recipeRes.json()) as BoothModelRecipe;
        if (controller.signal.aborted) return;

        const colours = recipe.availableColours;
        setAvailableColours(colours);

        let activeColour = colour;
        if (!activeColour || !colours.includes(activeColour)) {
          activeColour = pickDefaultColour(colours);
          if (activeColour !== colour) {
            setColour(activeColour);
            // Colour state change will re-run this effect; skip cost fetch here.
            return;
          }
        }

        const params = new URLSearchParams({ market: "default" });
        if (activeColour) params.set("colour", activeColour);

        const costRes = await fetch(
          `/api/recipe-costs/${encodeURIComponent(modelName)}?${params}`,
          { signal: controller.signal },
        );
        if (!costRes.ok) {
          if (costRes.status === 404) {
            setLoadError(labels.notFound);
            setStatus("error");
            setData(null);
            return;
          }
          throw new Error(`HTTP ${costRes.status}`);
        }

        const json = (await costRes.json()) as BoothMaterialCostResult;
        if (controller.signal.aborted) return;
        setData(json);
        setLoadError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : labels.loadError);
        setStatus("error");
        setData(null);
      }
    })();

    return () => controller.abort();
  }, [colour, labels.loadError, labels.notFound, modelName]);

  const stale =
    !!data && (data.modelName !== modelName || data.colour !== colour);

  if (models.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noModels}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="min-w-[12rem] flex-1 sm:max-w-[18rem]">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.model}
          </p>
          <Select
            value={modelName ?? undefined}
            onValueChange={(v) => {
              setStatus("loading");
              setData(null);
              setColour(DEFAULT_COLOUR);
              setModelName(v);
            }}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.name} value={model.name}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[12rem] flex-1 sm:max-w-[18rem]">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.colour}
          </p>
          <Select
            value={colour ?? "__none__"}
            onValueChange={(v) => {
              setStatus("loading");
              setColour(v === "__none__" ? null : v);
            }}
            disabled={availableColours.length === 0}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder={labels.noColourOption} />
            </SelectTrigger>
            <SelectContent>
              {availableColours.length === 0 ? (
                <SelectItem value="__none__">{labels.noColourOption}</SelectItem>
              ) : (
                availableColours.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {data ? (
          <p className="pb-2 text-sm text-muted-foreground">
            {data.materials.length} {labels.materialCount}
          </p>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {!data && status !== "error" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="h-20 animate-pulse rounded-md bg-muted" />
          <div className="h-56 animate-pulse rounded-md bg-muted/70" />
          <p className="text-sm text-muted-foreground">{labels.loading}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.totalAverage}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {formatMoney(data.totals.averageCost)}
              </p>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.totalLatest}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-primary">
                {formatMoney(data.totals.latestCost)}
              </p>
            </div>
          </div>

          {data.totals.missingPriceCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {labels.missingPrices.replace(
                "{count}",
                String(data.totals.missingPriceCount),
              )}
            </p>
          ) : null}

          <section className={cn("space-y-3", stale && "opacity-60")}>
            <div>
              <h3 className="text-base font-semibold">{labels.recipeTitle}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {labels.recipeDescription}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="w-12 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      #
                    </th>
                    <th className="min-w-[14rem] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.material}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.qty}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.avgUnit}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.latestUnit}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.avgLine}
                    </th>
                    <th className="bg-primary/5 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-primary">
                      {labels.columns.latestLine}
                    </th>
                    <th className="min-w-[10rem] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labels.columns.panels}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.materials.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {labels.empty}
                      </td>
                    </tr>
                  ) : (
                    data.materials.map((item, index) => {
                      const missingPrice =
                        item.averageUnitCost == null &&
                        item.latestUnitCost == null;
                      return (
                        <tr
                          key={item.materialCode}
                          className={cn(
                            "border-b border-border/60 last:border-0",
                            index % 2 === 1 && "bg-muted/25",
                            missingPrice && "opacity-70",
                          )}
                        >
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold tabular-nums tracking-tight">
                              {item.materialCode}
                            </div>
                            <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
                              {item.materialName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {item.quantityLabel}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatMoney(item.averageUnitCost)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatMoney(item.latestUnitCost)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatMoney(item.averageLineCost)}
                          </td>
                          <td className="bg-primary/5 px-4 py-3 text-right text-base font-semibold tabular-nums text-primary">
                            {formatMoney(item.latestLineCost)}
                          </td>
                          <td className="max-w-[14rem] px-4 py-3 text-sm leading-snug text-muted-foreground">
                            {item.panels.join(", ")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
