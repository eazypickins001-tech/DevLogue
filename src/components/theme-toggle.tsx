"use client";

import { useSyncExternalStore } from "react";
import {
  setTheme,
  subscribeTheme,
  themeServerSnapshot,
  themeSnapshot,
  type Theme,
} from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, themeServerSnapshot);

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={`rounded-md px-2 py-1 font-medium transition ${
            theme === option.value
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
