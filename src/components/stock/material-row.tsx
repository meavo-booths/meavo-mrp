"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Material = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  unitPriceEur: string | null;
  currentQuantity: string;
};

type Props = {
  material: Material;
  locale: string;
  labels: {
    edit: string;
    save: string;
    cancel: string;
    code: string;
    name: string;
    unit: string;
    unitPrice: string;
    error: string;
  };
};

export function MaterialRow({
  material,
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [code, setCode] = React.useState(material.code ?? "");
  const [name, setName] = React.useState(material.name);
  const [unit, setUnit] = React.useState(material.unit);
  const [unitPriceEur, setUnitPriceEur] = React.useState(
    material.unitPriceEur ?? "",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "PATCH",
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
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <li className="space-y-3 border-b py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{labels.code}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{labels.unit}</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{labels.name}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{labels.unitPrice}</Label>
            <Input
              value={unitPriceEur}
              onChange={(e) => setUnitPriceEur(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {labels.save}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            {labels.cancel}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{material.name}</p>
        <p className="text-muted-foreground">
          {[material.code, material.unitPriceEur ? `€${material.unitPriceEur}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {Number(material.currentQuantity).toLocaleString(locale)}{" "}
        {material.unit}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0"
        aria-label={labels.edit}
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </li>
  );
}
