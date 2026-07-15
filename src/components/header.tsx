"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import {
  Camera,
  ClipboardList,
  Factory,
  FileText,
  Globe,
  Home,
  Package,
  ScrollText,
  Settings,
  Truck,
  Zap,
} from "lucide-react";

import { MeavoLogo } from "@/components/brand/meavo-logo";
import { NavIcon } from "@/components/brand/nav-icon";
import { Link, usePathname } from "@/i18n/navigation";
import { isInvoiceScannerEnabled } from "@/lib/features-client";
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
  const scannerOn = isInvoiceScannerEnabled();

  const onLocaleChange = (next: string) => {
    router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
  };

  const stockItems = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/materials", label: t("materials"), icon: Package },
    { href: "/electrics", label: t("electrics"), icon: Zap },
    { href: "/stock/receipt", label: t("receipt"), icon: Truck },
    { href: "/inventory", label: t("inventory"), icon: ClipboardList },
    { href: "/batches", label: t("batches"), icon: Factory },
    { href: "/recipes", label: t("recipes"), icon: ScrollText },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const legacyItems = scannerOn
    ? [
        { href: "/scan", label: t("scan"), icon: Camera },
        { href: "/documents", label: t("documents"), icon: FileText },
      ]
    : [];

  const items = [...stockItems, ...legacyItems];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-2 px-4 sm:px-6 lg:gap-3 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <MeavoLogo />
        </Link>
        <nav className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:ml-2 sm:gap-1 lg:overflow-x-visible">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium transition-colors hover:bg-secondary sm:gap-2 sm:px-2.5",
                  active && "bg-secondary text-foreground",
                )}
              >
                <NavIcon icon={Icon} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Select value={locale} onValueChange={onLocaleChange}>
            <SelectTrigger
              className="h-9 w-[76px] border-border bg-card"
              aria-label={tc("language")}
            >
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
