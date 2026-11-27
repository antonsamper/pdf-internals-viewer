import { useEffect, useMemo, useRef, useState } from 'react';

import type { Selection } from '@/components/workspace/types';
import type { ResourceCategory } from '@/lib/pdf/resource-catalog';
import type { SitePath } from '@/lib/site-content';

import { TooltipProvider } from '@/components/ui/tooltip';
import { BytePane } from '@/components/workspace/byte-pane';
import { DropOverlay } from '@/components/workspace/drop-overlay';
import { EmptyWorkspace } from '@/components/workspace/empty-workspace';
import { ErrorBanner } from '@/components/workspace/error-banner';
import { ExplorerPane } from '@/components/workspace/explorer-pane';
import { SearchResultsPanel } from '@/components/workspace/search-results-panel';
import { emptyPageTree } from '@/components/workspace/types';
import { useArrival } from '@/components/workspace/use-arrival';
import { useBookmarks } from '@/components/workspace/use-bookmarks';
import { useDocumentLoader } from '@/components/workspace/use-document-loader';
import { useDocumentSearch } from '@/components/workspace/use-document-search';
import { useExploration } from '@/components/workspace/use-exploration';
import { useFileDrop } from '@/components/workspace/use-file-drop';
import { useResourceIndex } from '@/components/workspace/use-resource-index';
import { useSourceReveal } from '@/components/workspace/use-source-reveal';
import { useInitialSample, useWorkspaceShortcuts } from '@/components/workspace/use-workspace-shortcuts';
import { WorkspaceContent, OpeningProgress, WorkspaceFooter } from '@/components/workspace/workspace-content';
import { WorkspaceHeader } from '@/components/workspace/workspace-header';
import { WorkspaceInspector } from '@/components/workspace/workspace-inspector';
import { WorkspaceLayout } from '@/components/workspace/workspace-layout';
import { WorkspaceToolbar } from '@/components/workspace/workspace-toolbar';
import { sitePage } from '@/lib/site-content';
import { useSiteRoute } from '@/lib/site-route';

const NO_ACTIONS = { actions: [], notes: [], total: 0 };
const useNarrow = () => {
  // Match the build-time render; adapt after hydration on narrow screens.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    // Same range as the `w900` breakpoint token: widths below 901px.
    const query = window.matchMedia('(width < 901px)');
    const update = () => {
      return setNarrow(query.matches);
    };
    update();
    query.addEventListener('change', update);
    return () => {
      return query.removeEventListener('change', update);
    };
  }, []);
  return narrow;
};
const App = ({ initialPath = '/' }: { initialPath?: SitePath }) => {
  const [session, setSession] = useState({ id: 0, path: initialPath });
  return (
    <PdfWorkspace
      key={session.id}
      initialPath={session.path}
      openInitialSample={session.id === 0}
      onSessionEnd={() => {
        return setSession((current) => {
          return {
            id: current.id + 1,
            path: sitePage(window.location.pathname)?.path ?? '/',
          };
        });
      }}
    />
  );
};
const PdfWorkspace = ({
  initialPath,
  openInitialSample: shouldOpenInitialSample,
  onSessionEnd,
}: {
  initialPath: SitePath;
  openInitialSample: boolean;
  onSessionEnd: () => void;
}) => {
  const { path, about, goHome, followLink } = useSiteRoute(initialPath);
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [mobilePane, setMobilePane] = useState('inspector');
  const [pageTreeState, setPageTreeState] = useState(emptyPageTree);
  const [objectScroll, setObjectScroll] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [resourceCategory, setResourceCategory] = useState<ResourceCategory>('All');
  const [resourceFilter, setResourceFilter] = useState('');
  const narrow = useNarrow();
  const reveal = useSourceReveal();
  const bookmarks = useBookmarks();
  const loader = useDocumentLoader({
    closeAll: () => {
      return closeAll();
    },
    goHome,
    loadBookmarks: bookmarks.load,
    setNotice,
  });
  const { busy, bytes, document, filename } = loader;
  const drop = useFileDrop((file) => {
    return void loader.open(file);
  });
  const objects = useMemo(() => {
    return document?.objects ?? [];
  }, [document]);
  const objectMap = useMemo(() => {
    return new Map(
      objects.map((object) => {
        return [object.id, object];
      })
    );
  }, [objects]);
  // The parser worker builds the report, and leaves it empty for a locked document.
  const actionReport = useMemo(() => {
    return document?.indexes?.actions ?? NO_ACTIONS;
  }, [document]);
  const onArrive = useArrival({ document, reveal, setNotice, setObjectScroll, setPreview, setPreviewPage });
  const exploration = useExploration({
    document,
    objectMap,
    objects,
    onArrive,
    setMobilePane,
    setNotice,
  });
  const { navigate, section, selection, viewports } = exploration;
  const search = useDocumentSearch({
    bytes,
    document,
    navigate,
    objectMap,
    objectStep: exploration.objectStep,
    objects,
    previewPassword: loader.previewPassword,
    readStream: loader.readStream,
    reveal,
    selectRange: exploration.selectRange,
    setMobilePane,
    setPreview,
    setPreviewPage,
    visit: exploration.visit,
  });
  const closeAll = () => {
    loader.closeDocument();
    search.reset();
    reveal.clear();
    exploration.reset();
    bookmarks.reset();
    setNotice(null);
    setPreview(false);
    setObjectScroll(0);
    setPreviewPage(1);
    setPageTreeState(emptyPageTree());
    setPinnedId(null);
    setResourceCategory('All');
    setResourceFilter('');
  };
  const endSession = () => {
    closeAll();
    // Unmount the document owner so React's previous render, memoised graphs
    // and event-handler closures cannot retain a closed PDF until another update.
    onSessionEnd();
  };
  const openFile = () => {
    return input.current?.click();
  };
  useWorkspaceShortcuts(openFile, search.inputRef, search.setOpen);
  useInitialSample(shouldOpenInitialSample, (file) => {
    return void loader.sample(file);
  });
  const resources = useResourceIndex(document, objectMap);
  const explorer = (
    <ExplorerPane
      actionTotal={document && !document.locked ? actionReport.total : undefined}
      bookmarks={bookmarks.bookmarks}
      bookmarksSaved={bookmarks.saved}
      document={document}
      issues={loader.issues}
      issueSeverity={loader.issueSeverity}
      objectMap={objectMap}
      objectScroll={objectScroll}
      objects={objects}
      pageTreeState={pageTreeState}
      resourceObjects={resources.resourceObjects}
      section={section}
      selectedId={selection.id}
      onChooseSection={(next) => {
        exploration.chooseSection(next);
        setObjectScroll(0);
      }}
      onNavigate={(id) => {
        return navigate(id);
      }}
      onNoteBookmark={bookmarks.setNote}
      onPageNavigate={(id, trail) => {
        exploration.visit({ id, section: 'pages', tab: 'properties', trail });
        setMobilePane('inspector');
      }}
      onPageTreeChange={setPageTreeState}
      onRemoveBookmark={bookmarks.remove}
      onScroll={setObjectScroll}
      onVisitBookmark={(saved: Selection) => {
        exploration.visit(saved);
        setMobilePane(saved.range ? 'bytes' : 'inspector');
      }}
    />
  );
  const { byteReveal, textSource } = reveal;
  const byteView = (
    <BytePane
      activeResult={search.activeResult}
      bytes={bytes}
      range={exploration.selectedRange}
      revealKey={byteReveal}
      scrollPositionRef={viewports.bytes}
      textSource={textSource}
      onByteSelect={exploration.selectByte}
    />
  );
  const inspector = (
    <WorkspaceInspector
      actionReport={actionReport}
      bookmarks={bookmarks}
      exploration={exploration}
      loader={loader}
      notice={notice}
      objectMap={objectMap}
      objects={objects}
      pinnedId={pinnedId}
      preview={preview}
      previewPage={previewPage}
      resourceCategory={resourceCategory}
      resourceFilter={resourceFilter}
      resources={resources}
      search={search}
      textSource={textSource}
      onCategoryChange={setResourceCategory}
      onFilterChange={setResourceFilter}
      onFollowLink={followLink}
      onMobilePane={setMobilePane}
      onNotice={setNotice}
      onOpenFile={openFile}
      onPageChange={setPreviewPage}
      onPin={setPinnedId}
      onPreviewChange={setPreview}
    />
  );

  return (
    <TooltipProvider delay={250}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground" data-app-shell="" {...drop.handlers}>
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          aria-label="Open local PDF"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void loader.open(file);
            }
            event.target.value = '';
          }}
        />
        <WorkspaceHeader
          busy={busy}
          byteCount={bytes.length}
          filename={filename}
          path={path}
          onClose={endSession}
          onFollowLink={followLink}
          onHome={() => {
            if (document) {
              navigate(null, 'properties', 'overview');
            }
          }}
          onOpenFile={openFile}
        />
        {loader.error && (
          <ErrorBanner
            message={loader.error}
            onDismiss={() => {
              return loader.setError(null);
            }}
          />
        )}
        <WorkspaceContent
          about={about}
          empty={
            <EmptyWorkspace
              onFollowLink={followLink}
              onOpenFile={openFile}
              onSample={(file) => {
                return void loader.sample(file);
              }}
            />
          }
          path={path}
          showWorkspace={bytes.length > 0 || busy}
          workspace={
            <>
              <WorkspaceToolbar
                busy={busy}
                canGoBack={exploration.canGoBack}
                canGoForward={exploration.canGoForward}
                search={search}
                section={section}
                trail={selection.trail}
                onSelectStep={exploration.selectTrailStep}
                onTravel={exploration.travel}
              />
              <SearchResultsPanel search={search} textSource={textSource} />
              {busy && <OpeningProgress onCancel={endSession} />}
              <WorkspaceLayout
                bytes={byteView}
                explorer={explorer}
                inspector={inspector}
                mobilePane={mobilePane}
                narrow={narrow}
                onMobilePane={setMobilePane}
              />
            </>
          }
          onFollowLink={followLink}
        />
        <WorkspaceFooter
          busy={busy}
          byteCount={bytes.length}
          document={document}
          objectCount={objects.length}
          path={path}
          onFollowLink={followLink}
        />
        {drop.dragging && <DropOverlay />}
      </div>
    </TooltipProvider>
  );
};
export default App;
