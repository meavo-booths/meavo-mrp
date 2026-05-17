import { setRequestLocale, getTranslations } from "next-intl/server";
import { Camera, FileText } from "lucide-react";

import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const stats = await getTranslations("home.stats");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("welcome")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("description")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/scan">
              <Camera className="h-4 w-4" />
              {t("ctaScan")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/documents">
              <FileText className="h-4 w-4" />
              {t("ctaList")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {(
          [
            ["pending", "0"],
            ["approved", "0"],
            ["synced", "0"],
            ["syncFailed", "0"],
          ] as const
        ).map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardDescription>{stats(key)}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
