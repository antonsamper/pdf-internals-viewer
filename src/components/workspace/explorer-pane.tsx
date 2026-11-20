import { Braces, ChevronRight, FileCode2, FileWarning, Files, FolderOpen, Layers, LayoutDashboard, ListTree } from 'lucide-react';

import type { PageTreeState } from '@/components/page-tree';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';

import { PageTree } from '@/components/page-tree';
import { SessionBookmarks, type SessionBookmark } from '@/components/session-bookmarks';
import { Badge } from '@/components/ui/badge';

import type { Section, Selection } from './types';

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
    <aside className="explorer" aria-label="Structure explorer">
      <div className="pane-heading">
        <ListTree size={15} />
        <span>Explorer</span>
        <Badge variant="outline">{objects.length}</Badge>
      </div>
      <nav className="explorer-nav" aria-label="Document sections">
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
          <button key={key} className={`nav-item ${section === key ? 'active' : ''}`} onClick={() => onChooseSection(key)}>
            <Icon
              size={15}
              className={key === 'issues' ? 'issues-nav-icon' : undefined}
              data-severity={key === 'issues' ? issueSeverity : undefined}
            />
            <span>{label}</span>
            {key === 'issues' && (
              <span className="nav-count issues-nav-count" data-severity={issueSeverity}>
                {issues.filter((issue) => issue.severity !== 'info').length}
              </span>
            )}
            {key === 'pages' && <span className="nav-count">{document?.pages.length ?? '—'}</span>}
          </button>
        ))}
      </nav>
      <div className="object-list-heading">
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
        <div className="object-list" key={section} onScroll={(event) => onScroll(event.currentTarget.scrollTop)}>
          <div style={{ height: listedObjects.length * 42, position: 'relative' }}>
            {visibleObjects.map((object, index) => (
              <button
                key={object.id}
                className={`object-row ${selectedId === object.id ? 'selected' : ''}`}
                style={{ position: 'absolute', top: (listStart + index) * 42 }}
                onClick={() => onNavigate(object.id)}
              >
                <Braces size={14} />
                <span>
                  <code>{object.id}</code>
                  <span className="object-label">{object.kind}</span>
                </span>
                {object.provenance.type === 'decoded' ? <Layers size={12} aria-label="Inside object stream" /> : <ChevronRight size={12} />}
              </button>
            ))}
          </div>
          {!listedObjects.length && (
            <p className="list-empty">{document?.locked ? 'Object inspection is locked.' : 'No objects in this section.'}</p>
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
