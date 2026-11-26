import type { ReactNode } from 'react';

import { FileWarning } from 'lucide-react';

import { ActionButton, ActionRow } from '@/components/inspector/actions';
import { inspectionFailure } from '@/lib/pdf/failure';

/** A paragraph explaining why structure is unavailable. */
const Explanation = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 max-w-[65ch] text-small leading-[1.8] text-muted-foreground">{children}</p>
);

export const InspectionUnavailable = function InspectionUnavailable({
  reason,
  onOpenFile,
  onShowBytes,
}: {
  reason?: string;
  onOpenFile: () => void;
  onShowBytes: () => void;
}) {
  const failure = inspectionFailure(reason);
  return (
    <section aria-label="Why structure is unavailable">
      <FileWarning size={24} className="mt-3 mb-1 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3.5 mb-3 text-subheading font-[550]">{failure.title}</h2>
      <Explanation>{failure.explanation}</Explanation>
      <Explanation>{failure.suggestion}</Explanation>
      <Explanation>Original file bytes are still available. A parsing failure does not confirm password protection.</Explanation>
      {reason && (
        <details className="my-5 text-small">
          <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring">
            Technical details
          </summary>
          <pre className="mt-2.5 rounded-[5px] bg-muted p-3 [overflow-wrap:anywhere] whitespace-pre-wrap">{reason}</pre>
        </details>
      )}
      <ActionRow>
        <ActionButton onClick={onShowBytes}>Inspect original bytes</ActionButton>
        <ActionButton onClick={onOpenFile}>Open another PDF</ActionButton>
      </ActionRow>
    </section>
  );
};
