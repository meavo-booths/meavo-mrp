"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InventoryForm,
  type InventoryFormLabels,
  type RecordedCount,
} from "@/components/stock/inventory-form";
import { formatDate, formatQuantity } from "@/lib/utils/format";

type WarehouseOption = { id: string; name: string };
type BatchOption = { id: string; name: string };

export type RecentCountEntry = {
  countDate: string | Date;
  systemQuantity: string;
  countedQuantity: string;
  variance: string;
  countedThroughBatchLabel: string | null;
  materialName: string;
  unit: string;
  warehouseName: string;
};

type Props = {
  warehouses: WarehouseOption[];
  batches: BatchOption[];
  defaultWarehouseId: string;
  initialCounts: RecentCountEntry[];
  locale: string;
  labels: InventoryFormLabels & {
    formTitle: string;
    formDescription: string;
    historyTitle: string;
    historyDescription: string;
    historyEmpty: string;
    variance: string;
  };
};

/** Form + recent-counts history sharing state so a save updates the list without a full page refresh. */
export function InventoryPanel({
  warehouses,
  batches,
  defaultWarehouseId,
  initialCounts,
  locale,
  labels,
}: Props) {
  const [counts, setCounts] = React.useState<RecentCountEntry[]>(initialCounts);

  const handleRecorded = React.useCallback((recorded: RecordedCount) => {
    setCounts((prev) => [recorded, ...prev].slice(0, 20));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{labels.formTitle}</CardTitle>
          <CardDescription>{labels.formDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryForm
            warehouses={warehouses}
            batches={batches}
            defaultWarehouseId={defaultWarehouseId}
            onRecorded={handleRecorded}
            labels={labels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.historyTitle}</CardTitle>
          <CardDescription>{labels.historyDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {counts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.historyEmpty}</p>
          ) : (
            <ul className="divide-y text-sm">
              {counts.map((row, i) => (
                <li key={i} className="space-y-1 py-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{row.materialName}</span>
                    <span className="text-muted-foreground">
                      {formatDate(row.countDate, locale)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{row.warehouseName}</p>
                  {row.countedThroughBatchLabel ? (
                    <p className="text-muted-foreground">
                      {labels.countedThroughBatch}: {row.countedThroughBatchLabel}
                    </p>
                  ) : null}
                  <p>
                    {labels.counted}:{" "}
                    {formatQuantity(row.countedQuantity, locale, row.unit)}
                    {Number(row.systemQuantity) !== 0 &&
                    Number(row.variance) !== 0 ? (
                      <>
                        {" · "}
                        {labels.variance}:{" "}
                        <span
                          className={
                            Number(row.variance) < 0
                              ? "text-destructive"
                              : "text-green-600"
                          }
                        >
                          {formatQuantity(row.variance, locale, row.unit)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
