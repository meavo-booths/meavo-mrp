import * as React from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export type DocStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "synced"
  | "sync_failed";

export function StatusBadge({ status }: { status: DocStatus }) {
  const t = useTranslations("common");
  const v = (() => {
    switch (status) {
      case "synced":
        return { label: t("synced"), variant: "default" as const };
      case "approved":
        return { label: t("approved"), variant: "secondary" as const };
      case "sync_failed":
        return { label: t("syncFailed"), variant: "destructive" as const };
      case "rejected":
        return { label: "—", variant: "outline" as const };
      case "pending_review":
      default:
        return { label: t("pendingReview"), variant: "warn" as const };
    }
  })();
  return <Badge variant={v.variant}>{v.label}</Badge>;
}
