import { FileWarning, CircleAlert, TriangleAlert, Info, ScanLine } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { issueOrder, issueSummary, type PdfIssue, type IssueSeverity } from '@/lib/pdf/issues';
import { useScrollRestoration, type ScrollPosition } from '@/lib/scroll-restoration';
export const IssueSummary = ({ issues }: { issues: PdfIssue[] }) => {
  if (!issues.length) return <p role="status">{issueSummary(issues)}</p>;
  return (
    <div role="status" className="issue-summary">
      {issueOrder.map((severity) => {
        const count = issues.filter((issue) => issue.severity === severity).length;
        if (!count) return null;
        const Icon = severityIcons[severity];
        const label = severity === 'info' ? 'information note' : severity === 'limitation' ? 'inspection limitation' : severity;
        return (
          <span key={severity} className="issue-count" data-severity={severity}>
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
    <div {...scroll} role="region" className="overview inspector-scroll issues-panel" aria-label="PDF issues">
      <div className="overview-heading">
        <FileWarning size={25} aria-hidden="true" />
        <h1>Issues</h1>
        {locked ? <p role="status">Structure checks unavailable while the document is locked.</p> : <IssueSummary issues={issues} />}
      </div>
      <div className="issues-coverage">
        <h2>Checks and coverage</h2>
        <p>
          {locked
            ? 'Unlock the PDF from Overview to check its structure.'
            : 'Collected parser diagnostics, object source checks and reference resolution.'}
        </p>
        {recovered && <p>Structure was recovered. The inspected object set may be incomplete.</p>}
        <p>
          Stream failures are added as streams are inspected. Streams are not all decoded automatically; page rendering, visual correctness,
          signatures and PDF standard conformance are not validated here.
        </p>
        <p>A clean result only means no issues were detected by these checks.</p>
      </div>
      <ol className="issue-list">
        {sorted.slice(0, limit).map((issue) => {
          const Icon = severityIcons[issue.severity];
          return (
            <li key={issue.id} className="issue-item" data-severity={issue.severity}>
              <div className="issue-title">
                <Badge variant="outline" className="issue-severity">
                  <Icon size={13} aria-hidden="true" />
                  {severityNames[issue.severity]}
                </Badge>
                <h2>{issue.title}</h2>
              </div>
              <p>{issue.explanation}</p>
              <pre className="issue-evidence">{issue.evidence}</pre>
              <Button variant="outline" size="sm" onClick={() => (issue.objectId ? onNavigate(issue.objectId) : onStructure())}>
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
