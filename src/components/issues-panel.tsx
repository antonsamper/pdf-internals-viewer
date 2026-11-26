import { cn } from 'cn';
import { FileWarning, CircleAlert, TriangleAlert, Info, ScanLine } from 'lucide-react';

import {
  INSPECTOR_SCROLL,
  OVERVIEW_ICON,
  OVERVIEW_SUBTITLE,
  OVERVIEW_TITLE,
  SECTION_HEADING,
  SEVERITY_PILL,
  SEVERITY_TONE,
} from '@/components/inspector-styles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { issueOrder, issueSummary, type PdfIssue, type IssueSeverity } from '@/lib/pdf/issues';
import { useScrollRestoration, type ScrollPosition } from '@/lib/scroll-restoration';
export const IssueSummary = ({ className, issues }: { className?: string; issues: PdfIssue[] }) => {
  if (!issues.length)
    return (
      <p role="status" className={className}>
        {issueSummary(issues)}
      </p>
    );
  return (
    <div role="status" className="my-3 flex flex-wrap gap-2">
      {issueOrder.map((severity) => {
        const count = issues.filter((issue) => issue.severity === severity).length;
        if (!count) return null;
        const Icon = severityIcons[severity];
        const label = severity === 'info' ? 'information note' : severity === 'limitation' ? 'inspection limitation' : severity;
        return (
          <span
            key={severity}
            className={cn(SEVERITY_PILL, SEVERITY_TONE[severity], 'rounded-[5px] px-[9px] py-[5px] text-[12px] font-semibold')}
          >
            <Icon size={14} aria-hidden="true" />
            {count} {label}
            {count === 1 ? '' : 's'}
          </span>
        );
      })}
    </div>
  );
};
export const IssuesPanel = ({
  issues,
  limit,
  onLimitChange,
  scrollPositionRef,
  locked,
  recovered,
  onNavigate,
  onStructure,
}: {
  scrollPositionRef: ScrollPosition;
  limit: number;
  onLimitChange: (limit: number) => void;
  issues: PdfIssue[];
  locked: boolean;
  recovered: boolean;
  onNavigate: (id: string) => void;
  onStructure: () => void;
}) => {
  const scroll = useScrollRestoration(scrollPositionRef);
  const sorted = issues.toSorted((a, b) => issueOrder.indexOf(a.severity) - issueOrder.indexOf(b.severity));
  return (
    <div {...scroll} role="region" className={INSPECTOR_SCROLL} aria-label="PDF issues">
      <div>
        <FileWarning size={25} className={OVERVIEW_ICON} aria-hidden="true" />
        <h1 className={OVERVIEW_TITLE}>Issues</h1>
        {locked ? (
          <p role="status" className={OVERVIEW_SUBTITLE}>
            Structure checks unavailable while the document is locked.
          </p>
        ) : (
          <IssueSummary issues={issues} className={OVERVIEW_SUBTITLE} />
        )}
      </div>
      <div className="mt-5 border-t py-3.5 text-[12px] leading-[1.7]">
        <h2 className={SECTION_HEADING}>Checks and coverage</h2>
        <p className={COVERAGE_NOTE}>
          {locked
            ? 'Unlock the PDF from Overview to check its structure.'
            : 'Collected parser diagnostics, object source checks and reference resolution.'}
        </p>
        {recovered && <p className={COVERAGE_NOTE}>Structure was recovered. The inspected object set may be incomplete.</p>}
        <p className={COVERAGE_NOTE}>
          Stream failures are added as streams are inspected. Streams are not all decoded automatically; page rendering, visual correctness,
          signatures and PDF standard conformance are not validated here.
        </p>
        <p className={COVERAGE_NOTE}>A clean result only means no issues were detected by these checks.</p>
      </div>
      <ol>
        {sorted.slice(0, limit).map((issue) => {
          const Icon = severityIcons[issue.severity];
          return (
            <li
              key={issue.id}
              className={cn(
                SEVERITY_TONE[issue.severity],
                'border-t py-4 text-[12px] leading-[1.7]',
                MARKED[issue.severity] && 'my-3 border-l-[3px] border-l-(--issue-ink) pl-3.5'
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={SEVERITY_PILL}>
                  <Icon size={13} aria-hidden="true" />
                  {severityNames[issue.severity]}
                </Badge>
                <h2 className="text-[12px] font-[550]">{issue.title}</h2>
              </div>
              <p className={COVERAGE_NOTE}>{issue.explanation}</p>
              <pre className="my-2.5 rounded-[5px] bg-muted p-2.5 text-[11px] [overflow-wrap:anywhere] whitespace-pre-wrap">
                {issue.evidence}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] leading-[1.7]"
                onClick={() => (issue.objectId ? onNavigate(issue.objectId) : onStructure())}
              >
                {issue.objectId ? `Inspect ${issue.objectId} obj` : 'Inspect file structure'}
              </Button>
            </li>
          );
        })}
      </ol>
      {sorted.length > limit && (
        <Button variant="outline" size="sm" onClick={() => onLimitChange(limit + 50)}>
          Show more ({sorted.length - limit} remaining)
        </Button>
      )}
    </div>
  );
};
const COVERAGE_NOTE = 'my-2 text-muted-foreground';
/** Errors and warnings get a coloured rule down the left edge. */
const MARKED: Record<IssueSeverity, boolean> = { error: true, info: false, limitation: false, warning: true };
const severityIcons = {
  error: CircleAlert,
  info: Info,
  limitation: ScanLine,
  warning: TriangleAlert,
};
const severityNames: Record<IssueSeverity, string> = {
  error: 'Error',
  info: 'Information',
  limitation: 'Inspection limitation',
  warning: 'Warning',
};
