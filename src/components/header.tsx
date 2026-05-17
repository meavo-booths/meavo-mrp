"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Camera, FileText, ScanLine, Globe } from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const onLocaleChange = (next: string) => {
    router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
  };

  const items = [
    { href: "/", label: t("home"), icon: ScanLine },
    { href: "/scan", label: t("scan"), icon: Camera },
    { href: "/documents", label: t("documents"), icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden
            className="grid h-7 w-7 place-content-center rounded-md bg-primary text-primary-foreground text-xs"
          >
            MS
          </span>
          <span className="hidden sm:inline">{tc("appName")}</span>
        </Link>
        <nav className="ml-2 flex flex-1 items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent",
                  active && "bg-accent font-medium",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Select value={locale} onValueChange={onLocaleChange}>
            <SelectTrigger className="h-8 w-[80px]" aria-label={tc("language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((l) => (
                <SelectItem key={l} value={l}>
                  {l.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
