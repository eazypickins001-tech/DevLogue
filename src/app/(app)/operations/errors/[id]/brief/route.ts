import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildIncidentBrief } from "@/lib/errors/brief";
import { getErrorIncidentDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireSession();
  const { id } = await context.params;
  const detail = await getErrorIncidentDetail(id);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  if (format === "json") {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      incident: detail.incident,
      events: detail.events,
      notes: detail.notes,
    });
  }
  return new NextResponse(buildIncidentBrief(detail.incident, detail.events, detail.notes), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
