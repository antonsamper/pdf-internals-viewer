import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { ArrowUpRight, Braces, FileCode2, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { EmbeddedDownload } from '@/lib/pdf/downloads';
import type { ByteRange, PdfObjectRecord, PdfValue, StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { ContentStreamView } from '@/components/content-stream-view';
import { EmbeddedDownloads } from '@/components/embedded-downloads';
import { ImageDownload } from '@/components/image-download';
import { LoadingMessage } from '@/components/inspector/loading-message';
import { Note } from '@/components/inspector/notes';
import { PaneBody, SectionHeading } from '@/components/inspector/pane';
import { ReferenceButton } from '@/components/inspector/reference-button';
import { SourceCode } from '@/components/inspector/source-code';
import { Warning } from '@/components/inspector/warning';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ValueView } from '@/components/value-view';
import { embeddedDownloads } from '@/lib/pdf/downloads';
import { hasSubtype } from '@/lib/pdf/navigation';
import { objectName, objectRelationships, objectSummary } from '@/lib/pdf/object-context';
import { useScrollRestoration } from '@/lib/scroll-restoration';
import { cn } from '@/lib/utils';

/** Tabs sit on one flat line: violet when active, with a red underline. */
const ObjectTab = ({ className, ...props }: ComponentProps<typeof TabsTrigger>) => (
  <TabsTrigger
    className={cn(
      'h-8 flex-initial px-[3px] py-0 text-detail',
      'data-active:text-brand-purple data-active:after:bg-brand-red data-active:hover:text-brand-purple',
      'dark:data-active:text-brand-purple dark:data-active:hover:text-brand-purple',
      className
    )}
    {...props}
  />
);

/** One side of a relationship link: the referring object, the target or the path between them. */
const RelationshipPart = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)} {...props} />
);

const RelationshipPath = ({ children }: { children: ReactNode }) => (
  <RelationshipPart className="font-mono text-muted-foreground">{children}</RelationshipPart>
);

const RelationshipLink = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    className={cn(
      'flex flex-wrap justify-between gap-x-3 gap-y-1 p-2',
      'rounded-[5px] text-left text-detail leading-[inherit] [overflow-wrap:anywhere]',
      'hover:bg-accent'
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

/** A titled list of relationship links, with a sentence in place of the list when it is empty. */
const Relationships = ({ children, count, empty, title }: { children: ReactNode; count: number; empty?: string; title: string }) => (
  <>
    <SectionHeading className="leading-[inherit]">
      {title}{' '}
      <span className="ml-[5px] text-caption leading-[inherit] text-muted-foreground">
        {count} {count === 1 ? 'object' : 'objects'}
      </span>
    </SectionHeading>
    <div className="grid gap-1" data-relationship-links>
      {children}
      {empty && <p className="text-muted-foreground">{empty}</p>}
    </div>
  </>
);
const ObjectHeader = ({ object, summary }: { object: PdfObjectRecord; summary: string }) => (
  <header className="px-[22px] pt-[23px] pb-[15px] max-w480:px-[18px] max-w480:pt-5 max-w480:pb-3">
    <div className="flex items-center gap-[11px]">
      <Braces size={19} />
      <h1 className="font-mono text-heading font-medium">
        {object.id} <span className="text-muted-foreground">obj</span>
      </h1>
      <Badge variant="secondary" className="rounded-[4px] text-caption leading-[calc(4/3)]">
        {object.kind}
      </Badge>
    </div>
    <p className="mt-2 text-detail text-muted-foreground">{object.label}</p>
    <p className="mt-2.5 max-w-[65ch] text-small leading-[1.65] text-foreground" data-object-explanation>
      {summary}
    </p>
  </header>
);

const ProvenanceNote = ({ object, onNavigate }: { object: PdfObjectRecord; onNavigate: (id: string) => void }) => (
  <div
    className={cn(
      'flex items-start gap-[7px] px-[22px] pb-[18px]',
      'text-caption leading-[1.7] text-muted-foreground',
      'max-w480:px-[18px] max-w480:pb-4'
    )}
    data-provenance
  >
    <FileCode2 size={14} className="mt-0.5 shrink-0 text-brand-orange-ink" />
    {object.provenance.type === 'file' ? (
      <span>
        Original file · <code className="text-caption leading-[inherit]">0x{object.provenance.range.start.toString(16).toUpperCase()}</code>{' '}
        · {object.provenance.range.end - object.provenance.range.start} bytes
      </span>
    ) : object.provenance.type === 'decoded' ? (
      <span>
        Decoded object stream{' '}
        <ReferenceButton
          onClick={() => {
            if (object.provenance.type === 'decoded') onNavigate(object.provenance.containerId);
          }}
        >
          {object.provenance.containerId}
          <ArrowUpRight size={12} />
        </ReferenceButton>{' '}
        · offset {object.provenance.range.start}
      </span>
    ) : (
      <span>Source location unknown · {object.provenance.reason}</span>
    )}
  </div>
);

export const ObjectInspector = function ObjectInspector({
  object,
  scrollPositionRef,
  tab,
  onTabChange,
  onNavigate,
  onInspect,
  readStream,
  extractStream,
  extractImage,
  resources,
  objects,
  downloadIndex,
  pages = [],
  contextPageId,
  textMatchRanges,
  onFollowLink,
}: {
  object: PdfObjectRecord;
  scrollPositionRef: ScrollPosition;
  resources?: {
    value: PdfValue;
    inheritedFrom?: string;
  };
  downloadIndex?: Map<string, EmbeddedDownload[]>;
  objects?: Map<string, PdfObjectRecord>;
  pages?: string[];
  contextPageId?: string;
  textMatchRanges?: ByteRange[];
  onFollowLink?: (event: MouseEvent<HTMLElement>) => boolean;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onNavigate: (id: string, path?: string[]) => void;
  onInspect: (id: string) => void;
  readStream: (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
  extractStream: (id: string, purpose?: 'download' | 'size') => Promise<StreamResult>;
  extractImage: (id: string) => Promise<StreamResult>;
}) {
  const downloads = useMemo(() => downloadIndex ?? embeddedDownloads(objects ?? new Map()), [objects, downloadIndex]);
  const assets = downloads.get(object.id) ?? [];
  const relationships = useMemo(() => objectRelationships(object, objects ?? new Map()), [object, objects]);
  const summary = objectSummary(object, pages, relationships.incoming, objects ?? new Map());
  const [state, setState] = useState<{
    object: PdfObjectRecord;
    tab: InspectorTab;
    result?: StreamResult;
    error?: string;
  } | null>(null);
  const stream = state?.object === object && state.tab === tab ? state.result : undefined;
  const error = state?.object === object && state.tab === tab ? state.error : undefined;
  useEffect(() => {
    if (!object.stream || (tab !== 'raw' && tab !== 'decoded')) return;
    let active = true;
    readStream(object.id, tab)
      .then((result) => {
        if (active) setState({ object, result, tab });
      })
      .catch((reason) => {
        if (active)
          setState({
            error: reason instanceof Error ? reason.message : 'Could not read stream.',
            object,
            tab,
          });
      });
    return () => {
      active = false;
    };
  }, [object, tab, readStream]);
  const safeTab = !object.stream && (tab === 'raw' || tab === 'decoded') ? 'properties' : tab;
  const scroll = useScrollRestoration(scrollPositionRef, (safeTab !== 'raw' && safeTab !== 'decoded') || Boolean(stream || error));
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden" aria-label="Object inspector">
      <ObjectHeader object={object} summary={summary} />
      {object.stream && hasSubtype(object, 'Image') && (
        <div className="mx-[22px] mb-4">
          <ImageDownload key={object.id} object={object} extractImage={extractImage} />
        </div>
      )}
      {assets.length > 0 && <EmbeddedDownloads key={object.id} object={object} assets={assets} extractStream={extractStream} />}
      <ProvenanceNote object={object} onNavigate={onNavigate} />
      {object.warnings.map((warning, i) => (
        <Warning key={i}>{warning}</Warning>
      ))}
      <Tabs value={safeTab} onValueChange={(value) => onTabChange(value as InspectorTab)} className="min-h-0 flex-1 gap-0">
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-start gap-[13px] border-b px-[18px] py-0 group-data-horizontal/tabs:h-[37px]"
        >
          <ObjectTab value="properties">Properties</ObjectTab>
          <ObjectTab value="source">Source</ObjectTab>
          {object.stream && (
            <>
              <ObjectTab value="raw">Raw stream</ObjectTab>
              <ObjectTab value="decoded">Decoded</ObjectTab>
            </>
          )}
        </TabsList>
        <TabsContent value="properties" render={<PaneBody />} {...(safeTab === 'properties' ? scroll : {})}>
          <ValueView key={object.id} value={object.value} onNavigate={onNavigate} objects={objects} ancestors={[object.id]} />
          <section className="mt-[30px]">
            {resources && (
              <>
                <SectionHeading className="leading-[inherit]">Effective page resources</SectionHeading>
                {resources.inheritedFrom ? (
                  <Note>
                    Inherited from{' '}
                    <ReferenceButton onClick={() => onNavigate(resources.inheritedFrom!)}>{resources.inheritedFrom} R</ReferenceButton>. The
                    inspector found these resources on an ancestor in the page tree.
                  </Note>
                ) : (
                  <Note>Defined on this page.</Note>
                )}
                <ValueView
                  key={`${object.id}-resources`}
                  value={resources.value}
                  onNavigate={resources.inheritedFrom ? (id) => onNavigate(id) : onNavigate}
                  objects={objects}
                  ancestors={[object.id]}
                  path={['/Resources']}
                />
              </>
            )}
            <Relationships
              title="References"
              count={object.references.length}
              empty={
                relationships.outgoing.length
                  ? undefined
                  : object.references.length
                    ? 'Reference paths unavailable in the inspected value.'
                    : 'No outgoing references.'
              }
            >
              {relationships.outgoing.map((link, index) => (
                <RelationshipLink key={index} onClick={() => onNavigate(link.targetId, link.path)}>
                  <RelationshipPath>{link.path.join(' → ') || 'Direct reference'}</RelationshipPath>
                  <RelationshipPart>
                    {objectName(link.targetId, objects ?? new Map(), pages)} · <code className="text-reference">{link.targetId} R</code>
                    <ArrowUpRight size={12} />
                  </RelationshipPart>
                </RelationshipLink>
              ))}
            </Relationships>
            <Relationships
              title="Referenced by"
              count={object.referencedBy.length}
              empty={
                relationships.incoming.length
                  ? undefined
                  : object.referencedBy.length
                    ? 'Incoming reference paths unavailable in the inspected values.'
                    : 'No incoming references in the indexed object set.'
              }
            >
              {relationships.incoming.map((link, index) => (
                <RelationshipLink key={index} onClick={() => onInspect(link.sourceId)}>
                  <RelationshipPart>
                    {objectName(link.sourceId, objects ?? new Map(), pages)} · <code className="text-reference">{link.sourceId} obj</code>
                    <ArrowUpRight size={12} />
                  </RelationshipPart>
                  <RelationshipPath>via {link.path.join(' → ') || 'a direct reference'}</RelationshipPath>
                </RelationshipLink>
              ))}
            </Relationships>
            {relationships.incomplete && (
              <Note>
                Some relationship details may be missing. Inspection checks at most 200 paths per direction, 200 incoming objects, 5,000
                values per object, and 32 nested levels. Object counts above describe the indexed references.
              </Note>
            )}
          </section>
        </TabsContent>
        <TabsContent value="source" render={<PaneBody />} {...(safeTab === 'source' ? scroll : {})}>
          <Note>
            {object.provenance.type === 'file'
              ? 'Original object syntax. Use Original bytes to check the exact bytes in the file.'
              : object.provenance.type === 'decoded'
                ? 'Object syntax from its decoded container. These are not original file bytes.'
                : 'Reconstructed from parsed values. The exact syntax in the file is unavailable.'}
          </Note>
          <SourceCode>{object.source}</SourceCode>
        </TabsContent>
        {(['raw', 'decoded'] as const).map(
          (mode) =>
            object.stream && (
              <TabsContent key={mode} value={mode} render={<PaneBody />} {...(safeTab === mode ? scroll : {})}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-detail leading-[inherit]">
                  <span>{mode === 'raw' ? 'Stored stream bytes' : 'Decoded stream bytes'}</span>
                  <Badge variant="outline" className="text-micro leading-[calc(4/3)]">
                    {object.stream.filters.join(' → ') || 'No filters'}
                  </Badge>
                </div>
                <Note>
                  Each byte is shown as a Latin-1 character. This does not extract text from the rendered page.{' '}
                  {mode === 'decoded' && 'Decoded offsets differ from original file offsets.'}
                </Note>
                {error ? (
                  <Warning role="alert">{error}</Warning>
                ) : stream ? (
                  <>
                    {stream.error && <Warning role="alert">{stream.error}</Warning>}
                    <p className="mb-2.5 text-caption leading-[inherit] text-muted-foreground">
                      {stream.bytes.length.toLocaleString()} bytes
                      {stream.truncated ? ' · display truncated' : ''}
                    </p>
                    {mode === 'decoded' && objects && !stream.error ? (
                      <ContentStreamView
                        key={object.id}
                        object={object}
                        textMatchRanges={textMatchRanges}
                        stream={stream}
                        objects={objects}
                        pages={pages}
                        contextPageId={contextPageId}
                        onNavigate={onNavigate}
                        onFollowLink={onFollowLink}
                      />
                    ) : (
                      <SourceCode>{stream.text}</SourceCode>
                    )}
                  </>
                ) : (
                  <LoadingMessage>
                    <LoaderCircle size={15} className="animate-spin" />
                    Reading stream…
                  </LoadingMessage>
                )}
              </TabsContent>
            )
        )}
      </Tabs>
    </section>
  );
};
export type InspectorTab = 'properties' | 'source' | 'raw' | 'decoded';
