"use client";

import { useActionState } from "react";
import {
  requestLoginCode,
  verifyLoginCode,
  type OtpRequestState,
  type OtpVerifyState,
} from "@/app/actions/auth";
import { buttonPrimary, hintClass, inputClass, labelClass } from "@/components/ui";

const requestInitial: OtpRequestState = {};
const verifyInitial: OtpVerifyState = {};

export function OtpLoginForm({
  defaultEmail,
  devOutbox,
}: {
  defaultEmail?: string;
  devOutbox?: boolean;
}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestLoginCode,
    requestInitial,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyLoginCode,
    verifyInitial,
  );

  return (
    <div className="space-y-4">
      {!requestState.sent ? (
        <form action={requestAction} className="space-y-3">
          <div>
            <label htmlFor="otp-email" className={labelClass}>
              Email
            </label>
            <input
              id="otp-email"
              name="email"
              type="email"
              defaultValue={defaultEmail}
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
            />
            <p className={hintClass}>
              We send a six-digit code. No password needed, and the first sign-in creates the account.
            </p>
          </div>
          {requestState.error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {requestState.error}
            </p>
          ) : null}
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={requestPending}>
            {requestPending ? "Sending..." : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="email" value={requestState.email ?? defaultEmail ?? ""} />
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p>Code sent to {requestState.email}. Check your inbox and spam folder.</p>
            {devOutbox ? (
              <p className="mt-1 text-xs text-emerald-700">
                Development mode: the code is written to{" "}
                <code className="font-mono">.otp-outbox.jsonl</code> instead of email.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="otp-code" className={labelClass}>
              Six-digit code
            </label>
            <input
              id="otp-code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              className={`${inputClass} tracking-[0.4em]`}
              placeholder="000000"
            />
          </div>
          {verifyState.error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {verifyState.error}
            </p>
          ) : null}
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={verifyPending}>
            {verifyPending ? "Checking..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-800"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
