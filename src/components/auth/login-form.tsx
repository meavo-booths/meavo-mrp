"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/auth/supabase-browser";

export function LoginForm({
  googleLabel,
  errorTitle,
  tryAgainLabel,
  error,
  next,
}: {
  googleLabel: string;
  errorTitle: string;
  tryAgainLabel: string;
  error: string | null;
  next: string;
}) {
  const [pending, setPending] = React.useState(false);

  const onGoogle = async () => {
    setPending(true);
    const supabase = getBrowserSupabase();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
      },
    });
    if (err) {
      setPending(false);
      window.location.search = `?error=${encodeURIComponent(err.message)}`;
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{errorTitle}</p>
          <p className="mt-0.5 text-muted-foreground">{error}</p>
          <p className="mt-2">
            <button
              className="underline"
              onClick={() => (window.location.search = "")}
            >
              {tryAgainLabel}
            </button>
          </p>
        </div>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={onGoogle}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <GoogleLogo />
        )}
        {googleLabel}
      </Button>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden
      role="img"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.5 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
