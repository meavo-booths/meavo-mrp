import { AlertTriangle } from "lucide-react";

import type { BomMissingMaterial } from "@/lib/stock/bom-missing";

type Props = {
  items: BomMissingMaterial[];
  title: string;
  description: string;
  lineLabel: string;
};

export function BomMissingMaterialsBanner({
  items,
  title,
  description,
  lineLabel,
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
          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <li
                key={item.code}
                className="rounded-full bg-background/70 px-3 py-1 text-sm font-medium tabular-nums"
                title={`${lineLabel}: ${item.bomLineCount}`}
              >
                {item.code}
                <span className="ml-1.5 text-muted-foreground">
                  ({item.bomLineCount})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
