import type { ComponentProps } from 'react';

import { Braces, ChevronRight, FileCode2, FileWarning, Files, FolderOpen, Layers, LayoutDashboard, ListTree, Zap } from 'lucide-react';

import type { PageTreeState } from '@/components/page-tree';
import type { SessionBookmark } from '@/components/session-bookmarks';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PdfIssue } from '@/lib/pdf/issues';
import type { PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';

import { PaneHeading } from '@/components/inspector/pane';
import { SEVERITY_TONE } from '@/components/inspector/severity-tone';
import { PageTree } from '@/components/page-tree';
import { SessionBookmarks } from '@/components/session-bookmarks';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { Section, Selection } from './types';

// The object list is virtualised: rows are positioned from this pixel height, so it also sets each row's height.
const OBJECT_ROW_HEIGHT = 42;

const SectionCount = ({ className, ...props }: ComponentProps<'span'>) => {
  return <span className={cn('ml-auto text-caption tabular-nums', className)} {...props} />;
};

const SECTIONS = [
  ['overview', LayoutDashboard, 'Overview'],
  ['catalog', FolderOpen, 'Document catalogue'],
  ['pages', Files, 'Pages'],
  ['resources', Layers, 'Resources'],
  ['objects', Braces, 'All objects'],
  ['structure', FileCode2, 'File structure'],
  ['issues', FileWarning, 'Issues'],
  ['actions', Zap, 'Actions'],
] as const;

const LIST_HEADINGS: Partial<Record<Section, string>> = { pages: 'PAGE CONNECTIONS', resources: 'RESOURCE OBJECTS' };

/** The objects listed under the section buttons: the pages, the resources or every object. */
const sectionObjects = (
  section: Section,
  document: PdfDocumentInfo | null,
  objectMap: Map<string, PdfObjectRecord>,
  resourceObjects: PdfObjectRecord[],
  objects: PdfObjectRecord[]
) => {
  if (section === 'pages') {
    return (document?.pages ?? [])
      .map((id) => {
        return objectMap.get(id);
      })
      .filter((object): object is PdfObjectRecord => {
        return !!object;
      });
  }
  return section === 'resources' ? resourceObjects : objects;
};

const IssueCount = ({ issues, severity }: { issues: PdfIssue[]; severity: 'error' | 'warning' | undefined }) => {
  return (
    <SectionCount
      className={cn(severity && ['rounded-[4px] bg-(--issue-soft) px-1.5 py-0.5 font-[650] text-(--issue-ink)', SEVERITY_TONE[severity]])}
    >
      {
        issues.filter((issue) => {
          return issue.severity !== 'info';
        }).length
      }
    </SectionCount>
  );
};

const SectionButton = ({
  actionTotal,
  active,
  document,
  entry: [key, Icon, label],
  issues,
  issueSeverity,
  onChoose,
}: {
  actionTotal: number | undefined;
  active: boolean;
  document: PdfDocumentInfo | null;
  entry: (typeof SECTIONS)[number];
  issues: PdfIssue[];
  issueSeverity: 'error' | 'warning' | undefined;
  onChoose: (section: Section) => void;
}) => {
  return (
    <button
      className={cn(
        'flex items-center gap-2.25 px-2.5 py-2',
        'rounded-[5px] bg-transparent text-left text-detail text-muted-foreground',
        'hover:bg-accent hover:text-foreground',
        active && 'bg-accent font-medium text-accent-foreground shadow-[inset_3px_0_var(--brand-purple)]'
      )}
      onClick={() => {
        return onChoose(key);
      }}
    >
      <Icon size={15} className={cn(key === 'issues' && issueSeverity && ['text-(--issue-ink)', SEVERITY_TONE[issueSeverity]])} />
      <span>{label}</span>
      {key === 'issues' && <IssueCount issues={issues} severity={issueSeverity} />}
      {key === 'pages' && <SectionCount>{document?.pages.length ?? '—'}</SectionCount>}
      {key === 'actions' && <SectionCount>{actionTotal ?? '—'}</SectionCount>}
    </button>
  );
};

const ObjectRow = ({
  object,
  selected,
  top,
  onNavigate,
}: {
  object: PdfObjectRecord;
  selected: boolean;
  top: number;
  onNavigate: (id: string) => void;
}) => {
  return (
    <button
      className={cn(
        'absolute flex w-full items-center',
        'gap-2.5 px-2.25 text-left text-muted-foreground',
        'rounded-[4px] bg-transparent',
        'hover:bg-accent hover:text-foreground',
        selected && [
          'bg-accent text-accent-foreground',
          'hover:text-accent-foreground',
          '[outline:1px_solid_var(--border)] [outline-offset:-1px]',
        ]
      )}
      style={{ height: OBJECT_ROW_HEIGHT, top }}
      onClick={() => {
        return onNavigate(object.id);
      }}
    >
      <Braces size={14} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <code className="min-w-8 text-foreground">{object.id}</code>
        <span className="overflow-hidden text-caption text-ellipsis whitespace-nowrap">{object.kind}</span>
      </span>
      {object.provenance.type === 'decoded' ? <Layers size={12} aria-label="Inside object stream" /> : <ChevronRight size={12} />}
    </button>
  );
};

const ObjectList = ({
  locked,
  objects,
  scrollTop,
  selectedId,
  onNavigate,
  onScroll,
}: {
  locked: boolean | undefined;
  objects: PdfObjectRecord[];
  scrollTop: number;
  selectedId: string | null;
  onNavigate: (id: string) => void;
  onScroll: (top: number) => void;
}) => {
  const listStart = Math.max(0, Math.floor(scrollTop / OBJECT_ROW_HEIGHT) - 5);
  return (
    <div
      className="min-h-0 flex-1 overflow-auto px-1.75"
      data-object-list
      onScroll={(event) => {
        return onScroll(event.currentTarget.scrollTop);
      }}
    >
      <div className="relative" style={{ height: objects.length * OBJECT_ROW_HEIGHT }}>
        {objects.slice(listStart, listStart + 45).map((object, index) => {
          return (
            <ObjectRow
              key={object.id}
              object={object}
              selected={selectedId === object.id}
              top={(listStart + index) * OBJECT_ROW_HEIGHT}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
      {!objects.length && (
        <p className="px-2 py-4 text-xs text-muted-foreground">{locked ? 'Object inspection is locked.' : 'No objects in this section.'}</p>
      )}
    </div>
  );
};

export const ExplorerPane = ({
  actionTotal,
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
  actionTotal: number | undefined;
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
  const listedObjects = sectionObjects(section, document, objectMap, resourceObjects, objects);
  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar" aria-label="Structure explorer">
      <PaneHeading>
        <ListTree size={15} />
        <span>Explorer</span>
        <Badge variant="outline" className="ml-auto rounded-[4px] px-1.25 py-0 text-caption leading-[calc(4/3)] text-muted-foreground">
          {objects.length}
        </Badge>
      </PaneHeading>
      <nav className="flex flex-col gap-0.5 px-2.25 py-3.25" aria-label="Document sections">
        {SECTIONS.map((entry) => {
          return (
            <SectionButton
              key={entry[0]}
              actionTotal={actionTotal}
              active={section === entry[0]}
              document={document}
              entry={entry}
              issues={issues}
              issueSeverity={issueSeverity}
              onChoose={onChooseSection}
            />
          );
        })}
      </nav>
      <div
        className={cn(
          'flex justify-between',
          'mx-3.75 pt-3.25 pb-2.25',
          'text-micro font-medium tracking-[0.06em] text-muted-foreground',
          'border-t'
        )}
      >
        {LIST_HEADINGS[section] ?? 'INDIRECT OBJECTS'}
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
        <ObjectList
          key={section}
          locked={document?.locked}
          objects={listedObjects}
          scrollTop={objectScroll}
          selectedId={selectedId}
          onNavigate={onNavigate}
          onScroll={onScroll}
        />
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
