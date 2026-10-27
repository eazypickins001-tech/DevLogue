import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSession } from "@/lib/auth";
import { captureError } from "@/lib/errors/capture";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  name: z.string().trim().max(160).optional(),
  message: z.string().trim().min(1).max(6000),
  stack: z.string().max(20000).nullish(),
  route: z.string().trim().max(600).nullish(),
  action: z.string().trim().max(300).nullish(),
  context: z.record(z.string(), z.unknown()).nullish(),
  userAgent: z.string().max(500).nullish(),
});

export async function POST(request: Request): Promise<Response> {
  if (!(await hasSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > 30_000) {
    return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid error payload." }, { status: 422 });
  }

  await captureError({
    source: "client",
    severity: "error",
    name: parsed.data.name,
    message: parsed.data.message,
    stack: parsed.data.stack,
    route: parsed.data.route,
    action: parsed.data.action,
    context: parsed.data.context,
    userAgent: parsed.data.userAgent ?? request.headers.get("user-agent"),
  });
  return new NextResponse(null, { status: 204 });
}
