import * as React from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export type Zone = "local" | "eu" | "non_eu";

export function ZoneBadge({ zone }: { zone: Zone | null | undefined }) {
  const t = useTranslations("deliveryZone");
  if (!zone) return null;
  return (
    <Badge variant={zone === "non_eu" ? "nonEu" : zone === "eu" ? "eu" : "local"}>
      {t(zone)}
    </Badge>
  );
}
