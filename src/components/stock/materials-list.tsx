"use client";

import * as React from "react";
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

type Labels = {
  edit: string;
  save: string;
  cancel: string;
  code: string;
  name: string;
  unit: string;
  unitPrice: string;
  error: string;
};

type Props = {
  materials: Material[];
  locale: string;
  labels: Labels;
};

type EditState = {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitPriceEur: string;
};

/**
 * One client island for the whole list (instead of one per row) with
 * optimistic updates on save — no full route refresh needed.
 */
export function MaterialsList({ materials, locale, labels }: Props) {
  // Locally saved edits layered over the server-rendered rows.
  const [overrides, setOverrides] = React.useState<Map<string, Material>>(
    () => new Map(),
  );
  const [edit, setEdit] = React.useState<EditState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function startEdit(material: Material) {
    setError(null);
    setEdit({
      id: material.id,
      code: material.code ?? "",
      name: material.name,
      unit: material.unit,
      unitPriceEur: material.unitPriceEur ?? "",
    });
  }

  async function onSave() {
    if (!edit) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: edit.code.trim() || null,
          name: edit.name.trim(),
          unit: edit.unit.trim(),
          unitPriceEur: edit.unitPriceEur.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        material?: {
          id: string;
          code: string | null;
          name: string;
          unit: string;
          unitPriceEur: string | null;
          currentQuantity: string;
        };
      };
      if (!res.ok) {
        throw new Error(data.error ?? labels.error);
      }
      if (data.material) {
        const saved = data.material;
        setOverrides((prev) => {
          const next = new Map(prev);
          next.set(saved.id, {
            id: saved.id,
            code: saved.code,
            name: saved.name,
            unit: saved.unit,
            unitPriceEur: saved.unitPriceEur,
            currentQuantity: saved.currentQuantity,
          });
          return next;
        });
      }
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <ul>
      {materials.map((m) => {
        const material = overrides.get(m.id) ?? m;

        if (edit?.id === material.id) {
          return (
            <li key={material.id} className="space-y-3 border-b py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{labels.code}</Label>
                  <Input
                    value={edit.code}
                    onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{labels.unit}</Label>
                  <Input
                    value={edit.unit}
                    onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>{labels.name}</Label>
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>{labels.unitPrice}</Label>
                  <Input
                    value={edit.unitPriceEur}
                    onChange={(e) =>
                      setEdit({ ...edit, unitPriceEur: e.target.value })
                    }
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
                  onClick={() => setEdit(null)}
                  disabled={pending}
                >
                  {labels.cancel}
                </Button>
              </div>
            </li>
          );
        }

        return (
          <li
            key={material.id}
            className="flex items-center justify-between gap-3 border-b py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{material.name}</p>
              <p className="text-muted-foreground">
                {[
                  material.code,
                  material.unitPriceEur ? `€${material.unitPriceEur}` : null,
                ]
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
              onClick={() => startEdit(material)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
