"use client";

import { buttonDanger } from "@/components/ui";

export function ConfirmSubmit({
  children,
  message,
  className = buttonDanger,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
