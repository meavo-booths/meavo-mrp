import { AlertTriangle } from "lucide-react";

import type { MaterialInvalidUnit } from "@/lib/stock/material-unit-issues";

type Props = {
  items: MaterialInvalidUnit[];
  title: string;
  description: string;
  suggestedLabel: string;
};

export function InvalidMaterialUnitsBanner({
  items,
  title,
  description,
  suggestedLabel,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-300/80 bg-[#F4E3B1] px-4 py-4 text-foreground"
      role="status"
    >
      <div className="flex gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-900"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">{title}</p>
          <p className="mt-1 text-sm text-amber-950/80">{description}</p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg bg-background/70 px-3 py-2 text-sm"
              >
                <span className="font-medium tabular-nums">
                  {item.code ?? "—"}
                </span>
                <span className="text-muted-foreground"> · {item.name}</span>
                <span className="mt-1 block tabular-nums text-amber-950/90">
                  {item.unit}
                  {item.suggestedUnit ? (
                    <span className="text-muted-foreground">
                      {" "}
                      → {suggestedLabel}: {item.suggestedUnit}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
