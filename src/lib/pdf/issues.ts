import type { PdfDocumentInfo } from './types';
/** Classify only known diagnostics. Unrecognised parser messages remain warnings. */
export const diagnosticIssue = function diagnosticIssue(evidence: string, objectId?: string): PdfIssue {
  let severity: IssueSeverity = 'warning';
  let title = 'Parser warning';
  let explanation = 'The parser reported a concern. Inspect the evidence before drawing conclusions about the file.';

  if (/Encrypted document unlocked locally/.test(evidence)) {
    severity = 'info';
    title = 'Document unlocked locally';
    explanation = 'Properties are decrypted; source bytes and offsets still refer to the original encrypted file.';
  } else if (
    /unsupported|does not support|\blimit\b|\bbudget\b|password is required|password required|worker|module|exceeded 15 seconds/i.test(
      evidence
    )
  ) {
    severity = 'limitation';
    title = 'Inspection limited';
    explanation = 'This part could not be checked by the viewer. This does not establish a defect in the PDF.';
  } else if (/Recovered structure:/.test(evidence)) {
    title = 'Damaged cross-references recovered';
    explanation = 'The parser rebuilt the object index. Locations and relationships may be incomplete.';
  } else if (/invalid cross-reference offset|different object identity/.test(evidence)) {
    severity = 'error';
    title = 'Invalid cross-reference target';
    explanation = 'The object index points to an invalid location or a different object. Referenced content may be unavailable.';
  } else if (/Dangling or unresolved reference:/.test(evidence)) {
    title = 'Unresolved object reference';
    explanation =
      'A reference has no available target in the inspected object set. Recovery or an earlier parsing failure may also cause this.';
  } else if (evidence.startsWith('Page tree:')) {
    title = 'Page tree could not be read';
    explanation = 'The page list may be incomplete. Inspect the page-tree objects to investigate.';
  } else if (/could not be resolved|container is unavailable/.test(evidence)) {
    title = 'Object unavailable';
    explanation = 'The parser could not read this object. Content or relationships depending on it may be missing.';
  }

  return {
    evidence,
    explanation,
    id: JSON.stringify([objectId ?? null, evidence]),
    objectId,
    severity,
    title,
  };
};

export const documentIssues = function documentIssues(document: PdfDocumentInfo): PdfIssue[] {
  const available = new Set(
    document.objects.map((object) => {
      return object.id;
    })
  );
  const issues = new Map<string, PdfIssue>();

  for (const evidence of document.warnings) {
    const id = /^Object (\d+ \d+)(?::| )/.exec(evidence)?.[1];
    const issue = diagnosticIssue(evidence, id && available.has(id) ? id : undefined);

    issues.set(issue.id, issue);
  }

  for (const object of document.objects) {
    for (const evidence of object.warnings) {
      const issue = diagnosticIssue(evidence, object.id);

      issues.set(issue.id, issue);
    }
  }

  return [...issues.values()];
};

export const issueSummary = function issueSummary(issues: PdfIssue[]): string {
  return (
    issueOrder
      .flatMap((severity) => {
        const count = issues.filter((issue) => {
          return issue.severity === severity;
        }).length;
        const label = severity === 'info' ? 'information note' : severity === 'limitation' ? 'inspection limitation' : severity;

        return count ? [`${count} ${label}${count === 1 ? '' : 's'}`] : [];
      })
      .join(' · ') || 'No issues detected by these checks.'
  );
};

export type IssueSeverity = 'error' | 'warning' | 'limitation' | 'info';
export interface PdfIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  explanation: string;
  evidence: string;
  objectId?: string;
}
export const issueOrder: IssueSeverity[] = ['error', 'warning', 'limitation', 'info'];
export const issueLabels: Record<IssueSeverity, string> = {
  error: 'Errors',
  info: 'Information',
  limitation: 'Inspection limitations',
  warning: 'Warnings',
};
