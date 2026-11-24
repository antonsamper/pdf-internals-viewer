import { cn } from 'cn';
import { Braces, ChevronRight, FileCode2, FileWarning, Files, FolderOpen, Layers, LayoutDashboard, ListTree } from 'lucide-react';

import type { PageTreeState } from '@/components/page-tree';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';

import { PANE_HEADING, SEVERITY_TONE } from '@/components/inspector-styles';
import { PageTree } from '@/components/page-tree';
import { SessionBookmarks, type SessionBookmark } from '@/components/session-bookmarks';
import { Badge } from '@/components/ui/badge';

import type { Section, Selection } from './types';

const NAV_ITEM =
  'flex items-center gap-[9px] rounded-[5px] bg-transparent px-2.5 py-2 text-left text-[11px]! text-muted-foreground hover:bg-accent hover:text-foreground';
const NAV_ITEM_ACTIVE = 'bg-accent font-medium! text-accent-foreground shadow-[inset_3px_0_var(--brand-purple)]';
const OBJECT_ROW =
  'flex h-[42px] w-full items-center gap-2.5 rounded-[4px] bg-transparent px-[9px] text-left text-muted-foreground hover:bg-accent hover:text-foreground';
const OBJECT_ROW_SELECTED =
  'bg-accent text-accent-foreground hover:text-accent-foreground [outline-offset:-1px]! [outline:1px_solid_var(--border)]!';
const NAV_COUNT = 'ml-auto text-[10px] tabular-nums';
const ISSUES_COUNT = 'rounded-[4px] bg-(--issue-soft) px-1.5 py-0.5 font-[650] text-(--issue-ink)';

export const ExplorerPane = ({
  bookmarks,
  bookmarksSaved,
  document,
  issues,
  issueSeverity,
  objectMap,
  objectScroll,
  objects,
  pageTreeState,
  resourceObjects,
  section,
  selectedId,
  onChooseSection,
  onNavigate,
  onNoteBookmark,
  onPageNavigate,
  onPageTreeChange,
  onRemoveBookmark,
  onScroll,
  onVisitBookmark,
}: {
  bookmarks: SessionBookmark<Selection>[];
  bookmarksSaved: boolean;
  document: PdfDocumentInfo | null;
  issues: PdfIssue[];
  issueSeverity: 'error' | 'warning' | undefined;
  objectMap: Map<string, PdfObjectRecord>;
  objectScroll: number;
  objects: PdfObjectRecord[];
  pageTreeState: PageTreeState;
  resourceObjects: PdfObjectRecord[];
  section: Section;
  selectedId: string | null;
  onChooseSection: (section: Section) => void;
  onNavigate: (id: string) => void;
  onNoteBookmark: (key: number, note: string) => void;
  onPageNavigate: (id: string, trail: ExplorationStep[]) => void;
  onPageTreeChange: (state: PageTreeState) => void;
  onRemoveBookmark: (key: number) => void;
  onScroll: (top: number) => void;
  onVisitBookmark: (saved: Selection) => void;
}) => {
  const listedObjects =
    section === 'pages'
      ? (document?.pages ?? []).map((id) => objectMap.get(id)).filter((object): object is PdfObjectRecord => !!object)
      : section === 'resources'
        ? resourceObjects
        : objects;
  const listStart = Math.max(0, Math.floor(objectScroll / 42) - 5);
  const visibleObjects = listedObjects.slice(listStart, listStart + 45);
  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar" aria-label="Structure explorer">
      <div className={PANE_HEADING}>
        <ListTree size={15} />
        <span>Explorer</span>
        <Badge variant="outline" className="ml-auto rounded-[4px] px-[5px] py-0 text-[10px] leading-[calc(4/3)] text-muted-foreground">
          {objects.length}
        </Badge>
      </div>
      <nav className="flex flex-col gap-0.5 px-[9px] py-[13px]" aria-label="Document sections">
        {(
          [
            ['overview', LayoutDashboard, 'Overview'],
            ['catalog', FolderOpen, 'Document catalogue'],
            ['pages', Files, 'Pages'],
            ['resources', Layers, 'Resources'],
            ['objects', Braces, 'All objects'],
            ['structure', FileCode2, 'File structure'],
            ['issues', FileWarning, 'Issues'],
          ] as const
        ).map(([key, Icon, label]) => (
          <button key={key} className={cn(NAV_ITEM, section === key && NAV_ITEM_ACTIVE)} onClick={() => onChooseSection(key)}>
            <Icon size={15} className={cn(key === 'issues' && issueSeverity && ['text-(--issue-ink)', SEVERITY_TONE[issueSeverity]])} />
            <span>{label}</span>
            {key === 'issues' && (
              <span className={cn(NAV_COUNT, issueSeverity && [ISSUES_COUNT, SEVERITY_TONE[issueSeverity]])}>
                {issues.filter((issue) => issue.severity !== 'info').length}
              </span>
            )}
            {key === 'pages' && <span className={NAV_COUNT}>{document?.pages.length ?? '—'}</span>}
          </button>
        ))}
      </nav>
      <div className="mx-[15px] flex justify-between border-t pt-[13px] pb-[9px] text-[9px] font-medium tracking-[0.06em] text-muted-foreground">
        {section === 'pages' ? 'PAGE CONNECTIONS' : section === 'resources' ? 'RESOURCE OBJECTS' : 'INDIRECT OBJECTS'}
        <span>{section === 'pages' ? (document?.pages.length ?? 0) : listedObjects.length}</span>
      </div>
      {section === 'pages' && document ? (
        <PageTree
          document={document}
          objects={objectMap}
          selectedId={selectedId}
          state={pageTreeState}
          onStateChange={onPageTreeChange}
          onNavigate={onPageNavigate}
        />
      ) : (
        <div
          className="min-h-0 flex-1 overflow-auto px-[7px]"
          data-object-list
          key={section}
          onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
        >
          <div style={{ height: listedObjects.length * 42, position: 'relative' }}>
            {visibleObjects.map((object, index) => (
              <button
                key={object.id}
                className={cn(OBJECT_ROW, selectedId === object.id && OBJECT_ROW_SELECTED)}
                style={{ position: 'absolute', top: (listStart + index) * 42 }}
                onClick={() => onNavigate(object.id)}
              >
                <Braces size={14} />
                <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
                  <code className="min-w-8 text-foreground">{object.id}</code>
                  <span className="overflow-hidden text-[10px] text-ellipsis whitespace-nowrap">{object.kind}</span>
                </span>
                {object.provenance.type === 'decoded' ? <Layers size={12} aria-label="Inside object stream" /> : <ChevronRight size={12} />}
              </button>
            ))}
          </div>
          {!listedObjects.length && (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              {document?.locked ? 'Object inspection is locked.' : 'No objects in this section.'}
            </p>
          )}
        </div>
      )}
      <SessionBookmarks
        bookmarks={bookmarks}
        saved={bookmarksSaved}
        onVisit={onVisitBookmark}
        onNote={onNoteBookmark}
        onRemove={onRemoveBookmark}
      />
    </aside>
  );
};
