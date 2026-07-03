import { asc, eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { ReceiptForm } from "@/components/stock/receipt-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, schema } from "@/lib/db/client";
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
    db
      .select({
        id: schema.materials.id,
        name: schema.materials.name,
        unit: schema.materials.unit,
        code: schema.materials.code,
      })
      .from(schema.materials)
      .where(eq(schema.materials.isActive, true))
      .orderBy(asc(schema.materials.name)),
    db
      .select({
        id: schema.warehouses.id,
        name: schema.warehouses.name,
        code: schema.warehouses.code,
      })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.isActive, true))
      .orderBy(asc(schema.warehouses.name)),
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
