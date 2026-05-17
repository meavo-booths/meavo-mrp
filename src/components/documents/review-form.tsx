"use client";

import * as React from "react";
import { useForm, useFieldArray, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";

import {
  ExtractedDocumentSchema,
  type ConfidenceMap,
  type ExtractedDocument,
} from "@/lib/extractor/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ZoneBadge } from "@/components/documents/zone-badge";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/components/ui/toaster";

const LOW_CONFIDENCE = 0.7;

export type ReviewFormStrings = {
  sectionHeader: string;
  sectionSupplier: string;
  sectionLineItems: string;
  sectionTotals: string;
  sectionZone: string;
  fieldDocumentNumber: string;
  fieldIssueDate: string;
  fieldDueDate: string;
  fieldDeliveryDate: string;
  fieldType: string;
  typeInvoice: string;
  typeProforma: string;
  typeDelivery: string;
  fieldSupplierName: string;
  fieldSupplierVat: string;
  fieldSupplierEik: string;
  fieldSupplierCountry: string;
  fieldSupplierAddress: string;
  fieldCurrency: string;
  fieldSubtotal: string;
  fieldVatTotal: string;
  fieldTotal: string;
  fieldZone: string;
  fieldCustomsRef: string;
  liPosition: string;
  liName: string;
  liSku: string;
  liQuantity: string;
  liUnit: string;
  liUnitPrice: string;
  liVatRate: string;
  liLineTotal: string;
  addLine: string;
  removeLine: string;
  saveDraft: string;
  approveAndSync: string;
  rejectDocument: string;
  lowConfidence: string;
  aiSuggested: string;
  zoneLocal: string;
  zoneEu: string;
  zoneNonEu: string;
};

export function ReviewForm({
  documentId,
  defaults,
  confidence,
  strings,
  isApproved,
}: {
  documentId: string;
  defaults: ExtractedDocument;
  confidence: ConfidenceMap;
  strings: ReviewFormStrings;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"idle" | "save" | "approve" | "reject">("idle");

  const form = useForm<ExtractedDocument>({
    resolver: zodResolver(ExtractedDocumentSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchZone = useWatch({ control: form.control, name: "deliveryZone" });
  const watchType = useWatch({ control: form.control, name: "type" });

  const submit = async (action: "save" | "approve" | "reject") => {
    setPending(action);
    const values = form.getValues();
    try {
      if (action === "approve") {
        const res = await fetch(`/api/documents/${documentId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraction: values }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: strings.approveAndSync });
      } else if (action === "reject") {
        const res = await fetch(`/api/documents/${documentId}/reject`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: strings.rejectDocument });
      } else {
        const res = await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraction: values }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: strings.saveDraft });
      }
      router.refresh();
    } catch (e) {
      toast({
        title: "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setPending("idle");
    }
  };

  // Keyboard shortcut: Ctrl/Cmd+Enter approves.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isApproved) void submit("approve");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit("save");
      }}
      className="space-y-4 pb-28"
      noValidate
    >
      {/* Header */}
      <Section title={strings.sectionHeader}>
        <Field
          label={strings.fieldDocumentNumber}
          path="documentNumber"
          confidence={confidence}
          aiSuggested={strings.aiSuggested}
          lowConfidenceLabel={strings.lowConfidence}
        >
          <Input
            {...form.register("documentNumber")}
            inputMode="text"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={strings.fieldIssueDate} path="issueDate" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input type="date" {...form.register("issueDate")} />
          </Field>
          <Field label={strings.fieldDueDate} path="dueDate" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input type="date" {...form.register("dueDate")} />
          </Field>
          <Field label={strings.fieldDeliveryDate} path="deliveryDate" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input type="date" {...form.register("deliveryDate")} />
          </Field>
        </div>
        <Field label={strings.fieldType} path="type" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
          <Select
            value={watchType}
            onValueChange={(v) => form.setValue("type", v as ExtractedDocument["type"], { shouldDirty: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">{strings.typeInvoice}</SelectItem>
              <SelectItem value="proforma">{strings.typeProforma}</SelectItem>
              <SelectItem value="delivery_note">{strings.typeDelivery}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Supplier */}
      <Section title={strings.sectionSupplier}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={strings.fieldSupplierName} path="supplier.name" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input {...form.register("supplier.name")} />
          </Field>
          <Field label={strings.fieldSupplierCountry} path="supplier.countryCode" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input
              maxLength={2}
              {...form.register("supplier.countryCode")}
              placeholder="BG"
            />
          </Field>
          <Field label={strings.fieldSupplierVat} path="supplier.vatNumber" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input {...form.register("supplier.vatNumber")} placeholder="BG123456789" />
          </Field>
          <Field label={strings.fieldSupplierEik} path="supplier.eik" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input {...form.register("supplier.eik")} />
          </Field>
        </div>
        <Field label={strings.fieldSupplierAddress} path="supplier.address" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
          <Textarea rows={2} {...form.register("supplier.address")} />
        </Field>
      </Section>

      {/* Line items */}
      <Section title={strings.sectionLineItems}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-1 font-medium w-[3rem]">{strings.liPosition}</th>
                <th className="px-2 py-1 font-medium">{strings.liName}</th>
                <th className="px-2 py-1 font-medium w-[8rem]">{strings.liSku}</th>
                <th className="px-2 py-1 font-medium w-[6rem]">{strings.liQuantity}</th>
                <th className="px-2 py-1 font-medium w-[5rem]">{strings.liUnit}</th>
                <th className="px-2 py-1 font-medium w-[7rem]">{strings.liUnitPrice}</th>
                <th className="px-2 py-1 font-medium w-[5rem]">{strings.liVatRate}</th>
                <th className="px-2 py-1 font-medium w-[7rem]">{strings.liLineTotal}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {fields.map((row, idx) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={1}
                      {...form.register(`lineItems.${idx}.position` as const, {
                        valueAsNumber: true,
                      })}
                      className="h-8 w-12 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      {...form.register(`lineItems.${idx}.name` as const)}
                      className="h-8 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      {...form.register(`lineItems.${idx}.sku` as const)}
                      className="h-8 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      inputMode="decimal"
                      {...form.register(`lineItems.${idx}.quantity` as const)}
                      className="h-8 px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      {...form.register(`lineItems.${idx}.unit` as const)}
                      className="h-8 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      inputMode="decimal"
                      {...form.register(`lineItems.${idx}.unitPrice` as const)}
                      className="h-8 px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      inputMode="decimal"
                      {...form.register(`lineItems.${idx}.vatRate` as const)}
                      className="h-8 px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      inputMode="decimal"
                      {...form.register(`lineItems.${idx}.lineTotal` as const)}
                      className="h-8 px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(idx)}
                      aria-label={strings.removeLine}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                position: fields.length + 1,
                name: "",
                sku: null,
                quantity: null,
                unit: null,
                unitPrice: null,
                vatRate: null,
                lineTotal: null,
              })
            }
          >
            <Plus className="h-4 w-4" /> {strings.addLine}
          </Button>
        </div>
      </Section>

      {/* Totals */}
      <Section title={strings.sectionTotals}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label={strings.fieldCurrency} path="currency" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input
              maxLength={3}
              {...form.register("currency")}
              placeholder="BGN"
            />
          </Field>
          <Field label={strings.fieldSubtotal} path="subtotal" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input inputMode="decimal" className="text-right" {...form.register("subtotal")} />
          </Field>
          <Field label={strings.fieldVatTotal} path="vatTotal" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input inputMode="decimal" className="text-right" {...form.register("vatTotal")} />
          </Field>
          <Field label={strings.fieldTotal} path="total" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input inputMode="decimal" className="text-right font-medium" {...form.register("total")} />
          </Field>
        </div>
      </Section>

      {/* Delivery zone */}
      <Section title={strings.sectionZone}>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={watchZone ?? ""}
            onValueChange={(v) => form.setValue("deliveryZone", (v || null) as ExtractedDocument["deliveryZone"], { shouldDirty: true })}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">{strings.zoneLocal}</SelectItem>
              <SelectItem value="eu">{strings.zoneEu}</SelectItem>
              <SelectItem value="non_eu">{strings.zoneNonEu}</SelectItem>
            </SelectContent>
          </Select>
          {watchZone ? <ZoneBadge zone={watchZone} /> : null}
        </div>
        {watchZone === "non_eu" ? (
          <Field label={strings.fieldCustomsRef} path="customsRef" confidence={confidence} aiSuggested={strings.aiSuggested} lowConfidenceLabel={strings.lowConfidence}>
            <Input {...form.register("customsRef")} />
          </Field>
        ) : null}
      </Section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit("reject")}
            disabled={pending !== "idle"}
          >
            {strings.rejectDocument}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => submit("save")}
            disabled={pending !== "idle"}
          >
            {pending === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {strings.saveDraft}
          </Button>
          <Button
            type="button"
            onClick={() => submit("approve")}
            disabled={pending !== "idle" || isApproved}
          >
            {pending === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {strings.approveAndSync}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  path,
  children,
  confidence,
  aiSuggested,
  lowConfidenceLabel,
}: {
  label: string;
  path: Path<ExtractedDocument>;
  children: React.ReactNode;
  confidence: ConfidenceMap;
  aiSuggested: string;
  lowConfidenceLabel: string;
}) {
  const conf = confidence[path];
  const isLow = typeof conf === "number" && conf < LOW_CONFIDENCE;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className={cn("text-xs", isLow && "text-amber-700")}>{label}</Label>
        {isLow ? (
          <Badge variant="warn" className="text-[10px]">
            {lowConfidenceLabel}
          </Badge>
        ) : null}
      </div>
      <div className={cn(isLow && "ring-1 ring-warn rounded-md")}>{children}</div>
    </div>
  );
}
