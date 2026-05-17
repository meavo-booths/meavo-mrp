import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getOriginalSignedUrl } from "@/lib/storage/buckets";
import { buildDefaultsFromDocument } from "@/lib/extractor/from-document";
import type { ConfidenceMap } from "@/lib/extractor/schema";
import { ReviewForm } from "@/components/documents/review-form";
import { DocumentImage } from "@/components/documents/document-image";
import { StatusBadge } from "@/components/documents/status-badge";
import { ZoneBadge } from "@/components/documents/zone-badge";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/documents/${id}`)}`,
    );
  }

  const doc = await db.query.documents.findFirst({
    where: eq(schema.documents.id, id),
  });
  if (!doc) notFound();
  if (doc.createdBy !== user.id) notFound();

  const items = await db.query.lineItems.findMany({
    where: eq(schema.lineItems.documentId, id),
    orderBy: (li, { asc }) => [asc(li.position)],
  });

  let signedUrl: string | null = null;
  try {
    signedUrl = await getOriginalSignedUrl(doc.originalFilePath, 60 * 60);
  } catch {
    signedUrl = null;
  }

  const defaults = buildDefaultsFromDocument(doc, items);
  const confidence = (doc.confidence as ConfidenceMap | null) ?? {};

  const r = await getTranslations("review");
  const f = await getTranslations("review.fields");
  const li = await getTranslations("review.lineItem");
  const sec = await getTranslations("review.sections");
  const dt = await getTranslations("scan.documentType");
  const dz = await getTranslations("deliveryZone");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{r("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {dt(doc.type)}
            {doc.documentNumber ? ` · #${doc.documentNumber}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoneBadge zone={doc.deliveryZone} />
          <StatusBadge status={doc.status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,540px)]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-16 lg:h-[calc(100vh-9rem)]">
          {signedUrl ? (
            <DocumentImage
              src={signedUrl}
              mimeType={doc.originalMimeType}
              alt={doc.documentNumber ?? "document"}
            />
          ) : (
            <div className="grid h-72 place-content-center rounded-md border bg-muted text-sm text-muted-foreground">
              No preview available
            </div>
          )}
        </div>
        <div className="order-1 lg:order-2">
          <ReviewForm
            documentId={doc.id}
            defaults={defaults}
            confidence={confidence}
            isApproved={doc.status === "approved" || doc.status === "synced"}
            strings={{
              sectionHeader: sec("header"),
              sectionSupplier: sec("supplier"),
              sectionLineItems: sec("lineItems"),
              sectionTotals: sec("totals"),
              sectionZone: sec("zone"),
              fieldDocumentNumber: f("documentNumber"),
              fieldIssueDate: f("issueDate"),
              fieldDueDate: f("dueDate"),
              fieldDeliveryDate: f("deliveryDate"),
              fieldType: r("title"),
              typeInvoice: dt("invoice"),
              typeProforma: dt("proforma"),
              typeDelivery: dt("delivery_note"),
              fieldSupplierName: f("supplierName"),
              fieldSupplierVat: f("supplierVat"),
              fieldSupplierEik: f("supplierEik"),
              fieldSupplierCountry: f("supplierCountry"),
              fieldSupplierAddress: f("supplierAddress"),
              fieldCurrency: f("currency"),
              fieldSubtotal: f("subtotal"),
              fieldVatTotal: f("vatTotal"),
              fieldTotal: f("total"),
              fieldZone: f("deliveryZone"),
              fieldCustomsRef: f("customsRef"),
              liPosition: li("position"),
              liName: li("name"),
              liSku: li("sku"),
              liQuantity: li("quantity"),
              liUnit: li("unit"),
              liUnitPrice: li("unitPrice"),
              liVatRate: li("vatRate"),
              liLineTotal: li("lineTotal"),
              addLine: r("addLine"),
              removeLine: r("removeLine"),
              saveDraft: r("saveDraft"),
              approveAndSync: r("approveAndSync"),
              rejectDocument: r("rejectDocument"),
              lowConfidence: r("lowConfidence"),
              aiSuggested: r("aiSuggested", { value: "" }),
              zoneLocal: dz("local"),
              zoneEu: dz("eu"),
              zoneNonEu: dz("non_eu"),
            }}
          />
        </div>
      </div>
    </div>
  );
}
