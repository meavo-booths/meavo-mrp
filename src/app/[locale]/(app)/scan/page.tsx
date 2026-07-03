import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ScanForm } from "@/components/scan/scan-form";
import { isInvoiceScannerEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isInvoiceScannerEnabled()) notFound();

  const t = await getTranslations("scan");
  const types = await getTranslations("scan.documentType");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <ScanForm
        strings={{
          title: t("title"),
          subtitle: t("subtitle"),
          cameraLabel: t("captureCamera"),
          galleryLabel: t("captureGallery"),
          uploadDrag: t("uploadDrag"),
          uploadBrowse: t("uploadBrowse"),
          uploadHint: t("uploadHint"),
          pasteHint: t("pasteHint"),
          documentTypeLabel: t("documentTypeLabel"),
          typeAuto: types("auto"),
          typeInvoice: types("invoice"),
          typeProforma: types("proforma"),
          typeDelivery: types("delivery_note"),
          uploading: t("uploading"),
          extracting: t("extracting"),
          uploadAnother: t("uploadAnother"),
          errorUpload: t("errorUpload"),
          errorExtract: t("errorExtract"),
          successTitle: t("successTitle"),
          successDescription: t("successDescription"),
          retryLabel: t("uploadAnother"),
        }}
      />
    </div>
  );
}
