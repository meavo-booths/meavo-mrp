import "server-only";

/** When true, invoice scanner routes appear in nav (legacy OCR flow). */
export function isInvoiceScannerEnabled(): boolean {
  return (
    process.env.ENABLE_INVOICE_SCANNER === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_INVOICE_SCANNER === "true"
  );
}
