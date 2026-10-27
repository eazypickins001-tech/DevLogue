"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack ?? null,
        route: window.location.pathname + window.location.search,
        action: "global-error-boundary",
        context: error.digest ? { digest: error.digest } : null,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 24 }}>DevLogue could not start this page.</h1>
          <p style={{ color: "#475569" }}>
            The failure was recorded. Retry the page, or check the incident ledger after signing in.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "8px 14px", borderRadius: 8, border: 0, background: "#0f172a", color: "white" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
