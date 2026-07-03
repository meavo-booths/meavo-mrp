import { cn } from "@/lib/utils/cn";

type Props = {
  className?: string;
  showStock?: boolean;
};

/** Wordmark until official logo SVG is added to /public. */
export function MeavoLogo({ className, showStock = true }: Props) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-medium tracking-tight", className)}>
      <span className="text-lg font-semibold text-foreground sm:text-xl">MEAVO</span>
      {showStock ? (
        <span className="text-sm font-medium text-muted-foreground">Stock</span>
      ) : null}
    </span>
  );
}
