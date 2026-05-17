"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function RetryButton({
  documentId,
  disabled,
}: {
  documentId: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  const onClick = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/zeron/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `Sync failed (${res.status})`);
      }
      toast({ title: "Sync queued", description: json.message });
      router.refresh();
    } catch (e) {
      toast({
        title: "Sync error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCcw className="h-3.5 w-3.5" />
      )}
      Retry
    </Button>
  );
}
