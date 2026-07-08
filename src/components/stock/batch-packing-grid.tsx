"use client";

import * as React from "react";
import { Check } from "lucide-react";

import type {
  BatchPanelColumn,
  BatchUnitRow,
} from "@/lib/stock/manufacturing-batch-types";
import { cn } from "@/lib/utils/cn";

type Labels = {
  boothId: string;
  colour: string;
  unitProgress: string;
  noUnits: string;
  ticked: string;
  notTicked: string;
};

type Props = {
  panels: BatchPanelColumn[];
  units: BatchUnitRow[];
  labels: Labels;
};

export function BatchPackingGrid({ panels, units, labels }: Props) {
  if (units.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {labels.noUnits}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
            <th className="sticky left-0 z-20 min-w-[7rem] border-r bg-muted/50 px-3 py-2 font-medium">
              {labels.boothId}
            </th>
            <th className="sticky left-[7rem] z-20 min-w-[8rem] border-r bg-muted/50 px-3 py-2 font-medium">
              {labels.colour}
            </th>
            <th className="sticky left-[15rem] z-20 min-w-[4.5rem] border-r bg-muted/50 px-3 py-2 text-right font-medium">
              {labels.unitProgress}
            </th>
            {panels.map((panel) => (
              <th
                key={panel.boothElementId}
                className="max-w-[6rem] px-2 py-2 text-center font-medium"
                title={panel.sheetHeader}
              >
                <span className="line-clamp-2">{panel.simpleName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr
              key={unit.id}
              className="border-b border-border/50 last:border-0 odd:bg-background/40"
            >
              <td className="sticky left-0 z-10 border-r bg-background px-3 py-1.5 font-medium">
                {unit.boothIdText ?? "—"}
              </td>
              <td className="sticky left-[7rem] z-10 border-r bg-background px-3 py-1.5 text-muted-foreground">
                {unit.colour ?? "—"}
              </td>
              <td className="sticky left-[15rem] z-10 border-r bg-background px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                {unit.progressPct != null ? `${unit.progressPct}%` : "—"}
              </td>
              {panels.map((panel) => {
                const complete = unit.panels[panel.boothElementId] ?? false;
                return (
                  <td
                    key={panel.boothElementId}
                    className="px-2 py-1.5 text-center"
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded border",
                        complete
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted/30 text-transparent",
                      )}
                      title={complete ? labels.ticked : labels.notTicked}
                      aria-label={complete ? labels.ticked : labels.notTicked}
                    >
                      {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
