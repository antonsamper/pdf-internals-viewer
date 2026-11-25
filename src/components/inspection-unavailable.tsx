import { FileWarning } from 'lucide-react';

import { ACTION_BUTTON, ACTION_ROW } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';
import { inspectionFailure } from '@/lib/pdf/failure';
const PARAGRAPH = 'mb-3 max-w-[65ch] text-[12px] leading-[1.8] text-muted-foreground';

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
      <h2 className="mt-3.5 mb-3 text-[16px] font-[550]">{failure.title}</h2>
      <p className={PARAGRAPH}>{failure.explanation}</p>
      <p className={PARAGRAPH}>{failure.suggestion}</p>
      <p className={PARAGRAPH}>Original file bytes are still available. A parsing failure does not confirm password protection.</p>
      {reason && (
        <details className="my-5 text-[12px]">
          <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring">
            Technical details
          </summary>
          <pre className="mt-2.5 rounded-[5px] bg-muted p-3 [overflow-wrap:anywhere] whitespace-pre-wrap">{reason}</pre>
        </details>
      )}
      <div className={ACTION_ROW}>
        <Button variant="outline" className={ACTION_BUTTON} onClick={onShowBytes}>
          Inspect original bytes
        </Button>
        <Button variant="outline" className={ACTION_BUTTON} onClick={onOpenFile}>
          Open another PDF
        </Button>
      </div>
    </section>
  );
};
