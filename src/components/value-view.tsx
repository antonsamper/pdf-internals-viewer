import { cn } from 'cn';
import { ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';

import type { PdfObjectRecord, PdfValue } from '@/lib/pdf/types';

import { REFERENCE, REPRESENTATION_NOTE } from '@/components/inspector-styles';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
const MUTED = 'text-muted-foreground';
const SCALAR_TONE: Record<string, string> = { name: 'text-foreground', string: 'text-pdf-string' };

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
  if (depth > 12) return <span className={MUTED}>Expand this object in Source to inspect deeper nesting.</span>;
  if (value.type === 'reference') {
    const target = objects?.get(value.ref);
    const cycle = ancestors.includes(value.ref);
    return (
      <span className="inline-block max-w-full align-top">
        <button className={REFERENCE} onClick={() => onNavigate(value.ref, path)} title={`Open object ${value.ref} in the inspector`}>
          {value.text}
          <ChevronRight size={12} />
        </button>
        {objects && !target ? (
          <span className={MUTED}> · unavailable reference</span>
        ) : cycle ? (
          <span className={MUTED}> · already in this path</span>
        ) : target && referenceDepth < 4 && depth < 12 ? (
          <InlineReference
            key={value.ref}
            target={target}
            onNavigate={onNavigate}
            objects={objects}
            ancestors={ancestors}
            path={path}
            referenceDepth={referenceDepth}
            depth={depth}
          />
        ) : target ? (
          <span className={MUTED}> · inline depth limit; open object to continue</span>
        ) : null}
      </span>
    );
  }
  if (value.type === 'dictionary' || value.type === 'stream')
    return (
      <div className="w-full">
        {value.entries.length === 0 && <span className={MUTED}>Empty dictionary</span>}
        {value.entries.map(({ key, value: child }, index) => {
          const bareKey = key.replace(/^\//, '');
          return (
            <div
              className={cn(
                'grid grid-cols-[minmax(90px,32%)_minmax(0,1fr)] items-start',
                'gap-3 border-b py-[11px]',
                // Inside another entry's value, the two-column row stacks.
                'first:pt-[3px] in-data-[slot=pdf-value]:flex in-data-[slot=pdf-value]:flex-col in-data-[slot=pdf-value]:gap-1.5 in-data-[slot=pdf-value]:last:border-0'
              )}
              key={`${key}-${index}`}
            >
              <div
                className={cn(
                  'flex flex-wrap items-center gap-[5px]',
                  'font-pdf text-[11px] [overflow-wrap:anywhere] text-muted-foreground'
                )}
              >
                <span>/{bareKey}</span>
                {explanations[bareKey] && (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Explain /${bareKey}`}
                      className="inline-flex bg-transparent p-0 text-muted-foreground opacity-70"
                    >
                      <Info size={12} />
                    </TooltipTrigger>
                    <TooltipContent>{explanations[bareKey]}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="min-w-0 text-[11px] [overflow-wrap:anywhere]" data-slot="pdf-value">
                <ValueView
                  value={child}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                  objects={objects}
                  ancestors={ancestors}
                  path={[...path, `/${bareKey}`]}
                  referenceDepth={referenceDepth}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  if (value.type === 'array')
    return (
      <div className="flex flex-wrap items-baseline gap-[7px] text-[11px]">
        <span className={MUTED}>[</span>
        {value.items.map((child, index) => (
          <ValueView
            key={index}
            value={child}
            onNavigate={onNavigate}
            depth={depth + 1}
            objects={objects}
            ancestors={ancestors}
            path={[...path, `[${index}]`]}
            referenceDepth={referenceDepth}
          />
        ))}
        <span className={MUTED}>]</span>
      </div>
    );
  return <span className={cn('font-pdf text-[11px] whitespace-pre-wrap', SCALAR_TONE[value.type])}>{value.text}</span>;
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
    <details className="mt-1.5 text-[11px]" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary
        className={cn(
          'cursor-pointer py-[3px] text-muted-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        )}
      >
        Expand {target.id} inline
      </summary>
      {expanded && (
        <div className="mt-2 rounded-[5px] border p-2.5 [overflow-wrap:anywhere]">
          <p className={cn(REPRESENTATION_NOTE, 'mb-2.5')}>
            {target.label} ·{' '}
            {target.provenance.type === 'file'
              ? 'Original-file object'
              : target.provenance.type === 'decoded'
                ? 'Decoded object-stream member'
                : 'Source location unknown'}
          </p>
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
