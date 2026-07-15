"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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

function entriesToMap(entries: TopMaterialEntry[]): Map<string, TopMaterialEntry> {
  return new Map(entries.map((entry) => [entry.code.toLowerCase(), entry]));
}

export function TopMaterialsSettings({
  initialEntries,
  canEdit,
  storageConfigured,
  labels,
}: Props) {
  const t = useTranslations("settings.topMaterials");
  const [codes, setCodes] = React.useState(
    () => initialEntries.map((entry) => entry.code),
  );
  const [entriesByCode, setEntriesByCode] = React.useState(() =>
    entriesToMap(initialEntries),
  );
  const [paste, setPaste] = React.useState("");
  const [addQuery, setAddQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refreshEntries = React.useCallback(async (nextCodes: string[]) => {
    if (nextCodes.length === 0) {
      setEntriesByCode(new Map());
      return;
    }

    setResolving(true);
    try {
      const res = await fetch("/api/settings/top-materials/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: nextCodes }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        entries?: TopMaterialEntry[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? labels.error);
      }
      if (data.entries) {
        setEntriesByCode(entriesToMap(data.entries));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setResolving(false);
    }
  }, [labels.error]);

  function rememberMaterial(material: MaterialCodeOption | null) {
    if (!material?.code) return;
    setEntriesByCode((prev) => {
      const next = new Map(prev);
      next.set(material.code!.toLowerCase(), {
        code: material.code!,
        name: material.name,
        materialId: material.id,
        found: true,
      });
      return next;
    });
  }

  async function addCode(raw: string, material?: MaterialCodeOption | null) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    let nextCodes: string[] = [];
    setCodes((prev) => {
      const exists = prev.some(
        (code) => code.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) return prev;
      nextCodes = normalizeMaterialCodeList([...prev, trimmed]);
      return nextCodes;
    });

    if (nextCodes.length === 0) return;

    if (material?.code) {
      rememberMaterial(material);
    } else {
      await refreshEntries(nextCodes);
    }
    setAddQuery("");
    setMessage(null);
    setError(null);
  }

  async function applyPaste() {
    const parsed = parseMaterialCodeList(paste);
    if (parsed.length === 0) return;
    const next = normalizeMaterialCodeList(parsed);
    setCodes(next);
    setPaste("");
    setMessage(null);
    setError(null);
    await refreshEntries(next);
  }

  function removeCode(index: number) {
    setCodes((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setEntriesByCode((entries) => {
        const map = new Map(entries);
        const removed = prev[index]?.toLowerCase();
        if (removed) map.delete(removed);
        return map;
      });
      return next;
    });
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
        setEntriesByCode(entriesToMap(data.entries));
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
              disabled={!storageConfigured || !paste.trim() || resolving}
            >
              {labels.applyPaste}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="top-materials-add">{labels.addLabel}</Label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <MaterialCodeField
                inputId="top-materials-add"
                hideLabel
                value={addQuery}
                onChange={setAddQuery}
                onResolved={(material) => {
                  if (material?.code) void addCode(material.code, material);
                }}
                labels={{
                  material: labels.addLabel,
                  materialSearchPlaceholder: labels.addPlaceholder,
                  materialUnknown: labels.unknownCode,
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                onClick={() => void addCode(addQuery)}
                disabled={
                  !storageConfigured ||
                  !addQuery.trim() ||
                  resolving
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
            {t("listCount", { count: codes.length })}
          </span>
        </div>

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.listEmpty}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {codes.map((code, index) => {
              const entry = entriesByCode.get(code.toLowerCase());
              const found = entry?.found ?? false;
              const name = entry?.name ?? null;
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
                        found ?
                          "truncate text-muted-foreground"
                        : "truncate text-amber-800"
                      }
                    >
                      {resolving && !entry ?
                        t("resolving")
                      : found && name ?
                        name
                      : labels.unknownCode}
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
            disabled={pending || resolving || !storageConfigured}
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
