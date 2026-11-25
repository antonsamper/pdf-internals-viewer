import { cn } from 'cn';
import { ArrowUpRight, Braces, FileCode2, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import type { ByteRange, PdfObjectRecord, PdfValue, StreamResult } from '@/lib/pdf/types';

import { ContentStreamView } from '@/components/content-stream-view';
import { EmbeddedDownloads } from '@/components/embedded-downloads';
import { ImageDownload } from '@/components/image-download';
import {
  INSPECTOR_SCROLL,
  LOADING_INLINE,
  REFERENCE,
  REPRESENTATION_NOTE,
  SECTION_HEADING,
  SOURCE_CODE,
  WARNING_INLINE,
} from '@/components/inspector-styles';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ValueView } from '@/components/value-view';
import { embeddedDownloads, type EmbeddedDownload } from '@/lib/pdf/downloads';
import { hasSubtype } from '@/lib/pdf/navigation';
import { objectName, objectRelationships, objectSummary } from '@/lib/pdf/object-context';
import { useScrollRestoration, type ScrollPosition } from '@/lib/scroll-restoration';

/** Tabs sit on one flat line: violet when active, with a red underline. */
const TAB_TRIGGER = cn(
  'h-8 flex-initial px-[3px] py-0',
  'data-active:text-brand-purple data-active:after:bg-brand-red data-active:hover:text-brand-purple',
  'dark:data-active:text-brand-purple dark:data-active:hover:text-brand-purple',
  'text-[11px]!'
);
const RELATIONSHIP_LINK = cn(
  'flex flex-wrap justify-between gap-x-3 gap-y-1 p-2',
  'rounded-[5px] text-left [overflow-wrap:anywhere]',
  'hover:bg-accent',
  'text-[11px]!'
);
const RELATIONSHIP_PART = 'inline-flex min-w-0 flex-wrap items-center gap-1';
const RELATIONSHIP_PATH = 'text-muted-foreground [font-family:var(--font-mono,monospace)]';
const REFERENCE_COUNT = 'ml-[5px] text-[10px] text-muted-foreground';
const ObjectHeader = ({ object, summary }: { object: PdfObjectRecord; summary: string }) => (
  <header className="px-[22px] pt-[23px] pb-[15px] max-w480:px-[18px] max-w480:pt-5 max-w480:pb-3">
    <div className="flex items-center gap-[11px]">
      <Braces size={19} />
      <h1 className="font-pdf text-[18px] font-medium">
        {object.id} <span className="text-muted-foreground">obj</span>
      </h1>
      <Badge variant="secondary" className="rounded-[4px] text-[10px] leading-[calc(4/3)]">
        {object.kind}
      </Badge>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">{object.label}</p>
    <p className="mt-2.5 max-w-[65ch] text-[12px] leading-[1.65] text-foreground" data-object-explanation>
      {summary}
    </p>
  </header>
);

const ProvenanceNote = ({ object, onNavigate }: { object: PdfObjectRecord; onNavigate: (id: string) => void }) => (
  <div
    className={cn(
      'flex items-start gap-[7px] px-[22px] pb-[18px]',
      'text-[10px] leading-[1.7] text-muted-foreground',
      'max-w480:px-[18px] max-w480:pb-4'
    )}
    data-provenance
  >
    <FileCode2 size={14} className="mt-0.5 shrink-0 text-brand-orange-ink" />
    {object.provenance.type === 'file' ? (
      <span>
        Original file · <code className="text-[10px]!">0x{object.provenance.range.start.toString(16).toUpperCase()}</code> ·{' '}
        {object.provenance.range.end - object.provenance.range.start} bytes
      </span>
    ) : object.provenance.type === 'decoded' ? (
      <span>
        Decoded object stream{' '}
        <button
          className={REFERENCE}
          onClick={() => {
            if (object.provenance.type === 'decoded') onNavigate(object.provenance.containerId);
          }}
        >
          {object.provenance.containerId}
          <ArrowUpRight size={12} />
        </button>{' '}
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
        <p className={WARNING_INLINE} key={i}>
          {warning}
        </p>
      ))}
      <Tabs value={safeTab} onValueChange={(value) => onTabChange(value as InspectorTab)} className="min-h-0 flex-1 gap-0">
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-start gap-[13px] border-b px-[18px] py-0 group-data-horizontal/tabs:h-[37px]"
        >
          <TabsTrigger value="properties" className={TAB_TRIGGER}>
            Properties
          </TabsTrigger>
          <TabsTrigger value="source" className={TAB_TRIGGER}>
            Source
          </TabsTrigger>
          {object.stream && (
            <>
              <TabsTrigger value="raw" className={TAB_TRIGGER}>
                Raw stream
              </TabsTrigger>
              <TabsTrigger value="decoded" className={TAB_TRIGGER}>
                Decoded
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="properties" className={INSPECTOR_SCROLL} {...(safeTab === 'properties' ? scroll : {})}>
          <ValueView key={object.id} value={object.value} onNavigate={onNavigate} objects={objects} ancestors={[object.id]} />
          <section className="mt-[30px]">
            {resources && (
              <>
                <h2 className={SECTION_HEADING}>Effective page resources</h2>
                {resources.inheritedFrom ? (
                  <p className={REPRESENTATION_NOTE}>
                    Inherited from{' '}
                    <button className={REFERENCE} onClick={() => onNavigate(resources.inheritedFrom!)}>
                      {resources.inheritedFrom} R
                    </button>
                    . The inspector found these resources on an ancestor in the page tree.
                  </p>
                ) : (
                  <p className={REPRESENTATION_NOTE}>Defined on this page.</p>
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
            <h2 className={SECTION_HEADING}>
              References{' '}
              <span className={REFERENCE_COUNT}>
                {object.references.length} {object.references.length === 1 ? 'object' : 'objects'}
              </span>
            </h2>
            <div className="grid gap-1" data-relationship-links>
              {relationships.outgoing.map((link, index) => (
                <button className={RELATIONSHIP_LINK} key={index} onClick={() => onNavigate(link.targetId, link.path)}>
                  <span className={cn(RELATIONSHIP_PART, RELATIONSHIP_PATH)}>{link.path.join(' → ') || 'Direct reference'}</span>
                  <span className={RELATIONSHIP_PART}>
                    {objectName(link.targetId, objects ?? new Map(), pages)} · <code className="text-reference">{link.targetId} R</code>
                    <ArrowUpRight size={12} />
                  </span>
                </button>
              ))}
              {!relationships.outgoing.length && (
                <p className="text-muted-foreground">
                  {object.references.length ? 'Reference paths unavailable in the inspected value.' : 'No outgoing references.'}
                </p>
              )}
            </div>
            <h2 className={SECTION_HEADING}>
              Referenced by{' '}
              <span className={REFERENCE_COUNT}>
                {object.referencedBy.length} {object.referencedBy.length === 1 ? 'object' : 'objects'}
              </span>
            </h2>
            <div className="grid gap-1" data-relationship-links>
              {relationships.incoming.map((link, index) => (
                <button className={RELATIONSHIP_LINK} key={index} onClick={() => onInspect(link.sourceId)}>
                  <span className={RELATIONSHIP_PART}>
                    {objectName(link.sourceId, objects ?? new Map(), pages)} · <code className="text-reference">{link.sourceId} obj</code>
                    <ArrowUpRight size={12} />
                  </span>
                  <span className={cn(RELATIONSHIP_PART, RELATIONSHIP_PATH)}>via {link.path.join(' → ') || 'a direct reference'}</span>
                </button>
              ))}
              {!relationships.incoming.length && (
                <p className="text-muted-foreground">
                  {object.referencedBy.length
                    ? 'Incoming reference paths unavailable in the inspected values.'
                    : 'No incoming references in the indexed object set.'}
                </p>
              )}
            </div>
            {relationships.incomplete && (
              <p className={REPRESENTATION_NOTE}>
                Some relationship details may be missing. Inspection checks at most 200 paths per direction, 200 incoming objects, 5,000
                values per object, and 32 nested levels. Object counts above describe the indexed references.
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="source" className={INSPECTOR_SCROLL} {...(safeTab === 'source' ? scroll : {})}>
          <p className={REPRESENTATION_NOTE}>
            {object.provenance.type === 'file'
              ? 'Original object syntax. Use Original bytes to check the exact bytes in the file.'
              : object.provenance.type === 'decoded'
                ? 'Object syntax from its decoded container. These are not original file bytes.'
                : 'Reconstructed from parsed values. The exact syntax in the file is unavailable.'}
          </p>
          <pre className={SOURCE_CODE}>{object.source}</pre>
        </TabsContent>
        {(['raw', 'decoded'] as const).map(
          (mode) =>
            object.stream && (
              <TabsContent key={mode} value={mode} className={INSPECTOR_SCROLL} {...(safeTab === mode ? scroll : {})}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span>{mode === 'raw' ? 'Stored stream bytes' : 'Decoded stream bytes'}</span>
                  <Badge variant="outline" className="text-[9px] leading-[calc(4/3)]">
                    {object.stream.filters.join(' → ') || 'No filters'}
                  </Badge>
                </div>
                <p className={REPRESENTATION_NOTE}>
                  Each byte is shown as a Latin-1 character. This does not extract text from the rendered page.{' '}
                  {mode === 'decoded' && 'Decoded offsets differ from original file offsets.'}
                </p>
                {error ? (
                  <p role="alert" className={WARNING_INLINE}>
                    {error}
                  </p>
                ) : stream ? (
                  <>
                    {stream.error && (
                      <p role="alert" className={WARNING_INLINE}>
                        {stream.error}
                      </p>
                    )}
                    <p className="mb-2.5 text-[10px] text-muted-foreground">
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
                      <pre className={SOURCE_CODE}>{stream.text}</pre>
                    )}
                  </>
                ) : (
                  <p className={LOADING_INLINE}>
                    <LoaderCircle size={15} className="animate-spin" />
                    Reading stream…
                  </p>
                )}
              </TabsContent>
            )
        )}
      </Tabs>
    </section>
  );
};
export type InspectorTab = 'properties' | 'source' | 'raw' | 'decoded';
