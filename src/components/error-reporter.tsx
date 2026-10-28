"use client";

import { useEffect } from "react";
import { flushClientErrorQueue, reportClientError } from "@/lib/errors/client";
import { isExtensionError } from "@/lib/errors/ignore";

export function ErrorReporter() {
  useEffect(() => {
    void flushClientErrorQueue();

    const onError = (event: ErrorEvent) => {
      if (isExtensionError(event.filename, event.error?.stack)) return;
      reportClientError({
        name: event.error?.name ?? "Error",
        message: event.message || "Unknown browser error",
        stack: event.error?.stack ?? null,
        route: window.location.pathname + window.location.search,
        action: "window.error",
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (isExtensionError(reason instanceof Error ? reason.stack : String(reason))) return;
      reportClientError({
        name: reason instanceof Error ? reason.name : "UnhandledRejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack ?? null : null,
        route: window.location.pathname + window.location.search,
        action: "unhandledrejection",
      });
    };
    const onOnline = () => void flushClientErrorQueue();

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
