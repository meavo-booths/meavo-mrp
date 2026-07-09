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
type WarehouseOption = { id: string; name: string; code: string };

type Props = {
  materials: MaterialCodeOption[];
  warehouses: WarehouseOption[];
  defaultWarehouseId: string;
  labels: {
    material: string;
    materialSearchPlaceholder: string;
    materialUnknown: string;
    warehouse: string;
    quantity: string;
    date: string;
    invoiceNumber: string;
    notes: string;
    submit: string;
    error: string;
  };
};

export function ReceiptForm({
  materials,
  warehouses,
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
  const [quantity, setQuantity] = React.useState("");
  const [effectiveAt, setEffectiveAt] = React.useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
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
      const res = await fetch("/api/stock/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          warehouseId,
          quantity: Number(quantity),
          effectiveAt,
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? labels.error);
      }
      setQuantity("");
      setInvoiceNumber("");
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
        Add materials first before recording receipts.
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
        inputId="receipt-material-code"
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
          <Label htmlFor="receipt-qty">{labels.quantity}</Label>
          <Input
            id="receipt-qty"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receipt-date">{labels.date}</Label>
          <Input
            id="receipt-date"
            type="date"
            value={effectiveAt}
            onChange={(e) => setEffectiveAt(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt-invoice">{labels.invoiceNumber}</Label>
        <Input
          id="receipt-invoice"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt-notes">{labels.notes}</Label>
        <Textarea
          id="receipt-notes"
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
