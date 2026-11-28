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
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ValueView } from '@/components/value-view';
import { embeddedDownloads } from '@/lib/pdf/downloads';
import { hasSubtype } from '@/lib/pdf/navigation';
import { objectName, objectRelationships, objectSummary } from '@/lib/pdf/object-context';
import { useScrollRestoration } from '@/lib/scroll-restoration';
import { cn } from '@/lib/utils';

const ObjectTab = ({ className, ...props }: ComponentProps<typeof TabsTrigger>) => {
  return (
    <TabsTrigger
      className={cn(
        'h-8 flex-initial px-0.75 py-0 text-detail',
        'data-active:text-brand-purple data-active:after:bg-brand-red data-active:hover:text-brand-purple',
        'dark:data-active:text-brand-purple dark:data-active:hover:text-brand-purple',
        className
      )}
      {...props}
    />
  );
};

/** One side of a relationship link: the referring object, the target or the path between them. */
const RelationshipPart = ({ className, ...props }: ComponentProps<'span'>) => {
  return <span className={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)} {...props} />;
};

const RelationshipPath = ({ children }: { children: ReactNode }) => {
  return <RelationshipPart className="font-mono text-muted-foreground">{children}</RelationshipPart>;
};

const RelationshipLink = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => {
  return (
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
};

const Relationships = ({ children, count, empty, title }: { children: ReactNode; count: number; empty?: string; title: string }) => {
  return (
    <>
      <SectionHeading className="leading-[inherit]">
        {title}{' '}
        <span className="ml-1.25 text-caption leading-[inherit] text-muted-foreground">
          {count} {count === 1 ? 'object' : 'objects'}
        </span>
      </SectionHeading>
      <div className="grid gap-1" data-relationship-links>
        {children}
        {empty && <p className="text-muted-foreground">{empty}</p>}
      </div>
    </>
  );
};
const ObjectHeader = ({ object, summary }: { object: PdfObjectRecord; summary: string }) => {
  return (
    <header className="px-5.5 pt-5.75 pb-3.75 max-w480:px-4.5 max-w480:pt-5 max-w480:pb-3">
      <div className="flex items-center gap-2.75">
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
};

const ProvenanceNote = ({ object, onNavigate }: { object: PdfObjectRecord; onNavigate: (id: string) => void }) => {
  return (
    <div
      className={cn(
        'flex items-start gap-1.75 px-5.5 pb-4.5',
        'text-caption leading-[1.7] text-muted-foreground',
        'max-w480:px-4.5 max-w480:pb-4'
      )}
      data-provenance
    >
      <FileCode2 size={14} className="mt-0.5 shrink-0 text-brand-orange-ink" />
      {object.provenance.type === 'file' ? (
        <span>
          Original file ·{' '}
          <code className="text-caption leading-[inherit]">0x{object.provenance.range.start.toString(16).toUpperCase()}</code> ·{' '}
          {object.provenance.range.end - object.provenance.range.start} bytes
        </span>
      ) : object.provenance.type === 'decoded' ? (
        <span>
          Decoded object stream{' '}
          <ReferenceButton
            onClick={() => {
              if (object.provenance.type === 'decoded') {
                onNavigate(object.provenance.containerId);
              }
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
};

// Read-only stand-in when no object set is given, so memoised values keep their identity.
const EMPTY_OBJECTS = new Map<string, PdfObjectRecord>();

const isStreamTab = (tab: InspectorTab): tab is 'raw' | 'decoded' => {
  return tab === 'raw' || tab === 'decoded';
};

/** The sentence shown in place of a relationship list: paths unavailable, or no relationships at all. */
const emptyRelationships = (links: number, count: number, unavailable: string, none: string) => {
  if (links) {
    return undefined;
  }
  return count ? unavailable : none;
};

const SOURCE_NOTES: Record<PdfObjectRecord['provenance']['type'], string> = {
  decoded: 'Object syntax from its decoded container. These are not original file bytes.',
  file: 'Original object syntax. Use Original bytes to check the exact bytes in the file.',
  unknown: 'Reconstructed from parsed values. The exact syntax in the file is unavailable.',
};

/** Reads the raw or decoded stream for the stream tabs, keeping only the result for the current object and tab. */
const useStreamRead = (object: PdfObjectRecord, tab: InspectorTab, readStream: ObjectInspectorProps['readStream']) => {
  const [state, setState] = useState<{
    object: PdfObjectRecord;
    tab: InspectorTab;
    result?: StreamResult;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!object.stream || !isStreamTab(tab)) {
      return;
    }
    let active = true;
    readStream(object.id, tab)
      .then((result) => {
        if (active) {
          setState({ object, result, tab });
        }
      })
      .catch((reason) => {
        if (active) {
          setState({
            error: reason instanceof Error ? reason.message : 'Could not read stream.',
            object,
            tab,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [object, tab, readStream]);
  const current = state?.object === object && state.tab === tab ? state : undefined;
  return { error: current?.error, stream: current?.result };
};

const PageResources = ({
  objectId,
  objects,
  resources,
  onNavigate,
}: {
  objectId: string;
  objects?: Map<string, PdfObjectRecord>;
  resources: NonNullable<ObjectInspectorProps['resources']>;
  onNavigate: ObjectInspectorProps['onNavigate'];
}) => {
  const { inheritedFrom } = resources;
  return (
    <>
      <SectionHeading className="leading-[inherit]">Effective page resources</SectionHeading>
      {inheritedFrom ? (
        <Note>
          Inherited from{' '}
          <ReferenceButton
            onClick={() => {
              return onNavigate(inheritedFrom);
            }}
          >
            {inheritedFrom} R
          </ReferenceButton>
          . The inspector found these resources on an ancestor in the page tree.
        </Note>
      ) : (
        <Note>Defined on this page.</Note>
      )}
      <ValueView
        key={`${objectId}-resources`}
        value={resources.value}
        onNavigate={
          inheritedFrom
            ? (id) => {
                return onNavigate(id);
              }
            : onNavigate
        }
        objects={objects}
        ancestors={[objectId]}
        path={['/Resources']}
      />
    </>
  );
};

interface RelationshipListProps {
  links: ReturnType<typeof objectRelationships>;
  object: PdfObjectRecord;
  objects: Map<string, PdfObjectRecord>;
  pages: string[];
}

const OutgoingReferences = ({
  links,
  object,
  objects,
  pages,
  onNavigate,
}: RelationshipListProps & Pick<ObjectInspectorProps, 'onNavigate'>) => {
  return (
    <Relationships
      title="References"
      count={object.references.length}
      empty={emptyRelationships(
        links.outgoing.length,
        object.references.length,
        'Reference paths unavailable in the inspected value.',
        'No outgoing references.'
      )}
    >
      {links.outgoing.map((link, index) => {
        return (
          <RelationshipLink
            key={index}
            onClick={() => {
              return onNavigate(link.targetId, link.path);
            }}
          >
            <RelationshipPath>{link.path.join(' → ') || 'Direct reference'}</RelationshipPath>
            <RelationshipPart>
              {objectName(link.targetId, objects, pages)} · <code className="text-reference">{link.targetId} R</code>
              <ArrowUpRight size={12} />
            </RelationshipPart>
          </RelationshipLink>
        );
      })}
    </Relationships>
  );
};

const IncomingReferences = ({
  links,
  object,
  objects,
  pages,
  onInspect,
}: RelationshipListProps & Pick<ObjectInspectorProps, 'onInspect'>) => {
  return (
    <Relationships
      title="Referenced by"
      count={object.referencedBy.length}
      empty={emptyRelationships(
        links.incoming.length,
        object.referencedBy.length,
        'Incoming reference paths unavailable in the inspected values.',
        'No incoming references in the indexed object set.'
      )}
    >
      {links.incoming.map((link, index) => {
        return (
          <RelationshipLink
            key={index}
            onClick={() => {
              return onInspect(link.sourceId);
            }}
          >
            <RelationshipPart>
              {objectName(link.sourceId, objects, pages)} · <code className="text-reference">{link.sourceId} obj</code>
              <ArrowUpRight size={12} />
            </RelationshipPart>
            <RelationshipPath>via {link.path.join(' → ') || 'a direct reference'}</RelationshipPath>
          </RelationshipLink>
        );
      })}
    </Relationships>
  );
};

/** What a stream tab shows: the read error, the bytes (as instructions when decoded), or a loading line. */
const StreamContent = ({ error, mode, stream, ...props }: StreamTabProps & { mode: 'raw' | 'decoded' }) => {
  if (error) {
    return <Warning role="alert">{error}</Warning>;
  }
  if (!stream) {
    return (
      <LoadingMessage>
        <LoaderCircle size={15} className="animate-spin" />
        Reading stream…
      </LoadingMessage>
    );
  }
  return (
    <>
      {stream.error && <Warning role="alert">{stream.error}</Warning>}
      <p className="mb-2.5 text-caption leading-[inherit] text-muted-foreground">
        {stream.bytes.length.toLocaleString()} bytes
        {stream.truncated ? ' · display truncated' : ''}
      </p>
      {mode === 'decoded' && props.objects && !stream.error ? (
        <ContentStreamView
          key={props.object.id}
          object={props.object}
          textMatchRanges={props.textMatchRanges}
          stream={stream}
          objects={props.objects}
          pages={props.pages}
          contextPageId={props.contextPageId}
          onNavigate={props.onNavigate}
          onFollowLink={props.onFollowLink}
        />
      ) : (
        <SourceCode>{stream.text}</SourceCode>
      )}
    </>
  );
};

type StreamTabProps = Pick<
  ObjectInspectorProps,
  'contextPageId' | 'object' | 'objects' | 'textMatchRanges' | 'onFollowLink' | 'onNavigate'
> & {
  error?: string;
  pages: string[];
  stream?: StreamResult;
};

const StreamTab = ({
  filters,
  mode,
  scroll,
  ...props
}: StreamTabProps & { filters: string[]; mode: 'raw' | 'decoded'; scroll: Partial<ReturnType<typeof useScrollRestoration>> }) => {
  return (
    <TabsContent value={mode} render={<PaneBody />} {...scroll}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-detail leading-[inherit]">
        <span>{mode === 'raw' ? 'Stored stream bytes' : 'Decoded stream bytes'}</span>
        <Badge variant="outline" className="text-micro leading-[calc(4/3)]">
          {filters.join(' → ') || 'No filters'}
        </Badge>
      </div>
      <Note>
        Each byte is shown as a Latin-1 character. This does not extract text from the rendered page.{' '}
        {mode === 'decoded' && 'Decoded offsets differ from original file offsets.'}
      </Note>
      <StreamContent mode={mode} {...props} />
    </TabsContent>
  );
};

const nonStreamTab = (tab: InspectorTab) => {
  return isStreamTab(tab) ? 'properties' : tab;
};

const ObjectDownloads = ({
  downloadIndex,
  object,
  objects,
  extractImage,
  extractStream,
}: Pick<ObjectInspectorProps, 'downloadIndex' | 'object' | 'extractImage' | 'extractStream'> & {
  objects: Map<string, PdfObjectRecord>;
}) => {
  const downloads = useMemo(() => {
    return downloadIndex ?? embeddedDownloads(objects);
  }, [objects, downloadIndex]);
  const assets = downloads.get(object.id) ?? [];
  return (
    <>
      {object.stream && hasSubtype(object, 'Image') && (
        <div className="mx-5.5 mb-4">
          <ImageDownload key={object.id} object={object} extractImage={extractImage} />
        </div>
      )}
      {assets.length > 0 && <EmbeddedDownloads key={object.id} object={object} assets={assets} extractStream={extractStream} />}
    </>
  );
};

const PropertiesContent = ({
  links,
  object,
  objects,
  pages,
  resources,
  onInspect,
  onNavigate,
}: Omit<RelationshipListProps, 'objects'> & Pick<ObjectInspectorProps, 'objects' | 'resources' | 'onInspect' | 'onNavigate'>) => {
  const known = objects ?? EMPTY_OBJECTS;
  return (
    <>
      <ValueView key={object.id} value={object.value} onNavigate={onNavigate} objects={objects} ancestors={[object.id]} />
      <section className="mt-7.5">
        {resources && <PageResources objectId={object.id} objects={objects} resources={resources} onNavigate={onNavigate} />}
        <OutgoingReferences links={links} object={object} objects={known} pages={pages} onNavigate={onNavigate} />
        <IncomingReferences links={links} object={object} objects={known} pages={pages} onInspect={onInspect} />
        {links.incomplete && (
          <Note>
            Some relationship details may be missing. Inspection checks at most 200 paths per direction, 200 incoming objects, 5,000 values
            per object, and 32 nested levels. Object counts above describe the indexed references.
          </Note>
        )}
      </section>
    </>
  );
};

interface ObjectInspectorProps {
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
}

const WARNINGS_SHOWN = 5;

/** An object can carry one warning per dangling reference, so a long list opens collapsed. */
const ObjectWarnings = ({ warnings }: { warnings: string[] }) => {
  const [limit, setLimit] = useState(WARNINGS_SHOWN);
  return (
    <>
      {warnings.slice(0, limit).map((warning, i) => {
        return <Warning key={i}>{warning}</Warning>;
      })}
      {warnings.length > limit && (
        <Button
          variant="outline"
          size="sm"
          className="mx-5.5 mb-3 self-start max-w480:mx-4.5"
          onClick={() => {
            return setLimit(limit + 50);
          }}
        >
          Show more warnings ({warnings.length - limit} remaining)
        </Button>
      )}
    </>
  );
};

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
}: ObjectInspectorProps) {
  const known = objects ?? EMPTY_OBJECTS;
  const relationships = useMemo(() => {
    return objectRelationships(object, known);
  }, [object, known]);
  const summary = objectSummary(object, pages, relationships.incoming, known);
  const { error, stream } = useStreamRead(object, tab, readStream);
  // An object without a stream has no stream tabs, so a stream tab carried over from another object falls back to its properties.
  const safeTab = object.stream ? tab : nonStreamTab(tab);
  const scroll = useScrollRestoration(scrollPositionRef, !isStreamTab(safeTab) || Boolean(stream || error));
  const scrollFor = (value: InspectorTab) => {
    return safeTab === value ? scroll : {};
  };
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden" aria-label="Object inspector">
      <ObjectHeader object={object} summary={summary} />
      <ObjectDownloads
        downloadIndex={downloadIndex}
        object={object}
        objects={known}
        extractImage={extractImage}
        extractStream={extractStream}
      />
      <ProvenanceNote object={object} onNavigate={onNavigate} />
      <ObjectWarnings key={object.id} warnings={object.warnings} />
      <Tabs
        value={safeTab}
        onValueChange={(value) => {
          return onTabChange(value as InspectorTab);
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList variant="line" className="w-full shrink-0 justify-start gap-3.25 border-b px-4.5 py-0 group-data-horizontal/tabs:h-9.25">
          <ObjectTab value="properties">Properties</ObjectTab>
          <ObjectTab value="source">Source</ObjectTab>
          {object.stream && (
            <>
              <ObjectTab value="raw">Raw stream</ObjectTab>
              <ObjectTab value="decoded">Decoded</ObjectTab>
            </>
          )}
        </TabsList>
        <TabsContent value="properties" render={<PaneBody />} {...scrollFor('properties')}>
          <PropertiesContent
            links={relationships}
            object={object}
            objects={objects}
            pages={pages}
            resources={resources}
            onInspect={onInspect}
            onNavigate={onNavigate}
          />
        </TabsContent>
        <TabsContent value="source" render={<PaneBody />} {...scrollFor('source')}>
          <Note>{SOURCE_NOTES[object.provenance.type] ?? SOURCE_NOTES.unknown}</Note>
          <SourceCode>{object.source}</SourceCode>
        </TabsContent>
        {object.stream &&
          (['raw', 'decoded'] as const).map((mode) => {
            return (
              <StreamTab
                key={mode}
                mode={mode}
                filters={object.stream!.filters}
                scroll={scrollFor(mode)}
                contextPageId={contextPageId}
                error={error}
                object={object}
                objects={objects}
                pages={pages}
                stream={stream}
                textMatchRanges={textMatchRanges}
                onFollowLink={onFollowLink}
                onNavigate={onNavigate}
              />
            );
          })}
      </Tabs>
    </section>
  );
};
export type InspectorTab = 'properties' | 'source' | 'raw' | 'decoded';
