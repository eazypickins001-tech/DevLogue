"use client";

import { useEffect, useRef, useState } from "react";

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        if (!cancelled) setWaiting(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            if (!cancelled) setWaiting(worker);
          }
        });
      });
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        watch(registration);
        void registration.update();
      } catch {
        // Offline and unsupported browsers are non-fatal.
      }
    };

    const onControllerChange = () => {
      if (reloadingRef.current) window.location.reload();
    };
    const onFocus = () => {
      void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">DevLogue update available</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Reload to run the latest version. Unsaved timeline edits will prompt before leaving.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          onClick={() => {
            reloadingRef.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          Reload now
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setWaiting(null)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
