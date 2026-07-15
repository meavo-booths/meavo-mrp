import { setRequestLocale, getTranslations } from "next-intl/server";

import { TopMaterialsSettings } from "@/components/settings/top-materials-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/session";
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

  const detail = await getTopMaterialsDetail();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("topMaterials.title")}</CardTitle>
          <CardDescription>{t("topMaterials.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TopMaterialsSettings
            initialEntries={detail.entries}
            canEdit={user.role === "admin"}
            storageConfigured={detail.storageConfigured}
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
              listCount: t("topMaterials.listCount"),
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
