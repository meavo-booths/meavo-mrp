"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  MaterialCodeField,
  type MaterialCodeOption,
} from "@/components/stock/material-code-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeMaterialCodeList,
  parseMaterialCodeList,
  TOP_MATERIALS_MAX,
} from "@/lib/settings/parse-code-list";

export type TopMaterialEntry = {
  code: string;
  name: string | null;
  materialId: string | null;
  found: boolean;
};

type Labels = {
  title: string;
  description: string;
  pasteLabel: string;
  pastePlaceholder: string;
  pasteHelp: string;
  applyPaste: string;
  addLabel: string;
  addPlaceholder: string;
  addButton: string;
  listLabel: string;
  listEmpty: string;
  listCount: string;
  unknownCode: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  readOnly: string;
  storageUnavailable: string;
};

type Props = {
  initialEntries: TopMaterialEntry[];
  canEdit: boolean;
  storageConfigured: boolean;
  labels: Labels;
};

export function TopMaterialsSettings({
  initialEntries,
  canEdit,
  storageConfigured,
  labels,
}: Props) {
  const [codes, setCodes] = React.useState(
    () => initialEntries.map((entry) => entry.code),
  );
  const [namesByCode, setNamesByCode] = React.useState(() => {
    const map = new Map<string, string | null>();
    for (const entry of initialEntries) {
      map.set(entry.code.toLowerCase(), entry.name);
    }
    return map;
  });
  const [paste, setPaste] = React.useState("");
  const [addQuery, setAddQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function rememberMaterial(material: MaterialCodeOption | null) {
    if (!material?.code) return;
    setNamesByCode((prev) => {
      const next = new Map(prev);
      next.set(material.code!.toLowerCase(), material.name);
      return next;
    });
  }

  function addCode(raw: string, material?: MaterialCodeOption | null) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCodes((prev) => {
      const exists = prev.some(
        (code) => code.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) return prev;
      const next = normalizeMaterialCodeList([...prev, trimmed]);
      return next;
    });

    if (material?.code) {
      rememberMaterial(material);
    }
    setAddQuery("");
    setMessage(null);
    setError(null);
  }

  function applyPaste() {
    const parsed = parseMaterialCodeList(paste);
    if (parsed.length === 0) return;
    setCodes(normalizeMaterialCodeList(parsed));
    setPaste("");
    setMessage(null);
    setError(null);
  }

  function removeCode(index: number) {
    setCodes((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
    setError(null);
  }

  function moveCode(index: number, direction: -1 | 1) {
    setCodes((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setMessage(null);
    setError(null);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/top-materials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entries?: TopMaterialEntry[];
        codes?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? labels.error);
      }

      if (data.codes) setCodes(data.codes);
      if (data.entries) {
        setNamesByCode(
          new Map(
            data.entries.map((entry) => [
              entry.code.toLowerCase(),
              entry.name,
            ]),
          ),
        );
      }
      setMessage(labels.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {!storageConfigured ? (
        <p className="rounded-lg border border-amber-300/80 bg-[#F4E3B1] px-4 py-3 text-sm text-amber-950">
          {labels.storageUnavailable}
        </p>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
      ) : null}

      {canEdit ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="top-materials-paste">{labels.pasteLabel}</Label>
            <Textarea
              id="top-materials-paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={labels.pastePlaceholder}
              rows={5}
              disabled={!storageConfigured}
            />
            <p className="text-sm text-muted-foreground">{labels.pasteHelp}</p>
            <Button
              type="button"
              variant="outline"
              onClick={applyPaste}
              disabled={!storageConfigured || !paste.trim()}
            >
              {labels.applyPaste}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="top-materials-add">{labels.addLabel}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <MaterialCodeField
                inputId="top-materials-add"
                value={addQuery}
                onChange={setAddQuery}
                onResolved={(material) => {
                  if (material?.code) addCode(material.code, material);
                }}
                labels={{
                  material: labels.addLabel,
                  materialSearchPlaceholder: labels.addPlaceholder,
                  materialUnknown: labels.unknownCode,
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => addCode(addQuery)}
                disabled={
                  !storageConfigured ||
                  !addQuery.trim() ||
                  codes.length >= TOP_MATERIALS_MAX
                }
              >
                <Plus className="h-4 w-4" />
                {labels.addButton}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>{labels.listLabel}</Label>
          <span className="text-sm text-muted-foreground">
            {labels.listCount.replace("{count}", String(codes.length))}
          </span>
        </div>

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.listEmpty}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {codes.map((code, index) => {
              const name = namesByCode.get(code.toLowerCase());
              const known = name != null;
              return (
                <li
                  key={`${code}-${index}`}
                  className="flex items-center gap-2 px-3 py-3 text-sm"
                >
                  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">{code}</p>
                    <p
                      className={
                        known ?
                          "truncate text-muted-foreground"
                        : "truncate text-amber-800"
                      }
                    >
                      {known ? name : labels.unknownCode}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={labels.moveUp}
                        disabled={index === 0}
                        onClick={() => moveCode(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={labels.moveDown}
                        disabled={index === codes.length - 1}
                        onClick={() => moveCode(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={labels.remove}
                        onClick={() => removeCode(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onSave}
            disabled={pending || !storageConfigured}
          >
            {pending ? labels.saving : labels.save}
          </Button>
          {message ? (
            <p className="text-sm text-primary">{message}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
