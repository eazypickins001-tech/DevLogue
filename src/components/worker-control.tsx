"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getWorkerStatus,
  startWorker,
  stopWorker,
  type WorkerStatus,
} from "@/app/actions/worker";
import { buttonPrimary, buttonSecondary, hintClass, linkClass } from "@/components/ui";

export function WorkerControl() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [busy, setBusy] = useState<"start" | "stop" | "refresh" | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setBusy("refresh");
    try {
      setStatus(await getWorkerStatus());
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void getWorkerStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus({
            ok: false,
            configured: true,
            running: false,
            error: error instanceof Error ? error.message : "Could not check the worker.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    setBusy("start");
    try {
      setStatus(await startWorker());
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setBusy("stop");
    try {
      setStatus(await stopWorker());
    } finally {
      setBusy(null);
    }
  }

  const running = Boolean(status?.running);
  const configured = status?.configured !== false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            status === null ? "bg-slate-400" : running ? "bg-emerald-500" : "bg-slate-500"
          }`}
        />
        <span className="text-sm font-medium text-slate-900">
          {status === null ? "Checking worker..." : running ? "Worker running" : "Worker stopped"}
        </span>
        {status?.pid ? <span className="text-xs text-slate-500">PID {status.pid}</span> : null}
        {status?.startedAt ? (
          <span className="text-xs text-slate-500">Started {new Date(status.startedAt).toLocaleString()}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonPrimary}
          disabled={!configured || running || busy !== null}
          onClick={() => void start()}
        >
          {busy === "start" ? "Starting..." : "Start worker"}
        </button>
        <button
          type="button"
          className={buttonSecondary}
          disabled={!configured || !running || busy !== null}
          onClick={() => void stop()}
        >
          {busy === "stop" ? "Stopping..." : "Stop worker"}
        </button>
        <button
          type="button"
          className={buttonSecondary}
          disabled={busy !== null}
          onClick={() => void refresh()}
        >
          {busy === "refresh" ? "Refreshing..." : "Refresh status"}
        </button>
      </div>

      {status?.error ? <p className="text-sm text-rose-700">{status.error}</p> : null}
      {status?.lastExit && !running ? (
        <p className={hintClass}>
          Last exit: code {status.lastExit.code ?? "?"} {status.lastExit.signal ? `signal ${status.lastExit.signal}` : ""} at{" "}
          {new Date(status.lastExit.at).toLocaleString()}
        </p>
      ) : null}
      {!configured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Worker control is not configured</p>
          <p className="mt-1">
            Start the control service on the worker machine with{" "}
            <code className="font-mono">pnpm worker:control</code>, then set{" "}
            <code className="font-mono">WORKER_CONTROL_URL</code> and{" "}
            <code className="font-mono">WORKER_CONTROL_TOKEN</code> on the app. See{" "}
            <Link className={linkClass} href="/help#worker">
              help
            </Link>
            .
          </p>
          <button
            type="button"
            className={`${buttonSecondary} mt-3`}
            onClick={async () => {
              await navigator.clipboard.writeText("pnpm worker");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied" : "Copy pnpm worker"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
