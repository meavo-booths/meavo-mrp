"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { CsvDataPanel } from "@/components/stock/csv-data-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type CsvLabels = {
  panelListTitle: string;
  panelListDescription: string;
  recipesCsvTitle: string;
  recipesCsvDescription: string;
  recipesCsvFooterHelp: string;
  template: string;
  export: string;
  upload: string;
  uploading: string;
  created: string;
  updated: string;
  skipped: string;
  errors: string;
  warnings: string;
  row: string;
};

type Props = {
  title: React.ReactNode;
  updateLabel: string;
  csvLabels: CsvLabels;
  children: React.ReactNode;
};

export function RecipesPageShell({
  title,
  updateLabel,
  csvLabels,
  children,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const csvCommon = {
    template: csvLabels.template,
    export: csvLabels.export,
    upload: csvLabels.upload,
    uploading: csvLabels.uploading,
    created: csvLabels.created,
    updated: csvLabels.updated,
    skipped: csvLabels.skipped,
    errors: csvLabels.errors,
    warnings: csvLabels.warnings,
    row: csvLabels.row,
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {title}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1 self-start"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {updateLabel}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>

      {open ? (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <CsvDataPanel
            kind="elements"
            labels={{
              title: csvLabels.panelListTitle,
              description: csvLabels.panelListDescription,
              ...csvCommon,
            }}
          />
          <CsvDataPanel
            kind="element-bom"
            labels={{
              title: csvLabels.recipesCsvTitle,
              description: csvLabels.recipesCsvDescription,
              footerHelp: csvLabels.recipesCsvFooterHelp,
              ...csvCommon,
            }}
          />
        </div>
      ) : null}

      {children}
    </>
  );
}
