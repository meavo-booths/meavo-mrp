"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import type { ManufacturingBatchRow } from "@/lib/stock/manufacturing-batches";
import { cn } from "@/lib/utils/cn";

function batchSpreadsheetUrl(spreadsheetId: string | null): string | null {
  if (!spreadsheetId?.trim()) return null;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId.trim()}`;
}

type StatusFilter = "all" | ManufacturingBatchRow["status"];

type Labels = {
  filterAll: string;
  statusPlanned: string;
  statusInProduction: string;
  statusCompleted: string;
  statusCancelled: string;
  colName: string;
  colStatus: string;
  colModel: string;
  colQty: string;
  colWarehouse: string;
  colUnits: string;
  colSynced: string;
  colSheet: string;
  openSheet: string;
  empty: string;
  noSheet: string;
};

type Props = {
  batches: ManufacturingBatchRow[];
  labels: Labels;
  formatSynced: (value: Date | null) => string;
};

const STATUS_ORDER: ManufacturingBatchRow["status"][] = [
  "in_production",
  "planned",
  "completed",
  "cancelled",
];

function statusLabel(
  status: ManufacturingBatchRow["status"],
  labels: Labels,
): string {
  switch (status) {
    case "planned":
      return labels.statusPlanned;
    case "in_production":
      return labels.statusInProduction;
    case "completed":
      return labels.statusCompleted;
    case "cancelled":
      return labels.statusCancelled;
  }
}

function statusClass(status: ManufacturingBatchRow["status"]): string {
  switch (status) {
    case "planned":
      return "bg-sky-100 text-sky-900";
    case "in_production":
      return "bg-amber-100 text-amber-900";
    case "completed":
      return "bg-emerald-100 text-emerald-900";
    case "cancelled":
      return "bg-muted text-muted-foreground";
  }
}

export function BatchesTable({ batches, labels, formatSynced }: Props) {
  const [filter, setFilter] = React.useState<StatusFilter>("all");

  const counts = React.useMemo(() => {
    const map = new Map<ManufacturingBatchRow["status"], number>();
    for (const batch of batches) {
      map.set(batch.status, (map.get(batch.status) ?? 0) + 1);
    }
    return map;
  }, [batches]);

  const visible = React.useMemo(() => {
    if (filter === "all") return batches;
    return batches.filter((batch) => batch.status === filter);
  }, [batches, filter]);

  const filters: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: "all", label: labels.filterAll, count: batches.length },
    ...STATUS_ORDER.map((status) => ({
      id: status as StatusFilter,
      label: statusLabel(status, labels),
      count: counts.get(status) ?? 0,
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {item.label}
            <span className="ml-1.5 tabular-nums opacity-80">({item.count})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{labels.colName}</th>
                <th className="px-3 py-2 font-medium">{labels.colStatus}</th>
                <th className="px-3 py-2 font-medium">{labels.colModel}</th>
                <th className="px-3 py-2 text-right font-medium">{labels.colQty}</th>
                <th className="px-3 py-2 font-medium">{labels.colWarehouse}</th>
                <th className="px-3 py-2 text-right font-medium">{labels.colUnits}</th>
                <th className="px-3 py-2 font-medium">{labels.colSynced}</th>
                <th className="px-3 py-2 font-medium">{labels.colSheet}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((batch) => {
                const sheetUrl = batchSpreadsheetUrl(batch.batchSpreadsheetId);
                return (
                  <tr
                    key={batch.id}
                    className="border-b border-border/50 last:border-0 odd:bg-background/40"
                  >
                    <td className="px-3 py-2 font-medium">{batch.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusClass(batch.status),
                        )}
                      >
                        {statusLabel(batch.status, labels)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {batch.modelName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {batch.qty ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {batch.warehouseName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {batch.unitCount > 0 ? batch.unitCount : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatSynced(batch.lastSyncedAt)}
                    </td>
                    <td className="px-3 py-2">
                      {sheetUrl ? (
                        <a
                          href={sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {labels.openSheet}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {labels.noSheet}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
