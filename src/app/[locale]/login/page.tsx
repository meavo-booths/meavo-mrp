import { setRequestLocale, getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { MeavoLogo } from "@/components/brand/meavo-logo";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <MeavoLogo className="text-2xl" />
          </div>
          <h1 className="text-page-title">{t("title")}</h1>
          <p className="mt-2 text-base text-muted-foreground">{t("subtitle")}</p>
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
