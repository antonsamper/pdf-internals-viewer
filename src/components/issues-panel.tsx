import type { ComponentProps, ComponentType } from 'react';

import { FileWarning, CircleAlert, TriangleAlert, Info, ScanLine } from 'lucide-react';

import type { PdfIssue, IssueSeverity } from '@/lib/pdf/issues';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { IssueNote } from '@/components/inspector/notes';
import { PaneBody, PaneIntro, PaneSubtitle, SectionHeading } from '@/components/inspector/pane';
import { SeverityPill } from '@/components/inspector/severity-pill';
import { SEVERITY_TONE } from '@/components/inspector/severity-tone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { issueOrder, issueSummary } from '@/lib/pdf/issues';
import { useScrollRestoration } from '@/lib/scroll-restoration';
import { cn } from '@/lib/utils';

/** Severity counts, or `empty` with a sentence when there are no issues. */
export const IssueSummary = ({ empty: Empty, issues }: { empty: ComponentType<ComponentProps<'p'>>; issues: PdfIssue[] }) => {
  if (!issues.length) return <Empty role="status">{issueSummary(issues)}</Empty>;
  return (
    <div role="status" className="my-3 flex flex-wrap gap-2">
      {issueOrder.map((severity) => {
        const count = issues.filter((issue) => issue.severity === severity).length;
        if (!count) return null;
        const Icon = severityIcons[severity];
        const label = severity === 'info' ? 'information note' : severity === 'limitation' ? 'inspection limitation' : severity;
        return (
          <SeverityPill
            key={severity}
            className={cn(SEVERITY_TONE[severity], 'rounded-[5px] px-[9px] py-[5px] text-small leading-[inherit] font-semibold')}
          >
            <Icon size={14} aria-hidden="true" />
            {count} {label}
            {count === 1 ? '' : 's'}
          </SeverityPill>
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
    <PaneBody {...scroll} role="region" aria-label="PDF issues">
      <PaneIntro icon={FileWarning} title="Issues">
        {locked ? (
          <PaneSubtitle role="status">Structure checks unavailable while the document is locked.</PaneSubtitle>
        ) : (
          <IssueSummary issues={issues} empty={PaneSubtitle} />
        )}
      </PaneIntro>
      <div className="mt-5 border-t py-3.5 text-small leading-[1.7]">
        <SectionHeading className="leading-[1.7]">Checks and coverage</SectionHeading>
        <IssueNote>
          {locked
            ? 'Unlock the PDF from Overview to check its structure.'
            : 'Collected parser diagnostics, object source checks and reference resolution.'}
        </IssueNote>
        {recovered && <IssueNote>Structure was recovered. The inspected object set may be incomplete.</IssueNote>}
        <IssueNote>
          Stream failures are added as streams are inspected. Streams are not all decoded automatically; page rendering, visual correctness,
          signatures and PDF standard conformance are not validated here.
        </IssueNote>
        <IssueNote>A clean result only means no issues were detected by these checks.</IssueNote>
      </div>
      <ol>
        {sorted.slice(0, limit).map((issue) => {
          const Icon = severityIcons[issue.severity];
          return (
            <li
              key={issue.id}
              className={cn(
                SEVERITY_TONE[issue.severity],
                'border-t py-4 text-small leading-[1.7]',
                MARKED[issue.severity] && 'my-3 border-l-[3px] border-l-(--issue-ink) pl-3.5'
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityPill render={<Badge variant="outline" />}>
                  <Icon size={13} aria-hidden="true" />
                  {severityNames[issue.severity]}
                </SeverityPill>
                <h2 className="font-[550]">{issue.title}</h2>
              </div>
              <IssueNote>{issue.explanation}</IssueNote>
              <pre className="my-2.5 rounded-[5px] bg-muted p-2.5 text-detail leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap">
                {issue.evidence}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="text-small leading-[1.7]"
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
    </PaneBody>
  );
};
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
