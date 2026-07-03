"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import {
  MaterialCodeField,
  type MaterialCodeOption,
} from "@/components/stock/material-code-field";
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
import { cn } from "@/lib/utils/cn";

type ModelOption = { id: string; name: string };
type BatchOption = { id: string; name: string };

type BomLineOption = {
  id: string;
  boothModelName: string;
  materialCode: string | null;
  materialName: string;
  quantity: string;
  colour: string | null;
  market: string | null;
};

type ReplacementRow = {
  key: string;
  materialQuery: string;
  materialId: string;
  quantity: string;
};

type BatchRow = {
  key: string;
  batchLabel: string;
  manufacturingBatchId: string | null;
  applyToWholeBatch: boolean;
  boothIdsText: string;
};

type Labels = {
  title: string;
  addException: string;
  activeTitle: string;
  activeEmpty: string;
  revert: string;
  name: string;
  notes: string;
  models: string;
  modelsHint: string;
  scopeMarket: string;
  marketAll: string;
  marketDomestic: string;
  marketUs: string;
  scopeColour: string;
  scopeColourHint: string;
  panel: string;
  sourceLine: string;
  sourceLinePlaceholder: string;
  replacements: string;
  addReplacement: string;
  quantity: string;
  batches: string;
  batchesHint: string;
  batchLabel: string;
  wholeBatch: string;
  boothIds: string;
  boothIdsHint: string;
  addBatch: string;
  submit: string;
  cancel: string;
  error: string;
  material: string;
  materialSearchPlaceholder: string;
  materialUnknown: string;
  wildcard: string;
};

type Props = {
  models: ModelOption[];
  batches: BatchOption[];
  materials: MaterialCodeOption[];
  labels: Labels;
};

function lineLabel(line: BomLineOption, wildcard: string): string {
  const parts = [
    line.boothModelName,
    line.materialCode ?? line.materialName,
    line.quantity,
  ];
  if (line.colour) parts.push(line.colour);
  else parts.push(wildcard);
  if (line.market === "US") parts.push("US");
  else if (line.market === "default") parts.push("DOM");
  return parts.join(" · ");
}

export function RecipeExceptionForm({
  models,
  batches,
  materials,
  labels,
  onCancel,
}: Props & { onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [selectedModelIds, setSelectedModelIds] = React.useState<string[]>([]);
  const [scopeMarket, setScopeMarket] = React.useState<"all" | "default" | "US">(
    "all",
  );
  const [scopeColour, setScopeColour] = React.useState("");
  const [panels, setPanels] = React.useState<string[]>([]);
  const [panel, setPanel] = React.useState("");
  const [bomLines, setBomLines] = React.useState<BomLineOption[]>([]);
  const [sourceBomLineId, setSourceBomLineId] = React.useState("");
  const [replacements, setReplacements] = React.useState<ReplacementRow[]>([
    { key: "1", materialQuery: "", materialId: "", quantity: "" },
  ]);
  const [batchRows, setBatchRows] = React.useState<BatchRow[]>([
    {
      key: "1",
      batchLabel: "",
      manufacturingBatchId: null,
      applyToWholeBatch: true,
      boothIdsText: "",
    },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const marketParam =
    scopeMarket === "all" ? undefined : scopeMarket;

  React.useEffect(() => {
    if (selectedModelIds.length === 0) {
      setPanels([]);
      setPanel("");
      setBomLines([]);
      setSourceBomLineId("");
      return;
    }
    const params = new URLSearchParams({
      boothModelIds: selectedModelIds.join(","),
    });
    if (scopeColour.trim()) params.set("scopeColour", scopeColour.trim());
    if (marketParam) params.set("scopeMarket", marketParam);

    let cancelled = false;
    void fetch(`/api/recipe-exceptions/picker?${params}`)
      .then((r) => r.json())
      .then((data: { panels?: string[] }) => {
        if (cancelled) return;
        setPanels(data.panels ?? []);
        setPanel("");
        setBomLines([]);
        setSourceBomLineId("");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedModelIds, scopeColour, marketParam]);

  React.useEffect(() => {
    if (!panel || selectedModelIds.length === 0) {
      setBomLines([]);
      setSourceBomLineId("");
      return;
    }
    const params = new URLSearchParams({
      boothModelIds: selectedModelIds.join(","),
      simpleName: panel,
    });
    if (scopeColour.trim()) params.set("scopeColour", scopeColour.trim());
    if (marketParam) params.set("scopeMarket", marketParam);

    let cancelled = false;
    void fetch(`/api/recipe-exceptions/picker?${params}`)
      .then((r) => r.json())
      .then((data: { lines?: BomLineOption[] }) => {
        if (cancelled) return;
        setBomLines(data.lines ?? []);
        setSourceBomLineId("");
      });
    return () => {
      cancelled = true;
    };
  }, [panel, selectedModelIds, scopeColour, marketParam]);

  function toggleModel(id: string) {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function addReplacement() {
    setReplacements((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        materialQuery: "",
        materialId: "",
        quantity: "",
      },
    ]);
  }

  function addBatchRow() {
    setBatchRows((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        batchLabel: "",
        manufacturingBatchId: null,
        applyToWholeBatch: true,
        boothIdsText: "",
      },
    ]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const replacementLines = replacements
      .filter((r) => r.materialId && r.quantity)
      .map((r) => ({
        materialId: r.materialId,
        quantity: Number(r.quantity),
      }));

    const batchLinks = batchRows
      .map((row) => ({
        batchLabel: row.batchLabel.trim(),
        manufacturingBatchId: row.manufacturingBatchId,
        applyToWholeBatch: row.applyToWholeBatch,
        boothIdTexts: row.boothIdsText
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((b) => b.batchLabel);

    if (!sourceBomLineId) {
      setError(labels.sourceLinePlaceholder);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/recipe-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes: notes.trim() || null,
          boothModelIds: selectedModelIds,
          scopeColour: scopeColour.trim() || null,
          scopeMarket: scopeMarket === "all" ? null : scopeMarket,
          sourceBomLineId,
          replacementLines,
          batchLinks,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? labels.error);
      router.refresh();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exc-name">{labels.name}</Label>
          <Input
            id="exc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="exc-notes">{labels.notes}</Label>
          <Textarea
            id="exc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{labels.models}</Label>
        <p className="text-xs text-muted-foreground">{labels.modelsHint}</p>
        <div className="flex flex-wrap gap-2">
          {models.map((m) => (
            <label
              key={m.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                selectedModelIds.includes(m.id)
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-secondary/60",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedModelIds.includes(m.id)}
                onChange={() => toggleModel(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{labels.scopeMarket}</Label>
          <Select
            value={scopeMarket}
            onValueChange={(v) =>
              setScopeMarket(v as "all" | "default" | "US")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.marketAll}</SelectItem>
              <SelectItem value="default">{labels.marketDomestic}</SelectItem>
              <SelectItem value="US">{labels.marketUs}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exc-colour">{labels.scopeColour}</Label>
          <Input
            id="exc-colour"
            value={scopeColour}
            onChange={(e) => setScopeColour(e.target.value)}
            placeholder={labels.scopeColourHint}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{labels.panel}</Label>
          <Select
            value={panel || undefined}
            onValueChange={setPanel}
            disabled={panels.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {panels.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{labels.sourceLine}</Label>
          <Select
            value={sourceBomLineId || undefined}
            onValueChange={setSourceBomLineId}
            disabled={bomLines.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.sourceLinePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {bomLines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {lineLabel(line, labels.wildcard)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{labels.replacements}</Label>
        <div className="space-y-3">
          {replacements.map((row, index) => (
            <ReplacementRowFields
              key={row.key}
              materials={materials}
              row={row}
              labels={labels}
              onChange={(next) =>
                setReplacements((prev) =>
                  prev.map((r) => (r.key === row.key ? next : r)),
                )
              }
              onRemove={
                replacements.length > 1
                  ? () =>
                      setReplacements((prev) =>
                        prev.filter((r) => r.key !== row.key),
                      )
                  : undefined
              }
              quantityId={`exc-qty-${index}`}
            />
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addReplacement}>
          <Plus className="mr-2 h-4 w-4" />
          {labels.addReplacement}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{labels.batches}</Label>
        <p className="text-xs text-muted-foreground">{labels.batchesHint}</p>
        <div className="space-y-3">
          {batchRows.map((row) => (
            <div
              key={row.key}
              className="space-y-2 rounded-lg border border-border/70 p-3"
            >
              <div className="flex flex-wrap gap-2">
                {batches.length > 0 ? (
                  <Select
                    value={row.manufacturingBatchId ?? "__none__"}
                    onValueChange={(v) => {
                      if (v === "__none__") {
                        setBatchRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? { ...r, manufacturingBatchId: null }
                              : r,
                          ),
                        );
                        return;
                      }
                      const batch = batches.find((b) => b.id === v);
                      setBatchRows((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? {
                                ...r,
                                manufacturingBatchId: v,
                                batchLabel: batch?.name ?? r.batchLabel,
                              }
                            : r,
                        ),
                      );
                    }}
                  >
                    <SelectTrigger className="w-[10rem] shrink-0">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  className="min-w-[12rem] flex-1"
                  placeholder={labels.batchLabel}
                  value={row.batchLabel}
                  onChange={(e) =>
                    setBatchRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, batchLabel: e.target.value }
                          : r,
                      ),
                    )
                  }
                  required
                />
                {batchRows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setBatchRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.applyToWholeBatch}
                  onChange={(e) =>
                    setBatchRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, applyToWholeBatch: e.target.checked }
                          : r,
                      ),
                    )
                  }
                />
                {labels.wholeBatch}
              </label>
              {!row.applyToWholeBatch ? (
                <Input
                  placeholder={labels.boothIdsHint}
                  value={row.boothIdsText}
                  onChange={(e) =>
                    setBatchRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, boothIdsText: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              ) : null}
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addBatchRow}>
          <Plus className="mr-2 h-4 w-4" />
          {labels.addBatch}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || selectedModelIds.length === 0}>
          {labels.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}

function ReplacementRowFields({
  materials,
  row,
  labels,
  onChange,
  onRemove,
  quantityId,
}: {
  materials: MaterialCodeOption[];
  row: ReplacementRow;
  labels: Labels;
  onChange: (row: ReplacementRow) => void;
  onRemove?: () => void;
  quantityId: string;
}) {
  const rowRef = React.useRef(row);
  rowRef.current = row;

  const handleResolved = React.useCallback((material: MaterialCodeOption | null) => {
    const nextId = material?.id ?? "";
    if (rowRef.current.materialId === nextId) return;
    onChange({ ...rowRef.current, materialId: nextId });
  }, [onChange]);

  const fieldLabels = React.useMemo(
    () => ({
      material: labels.material,
      materialSearchPlaceholder: labels.materialSearchPlaceholder,
      materialUnknown: labels.materialUnknown,
    }),
    [labels.material, labels.materialSearchPlaceholder, labels.materialUnknown],
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1">
        <MaterialCodeField
          materials={materials}
          value={row.materialQuery}
          onChange={(q) => {
            if (q === rowRef.current.materialQuery && !rowRef.current.materialId) return;
            onChange({ ...rowRef.current, materialQuery: q, materialId: "" });
          }}
          onResolved={handleResolved}
          inputId={`exc-mat-${row.key}`}
          labels={fieldLabels}
        />
      </div>
      <div className="w-28 space-y-2">
        <Label htmlFor={quantityId}>{labels.quantity}</Label>
        <Input
          id={quantityId}
          type="number"
          min="0"
          step="any"
          value={row.quantity}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })}
          required
        />
      </div>
      {onRemove ? (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export type { Labels as RecipeExceptionLabels };
