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
import type { BoothMaterialCostResult } from "@/lib/stock/booth-material-cost";
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
  selectedModel: string | null;
  labels: Labels;
};

type Selection = {
  colour: string | null;
  market: BoothMarket;
  availableColours: string[];
  availableMarkets: Array<"default" | "US">;
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

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function defaultRecipeColour(colours: string[]): string | null {
  if (colours.length === 0) return null;
  return colours.find((c) => c === "Pure White") ?? colours[0] ?? null;
}

function CostDetail({
  modelName,
  labels,
  onBack,
}: {
  modelName: string;
  labels: Labels;
  onBack: () => void;
}) {
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [data, setData] = React.useState<BoothMaterialCostResult | null>(null);
  const [status, setStatus] = React.useState<
    "bootstrapping" | "loading" | "ready" | "error"
  >("bootstrapping");
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(
          `/api/recipes/${encodeURIComponent(modelName)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          if (res.status === 404) {
            setLoadError(labels.notFound);
            setStatus("error");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const recipe = (await res.json()) as BoothModelRecipe;
        if (controller.signal.aborted) return;
        const availableMarkets =
          recipe.availableMarkets.length > 0
            ? recipe.availableMarkets
            : (["default"] as Array<"default" | "US">);
        setSelection({
          colour: defaultRecipeColour(recipe.availableColours),
          market: availableMarkets.includes("default")
            ? "default"
            : (availableMarkets[0] ?? "default"),
          availableColours: recipe.availableColours,
          availableMarkets,
        });
        setStatus("loading");
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : labels.loadError);
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [labels.loadError, labels.notFound, modelName]);

  React.useEffect(() => {
    if (!selection) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const params = new URLSearchParams({ market: selection.market });
        if (selection.colour) params.set("colour", selection.colour);
        const res = await fetch(
          `/api/recipe-costs/${encodeURIComponent(modelName)}?${params}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          if (res.status === 404) {
            setLoadError(labels.notFound);
            setStatus("error");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as BoothMaterialCostResult;
        if (controller.signal.aborted) return;
        setData(json);
        setLoadError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : labels.loadError);
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [labels.loadError, labels.notFound, modelName, selection]);

  const colour = selection?.colour ?? null;
  const market = selection?.market ?? "default";
  const availableColours = selection?.availableColours ?? [];
  const availableMarkets = selection?.availableMarkets ?? ["default"];
  const showSkeleton =
    status === "bootstrapping" || (status === "loading" && !data);
  const stale =
    !!data &&
    !!selection &&
    (data.colour !== selection.colour || data.market !== selection.market);

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
        <h2 className="text-xl font-semibold tracking-tight">{modelName}</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.colour}
          </p>
          <Select
            value={colour ?? "__none__"}
            onValueChange={(v) =>
              setSelection((prev) =>
                prev
                  ? { ...prev, colour: v === "__none__" ? null : v }
                  : prev,
              )
            }
            disabled={!selection || availableColours.length === 0}
          >
            <SelectTrigger className="h-8 text-xs">
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

        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.market}
          </p>
          <Select
            value={market}
            onValueChange={(v) =>
              setSelection((prev) =>
                prev ? { ...prev, market: v as BoothMarket } : prev,
              )
            }
            disabled={!selection}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMarkets.includes("default") ? (
                <SelectItem value="default">{labels.marketDomestic}</SelectItem>
              ) : null}
              {availableMarkets.includes("US") ? (
                <SelectItem value="US">{labels.marketUs}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        {data ? (
          <p className="pb-0.5 text-xs text-muted-foreground">
            {data.materials.length} {labels.materialCount}
          </p>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {showSkeleton ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          <div className="h-40 animate-pulse rounded-md bg-muted/70" />
          <p className="text-sm text-muted-foreground">{labels.loading}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {labels.totalAverage}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(data.totals.averageCost)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {labels.totalLatest}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(data.totals.latestCost)}
              </p>
            </div>
          </div>

          {data.totals.missingPriceCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {labels.missingPrices.replace(
                "{count}",
                String(data.totals.missingPriceCount),
              )}
            </p>
          ) : null}

          <section className={cn("space-y-1.5", stale && "opacity-60")}>
            <div>
              <h3 className="text-sm font-semibold">{labels.recipeTitle}</h3>
              <p className="text-[11px] text-muted-foreground">
                {labels.recipeDescription}
              </p>
            </div>
            <CompactTable>
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="w-8 px-2 py-1 font-medium">#</th>
                  <th className="px-2 py-1 font-medium">
                    {labels.columns.material}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {labels.columns.qty}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {labels.columns.avgUnit}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {labels.columns.latestUnit}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {labels.columns.avgLine}
                  </th>
                  <th className="px-2 py-1 text-right font-medium">
                    {labels.columns.latestLine}
                  </th>
                  <th className="px-2 py-1 font-medium">
                    {labels.columns.panels}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.materials.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-2 py-3 text-muted-foreground"
                    >
                      {labels.empty}
                    </td>
                  </tr>
                ) : (
                  data.materials.map((item, index) => (
                    <tr
                      key={item.materialCode}
                      className="border-b border-border/40 last:border-0 odd:bg-muted/20"
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
                        {item.quantityLabel}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {formatMoney(item.averageUnitCost)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {formatMoney(item.latestUnitCost)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {formatMoney(item.averageLineCost)}
                      </td>
                      <td className="px-2 py-0.5 text-right font-medium tabular-nums">
                        {formatMoney(item.latestLineCost)}
                      </td>
                      <td className="max-w-[12rem] truncate px-2 py-0.5 text-muted-foreground">
                        {item.panels.join(", ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </section>
        </>
      ) : null}
    </div>
  );
}

export function BoothCostBrowser({ models, selectedModel, labels }: Props) {
  const router = useRouter();

  if (selectedModel) {
    return (
      <CostDetail
        key={selectedModel}
        modelName={selectedModel}
        labels={labels}
        onBack={() => router.push("/costs")}
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
              href={`/costs?model=${encodeURIComponent(model.name)}`}
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
