/** Client-safe feature flags (must match server `features.ts`). */
export function isInvoiceScannerEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_INVOICE_SCANNER === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_INVOICE_SCANNER === "1"
  );
}
