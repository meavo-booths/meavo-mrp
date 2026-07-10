"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils/cn";

export type MaterialCodeOption = {
  id: string;
  code: string | null;
  name: string;
  unit?: string;
};

type Labels = {
  material: string;
  materialSearchPlaceholder: string;
  materialUnknown: string;
};

type Props = {
  value: string;
  onChange: (query: string) => void;
  onResolved: (material: MaterialCodeOption | null) => void;
  labels: Labels;
  inputId?: string;
  className?: string;
};

/** Match typed digits to stored code (exact, zero-padded, or numeric). */
export function resolveMaterialByCode(
  materials: MaterialCodeOption[],
  input: string,
): MaterialCodeOption | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const exact = materials.find((m) => m.code === trimmed);
  if (exact) return exact;

  if (/^\d+$/.test(trimmed)) {
    const padded = trimmed.padStart(4, "0");
    const byPadded = materials.find((m) => m.code === padded);
    if (byPadded) return byPadded;

    const inputNum = trimmed.replace(/^0+/, "") || "0";
    return (
      materials.find((m) => {
        if (!m.code || !/^\d+$/.test(m.code)) return false;
        const codeNum = m.code.replace(/^0+/, "") || "0";
        return codeNum === inputNum;
      }) ?? null
    );
  }

  return null;
}

export function filterMaterialSuggestions(
  materials: MaterialCodeOption[],
  query: string,
  limit = 8,
): MaterialCodeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  type Scored = { material: MaterialCodeOption; score: number };
  const scored: Scored[] = [];

  for (const material of materials) {
    const name = material.name.toLowerCase();
    const code = (material.code ?? "").toLowerCase();

    if (code === q || name === q) {
      scored.push({ material, score: 0 });
    } else if (code.startsWith(q) || name.startsWith(q)) {
      scored.push({ material, score: 1 });
    } else if (name.includes(q) || code.includes(q)) {
      scored.push({ material, score: 2 });
    }
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        (a.material.code ?? "").localeCompare(b.material.code ?? "", "bg") ||
        a.material.name.localeCompare(b.material.name, "bg"),
    )
    .slice(0, limit)
    .map((s) => s.material);
}

function formatMaterialLabel(material: MaterialCodeOption): string {
  return material.code ? `${material.code} — ${material.name}` : material.name;
}

export function MaterialCodeField({
  value,
  onChange,
  onResolved,
  labels,
  inputId = "material-code",
  className,
}: Props) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const [selected, setSelected] = React.useState<MaterialCodeOption | null>(null);
  const [searchResult, setSearchResult] = React.useState<{
    query: string;
    materials: MaterialCodeOption[];
  }>({ query: "", materials: [] });

  // Suggestions come from a debounced server search instead of a client-side
  // scan of the full catalog (which used to be serialized into every page).
  const debouncedQuery = useDebouncedValue(value.trim(), 200);
  const selectedLabel = selected ? formatMaterialLabel(selected) : null;
  const shouldSearch = Boolean(debouncedQuery) && debouncedQuery !== selectedLabel;

  React.useEffect(() => {
    if (!shouldSearch) return;

    const controller = new AbortController();
    fetch(`/api/materials/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { materials: [] }))
      .then((data: { materials?: MaterialCodeOption[] }) => {
        setSearchResult({ query: debouncedQuery, materials: data.materials ?? [] });
      })
      .catch((err: unknown) => {
        // Aborted requests are superseded; anything else resolves to no results.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSearchResult({ query: debouncedQuery, materials: [] });
        }
      });
    return () => controller.abort();
  }, [shouldSearch, debouncedQuery]);

  const options = React.useMemo(
    () =>
      shouldSearch && searchResult.query === debouncedQuery
        ? searchResult.materials
        : [],
    [shouldSearch, searchResult, debouncedQuery],
  );
  const searching = shouldSearch && searchResult.query !== debouncedQuery;

  const isCodeQuery = /^\d+$/.test(value.trim());
  const codeMatch = React.useMemo(
    () => (isCodeQuery ? resolveMaterialByCode(options, value) : null),
    [options, value, isCodeQuery],
  );

  const suggestions = React.useMemo(() => {
    if (!value.trim() || codeMatch) return [];
    return filterMaterialSuggestions(options, value);
  }, [options, value, codeMatch]);

  const resolved = selected ?? codeMatch;
  const resolvedId = resolved?.id ?? null;
  const onResolvedRef = React.useRef(onResolved);
  const prevResolvedIdRef = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    onResolvedRef.current = onResolved;
  });

  React.useEffect(() => {
    if (prevResolvedIdRef.current === resolvedId) return;
    prevResolvedIdRef.current = resolvedId;
    onResolvedRef.current(resolved);
  }, [resolved, resolvedId]);

  // Reset highlight when the visible list changes (adjust-state-during-render pattern).
  const listKey = `${value}\u0000${suggestions.length}`;
  const [prevListKey, setPrevListKey] = React.useState(listKey);
  if (listKey !== prevListKey) {
    setPrevListKey(listKey);
    setHighlightIndex(0);
  }

  if (!value.trim() && selected !== null) {
    setSelected(null);
  }

  React.useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pickMaterial(material: MaterialCodeOption) {
    setSelected(material);
    onChange(formatMaterialLabel(material));
    setOpen(false);
  }

  function onInputChange(next: string) {
    setSelected(null);
    onChange(next);
    setOpen(true);
  }

  const pendingSearch =
    searching || (Boolean(value.trim()) && value.trim() !== debouncedQuery);
  const showSuggestions = open && suggestions.length > 0 && !codeMatch;
  const showUnknown =
    value.trim().length > 0 &&
    !resolved &&
    !showSuggestions &&
    !pendingSearch &&
    !isCodeQuery;
  const showCodeUnknown =
    isCodeQuery &&
    value.trim().length > 0 &&
    !codeMatch &&
    !pendingSearch &&
    suggestions.length === 0;

  return (
    <div ref={rootRef} className={cn("relative space-y-2", className)}>
      <Label htmlFor={inputId}>{labels.material}</Label>
      <Input
        id={inputId}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? `${inputId}-listbox` : undefined}
        className="font-normal"
        placeholder={labels.materialSearchPlaceholder}
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showSuggestions) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && suggestions[highlightIndex]) {
            e.preventDefault();
            pickMaterial(suggestions[highlightIndex]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showSuggestions ? (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {suggestions.map((material, index) => (
            <li key={material.id} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent",
                  index === highlightIndex && "bg-accent",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMaterial(material)}
              >
                {material.code ? (
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {material.code}
                  </span>
                ) : null}
                <span className="min-w-0">{material.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {resolved ? (
        <p className="text-sm text-muted-foreground">{resolved.name}</p>
      ) : showCodeUnknown || showUnknown ? (
        <p className="text-sm text-destructive">{labels.materialUnknown}</p>
      ) : null}
    </div>
  );
}
