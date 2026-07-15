"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  resolveTopMaterialQuantityView,
  sumTopMaterialQuantities,
  type WarehouseFilter,
} from "@/lib/stock/top-material-display";
import type {
  TopMaterialHomeRow,
  TopMaterialWarehouseOption,
} from "@/lib/stock/top-material-types";
import { formatQuantity } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Labels = {
  colMaterial: string;
  colQuantity: string;
  warehouseAll: string;
  warehouseTotal: string;
  notCounted: string;
  unknownCode: string;
};

type Props = {
  rows: TopMaterialHomeRow[];
  warehouses: TopMaterialWarehouseOption[];
  locale: string;
  labels: Labels;
};

function WarehouseBreakdownTooltip({
  row,
  locale,
  labels,
}: {
  row: TopMaterialHomeRow;
  locale: string;
  labels: Labels;
}) {
  if (!row.found || row.warehouses.length === 0) return null;

  const total = sumTopMaterialQuantities(row.warehouses);
  const baselined = row.warehouses.some((warehouse) => warehouse.hasBaseline);

  return (
    <div className="space-y-1">
      {row.warehouses.map((warehouse) => (
        <div
          key={warehouse.warehouseId}
          className="flex items-baseline justify-between gap-4"
        >
          <span className="text-primary-foreground/80">
            {warehouse.warehouseName}
          </span>
          <span className="tabular-nums">
            {warehouse.hasBaseline ?
              formatQuantity(warehouse.quantity, locale, row.unit)
            : labels.notCounted}
          </span>
        </div>
      ))}
      {baselined && row.warehouses.length > 1 ? (
        <div className="flex items-baseline justify-between gap-4 border-t border-primary-foreground/20 pt-1 font-medium">
          <span>{labels.warehouseTotal}</span>
          <span className="tabular-nums">
            {formatQuantity(total, locale, row.unit)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function TopMaterialRow({
  row,
  warehouseFilter,
  locale,
  labels,
}: {
  row: TopMaterialHomeRow;
  warehouseFilter: WarehouseFilter;
  locale: string;
  labels: Labels;
}) {
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const view = resolveTopMaterialQuantityView(row, warehouseFilter);
  const quantityLabel =
    !row.found ? labels.unknownCode
    : !view.hasBaseline ? labels.notCounted
    : view.quantity != null ?
      formatQuantity(view.quantity, locale, row.unit)
    : labels.notCounted;
  const showTooltip = row.found && row.warehouses.length > 0;

  return (
    <Tooltip open={showTooltip ? tooltipOpen : false} onOpenChange={setTooltipOpen}>
      <TooltipTrigger asChild>
        <tr
          className="border-b last:border-0 cursor-default"
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
        >
          <td className="py-2.5 pr-4">
            <span className="font-medium">{row.materialName ?? row.code}</span>
            {row.found && row.materialName ? (
              <span className="ml-2 text-muted-foreground">{row.code}</span>
            ) : null}
          </td>
          <td
            className={cn(
              "py-2.5 text-right tabular-nums",
              view.isShortage && "text-destructive",
            )}
          >
            {quantityLabel}
          </td>
        </tr>
      </TooltipTrigger>
      {showTooltip ? (
        <TooltipContent side="left" className="max-w-xs">
          <WarehouseBreakdownTooltip
            row={row}
            locale={locale}
            labels={labels}
          />
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

export function TopMaterialsTable({
  rows,
  warehouses,
  locale,
  labels,
}: Props) {
  const [warehouseFilter, setWarehouseFilter] =
    React.useState<WarehouseFilter>("all");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">{labels.colMaterial}</th>
              <th className="pb-2 font-medium text-right">
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <span className="shrink-0">{labels.colQuantity}</span>
                  <Select
                    value={warehouseFilter}
                    onValueChange={setWarehouseFilter}
                  >
                    <SelectTrigger
                      className="h-8 w-full min-w-[9rem] sm:w-auto"
                      aria-label={labels.colQuantity}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="all">{labels.warehouseAll}</SelectItem>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TopMaterialRow
                key={row.code}
                row={row}
                warehouseFilter={warehouseFilter}
                locale={locale}
                labels={labels}
              />
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
