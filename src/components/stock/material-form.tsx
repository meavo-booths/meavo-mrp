"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  labels: {
    code: string;
    name: string;
    unit: string;
    unitPrice: string;
    submit: string;
    success: string;
    error: string;
  };
};

export function MaterialForm({ labels }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("kg");
  const [unitPriceEur, setUnitPriceEur] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || null,
          name: name.trim(),
          unit: unit.trim(),
          unitPriceEur: unitPriceEur.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? labels.error);
      }
      setCode("");
      setName("");
      setUnit("kg");
      setUnitPriceEur("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="material-code">{labels.code}</Label>
        <Input
          id="material-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="MAT-001"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="material-unit">{labels.unit}</Label>
        <Input
          id="material-unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="material-unit-price">{labels.unitPrice}</Label>
        <Input
          id="material-unit-price"
          value={unitPriceEur}
          onChange={(e) => setUnitPriceEur(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="material-name">{labels.name}</Label>
        <Input
          id="material-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive sm:col-span-2">{error}</p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
