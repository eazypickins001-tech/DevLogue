import { Badge } from "@/components/ui";
import type { LintIssue } from "@/lib/domain/content";

export function QualityList({ issues }: { issues: LintIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-emerald-700">No deterministic issues found.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {issues.map((issue, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <Badge tone={issue.severity === "error" ? "danger" : "warning"}>
            {issue.severity}
          </Badge>
          <span className="text-slate-700">
            <span className="font-mono text-xs text-slate-500">{issue.code}</span> — {issue.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
