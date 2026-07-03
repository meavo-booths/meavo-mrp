"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ImportResult } from "@/lib/import/types";

type Props = {
  kind: "materials" | "opening-stock" | "elements" | "element-bom";
  labels: {
    title: string;
    description: string;
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
    help?: string;
    footerHelp?: string;
  };
};

export function CsvDataPanel({ kind, labels }: Props) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    setUploadError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/import/${kind}`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok && !data.errors) {
        throw new Error(data.error ?? "Import failed");
      }
      setResult(data);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="font-medium">{labels.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
        {labels.help ? (
          <p className="mt-2 text-xs text-muted-foreground">{labels.help}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/import/templates/${kind}`} download>
            <Download className="mr-2 h-4 w-4" />
            {labels.template}
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/import/export/${kind}`} download>
            <Download className="mr-2 h-4 w-4" />
            {labels.export}
          </a>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {pending ? labels.uploading : labels.upload}
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {uploadError ? (
        <p className="text-sm text-destructive">{uploadError}</p>
      ) : null}

      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            {labels.created}: {result.created} · {labels.updated}: {result.updated}
            {result.skipped > 0 ? ` · ${labels.skipped}: ${result.skipped}` : ""}
          </p>
          {result.warnings.length > 0 ? (
            <div>
              <p className="font-medium text-amber-600">{labels.warnings}</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-muted-foreground">
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    {labels.row} {w.row}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.errors.length > 0 ? (
            <div>
              <p className="font-medium text-destructive">{labels.errors}</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-muted-foreground">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `${labels.row} ${e.row}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {labels.footerHelp ? (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {labels.footerHelp}
        </p>
      ) : null}
    </div>
  );
}
