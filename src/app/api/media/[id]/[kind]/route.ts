import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getOwner, hasSession } from "@/lib/auth";
import { isStorageConfigured, presignGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
): Promise<Response> {
  if (!(await hasSession())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id, kind } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || (kind !== "thumbnail" && kind !== "waveform")) {
    return new Response("Not found", { status: 404 });
  }
  if (!isStorageConfigured()) {
    return new Response("Storage is not configured.", { status: 503 });
  }

  try {
    const owner = await getOwner();
    const rows = await getDb()
      .select({
        thumbnailKey: mediaAssets.thumbnailKey,
        waveformKey: mediaAssets.waveformKey,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, owner.id)))
      .limit(1);
    const asset = rows[0];
    if (!asset) return new Response("Not found", { status: 404 });
    const key = kind === "thumbnail" ? asset.thumbnailKey : asset.waveformKey;
    if (!key) return new Response("Not found", { status: 404 });

    const url = await presignGet(key, 300, "inline");
    return NextResponse.redirect(url, { status: 302 });
  } catch {
    return new Response("Derivative unavailable.", { status: 500 });
  }
}
