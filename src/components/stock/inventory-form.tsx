"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MaterialCodeField,
  type MaterialCodeOption,
} from "@/components/stock/material-code-field";

type WarehouseOption = { id: string; name: string };
type BatchOption = { id: string; name: string };

type Props = {
  materials: MaterialCodeOption[];
  warehouses: WarehouseOption[];
  batches: BatchOption[];
  defaultWarehouseId: string;
  labels: {
    material: string;
    materialSearchPlaceholder: string;
    materialUnknown: string;
    warehouse: string;
    countDate: string;
    counted: string;
    countedThroughBatch: string;
    countedThroughBatchHint: string;
    countedThroughBatchManual: string;
    countedThroughBatchNone: string;
    notes: string;
    submit: string;
    error: string;
  };
};

export function InventoryForm({
  materials,
  warehouses,
  batches,
  defaultWarehouseId,
  labels,
}: Props) {
  const router = useRouter();
  const [materialCode, setMaterialCode] = React.useState("");
  const [materialId, setMaterialId] = React.useState("");
  const handleMaterialResolved = React.useCallback(
    (material: MaterialCodeOption | null) => {
      setMaterialId(material?.id ?? "");
    },
    [],
  );
  const [warehouseId, setWarehouseId] = React.useState(defaultWarehouseId);
  const [countDate, setCountDate] = React.useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [countedQuantity, setCountedQuantity] = React.useState("");
  const [batchMode, setBatchMode] = React.useState<"none" | "pick" | "manual">(
    batches.length > 0 ? "pick" : "manual",
  );
  const [batchId, setBatchId] = React.useState(batches[0]?.id ?? "");
  const [batchLabel, setBatchLabel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) {
      setError(labels.materialUnknown);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const countedThroughBatchId =
        batchMode === "pick" && batchId ? batchId : null;
      const countedThroughBatchLabel =
        batchMode === "manual"
          ? batchLabel.trim() || null
          : batchMode === "pick"
            ? batches.find((b) => b.id === batchId)?.name ?? null
            : null;

      const res = await fetch("/api/stock/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          warehouseId,
          countDate,
          countedQuantity: Number(countedQuantity),
          notes: notes.trim() || undefined,
          countedThroughBatchId,
          countedThroughBatchLabel,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? labels.error);
      }
      setCountedQuantity("");
      setBatchLabel("");
      setNotes("");
      setMaterialCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add materials first before inventory counts.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <MaterialCodeField
        materials={materials}
        value={materialCode}
        onChange={setMaterialCode}
        onResolved={handleMaterialResolved}
        inputId="inv-material-code"
        labels={{
          material: labels.material,
          materialSearchPlaceholder: labels.materialSearchPlaceholder,
          materialUnknown: labels.materialUnknown,
        }}
      />
      <div className="space-y-2">
        <Label>{labels.warehouse}</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inv-date">{labels.countDate}</Label>
          <Input
            id="inv-date"
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-qty">{labels.counted}</Label>
          <Input
            id="inv-qty"
            type="number"
            min="0"
            step="any"
            value={countedQuantity}
            onChange={(e) => setCountedQuantity(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{labels.countedThroughBatch}</Label>
        <p className="text-xs text-muted-foreground">
          {labels.countedThroughBatchHint}
        </p>
        {batches.length > 0 ? (
          <Select
            value={batchMode === "none" ? "none" : batchMode === "manual" ? "manual" : batchId}
            onValueChange={(v) => {
              if (v === "none") {
                setBatchMode("none");
                return;
              }
              if (v === "manual") {
                setBatchMode("manual");
                return;
              }
              setBatchMode("pick");
              setBatchId(v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{labels.countedThroughBatchNone}</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
              <SelectItem value="manual">{labels.countedThroughBatchManual}</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {batchMode === "manual" || batches.length === 0 ? (
          <Input
            id="inv-batch"
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            placeholder={labels.countedThroughBatchManual}
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-notes">{labels.notes}</Label>
        <Textarea
          id="inv-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !materialId}>
        {labels.submit}
      </Button>
    </form>
  );
}
