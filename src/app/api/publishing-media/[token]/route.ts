import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { verifyHandoffToken } from "@/lib/publishing/handoff";
import { isStorageConfigured, readObjectStream } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  if (!isStorageConfigured()) {
    return new Response("Storage is not configured.", { status: 503 });
  }
  const { token } = await context.params;
  const verified = verifyHandoffToken(token);
  if (!verified) return new Response("Not found", { status: 404 });

  const rows = await getDb()
    .select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, verified.mediaId)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return new Response("Not found", { status: 404 });

  const upstream = await readObjectStream(asset.storageKey);
  if (!upstream.ok || !upstream.body) {
    return new Response("Could not read the asset.", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": upstream.headers.get("content-length") ?? "",
      "Cache-Control": "private, max-age=60",
    },
  });
}
