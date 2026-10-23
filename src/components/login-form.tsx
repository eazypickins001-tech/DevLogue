"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { buttonPrimary, inputClass, labelClass } from "@/components/ui";

const initialState: LoginState = {};

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {!configured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Set <code className="font-mono">APP_PASSWORD</code> and{" "}
          <code className="font-mono">AUTH_SECRET</code> in <code className="font-mono">.env.local</code>{" "}
          to enable sign-in.
        </div>
      ) : null}
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
          disabled={!configured}
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={`${buttonPrimary} w-full`} disabled={pending || !configured}>
        {pending ? "Checking…" : "Enter DevLogue"}
      </button>
    </form>
  );
}
