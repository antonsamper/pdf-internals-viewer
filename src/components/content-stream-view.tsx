import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import type { ByteRange, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { Button } from '@/components/ui/button';
import { contentInstructions, explainInstruction, namedResource, resourceCategory, resourceContexts } from '@/lib/pdf/content-stream';
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
  if (!contexts.length) return <pre className="source-code">{stream.text}</pre>;
  return (
    <div className="content-stream-view">
      <div className="content-stream-toolbar" aria-label="Decoded stream representation">
        <Button size="sm" variant={readable ? 'secondary' : 'ghost'} aria-pressed={readable} onClick={() => setReadable(true)}>
          Readable instructions
        </Button>
        <Button size="sm" variant={!readable ? 'secondary' : 'ghost'} aria-pressed={!readable} onClick={() => setReadable(false)}>
          Decoded byte text
        </Button>
      </div>
      {!readable ? (
        <pre className="source-code">{stream.text}</pre>
      ) : (
        <>
          <p className="representation-note">
            Instruction offsets are within this decoded stream, not the original file. Strings retain PDF syntax and font encoding; this is
            not extracted text.
          </p>
          <p className="representation-note content-operator-reference">
            <a href="https://pdfa.org/download-area/cheat-sheets/OperatorsAndOperands.pdf" target="_blank" rel="noopener noreferrer">
              PDF operator reference
            </a>{' '}
            (PDF Association, opens PDF in a new tab).
          </p>
          {parsed.instructions.some((instruction) => instruction.operator === 'TJ') && (
            <details className="content-text-help">
              <summary>Why are there numbers between strings? (TJ)</summary>
              <p>
                A PDF records how to draw text. In a <code>TJ</code> array, parentheses hold text strings and numbers adjust where the next
                string starts. For example, <code>[(lor) 17 (em)] TJ</code> can draw “lorem”: <code>17</code> shifts where “em” starts.
              </p>
              <p>
                Searching decoded streams checks the stored syntax, so a word split across strings may not match. Try a fragment such as{' '}
                <code>lor</code>.{' '}
                <a href="/guides/decode-pdf-streams" onClick={onFollowLink}>
                  Read the Streams guide
                </a>
                .
              </p>
            </details>
          )}
          {contexts.length > 1 ? (
            <label className="content-context-label">
              Resource context
              <select
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
            <p className="representation-note">
              {context?.label}.{' '}
              {!context?.resources && 'The resource dictionary is unavailable, so resource names cannot be linked to objects.'}
            </p>
          )}
          {contexts.length > 1 && !context && (
            <p className="warning-inline">
              This stream is shared by multiple pages. Choose a page to look up resource names in that page’s resource dictionary.
            </p>
          )}
          {(stream.truncated || parsed.incomplete) && (
            <p className="warning-inline">
              Instruction interpretation is incomplete. Use Decoded byte text to inspect the available bytes.
            </p>
          )}
          <ol className="content-instructions" aria-label="Content stream instructions">
            {parsed.instructions.map((instruction) => (
              <li
                className={`content-instruction ${textMatchRanges?.some((range) => range.start < instruction.end && range.end > instruction.start) ? 'text-match' : ''}`}
                ref={
                  textMatchRanges?.[0] && textMatchRanges[0].start >= instruction.start && textMatchRanges[0].start < instruction.end
                    ? firstMatch
                    : undefined
                }
                key={instruction.start}
              >
                <span className="content-offset" title="Decoded byte offset">
                  0x{instruction.start.toString(16).toUpperCase()}
                </span>
                <code className="content-syntax">
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
                            className="reference resource-token"
                            aria-label={`Inspect ${token.text} resource`}
                            title={`${context?.label} · /${category} · ${resource.id} R`}
                            onClick={() => onNavigate(resource.id!)}
                          >
                            {token.text}
                          </button>
                        ) : (
                          <span
                            className={
                              token.kind === 'operator'
                                ? 'operator-token'
                                : token.kind === 'name'
                                  ? 'name-token'
                                  : token.kind === 'number'
                                    ? 'number-token'
                                    : 'value-token'
                            }
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
                <p className="content-explanation">{explainInstruction(instruction)}</p>
              </li>
            ))}
          </ol>
          {!parsed.instructions.length && <p className="muted">No complete drawing instructions in the available stream bytes.</p>}
        </>
      )}
    </div>
  );
};
