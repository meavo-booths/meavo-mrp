"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import {
  AlertCircle,
  Camera,
  FileText,
  ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/components/ui/toaster";

type DocType = "auto" | "invoice" | "proforma" | "delivery_note";

const ACCEPTED_MIME = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const MAX_BYTES = 50 * 1024 * 1024;

export type ScanFormStrings = {
  title: string;
  subtitle: string;
  cameraLabel: string;
  galleryLabel: string;
  uploadDrag: string;
  uploadBrowse: string;
  uploadHint: string;
  pasteHint: string;
  documentTypeLabel: string;
  typeAuto: string;
  typeInvoice: string;
  typeProforma: string;
  typeDelivery: string;
  uploading: string;
  extracting: string;
  uploadAnother: string;
  errorUpload: string;
  errorExtract: string;
  successTitle: string;
  successDescription: string;
  retryLabel: string;
};

type Stage = "idle" | "uploading" | "extracting" | "done" | "error";

export function ScanForm({ strings }: { strings: ScanFormStrings }) {
  const router = useRouter();
  const [docType, setDocType] = React.useState<DocType>("auto");
  const [stage, setStage] = React.useState<Stage>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(`File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
        return;
      }

      let toUpload: File = file;
      const isImage = file.type.startsWith("image/");

      // Show a preview immediately
      try {
        const blobUrl = URL.createObjectURL(file);
        setPreviewUrl(blobUrl);
      } catch {
        // ignore
      }

      // Compress images client-side. Skip PDFs.
      if (isImage) {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 2200,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.9,
          });
          toUpload = new File([compressed], replaceExt(file.name, "jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        } catch (e) {
          // Fall back to original if compression fails — Gemini handles either.
           
          console.warn("Image compression failed, uploading original:", e);
        }
      }

      const formData = new FormData();
      formData.append("file", toUpload);
      formData.append("typeHint", docType);

      try {
        setStage("uploading");
        const upRes = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });
        if (!upRes.ok) {
          const msg = await upRes.text();
          throw new Error(msg || strings.errorUpload);
        }
        const { id } = (await upRes.json()) as { id: string };

        setStage("extracting");
        const extractRes = await fetch(`/api/documents/${id}/extract`, {
          method: "POST",
        });
        if (!extractRes.ok) {
          const msg = await extractRes.text();
          throw new Error(msg || strings.errorExtract);
        }

        setStage("done");
        toast({
          title: strings.successTitle,
          description: strings.successDescription,
        });
        router.push(`/documents/${id}`);
      } catch (e) {
        const msg = (e as Error).message;
        setStage("error");
        setError(msg);
        toast({
          title: strings.errorUpload,
          description: msg,
          variant: "destructive",
        });
      }
    },
    [docType, router, strings],
  );

  // Desktop drag/drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_MIME,
    maxFiles: 1,
    multiple: false,
    onDrop: (accepted) => {
      const f = accepted[0];
      if (f) void handleFile(f);
    },
    noClick: true, // we use our own button
    noKeyboard: false,
  });

  // Clipboard paste support
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const file = Array.from(e.clipboardData.items)
        .map((i) => (i.kind === "file" ? i.getAsFile() : null))
        .find(Boolean);
      if (file) void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const onCamera = () => cameraInputRef.current?.click();
  const onGallery = () => galleryInputRef.current?.click();
  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const inputsBusy = stage === "uploading" || stage === "extracting";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {strings.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{strings.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <span className="hidden sm:inline">{strings.uploadDrag}</span>
              <span className="sm:hidden">{strings.cameraLabel}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {strings.uploadHint}
              <span className="ml-1 hidden md:inline">
                {strings.pasteHint}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps({
                className: cn(
                  "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  isDragActive
                    ? "border-primary bg-accent"
                    : "border-input bg-background",
                  inputsBusy && "pointer-events-none opacity-60",
                ),
                role: "region",
                "aria-label": strings.uploadDrag,
                "aria-busy": inputsBusy,
              })}
            >
              <input {...getInputProps()} />

              {previewUrl && stage !== "idle" ? (
                <div className="mb-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt=""
                    className="max-h-48 rounded-md border"
                  />
                </div>
              ) : null}

              {stage === "idle" || stage === "error" ? (
                <>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Upload className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="hidden text-sm sm:block">{strings.uploadDrag}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    {/* On phones, the camera/gallery buttons are primary; on desktops the file picker. */}
                    <Button
                      onClick={onCamera}
                      className="sm:hidden"
                      type="button"
                    >
                      <Camera className="h-4 w-4" /> {strings.cameraLabel}
                    </Button>
                    <Button
                      onClick={onGallery}
                      type="button"
                      variant={"outline" as const}
                      className="sm:hidden"
                    >
                      <ImageIcon className="h-4 w-4" /> {strings.galleryLabel}
                    </Button>
                    <Button
                      onClick={onGallery}
                      type="button"
                      className="hidden sm:inline-flex"
                    >
                      <FileText className="h-4 w-4" /> {strings.uploadBrowse}
                    </Button>
                  </div>
                </>
              ) : null}

              {stage === "uploading" ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {strings.uploading}
                </p>
              ) : null}
              {stage === "extracting" ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {strings.extracting}
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">{strings.errorUpload}</p>
                  <p className="text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : null}

            {/* Hidden inputs that drive the camera + gallery buttons. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onPicked}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={onPicked}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {strings.documentTypeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="sr-only" htmlFor="docType">
              {strings.documentTypeLabel}
            </Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as DocType)}
              disabled={inputsBusy}
            >
              <SelectTrigger id="docType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{strings.typeAuto}</SelectItem>
                <SelectItem value="invoice">{strings.typeInvoice}</SelectItem>
                <SelectItem value="proforma">{strings.typeProforma}</SelectItem>
                <SelectItem value="delivery_note">
                  {strings.typeDelivery}
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function replaceExt(name: string, ext: string) {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return `${name}.${ext}`;
  return `${name.slice(0, dot)}.${ext}`;
}
