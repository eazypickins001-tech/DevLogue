import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { verifyHandoffToken } from "@/lib/publishing/handoff";
import { isStorageConfigured, readObjectStream } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!isStorageConfigured()) {
    return new Response("Storage is not configured.", { status: 503 });
  }
  const { path } = await context.params;
  const token = path[0];
  if (!token) return new Response("Not found", { status: 404 });
  const verified = verifyHandoffToken(token);
  if (!verified) return new Response("Not found", { status: 404 });

  const rows = await getDb()
    .select({
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
      filename: mediaAssets.filename,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, verified.mediaId))
    .limit(1);
  const asset = rows[0];
  if (!asset) return new Response("Not found", { status: 404 });

  const upstream = await readObjectStream(asset.storageKey);
  if (!upstream.ok || !upstream.body) {
    return new Response("Could not read the asset.", { status: 502 });
  }

  const filename = (path[1] ? decodeURIComponent(path[1]) : asset.filename).replace(
    /["\r\n]/g,
    "",
  );
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": upstream.headers.get("content-length") ?? "",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
