import type { ComponentProps, MouseEvent, Ref } from 'react';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import type { ContentInstruction, ContentToken, ResourceContext } from '@/lib/pdf/content-stream';
import type { ByteRange, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { Note } from '@/components/inspector/notes';
import { ReferenceButton } from '@/components/inspector/reference-button';
import { SourceCode } from '@/components/inspector/source-code';
import { Warning } from '@/components/inspector/warning';
import { Button } from '@/components/ui/button';
import { contentInstructions, explainInstruction, namedResource, resourceCategory, resourceContexts } from '@/lib/pdf/content-stream';
import { cn } from '@/lib/utils';
const ExplanationLink = ({ className, ...props }: ComponentProps<'a'>) => {
  return <a className={cn('underline underline-offset-3', className)} {...props} />;
};

const RepresentationToggle = ({ readable, onChange }: { readable: boolean; onChange: (readable: boolean) => void }) => {
  return (
    <div className="my-3 flex flex-wrap items-center gap-1.5" aria-label="Decoded stream representation">
      <Button
        size="sm"
        variant={readable ? 'secondary' : 'ghost'}
        className="text-sm"
        aria-pressed={readable}
        onClick={() => {
          return onChange(true);
        }}
      >
        Readable instructions
      </Button>
      <Button
        size="sm"
        variant={!readable ? 'secondary' : 'ghost'}
        className="text-sm"
        aria-pressed={!readable}
        onClick={() => {
          return onChange(false);
        }}
      >
        Decoded byte text
      </Button>
    </div>
  );
};

const TextArrayHelp = ({ onFollowLink }: { onFollowLink?: (event: MouseEvent<HTMLElement>) => boolean }) => {
  return (
    <details className="mb-3 rounded-[5px] border px-3 py-2.5 text-small leading-[1.7]" data-text-help>
      <summary className="cursor-pointer">Why are there numbers between strings? (TJ)</summary>
      <p className="mt-2 text-muted-foreground">
        A PDF records how to draw text. In a <code>TJ</code> array, parentheses hold text strings and numbers adjust where the next string
        starts. For example, <code>[(lor) 17 (em)] TJ</code> can draw “lorem”: <code>17</code> shifts where “em” starts.
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
  );
};

/** The page whose resources resolve names: a picker when several pages share the stream. */
const ResourceContextChoice = ({
  context,
  contexts,
  onChoose,
}: {
  context: ResourceContext | undefined;
  contexts: ResourceContext[];
  onChoose: (id: string) => void;
}) => {
  if (contexts.length <= 1) {
    return (
      <Note>
        {context?.label}. {!context?.resources && 'The resource dictionary is unavailable, so resource names cannot be linked to objects.'}
      </Note>
    );
  }

  return (
    <>
      <label className="mb-3 flex flex-wrap items-center gap-2 text-detail leading-[inherit]">
        Resource context
        <select
          className="max-w-full rounded-[5px] border bg-background p-1.5"
          aria-label="Content resource context"
          value={context?.id ?? ''}
          onChange={(event) => {
            return onChoose(event.target.value);
          }}
        >
          <option value="">Choose a page to resolve resource names</option>
          {contexts.map((entry) => {
            return (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            );
          })}
        </select>
      </label>
      {!context && (
        <Warning>
          This stream is shared by multiple pages. Choose a page to look up resource names in that page’s resource dictionary.
        </Warning>
      )}
    </>
  );
};

const BUILT_IN_COLOUR_SPACES = ['/DeviceGray', '/DeviceRGB', '/DeviceCMYK', '/Pattern'];

/** Why a resource name has no link: a direct value, or a name the context does not define. */
const unresolvedTitle = (category: string | undefined, token: ContentToken, resolved: boolean) => {
  if (!category || (category === 'ColorSpace' && BUILT_IN_COLOUR_SPACES.includes(token.text))) {
    return undefined;
  }

  return resolved ? 'Direct resource value; inspect its resource dictionary for details.' : 'Resource unresolved in the selected context.';
};

// A function rather than a component: a stream can hold thousands of tokens.
const instructionToken = (token: ContentToken, index: number, { context, instruction, objects, text, onNavigate }: InstructionProps) => {
  const category = token.kind === 'name' ? resourceCategory(instruction.operator, index, instruction.tokens.length - 1) : undefined;
  const resource = category ? namedResource(context, category, token.text, objects) : undefined;
  const resourceId = resource?.id;

  return (
    <Fragment key={token.start}>
      {index > 0 && text.slice(instruction.tokens[index - 1].end, token.start)}
      {resourceId ? (
        <ReferenceButton
          aria-label={`Inspect ${token.text} resource`}
          title={`${context?.label} · /${category} · ${resourceId} R`}
          onClick={() => {
            return onNavigate(resourceId);
          }}
        >
          {token.text}
        </ReferenceButton>
      ) : (
        <span className={token.kind === 'operator' ? 'font-semibold' : undefined} title={unresolvedTitle(category, token, !!resource)}>
          {token.text}
        </span>
      )}
    </Fragment>
  );
};

interface InstructionProps {
  context: ResourceContext | undefined;
  instruction: ContentInstruction;
  objects: Map<string, PdfObjectRecord>;
  text: string;
  onNavigate: (id: string, path?: string[]) => void;
}

const InstructionRow = ({ matched, matchRef, ...props }: InstructionProps & { matched?: boolean; matchRef?: Ref<HTMLLIElement> }) => {
  return (
    <li
      className={cn(
        'grid grid-cols-[52px_minmax(0,1fr)] gap-x-2.5 border-b py-3',
        matched && 'bg-byte-selection text-byte-selection-foreground'
      )}
      data-text-match={matched || undefined}
      ref={matchRef}
    >
      <span className="pt-0.5 font-mono text-caption leading-[normal] text-muted-foreground" title="Decoded byte offset">
        0x{props.instruction.start.toString(16).toUpperCase()}
      </span>
      <code className="text-detail leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap">
        {props.instruction.tokens.map((token, index) => {
          return instructionToken(token, index, props);
        })}
      </code>
      <p className="col-start-2 mt-1.25 text-detail leading-[1.7] text-muted-foreground">{explainInstruction(props.instruction)}</p>
    </li>
  );
};

/** Whether a byte range overlaps the instruction, and whether the range starts inside it. */
const overlaps = (range: ByteRange, instruction: ContentInstruction) => {
  return range.start < instruction.end && range.end > instruction.start;
};

const startsIn = (range: ByteRange | undefined, instruction: ContentInstruction) => {
  return !!range && range.start >= instruction.start && range.start < instruction.end;
};

/** The page to resolve names against before the reader picks one: the only page, or the page in view. */
const defaultContextId = (contexts: ResourceContext[], contextPageId: string | undefined) => {
  return contexts.length === 1
    ? contexts[0].id
    : (contexts.find((entry) => {
        return entry.id === contextPageId;
      })?.id ?? '');
};

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
  const contexts = useMemo(() => {
    return resourceContexts(object, objects, pages, contextPageId);
  }, [object, objects, pages, contextPageId]);
  const parsed = useMemo(() => {
    return contentInstructions(stream.text);
  }, [stream.text]);
  const context = contexts.find((entry) => {
    return entry.id === (chosenContext ?? defaultContextId(contexts, contextPageId));
  });

  if (!contexts.length) {
    return <SourceCode>{stream.text}</SourceCode>;
  }

  return (
    <div>
      <RepresentationToggle readable={readable} onChange={setReadable} />
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
          {parsed.instructions.some((instruction) => {
            return instruction.operator === 'TJ';
          }) && <TextArrayHelp onFollowLink={onFollowLink} />}
          <ResourceContextChoice context={context} contexts={contexts} onChoose={setChosenContext} />
          {(stream.truncated || parsed.incomplete) && (
            <Warning>Instruction interpretation is incomplete. Use Decoded byte text to inspect the available bytes.</Warning>
          )}
          <ol aria-label="Content stream instructions">
            {parsed.instructions.map((instruction) => {
              return (
                <InstructionRow
                  key={instruction.start}
                  context={context}
                  instruction={instruction}
                  matched={textMatchRanges?.some((range) => {
                    return overlaps(range, instruction);
                  })}
                  matchRef={startsIn(textMatchRanges?.[0], instruction) ? firstMatch : undefined}
                  objects={objects}
                  text={stream.text}
                  onNavigate={onNavigate}
                />
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
