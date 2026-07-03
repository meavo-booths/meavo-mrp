"use client";

import { useTranslations } from "next-intl";

import { MeavoLogo } from "@/components/brand/meavo-logo";

export function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="mt-auto border-t border-border bg-foreground text-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <MeavoLogo showStock className="[&_span]:text-background [&_span.text-muted-foreground]:text-background/70" />
        <p className="text-sm text-background/70">
          © {new Date().getFullYear()} {t("appName")}
        </p>
      </div>
    </footer>
  );
}
