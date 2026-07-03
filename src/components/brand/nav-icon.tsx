import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type Props = {
  icon: LucideIcon;
  className?: string;
  size?: "sm" | "md";
};

/** MEAVO style guide: green circle, cream symbol. */
export function NavIcon({ icon: Icon, className, size = "sm" }: Props) {
  const box = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const glyph = size === "md" ? "h-[17px] w-[17px]" : "h-4 w-4";

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
        box,
        className,
      )}
      aria-hidden
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}
