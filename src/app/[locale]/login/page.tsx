import { setRequestLocale, getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-content-center rounded-md bg-primary text-primary-foreground">
            MS
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm
          googleLabel={t("google")}
          errorTitle={t("errorTitle")}
          tryAgainLabel={t("tryAgain")}
          error={sp.error ?? null}
          next={sp.next ?? "/"}
        />
      </div>
    </div>
  );
}
