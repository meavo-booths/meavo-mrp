import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { isInvoiceScannerEnabled } from "@/lib/features";
import { StatusBadge } from "@/components/documents/status-badge";
import { ZoneBadge } from "@/components/documents/zone-badge";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isInvoiceScannerEnabled()) notFound();
  const user = await requireSessionUser();

  const t = await getTranslations("documents");
  const tType = await getTranslations("scan.documentType");

  const docs = await prisma.mrpDocument.findMany({
    where: { createdById: user.id },
    select: {
      id: true,
      type: true,
      documentNumber: true,
      issueDate: true,
      total: true,
      currency: true,
      status: true,
      deliveryZone: true,
      supplierNameRaw: true,
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const rows = docs.map((d) => ({
    ...d,
    total: d.total?.toString() ?? null,
    supplierName: d.supplier?.name ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/scan">{tType("invoice")} +</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <FileText
            className="h-10 w-10 text-muted-foreground"
            aria-hidden
          />
          <p className="text-muted-foreground">{t("empty")}</p>
          <Button asChild className="mt-2">
            <Link href="/scan">{tType("invoice")} +</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("columns.number")}</th>
                  <th className="px-4 py-2 font-medium">{t("columns.type")}</th>
                  <th className="px-4 py-2 font-medium">{t("columns.supplier")}</th>
                  <th className="px-4 py-2 font-medium">{t("columns.issueDate")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("columns.total")}</th>
                  <th className="px-4 py-2 font-medium">{t("columns.zone")}</th>
                  <th className="px-4 py-2 font-medium">{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/documents/${r.id}`}
                        className="hover:underline"
                      >
                        {r.documentNumber ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{tType(r.type)}</td>
                    <td className="px-4 py-2">
                      {r.supplierName ?? r.supplierNameRaw ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDate(r.issueDate, locale)}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {formatMoney(r.total, r.currency, locale)}
                    </td>
                    <td className="px-4 py-2">
                      <ZoneBadge zone={r.deliveryZone} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
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
