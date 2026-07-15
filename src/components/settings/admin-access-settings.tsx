"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidEmail,
  normalizeEmail,
  parseEmailList,
} from "@/lib/settings/parse-email-list";

type Labels = {
  pasteLabel: string;
  pastePlaceholder: string;
  pasteHelp: string;
  applyPaste: string;
  addLabel: string;
  addPlaceholder: string;
  addButton: string;
  bootstrapLabel: string;
  bootstrapHelp: string;
  configuredLabel: string;
  configuredEmpty: string;
  configuredCount: string;
  remove: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  invalidEmail: string;
  storageUnavailable: string;
};

type Props = {
  bootstrapEmails: string[];
  initialConfiguredEmails: string[];
  storageConfigured: boolean;
  labels: Labels;
};

export function AdminAccessSettings({
  bootstrapEmails,
  initialConfiguredEmails,
  storageConfigured,
  labels,
}: Props) {
  const [emails, setEmails] = React.useState(initialConfiguredEmails);
  const [paste, setPaste] = React.useState("");
  const [addValue, setAddValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const bootstrapSet = React.useMemo(
    () => new Set(bootstrapEmails.map(normalizeEmail)),
    [bootstrapEmails],
  );

  function addEmail(raw: string) {
    const email = normalizeEmail(raw);
    if (!email) return;
    if (!isValidEmail(email)) {
      setError(labels.invalidEmail);
      return;
    }
    if (bootstrapSet.has(email)) return;

    setEmails((prev) => {
      if (prev.some((item) => normalizeEmail(item) === email)) return prev;
      return [...prev, email];
    });
    setAddValue("");
    setError(null);
    setMessage(null);
  }

  function applyPaste() {
    const parsed = parseEmailList(paste).filter(
      (email) => !bootstrapSet.has(email),
    );
    if (parsed.length === 0) return;
    setEmails(parsed);
    setPaste("");
    setMessage(null);
    setError(null);
  }

  function removeEmail(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
    setError(null);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/admin-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        configuredEmails?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? labels.error);
      }
      if (data.configuredEmails) setEmails(data.configuredEmails);
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

      <div className="space-y-2">
        <Label>{labels.bootstrapLabel}</Label>
        <p className="text-sm text-muted-foreground">{labels.bootstrapHelp}</p>
        <ul className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          {bootstrapEmails.map((email) => (
            <li key={email} className="py-1 tabular-nums">
              {email}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-emails-paste">{labels.pasteLabel}</Label>
        <Textarea
          id="admin-emails-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={labels.pastePlaceholder}
          rows={4}
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
        <Label htmlFor="admin-email-add">{labels.addLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="admin-email-add"
            type="email"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            placeholder={labels.addPlaceholder}
            disabled={!storageConfigured}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => addEmail(addValue)}
            disabled={!storageConfigured || !addValue.trim()}
          >
            <Plus className="h-4 w-4" />
            {labels.addButton}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>{labels.configuredLabel}</Label>
          <span className="text-sm text-muted-foreground">
            {labels.configuredCount.replace("{count}", String(emails.length))}
          </span>
        </div>

        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.configuredEmpty}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {emails.map((email, index) => (
              <li
                key={email}
                className="flex items-center justify-between gap-2 px-3 py-3 text-sm"
              >
                <span className="tabular-nums">{email}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={labels.remove}
                  onClick={() => removeEmail(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onSave}
          disabled={pending || !storageConfigured}
        >
          {pending ? labels.saving : labels.save}
        </Button>
        {message ? <p className="text-sm text-primary">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
