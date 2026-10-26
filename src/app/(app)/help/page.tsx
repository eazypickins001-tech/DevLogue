import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, linkClass } from "@/components/ui";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["quick-start", "Quick start"],
  ["projects", "Projects and sessions"],
  ["recording", "Recording"],
  ["editing", "Editing a video"],
  ["captions", "Transcription and captions"],
  ["rendering", "Rendering"],
  ["publishing", "Publishing"],
  ["storage", "Storage and deletion"],
  ["worker", "Worker setup"],
  ["install", "Install app"],
  ["troubleshooting", "Troubleshooting"],
  ["faq", "FAQ"],
];

export default async function HelpPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help and user guide"
        description="A practical guide to recording, editing, publishing, storage and troubleshooting in DevLogue."
        actions={<Badge tone="accent">Start here</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Help sections" className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
          <ul className="mt-2 space-y-1 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a className="text-slate-600 hover:text-slate-900" href={`#${id}`}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-5">
          <Card id="quick-start">
            <CardHeader
              title="Quick start"
              description="The shortest path from an idea to a scheduled video."
              action={<Badge tone="success">5 steps</Badge>}
            />
            <ol className="list-decimal space-y-3 p-5 pl-9 text-sm text-slate-700">
              <li>
                Create a <Link className={linkClass} href="/projects/new">project</Link>. This holds context,
                audience, tone and publication exclusions.
              </li>
              <li>
                Open the project and choose <strong>Capture session</strong>. Add a title and what you worked on.
              </li>
              <li>
                Open <Link className={linkClass} href="/record">Record</Link>, choose the destination session,
                then record your screen, camera, microphone or a combination.
              </li>
              <li>
                Save the recording. Raw tracks upload to R2 and a multi-track timeline is created. Choose
                <strong> Open timeline</strong>.
              </li>
              <li>
                Edit, generate captions if needed, render the final MP4, then create a content draft and use the
                publishing handoff.
              </li>
            </ol>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Transcription, thumbnails, waveforms and final rendering run on the local/Contabo worker. The web app
              queues the work.
            </p>
          </Card>

          <Card id="projects">
            <CardHeader title="Projects and sessions" description="How the work is organised." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>
                <strong>Projects</strong> hold the long-lived context: problem, target users, goals, preferred
                platforms, tone, sensitive notes and publication exclusions.
              </p>
              <p>
                <strong>Build sessions</strong> are individual pieces of work inside a project. A session can have
                notes, evidence, uploads, recordings and timelines.
              </p>
              <p>
                <strong>Editing studio destination</strong> is simply the build session that will receive the
                recording. Create a project and session first, then choose that session in the recorder.
              </p>
              <p>
                Use <Link className={linkClass} href="/sessions/new">New session</Link> or the{" "}
                <strong>Capture session</strong> button on a project.
              </p>
            </div>
          </Card>

          <Card id="recording">
            <CardHeader title="Recording" description="Screen, camera and audio." />
            <div className="space-y-4 p-5 text-sm text-slate-700">
              <div>
                <h3 className="font-semibold text-slate-900">Capture modes</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li><strong>Screen + camera</strong> — screen recording with an optional camera PiP.</li>
                  <li><strong>Screen only</strong> — no camera stream is recorded.</li>
                  <li><strong>Camera only</strong> — useful for talking-head videos.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Camera visibility</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li><strong>Show PiP</strong> — camera appears in the recording and the default render.</li>
                  <li><strong>Record only</strong> — camera is saved as a separate track but hidden by default.</li>
                  <li><strong>Off</strong> — camera is not recorded.</li>
                </ul>
                <p className="mt-2 text-slate-600">
                  Because tracks are separate, you can show, hide, move, resize or sync the camera later in the
                  timeline without re-recording.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Format and quality</h3>
                <p className="mt-1">Choose 16:9 or 9:16, microphone and system audio, frame rate and quality. Recordings run in the browser and upload directly to private R2 storage.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">5–15 minute recordings</h3>
                <p className="mt-1">Files over 16MB use multipart uploads with progress and retry. If an upload is interrupted, open the session Media card and choose <strong>Resume</strong>, then select the same file again.</p>
              </div>
            </div>
          </Card>

          <Card id="editing">
            <CardHeader title="Editing a video" description="Studio lists drafts and timelines; the timeline editor is a focused page for the actual edit." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>
                Open a generated timeline from the save prompt or from the session page’s <strong>Video editor</strong>{" "}
                card. The editor shows a preview, track lanes, playhead and inspector.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Trim</strong> — change duration and source trim in the inspector.</li>
                <li><strong>Sync</strong> — nudge camera/audio by ±100ms or ±500ms, enter an offset, or reset to 0.</li>
                <li><strong>Captions</strong> — add manual captions or generate timed captions from a transcript.</li>
                <li><strong>Format</strong> — switch between 16:9 and 9:16.</li>
                <li><strong>Camera</strong> — show/hide and reposition the camera overlay.</li>
                <li><strong>Previews</strong> — video clips show thumbnails; audio clips show waveforms after the worker generates them.</li>
              </ul>
              <p>
                Save creates a new timeline version. <strong>Queue final render</strong> sends the saved timeline to
                the worker. <strong>Create content draft</strong> appears after a successful render.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">Video looks blank?</p>
                <p className="mt-1">
                  Make sure the timeline has a successful render or uploaded media, use the stable production URL,
                  hard-refresh, and confirm the worker generated thumbnails. A blank video with a visible thumbnail
                  usually means the media route or worker needs attention.
                </p>
              </div>
            </div>
          </Card>

          <Card id="captions">
            <CardHeader title="Transcription and captions" description="Whisper runs on the worker." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>Saving a recording queues transcription for the microphone and system-audio tracks. The worker transcribes both; the editor prefers microphone speech and falls back to system audio.</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Start the worker: <code className="font-mono">pnpm worker</code>.</li>
                <li>Open the timeline and wait for the transcript status to become ready. Use <strong>Refresh status</strong>.</li>
                <li>Choose <strong>Generate captions</strong>.</li>
              </ol>
              <p>Generating again replaces clips labeled <strong>Auto caption</strong>; manually edited captions keep their own labels.</p>
            </div>
          </Card>

          <Card id="rendering">
            <CardHeader title="Rendering" description="Final MP4 output." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>Render jobs queue in the database and are processed by <code className="font-mono">pnpm worker</code>. A timeline render composites the main video, camera overlay, captions and recorded audio, validates the output, and uploads it to R2.</p>
              <p>The timeline page shows queued, running, succeeded and failed jobs, plus the rendered file link.</p>
              <p>Render jobs are local-only by design; Vercel cannot run FFmpeg.</p>
            </div>
          </Card>

          <Card id="publishing">
            <CardHeader title="Publishing" description="From timeline to social draft." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>After a successful render, choose <strong>Create content draft</strong>. This creates a short-video draft linked to the timeline.</p>
              <p>Edit the caption, approve the draft, then use <strong>Publishing handoff</strong>. Timeline drafts upload only the rendered MP4 to HighLevel—not the raw screen, camera or microphone tracks.</p>
              <p>If <code className="font-mono">GHL_TEST_MODE=true</code>, the handoff creates a HighLevel draft and does not publish. Keep test mode on until the account and media flow are verified.</p>
              <p>See the <Link className={linkClass} href="/calendar">publishing calendar</Link> for scheduled and draft posts.</p>
            </div>
          </Card>

          <Card id="storage">
            <CardHeader title="Storage and deletion" description="What is removed and what stays." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Delete project</strong> — removes the project and all related database records plus R2 media, renders, thumbnails, waveforms and pending multipart uploads.</li>
                <li><strong>Delete timeline</strong> — removes the timeline and its rendered video, but keeps raw recording tracks.</li>
                <li><strong>Delete media</strong> — removes one uploaded asset and its derivatives.</li>
              </ul>
              <p>Project deletion is permanent. Use the Delete link on the project or the delete card at the bottom of the project page and type <code className="font-mono">DELETE</code>.</p>
            </div>
          </Card>

          <Card id="worker">
            <CardHeader title="Worker setup" description="FFmpeg and faster-whisper." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>Run the worker on your PC or Contabo VPS. It needs Node, FFmpeg and a Python environment with faster-whisper.</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"><code>{`winget install Gyan.FFmpeg
python -m venv .venv
.\\.venv\\Scripts\\pip install -r scripts\\requirements-worker.txt
pnpm worker`}</code></pre>
              <p>Use <code className="font-mono">pnpm worker:once</code> to process one job and exit. Jobs processed in order: media previews, transcription, timeline renders and storyboard renders.</p>
              <p>The <strong>Worker control</strong> panel on Video Production can start and stop the worker when the control service is running. Start it with <code className="font-mono">pnpm worker:control</code> and set <code className="font-mono">WORKER_CONTROL_URL</code> plus <code className="font-mono">WORKER_CONTROL_TOKEN</code>.</p>
            </div>
          </Card>

          <Card id="install">
            <CardHeader title="Install app" description="DevLogue can be installed as a PWA." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p><strong>Desktop Chrome/Edge:</strong> use the install icon in the address bar, or the <strong>Install app</strong> button on the landing page.</p>
              <p><strong>Android:</strong> Chrome menu ? <strong>Install app</strong> / <strong>Add to Home screen</strong>.</p>
              <p><strong>iPhone/iPad:</strong> Safari ? Share ? <strong>Add to Home Screen</strong>. iOS does not show a browser install prompt.</p>
              <p>The app shell and landing page work offline. Projects, media, uploads, rendering and transcription still need a connection and a running worker.</p>
            </div>
          </Card>
          <Card id="troubleshooting">
            <CardHeader title="Troubleshooting" description="Common fixes." />
            <div className="space-y-4 p-5 text-sm text-slate-700">
              <div>
                <h3 className="font-semibold text-slate-900">Upload failed / CORS</h3>
                <p className="mt-1">The R2 bucket must allow the exact origin you opened. Production is `https://devlogue-prod.vercel.app`; a deployment-specific Vercel URL needs to be added separately. Check with <code className="font-mono">wrangler r2 bucket cors list devlogue-media</code>.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Interrupted upload</h3>
                <p className="mt-1">Open the session Media card, choose <strong>Resume</strong>, and select the same original file. Cancel aborts the partial upload.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">No captions</h3>
                <p className="mt-1">Start the worker and check that the recording has microphone or system audio. The transcript status must be ready before Generate captions appears.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">No thumbnails or waveforms</h3>
                <p className="mt-1">Open the timeline so missing derivative jobs are queued, start the worker, and refresh. Video thumbnails and audio waveforms are generated asynchronously.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Video preview looks blank</h3>
                <p className="mt-1">Confirm the asset opens through <code className="font-mono">/api/media/[id]</code>, refresh after the worker generates a thumbnail, and check that the timeline playhead is inside a clip.</p>
              </div>
            </div>
          </Card>

          <Card id="faq">
            <CardHeader title="FAQ" description="Short answers." />
            <div className="space-y-4 p-5 text-sm text-slate-700">
              <div>
                <h3 className="font-semibold text-slate-900">Can I use this with a project today?</h3>
                <p className="mt-1">Yes. Create a project and session, record or upload media, then edit and render. Use the stable production URL. Start the worker for transcription, previews and rendering.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Does deleting a timeline delete my recording?</h3>
                <p className="mt-1">No. It deletes the timeline and rendered video. Raw screen, camera and audio tracks stay attached to the session.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Can I switch to dark mode?</h3>
                <p className="mt-1">Yes. Use the Light / Dark / System control in the top navigation. System follows your operating system preference.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Can I use it on my phone?</h3>
                <p className="mt-1">Phone recording and the responsive pages work. The timeline editor is still desktop-first; full mobile editing and PWA installation are on the roadmap.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">What is the difference between Studio and the Video Editor?</h3>
                <p className="mt-1">Studio lists text drafts, storyboards and video timelines. The Video Editor opens a timeline for trimming, captions, sync, preview and rendering.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
