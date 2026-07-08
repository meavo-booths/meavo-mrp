"use client";

import * as React from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { BatchPackingGrid } from "@/components/stock/batch-packing-grid";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ManufacturingBatchDetail } from "@/lib/stock/manufacturing-batch-types";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

function batchSpreadsheetUrl(spreadsheetId: string | null): string | null {
  if (!spreadsheetId?.trim()) return null;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId.trim()}`;
}

type Labels = {
  back: string;
  model: string;
  warehouse: string;
  qty: string;
  completeness: string;
  synced: string;
  openSheet: string;
  noSheet: string;
  boothId: string;
  colour: string;
  unitProgress: string;
  noUnits: string;
  ticked: string;
  notTicked: string;
  statusPlanned: string;
  statusInProduction: string;
  statusCompleted: string;
  statusCancelled: string;
};

type Props = {
  batch: ManufacturingBatchDetail;
  labels: Labels;
  locale: string;
};

function statusLabel(
  status: ManufacturingBatchDetail["status"],
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

function statusClass(status: ManufacturingBatchDetail["status"]): string {
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

export function BatchDetailView({ batch, labels, locale }: Props) {
  const sheetUrl = batchSpreadsheetUrl(batch.batchSpreadsheetId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 px-2"
            asChild
          >
            <Link href="/batches">
              <ArrowLeft className="h-3.5 w-3.5" />
              {labels.back}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{batch.name}</h2>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusClass(batch.status),
              )}
            >
              {statusLabel(batch.status, labels)}
            </span>
          </div>
        </div>
        {sheetUrl ? (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {labels.openSheet}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">{labels.noSheet}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {batch.modelName ? (
          <span>
            {labels.model}: <span className="text-foreground">{batch.modelName}</span>
          </span>
        ) : null}
        {batch.warehouseName ? (
          <span>
            {labels.warehouse}:{" "}
            <span className="text-foreground">{batch.warehouseName}</span>
          </span>
        ) : null}
        {batch.qty != null ? (
          <span>
            {labels.qty}: <span className="text-foreground">{batch.qty}</span>
          </span>
        ) : null}
        {batch.completenessPct != null ? (
          <span>
            {labels.completeness}:{" "}
            <span className="font-medium text-foreground">
              {batch.completenessPct}%
            </span>
          </span>
        ) : null}
        <span>
          {labels.synced}:{" "}
          <span className="text-foreground">
            {formatDate(batch.lastSyncedAt, locale)}
          </span>
        </span>
      </div>

      <BatchPackingGrid
        panels={batch.panels}
        units={batch.units}
        labels={{
          boothId: labels.boothId,
          colour: labels.colour,
          unitProgress: labels.unitProgress,
          noUnits: labels.noUnits,
          ticked: labels.ticked,
          notTicked: labels.notTicked,
        }}
      />
    </div>
  );
}
