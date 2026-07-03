"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

import {
  RecipeExceptionForm,
  type RecipeExceptionLabels,
} from "@/components/stock/recipe-exception-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ModelOption = { id: string; name: string };
type BatchOption = { id: string; name: string };
type MaterialOption = { id: string; code: string | null; name: string };

export type ExceptionListItem = {
  id: string;
  name: string;
  notes: string | null;
  modelNames: string[];
  batchLabels: string[];
  changeSummary: string;
};

type Props = {
  models: ModelOption[];
  batches: BatchOption[];
  materials: MaterialOption[];
  activeExceptions: ExceptionListItem[];
  labels: RecipeExceptionLabels & {
    activeTitle: string;
    activeEmpty: string;
    revert: string;
    addException: string;
  };
};

export function RecipeExceptionsSection({
  models,
  batches,
  materials,
  activeExceptions,
  labels,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [revertingId, setRevertingId] = React.useState<string | null>(null);

  async function onRevert(id: string) {
    setRevertingId(id);
    try {
      await fetch(`/api/recipe-exceptions/${id}/revert`, { method: "POST" });
      router.refresh();
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <section className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="text-sm font-semibold">{labels.title}</span>
          {activeExceptions.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {activeExceptions.length}
            </span>
          ) : null}
        </button>
        {open ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {labels.addException}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-4">
          {showForm ? (
            <RecipeExceptionForm
              models={models}
              batches={batches}
              materials={materials}
              labels={labels}
              onCancel={() => setShowForm(false)}
            />
          ) : null}

          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.activeTitle}
            </h3>
            {activeExceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.activeEmpty}</p>
            ) : (
              <ul className="divide-y rounded-xl border border-border text-sm">
                {activeExceptions.map((exc) => (
                  <li
                    key={exc.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{exc.name}</p>
                      {exc.changeSummary ? (
                        <p className="text-muted-foreground">{exc.changeSummary}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {exc.modelNames.join(", ")}
                        {exc.batchLabels.length > 0
                          ? ` · ${exc.batchLabels.join(", ")}`
                          : ""}
                      </p>
                      {exc.notes ? (
                        <p className="text-xs text-muted-foreground">{exc.notes}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revertingId === exc.id}
                      onClick={() => onRevert(exc.id)}
                    >
                      {labels.revert}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
