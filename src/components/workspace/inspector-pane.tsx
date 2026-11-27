import type { ComponentProps, ReactNode } from 'react';

import { BookmarkPlus, Braces, Image, LoaderCircle, Pin, X } from 'lucide-react';
import { lazy, Suspense } from 'react';

import type { PdfPreviewProps } from '@/components/pdf-preview';
import type { PdfActionReport } from '@/lib/pdf/document-actions';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { ResourceCategory, ResourceEntry } from '@/lib/pdf/resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { ActionsPanel } from '@/components/actions-panel';
import { LoadingMessage } from '@/components/inspector/loading-message';
import { Notice } from '@/components/inspector/notes';
import { PaneHeading } from '@/components/inspector/pane';
import { IssuesPanel } from '@/components/issues-panel';
import { ObjectComparison } from '@/components/object-comparison';
import { ResourceBrowser } from '@/components/resource-browser';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

import type { Section } from './types';

/** A small ghost button in the pane heading, in compact type. */
const PaneAction = ({ className, ...props }: ComponentProps<typeof Button>) => (
  <Button variant="ghost" size="sm" className={cn('gap-1.25 text-caption font-medium', className)} {...props} />
);

const PdfPreview = lazy(() =>
  import('@/components/pdf-preview').then((module) => ({
    default: module.PdfPreview,
  }))
);

export interface InspectorPaneProps {
  actionReport: PdfActionReport;
  busy: boolean;
  bytes: Uint8Array;
  document: PdfDocumentInfo | null;
  filename: string;
  hasRange: boolean;
  inspectorContent: ReactNode;
  issues: PdfIssue[];
  limits: { actionLimit: number; issueLimit: number; resourceLimit: number };
  notice: string | null;
  objectMap: Map<string, PdfObjectRecord>;
  overview: ReactNode;
  pinnedId: string | null;
  preview: boolean;
  previewPage: number;
  previewPassword: string | undefined;
  previewSearch: PdfPreviewProps['search'];
  resourceCategory: ResourceCategory;
  resourceEntries: ResourceEntry[];
  resourceFilter: string;
  scrollPositionRef: ScrollPosition;
  section: Section;
  selected: PdfObjectRecord | undefined;
  extractImage: (id: string) => Promise<StreamResult>;
  extractStream: (id: string, purpose?: 'download' | 'size') => Promise<StreamResult>;
  readStream: (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
  onBookmark: () => void;
  onBrowseResources: () => void;
  onCategoryChange: (category: ResourceCategory) => void;
  onDismissNotice: () => void;
  onFilterChange: (filter: string) => void;
  onActionLimitChange: (limit: number) => void;
  onIssueLimitChange: (limit: number) => void;
  onNavigate: (id: string) => void;
  onPageChange: (page: number) => void;
  onPin: (id: string | null) => void;
  onPreviewChange: (preview: boolean) => void;
  onResourceLimitChange: (limit: number) => void;
  onStructure: () => void;
}

const paneTitle = ({ busy, preview, section, selected }: Pick<InspectorPaneProps, 'busy' | 'preview' | 'section' | 'selected'>) => {
  if (busy) return 'Opening PDF';
  if (preview) return 'Page preview';
  if (selected) return 'Object inspector';
  const titles: Partial<Record<Section, string>> = {
    actions: 'Actions',
    issues: 'Issues',
    resources: 'Resource browser',
    structure: 'File structure',
  };
  return titles[section] ?? 'Overview';
};

/** Pins the selected object to compare it with the next one, or unpins it. */
const PinAction = ({ pinnedId, selected, onPin }: Pick<InspectorPaneProps, 'pinnedId' | 'onPin'> & { selected: PdfObjectRecord }) => {
  const pinned = pinnedId === selected.id;
  return (
    <PaneAction variant={pinned ? 'secondary' : 'ghost'} onClick={() => onPin(pinned ? null : selected.id)} aria-pressed={pinned}>
      <Pin size={14} />
      {pinned ? 'Unpin' : 'Pin to compare'}
    </PaneAction>
  );
};

/** Switches between the page preview and the inspector. */
const PreviewAction = ({
  busy,
  bytes,
  preview,
  onPreviewChange,
}: Pick<InspectorPaneProps, 'busy' | 'bytes' | 'preview' | 'onPreviewChange'>) => (
  <PaneAction variant={preview ? 'secondary' : 'ghost'} disabled={!bytes.length || busy} onClick={() => onPreviewChange(!preview)}>
    {preview ? <Braces size={14} /> : <Image size={14} />}
    {preview ? 'Inspect' : 'Preview'}
  </PaneAction>
);

const PaneActions = (props: InspectorPaneProps) => {
  const { hasRange, section, selected, onBookmark, onBrowseResources } = props;
  return (
    <div className="flex items-center gap-1 narrow:flex-wrap">
      {section === 'resources' && selected && <PaneAction onClick={onBrowseResources}>Browse resources</PaneAction>}
      {(selected || hasRange) && (
        <PaneAction onClick={onBookmark}>
          <BookmarkPlus size={14} />
          Bookmark
        </PaneAction>
      )}
      {selected && <PinAction pinnedId={props.pinnedId} selected={selected} onPin={props.onPin} />}
      <PreviewAction {...props} />
    </div>
  );
};

const SelectedObjectView = ({ inspectorContent, objectMap, pinnedId, selected, onNavigate, onPin }: InspectorPaneProps) => {
  const pinned = pinnedId ? objectMap.get(pinnedId) : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&>section]:flex-1">
      {pinned ? (
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="40%" minSize="20%">
            <ObjectComparison pinned={pinned} current={selected!} onUnpin={() => onPin(null)} onNavigate={onNavigate} />
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className={cn(
              'shrink-0 cursor-row-resize border-y bg-muted',
              'hover:bg-accent focus-visible:bg-accent aria-[orientation=horizontal]:h-3 [&>div]:bg-muted-foreground'
            )}
            aria-label="Resize comparison and inspector"
            title="Drag to resize · use arrow keys when focused"
          />
          <ResizablePanel defaultSize="60%" minSize="25%">
            {inspectorContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        inspectorContent
      )}
    </div>
  );
};

const LoadingView = () => (
  <section
    className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto px-6 py-8 text-center"
    role="status"
    aria-label="Opening PDF"
  >
    <LoaderCircle size={32} className="mb-5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
    <h1 className="mb-2.5 text-heading font-medium">Opening PDF…</h1>
    <p className="max-w-[38ch] text-small leading-[1.8] text-muted-foreground">
      Reading objects and building the document structure. Larger documents can take a few seconds.
    </p>
  </section>
);

const PreviewView = ({ bytes, filename, previewPage, previewPassword, previewSearch, onPageChange }: InspectorPaneProps) => (
  <Suspense fallback={<LoadingMessage>Loading EmbedPDF…</LoadingMessage>}>
    <PdfPreview
      bytes={bytes}
      fileName={filename}
      password={previewPassword}
      pageNumber={previewPage}
      onPageChange={onPageChange}
      search={previewSearch}
    />
  </Suspense>
);

/** The issues, actions or resources section, or null for a section without its own view. */
const SectionView = (props: InspectorPaneProps & { document: PdfDocumentInfo }) => {
  const { document, filename, issues, limits, objectMap, section, scrollPositionRef } = props;
  if (section === 'issues')
    return (
      <IssuesPanel
        key={filename}
        issues={issues}
        limit={limits.issueLimit}
        onLimitChange={props.onIssueLimitChange}
        scrollPositionRef={scrollPositionRef}
        locked={document.locked}
        recovered={document.recovered}
        onNavigate={props.onNavigate}
        onStructure={props.onStructure}
      />
    );
  if (section === 'actions')
    return (
      <ActionsPanel
        key={filename}
        locked={document.locked}
        recovered={document.recovered}
        report={props.actionReport}
        limit={limits.actionLimit}
        onLimitChange={props.onActionLimitChange}
        scrollPositionRef={scrollPositionRef}
        readStream={props.readStream}
        onNavigate={props.onNavigate}
      />
    );
  if (section === 'resources')
    return (
      <ResourceBrowser
        scrollPositionRef={scrollPositionRef}
        limit={limits.resourceLimit}
        onLimitChange={props.onResourceLimitChange}
        document={document}
        objectMap={objectMap}
        extractStream={props.extractStream}
        extractImage={props.extractImage}
        resources={props.resourceEntries}
        category={props.resourceCategory}
        onCategoryChange={props.onCategoryChange}
        filter={props.resourceFilter}
        onFilterChange={props.onFilterChange}
        onNavigate={props.onNavigate}
      />
    );
  return null;
};

const SECTION_VIEWS = new Set<Section>(['issues', 'actions', 'resources']);

const InspectorBody = (props: InspectorPaneProps) => {
  const { busy, bytes, document, overview, preview, section, selected } = props;
  if (busy) return <LoadingView />;
  if (preview && bytes.length) return <PreviewView {...props} />;
  if (selected) return <SelectedObjectView {...props} />;
  if (document && SECTION_VIEWS.has(section)) return <SectionView {...props} document={document} />;
  return overview;
};

export const InspectorPane = (props: InspectorPaneProps) => (
  <main className="flex h-full min-h-0 flex-col overflow-hidden" aria-label="Document inspection" aria-busy={props.busy}>
    <PaneHeading className="justify-between narrow:h-auto narrow:flex-wrap narrow:gap-1.5 narrow:py-1.5">
      <span>{paneTitle(props)}</span>
      <PaneActions {...props} />
    </PaneHeading>
    {props.notice && (
      <Notice role="status">
        <span>{props.notice}</span>
        <button className="ml-auto bg-transparent" aria-label="Dismiss notice" onClick={props.onDismissNotice}>
          <X size={14} />
        </button>
      </Notice>
    )}
    <InspectorBody {...props} />
  </main>
);
