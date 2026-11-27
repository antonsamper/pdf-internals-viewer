import type { ComponentProps, MouseEvent } from 'react';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import type { ByteRange, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { Note } from '@/components/inspector/notes';
import { ReferenceButton } from '@/components/inspector/reference-button';
import { SourceCode } from '@/components/inspector/source-code';
import { Warning } from '@/components/inspector/warning';
import { Button } from '@/components/ui/button';
import { contentInstructions, explainInstruction, namedResource, resourceCategory, resourceContexts } from '@/lib/pdf/content-stream';
import { cn } from '@/lib/utils';
/** A link in the explanations above the instructions. */
const ExplanationLink = ({ className, ...props }: ComponentProps<'a'>) => (
  <a className={cn('underline underline-offset-3', className)} {...props} />
);

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
  if (!contexts.length) return <SourceCode>{stream.text}</SourceCode>;
  return (
    <div>
      <div className="my-3 flex flex-wrap items-center gap-1.5" aria-label="Decoded stream representation">
        <Button
          size="sm"
          variant={readable ? 'secondary' : 'ghost'}
          className="text-sm"
          aria-pressed={readable}
          onClick={() => setReadable(true)}
        >
          Readable instructions
        </Button>
        <Button
          size="sm"
          variant={!readable ? 'secondary' : 'ghost'}
          className="text-sm"
          aria-pressed={!readable}
          onClick={() => setReadable(false)}
        >
          Decoded byte text
        </Button>
      </div>
      {!readable ? (
        <SourceCode>{stream.text}</SourceCode>
      ) : (
        <>
          <Note>
            Instruction offsets are within this decoded stream, not the original file. Strings retain PDF syntax and font encoding; this is
            not extracted text.
          </Note>
          <Note>
            <ExplanationLink
              href="https://pdfa.org/download-area/cheat-sheets/OperatorsAndOperands.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              PDF operator reference
            </ExplanationLink>{' '}
            (PDF Association, opens PDF in a new tab).
          </Note>
          {parsed.instructions.some((instruction) => instruction.operator === 'TJ') && (
            <details className="mb-3 rounded-[5px] border px-3 py-2.5 text-small leading-[1.7]" data-text-help>
              <summary className="cursor-pointer">Why are there numbers between strings? (TJ)</summary>
              <p className="mt-2 text-muted-foreground">
                A PDF records how to draw text. In a <code>TJ</code> array, parentheses hold text strings and numbers adjust where the next
                string starts. For example, <code>[(lor) 17 (em)] TJ</code> can draw “lorem”: <code>17</code> shifts where “em” starts.
              </p>
              <p className="mt-2 text-muted-foreground">
                Searching decoded streams checks the stored syntax, so a word split across strings may not match. Try a fragment such as{' '}
                <code>lor</code>.{' '}
                <ExplanationLink href="/guides/decode-pdf-streams" onClick={onFollowLink}>
                  Read the Streams guide
                </ExplanationLink>
                .
              </p>
            </details>
          )}
          {contexts.length > 1 ? (
            <label className="mb-3 flex flex-wrap items-center gap-2 text-detail leading-[inherit]">
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
            <Note>
              {context?.label}.{' '}
              {!context?.resources && 'The resource dictionary is unavailable, so resource names cannot be linked to objects.'}
            </Note>
          )}
          {contexts.length > 1 && !context && (
            <Warning>
              This stream is shared by multiple pages. Choose a page to look up resource names in that page’s resource dictionary.
            </Warning>
          )}
          {(stream.truncated || parsed.incomplete) && (
            <Warning>Instruction interpretation is incomplete. Use Decoded byte text to inspect the available bytes.</Warning>
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
                  <span className="pt-0.5 font-mono text-caption leading-[normal] text-muted-foreground" title="Decoded byte offset">
                    0x{instruction.start.toString(16).toUpperCase()}
                  </span>
                  <code className="text-detail leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap">
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
                            <ReferenceButton
                              aria-label={`Inspect ${token.text} resource`}
                              title={`${context?.label} · /${category} · ${resource.id} R`}
                              onClick={() => onNavigate(resource.id!)}
                            >
                              {token.text}
                            </ReferenceButton>
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
                  <p className="col-start-2 mt-1.25 text-detail leading-[1.7] text-muted-foreground">{explainInstruction(instruction)}</p>
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
