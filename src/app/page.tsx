import Link from "next/link";
import { hasSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallPrompt } from "@/components/install-prompt";
import { Badge, buttonPrimary, buttonSecondary, linkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Record once",
    detail: "Screen, camera, microphone and system audio. Camera PiP can be shown or hidden later.",
  },
  {
    title: "Edit with a real timeline",
    detail: "Trim, split, captions, camera overlays, 16:9 or 9:16, sync offsets and preview thumbnails.",
  },
  {
    title: "Transcribe and caption",
    detail: "Whisper turns the recording audio into a transcript, then timed captions on the text track.",
  },
  {
    title: "Render and schedule",
    detail: "The worker renders a final MP4; DevLogue creates a content draft and hands it to HighLevel.",
  },
];

const STEPS = [
  ["01", "Capture the work", "Create a project and session, then record or upload the raw material."],
  ["02", "Shape the story", "Use the video editor to cut, caption, sync and reframe."],
  ["03", "Publish deliberately", "Approve the content draft, then create a scheduled post or HighLevel draft."],
];

export default async function HomePage() {
  const signedIn = await hasSession();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              DL
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900">DevLogue</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
            <a className="hover:text-slate-900" href="#features">
              Features
            </a>
            <a className="hover:text-slate-900" href="#workflow">
              Workflow
            </a>
            <a className="hover:text-slate-900" href="#privacy">
              Privacy
            </a>
            <Link className="hover:text-slate-900" href="/help">
              Help
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <ThemeToggle />
            <Link className={buttonPrimary} href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? "Open workspace" : "Sign in"}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <Badge tone="accent">Evidence-first content, not invented results</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
              Turn real build work into videos, posts and progress.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              DevLogue records the work, keeps the evidence, edits the footage and prepares the
              content. You decide what gets published.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className={buttonPrimary} href={signedIn ? "/record" : "/login"}>
                {signedIn ? "Record a session" : "Start with DevLogue"}
              </Link>
              <a className={buttonSecondary} href="#workflow">
                See the workflow
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Private by default. AI drafts never publish themselves.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-800 px-2 pb-3 text-xs text-slate-400">
              <span>Timeline preview</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                Worker on demand
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Screen", "w-full", "bg-slate-700"],
                ["Camera", "w-2/5", "bg-indigo-500"],
                ["Microphone", "w-3/5", "bg-emerald-500"],
                ["Captions", "w-1/2", "bg-amber-500"],
              ].map(([label, width, color]) => (
                <div key={label} className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <div className="h-7 rounded-md bg-slate-900 p-1">
                    <div className={`h-full rounded ${width} ${color}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
              <span>00:00 / 14:32</span>
              <span className="font-mono text-slate-300">R2 · private</span>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">One workflow</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                From a raw recording to a scheduled story.
              </h2>
              <p className="mt-3 text-slate-600">
                No second editor, no upload-and-pray, no content invented from a blank prompt.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Keep the evidence. Make the content.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The recording, transcript and claim references stay connected. You can see where every
                post came from.
              </p>
            </div>
            <div className="space-y-3">
              {STEPS.map(([number, title, detail]) => (
                <div key={number} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="font-mono text-sm text-indigo-700">{number}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="privacy" className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Private media. Deliberate publishing.
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Raw tracks live in your private R2 bucket. AI prompts receive the text you choose, not
                the video. Publishing requires an explicit approval and handoff.
              </p>
            </div>
            <Link className={buttonPrimary} href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? "Open workspace" : "Sign in"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-slate-500 sm:px-6">
        <span>DevLogue — build in public from real work.</span>
        <div className="flex gap-4">
          <Link className={linkClass} href="/help">
            Help
          </Link>
          <Link className={linkClass} href="/login">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
