type Scene = {
  sceneIndex: number;
  startSec: number;
  durationSec: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  sourceAssetId: string | null;
  editingNotes: string | null;
  transition: string | null;
};

export function StoryboardView({
  board,
  scenes,
  assetNames,
}: {
  board: { hook: string; cta: string; targetDurationSec: number; totalDurationSec: number };
  scenes: Scene[];
  assetNames: Map<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">
          Target {board.targetDurationSec}s
        </span>
        <span
          className={`rounded-lg px-2 py-1 ${
            board.targetDurationSec === board.totalDurationSec
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          Actual {board.totalDurationSec}s
        </span>
        <span className="text-slate-600">9:16 vertical · safe margins for captions</span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p>
          <span className="font-semibold text-slate-900">Hook:</span> {board.hook}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-slate-900">CTA:</span> {board.cta}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3">#</th>
              <th scope="col" className="py-2 pr-3">Time</th>
              <th scope="col" className="py-2 pr-3">On-screen text</th>
              <th scope="col" className="py-2 pr-3">Narration</th>
              <th scope="col" className="py-2 pr-3">Visual</th>
              <th scope="col" className="py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene) => (
              <tr key={scene.sceneIndex} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 text-slate-500">{scene.sceneIndex + 1}</td>
                <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                  {scene.startSec}–{scene.startSec + scene.durationSec}s
                  <span className="block text-slate-400">{scene.durationSec}s</span>
                </td>
                <td className="py-2 pr-3 font-medium text-slate-900">{scene.onScreenText}</td>
                <td className="py-2 pr-3 text-slate-700">{scene.narration}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {scene.visualDirection}
                  {scene.editingNotes ? (
                    <span className="mt-1 block text-xs text-slate-500">Note: {scene.editingNotes}</span>
                  ) : null}
                </td>
                <td className="py-2 text-xs text-slate-600">
                  {scene.sourceAssetId ? assetNames.get(scene.sourceAssetId) ?? scene.sourceAssetId : "—"}
                  {scene.transition ? (
                    <span className="mt-1 block text-slate-400">→ {scene.transition}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
