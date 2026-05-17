"use client";

import * as React from "react";
import {
  TransformWrapper,
  TransformComponent,
} from "react-zoom-pan-pinch";
import { Maximize2, Minus, Plus, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DocumentImage({
  src,
  mimeType,
  alt,
}: {
  src: string;
  mimeType: string | null;
  alt: string;
}) {
  if (mimeType === "application/pdf") {
    return (
      <div className="h-full w-full">
        <object
          data={src}
          type="application/pdf"
          className="h-full min-h-[60vh] w-full rounded-md border bg-muted"
        >
          <p className="p-4 text-sm text-muted-foreground">
            PDF preview is not supported in this browser.{" "}
            <a className="underline" href={src} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          </p>
        </object>
      </div>
    );
  }

  return (
    <TransformWrapper
      minScale={0.5}
      maxScale={6}
      doubleClick={{ mode: "toggle" }}
      panning={{ velocityDisabled: true }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="relative h-full w-full overflow-hidden rounded-md border bg-muted">
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => zoomOut()}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => zoomIn()}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => resetTransform()}
              aria-label="Reset zoom"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => {
                window.open(src, "_blank", "noopener,noreferrer");
              }}
              aria-label="Open in new tab"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
          <TransformComponent
            wrapperClass="!h-full !w-full"
            contentClass="!h-full !w-full flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
