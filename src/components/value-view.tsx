import { ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';

import type { PdfObjectRecord, PdfValue } from '@/lib/pdf/types';

import { Note } from '@/components/inspector/notes';
import { ReferenceButton } from '@/components/inspector/reference-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
const SCALAR_TONE: Record<string, string> = { name: 'text-foreground', string: 'text-pdf-string' };

/** Where a value sits in the tree: shared by every kind of value below. */
interface ValueContext {
  onNavigate: (id: string, path?: string[]) => void;
  depth: number;
  objects?: Map<string, PdfObjectRecord>;
  ancestors: string[];
  path: string[];
  referenceDepth: number;
}

/** The note after a reference: why it stops, or a way to expand it in place. */
const ReferenceSuffix = ({ value, ...context }: ValueContext & { value: Extract<PdfValue, { type: 'reference' }> }) => {
  const { ancestors, depth, objects, referenceDepth } = context;
  const target = objects?.get(value.ref);
  if (objects && !target) return <span className="text-muted-foreground"> · unavailable reference</span>;
  if (ancestors.includes(value.ref)) return <span className="text-muted-foreground"> · already in this path</span>;
  if (!target) return null;
  if (referenceDepth < 4 && depth < 12) return <InlineReference key={value.ref} target={target} {...context} />;
  return <span className="text-muted-foreground"> · inline depth limit; open object to continue</span>;
};

const ReferenceValue = ({ value, ...context }: ValueContext & { value: Extract<PdfValue, { type: 'reference' }> }) => (
  <span className="inline-block max-w-full align-top">
    <ReferenceButton onClick={() => context.onNavigate(value.ref, context.path)} title={`Open object ${value.ref} in the inspector`}>
      {value.text}
      <ChevronRight size={12} />
    </ReferenceButton>
    <ReferenceSuffix value={value} {...context} />
  </span>
);

/** A dictionary key, with an explanation for the common ones. */
const EntryKey = ({ name }: { name: string }) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-1.25',
      'font-mono text-detail leading-[inherit] [overflow-wrap:anywhere] text-muted-foreground'
    )}
  >
    <span>/{name}</span>
    {explanations[name] && (
      <Tooltip>
        <TooltipTrigger aria-label={`Explain /${name}`} className="inline-flex bg-transparent p-0 text-muted-foreground opacity-70">
          <Info size={12} />
        </TooltipTrigger>
        <TooltipContent>{explanations[name]}</TooltipContent>
      </Tooltip>
    )}
  </div>
);

const DictionaryValue = ({ value, ...context }: ValueContext & { value: Extract<PdfValue, { type: 'dictionary' | 'stream' }> }) => (
  <div className="w-full">
    {value.entries.length === 0 && <span className="text-muted-foreground">Empty dictionary</span>}
    {value.entries.map(({ key, value: child }, index) => {
      const bareKey = key.replace(/^\//, '');
      return (
        <div
          className={cn(
            'grid grid-cols-[minmax(90px,32%)_minmax(0,1fr)] items-start',
            'gap-3 border-b py-2.75',
            // Inside another entry's value, the two-column row stacks.
            'first:pt-0.75 in-data-[slot=pdf-value]:flex in-data-[slot=pdf-value]:flex-col in-data-[slot=pdf-value]:gap-1.5 in-data-[slot=pdf-value]:last:border-0'
          )}
          key={`${key}-${index}`}
        >
          <EntryKey name={bareKey} />
          <div className="min-w-0 text-detail leading-[inherit] [overflow-wrap:anywhere]" data-slot="pdf-value">
            <ValueView {...context} value={child} depth={context.depth + 1} path={[...context.path, `/${bareKey}`]} />
          </div>
        </div>
      );
    })}
  </div>
);

const ArrayValue = ({ value, ...context }: ValueContext & { value: Extract<PdfValue, { type: 'array' }> }) => (
  <div className="flex flex-wrap items-baseline gap-1.75 text-detail leading-[inherit]">
    <span className="text-muted-foreground">[</span>
    {value.items.map((child, index) => (
      <ValueView key={index} {...context} value={child} depth={context.depth + 1} path={[...context.path, `[${index}]`]} />
    ))}
    <span className="text-muted-foreground">]</span>
  </div>
);

export const ValueView = function ValueView({
  value,
  onNavigate,
  depth = 0,
  objects,
  ancestors = [],
  path = [],
  referenceDepth = 0,
}: {
  value: PdfValue;
  onNavigate: (id: string, path?: string[]) => void;
  depth?: number;
  objects?: Map<string, PdfObjectRecord>;
  ancestors?: string[];
  path?: string[];
  referenceDepth?: number;
}) {
  const context = { ancestors, depth, objects, onNavigate, path, referenceDepth };
  if (depth > 12) return <span className="text-muted-foreground">Expand this object in Source to inspect deeper nesting.</span>;
  if (value.type === 'reference') return <ReferenceValue value={value} {...context} />;
  if (value.type === 'dictionary' || value.type === 'stream') return <DictionaryValue value={value} {...context} />;
  if (value.type === 'array') return <ArrayValue value={value} {...context} />;
  return <span className={cn('font-mono text-detail leading-[inherit] whitespace-pre-wrap', SCALAR_TONE[value.type])}>{value.text}</span>;
};
const InlineReference = function InlineReference({
  target,
  onNavigate,
  objects,
  ancestors,
  path,
  referenceDepth,
  depth,
}: {
  target: PdfObjectRecord;
  onNavigate: (id: string, path?: string[]) => void;
  objects?: Map<string, PdfObjectRecord>;
  ancestors: string[];
  path: string[];
  referenceDepth: number;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="mt-1.5 text-detail leading-[inherit]" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary
        className={cn(
          'cursor-pointer py-0.75 text-muted-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        )}
      >
        Expand {target.id} inline
      </summary>
      {expanded && (
        <div className="mt-2 rounded-[5px] border p-2.5 [overflow-wrap:anywhere]">
          <Note className="mb-2.5">
            {target.label} · {PROVENANCE_LABELS[target.provenance.type] ?? PROVENANCE_LABELS.unknown}
          </Note>
          <ValueView
            value={target.value}
            onNavigate={onNavigate}
            objects={objects}
            ancestors={[...ancestors, target.id]}
            path={path}
            referenceDepth={referenceDepth + 1}
            depth={depth + 1}
          />
        </div>
      )}
    </details>
  );
};
const PROVENANCE_LABELS: Record<PdfObjectRecord['provenance']['type'], string> = {
  decoded: 'Decoded object-stream member',
  file: 'Original-file object',
  unknown: 'Source location unknown',
};
const explanations: Record<string, string> = {
  Contents: 'Drawing instructions used to construct this page. May point to one stream or an array of streams.',
  Filter: 'The decoding filters applied to this stream, in the order needed to decode it.',
  Font: 'Named font resources used by content streams.',
  Kids: 'Child nodes in the page tree. References may lead to pages or intermediate nodes.',
  Length: 'The stored length of the stream data, in bytes. May be an indirect reference.',
  MediaBox: 'The page boundary rectangle, measured in PDF user-space units.',
  Pages: 'The root of the page tree.',
  Parent: 'The parent node in the page tree. Page attributes may be inherited from ancestors.',
  Prev: 'The original byte offset of the preceding cross-reference section.',
  Resources: 'Fonts, images, and other named resources available to this page or form.',
  Root: 'The document catalogue: the starting point for exploring the logical document.',
  Type: 'The kind of object this dictionary describes.',
  XObject: 'Named external objects, such as images and reusable form content.',
};
