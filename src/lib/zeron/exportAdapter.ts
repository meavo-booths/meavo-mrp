import * as XLSX from "xlsx";

import type { ZeronAdapter, ZeronPushPayload, ZeronPushResult } from "./adapter";

/**
 * Manual export adapter (Plan B).
 *
 * Builds an Excel file matching a generic Zeron purchase-invoice import
 * layout (header sheet + line items sheet) and returns it as a base64
 * payload that the admin page can download.
 *
 * The exact column names will need to be tuned to Zeron's actual import
 * template — these are the most-commonly-used ones in Bulgarian ERP imports
 * and they map cleanly to our internal fields.
 */
export const exportAdapter: ZeronAdapter = {
  name: "export",
  async pushDocument(payload: ZeronPushPayload): Promise<ZeronPushResult> {
    const wb = XLSX.utils.book_new();

    const headerRow = [
      {
        DocumentNumber: payload.document.documentNumber ?? "",
        DocumentType:
          payload.document.type === "invoice"
            ? "Фактура"
            : payload.document.type === "proforma"
              ? "Проформа"
              : "Стокова разписка",
        IssueDate: toDate(payload.document.issueDate),
        DueDate: toDate(payload.document.dueDate),
        DeliveryDate: toDate(payload.document.deliveryDate),
        SupplierName: payload.supplier?.name ?? "",
        SupplierVAT: payload.supplier?.vatNumber ?? "",
        SupplierEIK: payload.supplier?.eik ?? "",
        SupplierCountry: payload.supplier?.countryCode ?? "",
        Currency: payload.document.currency ?? "",
        Subtotal: payload.document.subtotal?.toString() ?? "",
        VATTotal: payload.document.vatTotal?.toString() ?? "",
        Total: payload.document.total?.toString() ?? "",
        DeliveryZone: payload.document.deliveryZone ?? "",
        CustomsRef: payload.document.customsRef ?? "",
        ZeronInternalId: payload.document.id,
      },
    ];

    const linesRows = payload.lineItems.map((li) => ({
      DocumentNumber: payload.document.documentNumber ?? "",
      Position: li.position,
      ItemName: li.name,
      SKU: li.sku ?? "",
      Quantity: li.quantity?.toString() ?? "",
      Unit: li.unit ?? "",
      UnitPrice: li.unitPrice?.toString() ?? "",
      VATRate: li.vatRate?.toString() ?? "",
      LineTotal: li.lineTotal?.toString() ?? "",
    }));

    const headerSheet = XLSX.utils.json_to_sheet(headerRow);
    const linesSheet = XLSX.utils.json_to_sheet(linesRows);

    XLSX.utils.book_append_sheet(wb, headerSheet, "Header");
    XLSX.utils.book_append_sheet(wb, linesSheet, "Lines");

    const buffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;
    const base64 = bufferToBase64(buffer);

    const filename = `zeron-${payload.document.documentNumber ?? payload.document.id}.xlsx`;

    return {
      message: `Generated XLSX export (${linesRows.length} line items). Download from the sync admin.`,
      raw: {
        filename,
        contentBase64: base64,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: buffer.byteLength,
      },
    };
  },
};

function toDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function bufferToBase64(buf: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buf).toString("base64");
  }
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
