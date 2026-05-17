"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

type ToastInput = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type ToastEntry = ToastInput & { id: number };

let pushToastImpl: (t: ToastInput) => void = () => {};

/** Imperative API used from non-component code. */
export function toast(t: ToastInput) {
  pushToastImpl(t);
}

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-start gap-2 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Toaster({ ...props }: VariantProps<typeof toastVariants>) {
  const [items, setItems] = React.useState<ToastEntry[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback((t: ToastInput) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, ...t }]);
    setTimeout(() => remove(id), 5000);
  }, [remove]);

  React.useEffect(() => {
    pushToastImpl = push;
    return () => {
      pushToastImpl = () => {};
    };
  }, [push]);

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {items.map(({ id, title, description, variant }) => (
        <ToastPrimitives.Root
          key={id}
          className={cn(toastVariants({ variant: variant ?? props.variant }))}
          onOpenChange={(open) => {
            if (!open) remove(id);
          }}
        >
          <div className="flex-1 grid gap-1">
            {title ? (
              <ToastPrimitives.Title className="text-sm font-semibold">
                {title}
              </ToastPrimitives.Title>
            ) : null}
            {description ? (
              <ToastPrimitives.Description className="text-sm opacity-90">
                {description}
              </ToastPrimitives.Description>
            ) : null}
          </div>
          <ToastPrimitives.Close
            className="absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </ToastPrimitives.Close>
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastPrimitives.Provider>
  );
}
