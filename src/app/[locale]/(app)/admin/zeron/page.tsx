import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { ExternalLink } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { ZoneBadge } from "@/components/documents/zone-badge";
import { RetryButton } from "@/components/admin/retry-button";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ZeronAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/zeron`)}`,
    );
  }

  const t = await getTranslations("admin.zeron");
  const adapterT = await getTranslations("admin.zeron.adapter");
  const dt = await getTranslations("scan.documentType");

  const adapterKey = env.ZERON_ADAPTER;

  // Pull the most recent attempts (and their parent documents)
  const attempts = await db
    .select({
      id: schema.syncAttempts.id,
      documentId: schema.syncAttempts.documentId,
      adapter: schema.syncAttempts.adapter,
      status: schema.syncAttempts.status,
      error: schema.syncAttempts.error,
      response: schema.syncAttempts.response,
      attemptedAt: schema.syncAttempts.attemptedAt,
      completedAt: schema.syncAttempts.completedAt,
      isCurrent: schema.syncAttempts.isCurrent,
      docNumber: schema.documents.documentNumber,
      docType: schema.documents.type,
      docStatus: schema.documents.status,
      docZone: schema.documents.deliveryZone,
      supplierName: schema.suppliers.name,
    })
    .from(schema.syncAttempts)
    .leftJoin(
      schema.documents,
      eq(schema.syncAttempts.documentId, schema.documents.id),
    )
    .leftJoin(
      schema.suppliers,
      eq(schema.documents.supplierId, schema.suppliers.id),
    )
    .orderBy(desc(schema.syncAttempts.attemptedAt))
    .limit(100);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{t("currentAdapter")}</CardDescription>
          <CardTitle className="text-lg">
            {adapterT(adapterKey as "stub" | "export" | "api" | "agent")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (env <code>ZERON_ADAPTER={adapterKey}</code>)
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {attempts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          —
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Document</th>
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium">Adapter</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Attempted</th>
                  <th className="px-4 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {attempts.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-2">
                      <Link
                        href={`/documents/${row.documentId}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {row.docNumber ?? "(no number)"}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {row.docType ? dt(row.docType) : "—"}
                        {" · "}
                        <ZoneBadge zone={row.docZone} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {row.supplierName ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">
                        {adapterT(row.adapter)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <SyncStatus status={row.status} />
                      {row.error ? (
                        <p className="mt-1 max-w-md text-xs text-destructive">
                          {row.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.attemptedAt, locale)}
                      {row.completedAt ? (
                        <>
                          {" → "}
                          {formatDate(row.completedAt, locale)}
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RetryButton
                        documentId={row.documentId}
                        disabled={row.status === "running"}
                      />
                      {row.docStatus ? (
                        <div className="mt-1">
                          <StatusBadge status={row.docStatus} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SyncStatus({
  status,
}: {
  status: "queued" | "running" | "succeeded" | "failed";
}) {
  const v =
    status === "succeeded"
      ? ("default" as const)
      : status === "failed"
        ? ("destructive" as const)
        : status === "running"
          ? ("warn" as const)
          : ("outline" as const);
  return <Badge variant={v}>{status}</Badge>;
}
