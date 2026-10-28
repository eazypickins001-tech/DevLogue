import { describe, expect, it } from "vitest";
import { supersededRenderKeys, type RenderJobRow } from "@/lib/storage-retention";

const cutoff = new Date("2026-10-01T00:00:00.000Z");

function job(
  id: string,
  groupId: string,
  outputKey: string | null,
  createdAt: string,
  label = "Timeline",
): RenderJobRow {
  return { id, groupId, outputKey, label, createdAt: new Date(createdAt) };
}

describe("render retention", () => {
  it("returns superseded renders older than the cutoff", () => {
    const jobs = [
      job("a", "g1", "renders/a.mp4", "2026-08-01T00:00:00.000Z"),
      job("b", "g1", "renders/b.mp4", "2026-09-01T00:00:00.000Z"),
      job("c", "g1", "renders/c.mp4", "2026-09-15T00:00:00.000Z"),
    ];
    expect([...supersededRenderKeys(jobs, cutoff).keys()]).toEqual([
      "renders/a.mp4",
      "renders/b.mp4",
    ]);
  });

  it("keeps the newest render even when it is older than the cutoff", () => {
    const jobs = [job("a", "g1", "renders/a.mp4", "2026-01-01T00:00:00.000Z")];
    expect(supersededRenderKeys(jobs, cutoff).size).toBe(0);
  });

  it("skips superseded renders newer than the cutoff and null keys", () => {
    const recentCutoff = new Date("2026-09-20T00:00:00.000Z");
    const jobs = [
      job("a", "g1", "renders/a.mp4", "2026-09-25T00:00:00.000Z"),
      job("b", "g1", "renders/b.mp4", "2026-09-28T00:00:00.000Z"),
      job("c", "g1", null, "2026-09-01T00:00:00.000Z"),
      job("d", "g1", "renders/d.mp4", "2026-10-02T00:00:00.000Z"),
    ];
    expect(supersededRenderKeys(jobs, recentCutoff).size).toBe(0);
  });

  it("breaks ties by job id", () => {
    const createdAt = "2026-09-01T00:00:00.000Z";
    const jobs = [
      job("a", "g1", "renders/a.mp4", createdAt),
      job("b", "g1", "renders/b.mp4", createdAt),
    ];
    expect([...supersededRenderKeys(jobs, cutoff).keys()]).toEqual(["renders/a.mp4"]);
  });

  it("groups independently per timeline or draft", () => {
    const jobs = [
      job("a", "g1", "renders/a.mp4", "2026-08-01T00:00:00.000Z"),
      job("b", "g1", "renders/b.mp4", "2026-09-01T00:00:00.000Z"),
      job("c", "g2", "renders/c.mp4", "2026-08-01T00:00:00.000Z"),
      job("d", "g2", "renders/d.mp4", "2026-09-01T00:00:00.000Z"),
    ];
    expect([...supersededRenderKeys(jobs, cutoff).keys()]).toEqual([
      "renders/a.mp4",
      "renders/c.mp4",
    ]);
  });
});
