import "server-only";

import { redactSecrets } from "@/lib/domain/secrets";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.OWNER_EMAIL?.trim());
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const from = process.env.AUTH_EMAIL_FROM?.trim() || "DevLogue <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your DevLogue sign-in code",
      text: [
        `Your DevLogue sign-in code is ${code}.`,
        "",
        "It expires in 10 minutes and can be used once.",
        "If you did not request it, ignore this email.",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}): ${redactSecrets(text).slice(0, 200)}`);
  }
}
