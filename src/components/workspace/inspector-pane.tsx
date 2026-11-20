import { BookmarkPlus, Braces, Image, LoaderCircle, Pin, X } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';

import type { PdfPreviewProps } from '@/components/pdf-preview';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { ResourceCategory, ResourceEntry } from '@/lib/pdf/resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { IssuesPanel } from '@/components/issues-panel';
import { ObjectComparison } from '@/components/object-comparison';
import { ResourceBrowser } from '@/components/resource-browser';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

import type { Section } from './types';

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
  <div className="pane-actions">
    {section === 'resources' && selected && (
      <Button variant="ghost" size="sm" onClick={onBrowseResources}>
        Browse resources
      </Button>
    )}
    {(selected || hasRange) && (
      <Button variant="ghost" size="sm" onClick={onBookmark}>
        <BookmarkPlus size={14} />
        Bookmark
      </Button>
    )}
    {selected && (
      <Button
        variant={pinnedId === selected.id ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onPin(pinnedId === selected.id ? null : selected.id)}
        aria-pressed={pinnedId === selected.id}
      >
        <Pin size={14} />
        {pinnedId === selected.id ? 'Unpin' : 'Pin to compare'}
      </Button>
    )}
    <Button variant={preview ? 'secondary' : 'ghost'} size="sm" disabled={!bytes.length || busy} onClick={() => onPreviewChange(!preview)}>
      {preview ? <Braces size={14} /> : <Image size={14} />}
      {preview ? 'Inspect' : 'Preview'}
    </Button>
  </div>
);

const SelectedObjectView = ({ inspectorContent, objectMap, pinnedId, selected, onNavigate, onPin }: InspectorPaneProps) => {
  const pinned = pinnedId ? objectMap.get(pinnedId) : undefined;
  return (
    <div className="inspection-detail-stack min-h-0 flex-1">
      {pinned ? (
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="40%" minSize="20%">
            <ObjectComparison pinned={pinned} current={selected!} onUnpin={() => onPin(null)} onNavigate={onNavigate} />
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="comparison-divider"
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
  <section className="document-loading" role="status" aria-label="Opening PDF">
    <LoaderCircle size={32} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <h1>Opening PDF…</h1>
    <p>Reading objects and building the document structure. Larger documents can take a few seconds.</p>
  </section>
);

const PreviewView = ({ bytes, filename, previewPage, previewPassword, previewSearch, onPageChange }: InspectorPaneProps) => (
  <Suspense fallback={<p className="loading-inline">Loading EmbedPDF…</p>}>
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
  <main className="main-inspector" aria-label="Document inspection" aria-busy={props.busy}>
    <div className="pane-heading">
      <span>{paneTitle(props)}</span>
      <PaneActions {...props} />
    </div>
    {props.notice && (
      <div className="notice" role="status">
        <span>{props.notice}</span>
        <button aria-label="Dismiss notice" onClick={props.onDismissNotice}>
          <X size={14} />
        </button>
      </div>
    )}
    <InspectorBody {...props} />
  </main>
);
