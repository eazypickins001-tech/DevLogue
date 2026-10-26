import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getOwner, hasSession } from "@/lib/auth";
import { isStorageConfigured, presignGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await hasSession())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }
  if (!isStorageConfigured()) {
    return new Response("Storage is not configured.", { status: 503 });
  }
  const owner = await getOwner();
  const rows = await getDb()
    .select({ storageKey: mediaAssets.storageKey, kind: mediaAssets.kind })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, owner.id)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return new Response("Not found", { status: 404 });

  const disposition = asset.kind === "document" ? "attachment" : "inline";
  const url = await presignGet(asset.storageKey, 300, disposition);
  return NextResponse.redirect(url, { status: 302 });
}
