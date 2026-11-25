import { cn } from 'cn';
import { BookmarkPlus, Braces, Image, LoaderCircle, Pin, X } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';

import type { PdfPreviewProps } from '@/components/pdf-preview';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { ResourceCategory, ResourceEntry } from '@/lib/pdf/resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { LOADING_INLINE, NOTICE, PANE_HEADING } from '@/components/inspector-styles';
import { IssuesPanel } from '@/components/issues-panel';
import { ObjectComparison } from '@/components/object-comparison';
import { ResourceBrowser } from '@/components/resource-browser';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

import type { Section } from './types';

/** Toolbar buttons in the pane heading: compact type and gap. */
const PANE_ACTION = 'gap-[5px] text-[10px]!';

const PdfPreview = lazy(() =>
  import('@/components/pdf-preview').then((module) => ({
    default: module.PdfPreview,
  }))
);

export interface InspectorPaneProps {
  busy: boolean;
  bytes: Uint8Array;
  document: PdfDocumentInfo | null;
  filename: string;
  hasRange: boolean;
  inspectorContent: ReactNode;
  issues: PdfIssue[];
  limits: { issueLimit: number; resourceLimit: number };
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
  onBookmark: () => void;
  onBrowseResources: () => void;
  onCategoryChange: (category: ResourceCategory) => void;
  onDismissNotice: () => void;
  onFilterChange: (filter: string) => void;
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
    issues: 'Issues',
    resources: 'Resource browser',
    structure: 'File structure',
  };
  return titles[section] ?? 'Overview';
};

const PaneActions = ({
  busy,
  bytes,
  hasRange,
  pinnedId,
  preview,
  section,
  selected,
  onBookmark,
  onBrowseResources,
  onPin,
  onPreviewChange,
}: InspectorPaneProps) => (
  <div className="flex items-center gap-1 max-w900:flex-wrap">
    {section === 'resources' && selected && (
      <Button variant="ghost" size="sm" className={PANE_ACTION} onClick={onBrowseResources}>
        Browse resources
      </Button>
    )}
    {(selected || hasRange) && (
      <Button variant="ghost" size="sm" className={PANE_ACTION} onClick={onBookmark}>
        <BookmarkPlus size={14} />
        Bookmark
      </Button>
    )}
    {selected && (
      <Button
        variant={pinnedId === selected.id ? 'secondary' : 'ghost'}
        size="sm"
        className={PANE_ACTION}
        onClick={() => onPin(pinnedId === selected.id ? null : selected.id)}
        aria-pressed={pinnedId === selected.id}
      >
        <Pin size={14} />
        {pinnedId === selected.id ? 'Unpin' : 'Pin to compare'}
      </Button>
    )}
    <Button
      variant={preview ? 'secondary' : 'ghost'}
      size="sm"
      className={PANE_ACTION}
      disabled={!bytes.length || busy}
      onClick={() => onPreviewChange(!preview)}
    >
      {preview ? <Braces size={14} /> : <Image size={14} />}
      {preview ? 'Inspect' : 'Preview'}
    </Button>
  </div>
);

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
    <h1 className="mb-2.5 text-[18px] font-medium">Opening PDF…</h1>
    <p className="max-w-[38ch] text-[12px] leading-[1.8] text-muted-foreground">
      Reading objects and building the document structure. Larger documents can take a few seconds.
    </p>
  </section>
);

const PreviewView = ({ bytes, filename, previewPage, previewPassword, previewSearch, onPageChange }: InspectorPaneProps) => (
  <Suspense fallback={<p className={LOADING_INLINE}>Loading EmbedPDF…</p>}>
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

const InspectorBody = (props: InspectorPaneProps) => {
  const { busy, bytes, document, filename, issues, limits, objectMap, overview, preview, section, selected, scrollPositionRef } = props;
  if (busy) return <LoadingView />;
  if (preview && bytes.length) return <PreviewView {...props} />;
  if (selected) return <SelectedObjectView {...props} />;
  if (section === 'issues' && document)
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
  if (section === 'resources' && document)
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
  return overview;
};

export const InspectorPane = (props: InspectorPaneProps) => (
  <main className="flex h-full min-h-0 flex-col overflow-hidden" aria-label="Document inspection" aria-busy={props.busy}>
    <div className={cn(PANE_HEADING, 'justify-between max-w900:h-auto max-w900:flex-wrap max-w900:gap-1.5 max-w900:py-1.5')}>
      <span>{paneTitle(props)}</span>
      <PaneActions {...props} />
    </div>
    {props.notice && (
      <div className={NOTICE} role="status">
        <span>{props.notice}</span>
        <button className="ml-auto bg-transparent" aria-label="Dismiss notice" onClick={props.onDismissNotice}>
          <X size={14} />
        </button>
      </div>
    )}
    <InspectorBody {...props} />
  </main>
);
