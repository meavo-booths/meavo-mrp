import { setRequestLocale, getTranslations } from "next-intl/server";

import { ReceiptForm } from "@/components/stock/receipt-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { ensureStockReferenceData, getDefaultWarehouseId } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser();
  await ensureStockReferenceData();

  const t = await getTranslations("stock.receipt");
  const defaultWarehouseId = await getDefaultWarehouseId();

  const [materials, warehouses] = await Promise.all([
    prisma.mrpMaterial.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.mrpWarehouse.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("formTitle")}</CardTitle>
          <CardDescription>{t("formDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReceiptForm
            materials={materials}
            warehouses={warehouses}
            defaultWarehouseId={defaultWarehouseId}
            labels={{
              material: t("material"),
              materialSearchPlaceholder: t("materialSearchPlaceholder"),
              materialUnknown: t("materialUnknown"),
              warehouse: t("warehouse"),
              quantity: t("quantity"),
              date: t("date"),
              invoiceNumber: t("invoiceNumber"),
              notes: t("notes"),
              submit: t("submit"),
              error: t("error"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
