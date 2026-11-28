import type { ComponentProps } from 'react';

import { ShieldAlert, TriangleAlert, Zap } from 'lucide-react';
import { useState } from 'react';

import type { PdfAction, PdfActionReport, PdfActionTarget } from '@/lib/pdf/document-actions';
import type { StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { IssueNote } from '@/components/inspector/notes';
import { PaneBody, PaneIntro, PaneSubtitle, SectionHeading } from '@/components/inspector/pane';
import { SeverityPill } from '@/components/inspector/severity-pill';
import { SEVERITY_TONE } from '@/components/inspector/severity-tone';
import { Warning } from '@/components/inspector/warning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ACTION_PAGE_SIZE, flattenActions, scriptText } from '@/lib/pdf/document-actions';
import { useScrollRestoration } from '@/lib/scroll-restoration';
import { cn } from '@/lib/utils';

type ReadStream = (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
type Navigate = (id: string) => void;

const plural = (count: number, word: string) => {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
};

const summary = ({ actions, notes }: PdfActionReport) => {
  const all = flattenActions(actions);
  const sensitive = all.filter((action) => {
    return action.sensitive;
  }).length;
  const noteCount =
    notes.length +
    all.reduce((total, action) => {
      return total + action.notes.length;
    }, 0);

  return [
    all.length ? plural(all.length, 'action') : 'No actions found in the sources below',
    sensitive && `${sensitive} marked for review`,
    noteCount && plural(noteCount, 'parse note'),
  ]
    .filter(Boolean)
    .join(' · ');
};

const InspectButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  return <Button variant="outline" size="sm" className={cn('text-small leading-[1.7]', 'narrow:min-h-11', className)} {...props} />;
};

/** Decoded text shown as plain text, never as markup or a link. */
const DecodedText = ({ className, ...props }: ComponentProps<'pre'>) => {
  return (
    <pre
      className={cn(
        'my-2 max-h-60 overflow-auto p-2.5',
        'text-detail leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap',
        'rounded-[5px] bg-muted',
        className
      )}
      {...props}
    />
  );
};

const DecodedLabel = ({ className, ...props }: ComponentProps<'p'>) => {
  return <p className={cn('mt-2 text-caption text-muted-foreground', className)} {...props} />;
};

const DecodedScript = ({ result, streamId }: { result: StreamResult; streamId: string }) => {
  const { encoding, text } = scriptText(result);

  return (
    <>
      <DecodedLabel>
        Decoded stream text from {streamId} obj, read as {encoding}
        {result.truncated ? ', truncated' : ''}. Not run.
      </DecodedLabel>
      <DecodedText aria-label={`Decoded script from ${streamId} obj`}>{text}</DecodedText>
    </>
  );
};

/** Reads a script stream when asked, so opening the panel reads nothing. */
const ScriptStream = ({ streamId, readStream, onNavigate }: { streamId: string; readStream: ReadStream; onNavigate: Navigate }) => {
  const [result, setResult] = useState<StreamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setFailure(null);
    try {
      setResult(await readStream(streamId, 'decoded'));
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : 'The script stream could not be read.');
    } finally {
      setLoading(false);
    }
  };

  const error = failure ?? result?.error;

  return (
    <div className="my-2">
      <div className="flex flex-wrap gap-2">
        {!result && (
          <InspectButton
            disabled={loading}
            onClick={() => {
              return void load();
            }}
          >
            {loading ? 'Reading script…' : 'Show decoded script'}
          </InspectButton>
        )}
        <InspectButton
          onClick={() => {
            return onNavigate(streamId);
          }}
        >
          Inspect {streamId} obj
        </InspectButton>
      </div>
      {error && <Warning role="alert">{error}</Warning>}
      {result && !result.error && <DecodedScript result={result} streamId={streamId} />}
    </div>
  );
};

const ActionTarget = ({ target, readStream, onNavigate }: { target: PdfActionTarget; readStream: ReadStream; onNavigate: Navigate }) => {
  if (target.streamId) {
    return (
      <>
        <p className="mt-2">
          <span className="text-muted-foreground">{target.label}:</span> stream {target.streamId} obj
        </p>
        <ScriptStream streamId={target.streamId} readStream={readStream} onNavigate={onNavigate} />
      </>
    );
  }

  if (target.decodedString) {
    return (
      <>
        <DecodedLabel>
          {target.label}, decoded from a string value{target.truncated ? ', truncated' : ''}. Not run.
        </DecodedLabel>
        <DecodedText>{target.text}</DecodedText>
      </>
    );
  }

  return (
    <>
      <p className="mt-2 [overflow-wrap:anywhere]">
        <span className="text-muted-foreground">{target.label}:</span> <code>{target.text}</code>
        {target.truncated && <span className="text-muted-foreground"> (truncated)</span>}
      </p>
      {target.detail && <p className="[overflow-wrap:anywhere]">{target.detail}</p>}
    </>
  );
};

/** The type badge, and a pill for the types that run code, open files or move form data. */
const ActionType = ({ action }: { action: PdfAction }) => {
  return (
    <>
      {action.type ? (
        <Badge variant="outline" className="font-mono text-detail">
          /S /{action.type}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-detail">
          {action.destination ? 'Destination' : 'No action type'}
        </Badge>
      )}
      {action.sensitive && (
        <SeverityPill render={<Badge variant="outline" />}>
          <ShieldAlert size={13} aria-hidden="true" />
          {action.sensitive}
        </SeverityPill>
      )}
    </>
  );
};

const ActionLinks = ({ action, onNavigate }: { action: PdfAction; onNavigate: Navigate }) => {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {action.holderId && (
        <InspectButton
          onClick={() => {
            return onNavigate(action.holderId!);
          }}
        >
          Inspect holder {action.holderId} obj
        </InspectButton>
      )}
      {action.actionId && action.actionId !== action.holderId && (
        <InspectButton
          onClick={() => {
            return onNavigate(action.actionId!);
          }}
        >
          Inspect action {action.actionId} obj
        </InspectButton>
      )}
    </div>
  );
};

/** Parse notes. The walk adds each report note once; the set keeps an action's own notes unique too, so the text is the key. */
const ActionNotes = ({ notes }: { notes: string[] }) => {
  return [...new Set(notes)].map((note) => {
    return (
      <Warning key={note} className="text-small">
        <TriangleAlert size={14} className="mt-1 shrink-0" aria-hidden="true" />
        <span>{note}</span>
      </Warning>
    );
  });
};

const ActionItem = ({
  action,
  chained = false,
  readStream,
  onNavigate,
}: {
  action: PdfAction;
  chained?: boolean;
  readStream: ReadStream;
  onNavigate: Navigate;
}) => {
  const Heading = chained ? 'h3' : 'h2';

  return (
    <li
      className={cn(
        'border-t py-4 text-small leading-[1.7]',
        action.sensitive && [SEVERITY_TONE.warning, 'border-l-3 border-l-(--issue-ink) pl-3.5']
      )}
      data-action-type={action.type ?? (action.destination ? 'destination' : 'none')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ActionType action={action} />
        <Heading className="font-[550]">{action.trigger}</Heading>
      </div>
      <p className="[overflow-wrap:anywhere] text-muted-foreground">
        {action.context} · <code>{action.entry}</code>
      </p>
      {action.target && <ActionTarget target={action.target} readStream={readStream} onNavigate={onNavigate} />}
      <ActionNotes notes={action.notes} />
      <ActionLinks action={action} onNavigate={onNavigate} />
      {action.next.length > 0 && (
        <ol className="mt-3 ml-1.5 border-l pl-3.5" aria-label={`Actions after ${action.trigger.toLowerCase()}`}>
          {action.next.map((next) => {
            return <ActionItem key={next.key} action={next} chained readStream={readStream} onNavigate={onNavigate} />;
          })}
        </ol>
      )}
    </li>
  );
};

const Coverage = ({ recovered }: { recovered: boolean }) => {
  return (
    <div className="mt-5 border-t py-3.5 text-small leading-[1.7]">
      <SectionHeading className="leading-[1.7]">Sources and limits</SectionHeading>
      <IssueNote>
        Read from the catalogue’s <code>/OpenAction</code> and <code>/AA</code>, its <code>/Names /JavaScript</code> tree, page{' '}
        <code>/AA</code>, annotation <code>/A</code> and <code>/AA</code>, form field <code>/A</code> and <code>/AA</code> and outline item{' '}
        <code>/A</code> entries, with their <code>/Next</code> chains.
      </IssueNote>
      <IssueNote>
        XFA form scripts and actions inside other objects are not listed. A note below says when this document has an XFA form. Search Keys
        for <code>JavaScript</code> to find them.
      </IssueNote>
      <IssueNote>
        Nothing is run. Targets and scripts are decoded values; check the holder’s Source or Original bytes for the stored syntax.
      </IssueNote>
      {recovered && <IssueNote>Structure was recovered. The inspected object set may be incomplete.</IssueNote>}
    </div>
  );
};

export const ActionsPanel = ({
  limit,
  locked,
  recovered,
  report,
  scrollPositionRef,
  readStream,
  onLimitChange,
  onNavigate,
}: {
  limit: number;
  locked: boolean;
  recovered: boolean;
  report: PdfActionReport;
  scrollPositionRef: ScrollPosition;
  readStream: ReadStream;
  onLimitChange: (limit: number) => void;
  onNavigate: Navigate;
}) => {
  const scroll = useScrollRestoration(scrollPositionRef);
  const { actions, notes } = report;

  return (
    <PaneBody {...scroll} role="region" aria-label="PDF actions">
      <PaneIntro icon={Zap} title="Actions">
        <PaneSubtitle role="status">
          {locked ? 'Actions are unavailable while the document is locked. Unlock it from Overview.' : summary(report)}
        </PaneSubtitle>
      </PaneIntro>
      <Coverage recovered={recovered} />
      <ActionNotes notes={notes} />
      <ol aria-label="Actions">
        {actions.slice(0, limit).map((action) => {
          return <ActionItem key={action.key} action={action} readStream={readStream} onNavigate={onNavigate} />;
        })}
      </ol>
      {actions.length > limit && (
        <Button
          variant="outline"
          size="sm"
          className="narrow:min-h-11"
          onClick={() => {
            return onLimitChange(limit + ACTION_PAGE_SIZE);
          }}
        >
          Show more ({actions.length - limit} remaining)
        </Button>
      )}
    </PaneBody>
  );
};
