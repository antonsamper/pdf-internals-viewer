import { cn } from 'cn';
import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import type { ByteRange, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { REFERENCE, REPRESENTATION_NOTE, SOURCE_CODE, WARNING_INLINE } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';
import { contentInstructions, explainInstruction, namedResource, resourceCategory, resourceContexts } from '@/lib/pdf/content-stream';
const EXPLANATION_LINK = 'underline underline-offset-[3px]';

export const ContentStreamView = ({
  object,
  stream,
  objects,
  pages,
  contextPageId,
  onNavigate,
  textMatchRanges,
  onFollowLink,
}: {
  object: PdfObjectRecord;
  textMatchRanges?: ByteRange[];
  stream: StreamResult;
  objects: Map<string, PdfObjectRecord>;
  pages: string[];
  contextPageId?: string;
  onNavigate: (id: string, path?: string[]) => void;
  onFollowLink?: (event: MouseEvent<HTMLElement>) => boolean;
}) => {
  const firstMatch = useRef<HTMLLIElement>(null);
  useEffect(() => {
    firstMatch.current?.scrollIntoView({ block: 'nearest' });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- scroll runs whenever the highlighted match ranges change.
  }, [textMatchRanges]);
  const [readable, setReadable] = useState(true);
  const [chosenContext, setChosenContext] = useState<string | null>(null);
  const contexts = useMemo(() => resourceContexts(object, objects, pages, contextPageId), [object, objects, pages, contextPageId]);
  const parsed = useMemo(() => contentInstructions(stream.text), [stream.text]);
  const defaultContext = contexts.length === 1 ? contexts[0].id : (contexts.find((entry) => entry.id === contextPageId)?.id ?? '');
  const context = contexts.find((entry) => entry.id === (chosenContext ?? defaultContext));
  if (!contexts.length) return <pre className={SOURCE_CODE}>{stream.text}</pre>;
  return (
    <div>
      <div className="my-3 flex flex-wrap items-center gap-1.5" aria-label="Decoded stream representation">
        <Button size="sm" variant={readable ? 'secondary' : 'ghost'} aria-pressed={readable} onClick={() => setReadable(true)}>
          Readable instructions
        </Button>
        <Button size="sm" variant={!readable ? 'secondary' : 'ghost'} aria-pressed={!readable} onClick={() => setReadable(false)}>
          Decoded byte text
        </Button>
      </div>
      {!readable ? (
        <pre className={SOURCE_CODE}>{stream.text}</pre>
      ) : (
        <>
          <p className={REPRESENTATION_NOTE}>
            Instruction offsets are within this decoded stream, not the original file. Strings retain PDF syntax and font encoding; this is
            not extracted text.
          </p>
          <p className={REPRESENTATION_NOTE}>
            <a
              className={EXPLANATION_LINK}
              href="https://pdfa.org/download-area/cheat-sheets/OperatorsAndOperands.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              PDF operator reference
            </a>{' '}
            (PDF Association, opens PDF in a new tab).
          </p>
          {parsed.instructions.some((instruction) => instruction.operator === 'TJ') && (
            <details className="mb-3 rounded-[5px] border px-3 py-2.5 text-[12px] leading-[1.7]" data-text-help>
              <summary className="cursor-pointer">Why are there numbers between strings? (TJ)</summary>
              <p className="mt-2 text-muted-foreground">
                A PDF records how to draw text. In a <code>TJ</code> array, parentheses hold text strings and numbers adjust where the next
                string starts. For example, <code>[(lor) 17 (em)] TJ</code> can draw “lorem”: <code>17</code> shifts where “em” starts.
              </p>
              <p className="mt-2 text-muted-foreground">
                Searching decoded streams checks the stored syntax, so a word split across strings may not match. Try a fragment such as{' '}
                <code>lor</code>.{' '}
                <a className={EXPLANATION_LINK} href="/guides/decode-pdf-streams" onClick={onFollowLink}>
                  Read the Streams guide
                </a>
                .
              </p>
            </details>
          )}
          {contexts.length > 1 ? (
            <label className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              Resource context
              <select
                className="max-w-full rounded-[5px] border bg-background p-1.5"
                aria-label="Content resource context"
                value={context?.id ?? ''}
                onChange={(event) => setChosenContext(event.target.value)}
              >
                <option value="">Choose a page to resolve resource names</option>
                {contexts.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className={REPRESENTATION_NOTE}>
              {context?.label}.{' '}
              {!context?.resources && 'The resource dictionary is unavailable, so resource names cannot be linked to objects.'}
            </p>
          )}
          {contexts.length > 1 && !context && (
            <p className={WARNING_INLINE}>
              This stream is shared by multiple pages. Choose a page to look up resource names in that page’s resource dictionary.
            </p>
          )}
          {(stream.truncated || parsed.incomplete) && (
            <p className={WARNING_INLINE}>
              Instruction interpretation is incomplete. Use Decoded byte text to inspect the available bytes.
            </p>
          )}
          <ol aria-label="Content stream instructions">
            {parsed.instructions.map((instruction) => {
              const matched = textMatchRanges?.some((range) => range.start < instruction.end && range.end > instruction.start);
              return (
                <li
                  className={cn(
                    'grid grid-cols-[52px_minmax(0,1fr)] gap-x-2.5 border-b py-3',
                    matched && 'bg-byte-selection text-byte-selection-foreground'
                  )}
                  data-text-match={matched || undefined}
                  ref={
                    textMatchRanges?.[0] && textMatchRanges[0].start >= instruction.start && textMatchRanges[0].start < instruction.end
                      ? firstMatch
                      : undefined
                  }
                  key={instruction.start}
                >
                  <span className="pt-0.5 font-pdf text-[10px] leading-[normal] text-muted-foreground" title="Decoded byte offset">
                    0x{instruction.start.toString(16).toUpperCase()}
                  </span>
                  <code className="text-[11px]! leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {instruction.tokens.map((token, index) => {
                      const category =
                        token.kind === 'name' ? resourceCategory(instruction.operator, index, instruction.tokens.length - 1) : undefined;
                      const resource = category ? namedResource(context, category, token.text, objects) : undefined;
                      const builtInColor =
                        category === 'ColorSpace' && ['/DeviceGray', '/DeviceRGB', '/DeviceCMYK', '/Pattern'].includes(token.text);
                      return (
                        <Fragment key={token.start}>
                          {index > 0 && stream.text.slice(instruction.tokens[index - 1].end, token.start)}
                          {resource?.id ? (
                            <button
                              className={REFERENCE}
                              aria-label={`Inspect ${token.text} resource`}
                              title={`${context?.label} · /${category} · ${resource.id} R`}
                              onClick={() => onNavigate(resource.id!)}
                            >
                              {token.text}
                            </button>
                          ) : (
                            <span
                              className={token.kind === 'operator' ? 'font-semibold' : undefined}
                              title={
                                category && !builtInColor
                                  ? resource
                                    ? 'Direct resource value; inspect its resource dictionary for details.'
                                    : 'Resource unresolved in the selected context.'
                                  : undefined
                              }
                            >
                              {token.text}
                            </span>
                          )}
                        </Fragment>
                      );
                    })}
                  </code>
                  <p className="col-start-2 mt-[5px] text-[11px] leading-[1.7] text-muted-foreground">{explainInstruction(instruction)}</p>
                </li>
              );
            })}
          </ol>
          {!parsed.instructions.length && (
            <p className="text-muted-foreground">No complete drawing instructions in the available stream bytes.</p>
          )}
        </>
      )}
    </div>
  );
};
