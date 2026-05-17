import { setRequestLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LocaleNotFound() {
  // Default to bulgarian for the not-found message — middleware would normally
  // set the locale before reaching here.
  setRequestLocale("bg");
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold tracking-tight">404</p>
      <p className="text-muted-foreground">
        Страницата не съществува / Page not found.
      </p>
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
}
