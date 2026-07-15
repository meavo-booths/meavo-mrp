import { setRequestLocale, getTranslations } from "next-intl/server";

import { AdminAccessSettings } from "@/components/settings/admin-access-settings";
import { TopMaterialsSettings } from "@/components/settings/top-materials-settings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/session";
import { getAdminAccessDetail } from "@/lib/settings/admin-access";
import { getTopMaterialsDetail } from "@/lib/settings/top-materials";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireSessionUser();
  const t = await getTranslations("settings");
  const isAdmin = user.role === "admin";

  const [adminAccess, topMaterials] = await Promise.all([
    isAdmin ? getAdminAccessDetail() : Promise.resolve(null),
    getTopMaterialsDetail(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("access.currentTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{user.email}</span>
          <Badge variant={isAdmin ? "default" : "outline"}>
            {t(`access.roles.${user.role}`)}
          </Badge>
        </CardContent>
      </Card>

      {isAdmin && adminAccess ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("adminAccess.title")}</CardTitle>
            <CardDescription>{t("adminAccess.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminAccessSettings
              bootstrapEmails={adminAccess.bootstrapEmails}
              initialConfiguredEmails={adminAccess.configuredEmails}
              storageConfigured={adminAccess.storageConfigured}
              labels={{
                pasteLabel: t("adminAccess.pasteLabel"),
                pastePlaceholder: t("adminAccess.pastePlaceholder"),
                pasteHelp: t("adminAccess.pasteHelp"),
                applyPaste: t("adminAccess.applyPaste"),
                addLabel: t("adminAccess.addLabel"),
                addPlaceholder: t("adminAccess.addPlaceholder"),
                addButton: t("adminAccess.addButton"),
                bootstrapLabel: t("adminAccess.bootstrapLabel"),
                bootstrapHelp: t("adminAccess.bootstrapHelp"),
                configuredLabel: t("adminAccess.configuredLabel"),
                configuredEmpty: t("adminAccess.configuredEmpty"),
                configuredCount: t("adminAccess.configuredCount"),
                remove: t("adminAccess.remove"),
                save: t("adminAccess.save"),
                saving: t("adminAccess.saving"),
                saved: t("adminAccess.saved"),
                error: t("adminAccess.error"),
                invalidEmail: t("adminAccess.invalidEmail"),
                storageUnavailable: t("adminAccess.storageUnavailable"),
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("topMaterials.title")}</CardTitle>
          <CardDescription>{t("topMaterials.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TopMaterialsSettings
            initialEntries={topMaterials.entries}
            canEdit={isAdmin}
            storageConfigured={topMaterials.storageConfigured}
            labels={{
              title: t("topMaterials.title"),
              description: t("topMaterials.description"),
              pasteLabel: t("topMaterials.pasteLabel"),
              pastePlaceholder: t("topMaterials.pastePlaceholder"),
              pasteHelp: t("topMaterials.pasteHelp"),
              applyPaste: t("topMaterials.applyPaste"),
              addLabel: t("topMaterials.addLabel"),
              addPlaceholder: t("topMaterials.addPlaceholder"),
              addButton: t("topMaterials.addButton"),
              listLabel: t("topMaterials.listLabel"),
              listEmpty: t("topMaterials.listEmpty"),
              unknownCode: t("topMaterials.unknownCode"),
              moveUp: t("topMaterials.moveUp"),
              moveDown: t("topMaterials.moveDown"),
              remove: t("topMaterials.remove"),
              save: t("topMaterials.save"),
              saving: t("topMaterials.saving"),
              saved: t("topMaterials.saved"),
              error: t("topMaterials.error"),
              readOnly: t("topMaterials.readOnly"),
              storageUnavailable: t("topMaterials.storageUnavailable"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
