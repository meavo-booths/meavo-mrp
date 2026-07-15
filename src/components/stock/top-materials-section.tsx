"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TopMaterialsTable } from "@/components/stock/top-materials-table";
import { Badge } from "@/components/ui/badge";
import { resolveTopMaterialQuantityView } from "@/lib/stock/top-material-display";
import type {
  TopMaterialHomeRow,
  TopMaterialWarehouseOption,
} from "@/lib/stock/top-material-types";
import { cn } from "@/lib/utils/cn";

type Labels = {
  title: string;
  description: string;
  empty: string;
  configure: string;
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
  defaultOpen?: boolean;
};

export function TopMaterialsSection({
  rows,
  warehouses,
  locale,
  labels,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen && rows.length > 0);
  const shortageCount = rows.filter(
    (row) => resolveTopMaterialQuantityView(row, "all").isShortage,
  ).length;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:items-center"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform sm:mt-0",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{labels.title}</h2>
            {rows.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {rows.length}
              </Badge>
            ) : null}
            {shortageCount > 0 ? (
              <Badge variant="destructive" className="tabular-nums">
                {shortageCount}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.description}
          </p>
        </div>
      </button>

      {open ? (
        <div className="border-t px-4 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {labels.empty}{" "}
              <Link href="/settings" className="underline underline-offset-2">
                {labels.configure}
              </Link>
            </p>
          ) : (
            <>
              <TopMaterialsTable
                rows={rows}
                warehouses={warehouses}
                locale={locale}
                labels={{
                  colMaterial: labels.colMaterial,
                  colQuantity: labels.colQuantity,
                  warehouseAll: labels.warehouseAll,
                  warehouseTotal: labels.warehouseTotal,
                  notCounted: labels.notCounted,
                  unknownCode: labels.unknownCode,
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                <Link href="/settings" className="underline underline-offset-2">
                  {labels.configure}
                </Link>
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
