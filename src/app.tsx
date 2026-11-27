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
import { InspectorPane } from '@/components/workspace/inspector-pane';
import { OverviewPane } from '@/components/workspace/overview-pane';
import { SearchResultsPanel } from '@/components/workspace/search-results-panel';
import { SelectedObjectPane } from '@/components/workspace/selected-object-pane';
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
import { WorkspaceLayout } from '@/components/workspace/workspace-layout';
import { WorkspaceToolbar } from '@/components/workspace/workspace-toolbar';
import { actionCount, documentActions } from '@/lib/pdf/document-actions';
import { sitePage } from '@/lib/site-content';
import { useSiteRoute } from '@/lib/site-route';

const NO_ACTIONS = { actions: [], notes: [] };
const useNarrow = () => {
  // Match the build-time render; adapt after hydration on narrow screens.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    // Same range as the `w900` breakpoint token: widths below 901px.
    const query = window.matchMedia('(width < 901px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
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
      onSessionEnd={() =>
        setSession((current) => ({
          id: current.id + 1,
          path: sitePage(window.location.pathname)?.path ?? '/',
        }))
      }
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
    closeAll: () => closeAll(),
    goHome,
    loadBookmarks: bookmarks.load,
    setNotice,
  });
  const { busy, bytes, document, filename } = loader;
  const drop = useFileDrop((file) => void loader.open(file));
  const objects = useMemo(() => document?.objects ?? [], [document]);
  const objectMap = useMemo(() => new Map(objects.map((object) => [object.id, object])), [objects]);
  const actionReport = useMemo(
    () => (document && !document.locked ? documentActions(document, objectMap) : NO_ACTIONS),
    [document, objectMap]
  );
  const onArrive = useArrival({ document, reveal, setNotice, setObjectScroll, setPreview, setPreviewPage });
  const exploration = useExploration({
    document,
    objectMap,
    objects,
    onArrive,
    setMobilePane,
    setNotice,
  });
  const { navigate, section, selected, selection, viewports } = exploration;
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
  const openFile = () => input.current?.click();
  useWorkspaceShortcuts(openFile, search.inputRef, search.setOpen);
  useInitialSample(shouldOpenInitialSample, (file) => void loader.sample(file));
  const { downloadIndex, resourceEntries, resourceObjects } = useResourceIndex(document, objectMap);
  const explorer = (
    <ExplorerPane
      actionTotal={actionCount(actionReport.actions)}
      bookmarks={bookmarks.bookmarks}
      bookmarksSaved={bookmarks.saved}
      document={document}
      issues={loader.issues}
      issueSeverity={loader.issueSeverity}
      objectMap={objectMap}
      objectScroll={objectScroll}
      objects={objects}
      pageTreeState={pageTreeState}
      resourceObjects={resourceObjects}
      section={section}
      selectedId={selection.id}
      onChooseSection={(next) => {
        exploration.chooseSection(next);
        setObjectScroll(0);
      }}
      onNavigate={(id) => navigate(id)}
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
  const overview = (
    <OverviewPane
      byteCount={bytes.length}
      document={document}
      filename={filename}
      inspectionError={loader.inspectionError}
      issues={loader.issues}
      objectMap={objectMap}
      objects={objects}
      resourceObjects={resourceObjects}
      scrollPositionRef={viewports.inspector}
      section={section}
      unlockError={loader.unlockError}
      unlocking={loader.unlocking}
      onChooseSection={exploration.chooseSection}
      onFollowReference={exploration.followReference}
      onNavigate={navigate}
      onOpenFile={openFile}
      onPreview={() => setPreview(true)}
      onSelectRange={exploration.selectRange}
      onShowBytes={() => {
        exploration.selectRange({ end: Math.min(bytes.length, 1), start: 0 });
        setMobilePane('bytes');
      }}
      onUnlock={(password) => void loader.unlock(password)}
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
  const objectInspector = selected ? (
    <SelectedObjectPane
      downloadIndex={downloadIndex}
      objectMap={objectMap}
      pages={document?.pages}
      scrollPositionRef={viewports.inspector}
      selected={selected}
      tab={selection.tab}
      textSource={textSource}
      trail={selection.trail}
      extractImage={loader.extractImage}
      extractStream={loader.extractStream}
      readStream={loader.readStream}
      onFollowLink={followLink}
      onFollowReference={exploration.followReference}
      onNavigate={navigate}
      onTabChange={(tab) => navigate(selected.id, tab)}
    />
  ) : null;
  const inspector = (
    <InspectorPane
      actionReport={actionReport}
      busy={busy}
      bytes={bytes}
      document={document}
      filename={filename}
      hasRange={Boolean(selection.range)}
      inspectorContent={objectInspector}
      issues={loader.issues}
      limits={viewports}
      notice={notice}
      objectMap={objectMap}
      overview={overview}
      pinnedId={pinnedId}
      preview={preview}
      previewPage={previewPage}
      previewPassword={loader.previewPassword}
      previewSearch={search.previewSearch}
      resourceCategory={resourceCategory}
      resourceEntries={resourceEntries}
      resourceFilter={resourceFilter}
      scrollPositionRef={viewports.inspector}
      section={section}
      selected={selected}
      extractImage={loader.extractImage}
      extractStream={loader.extractStream}
      readStream={loader.readStream}
      onBookmark={() => bookmarks.add(selection)}
      onBrowseResources={() => navigate(null, 'properties', 'resources')}
      onCategoryChange={setResourceCategory}
      onDismissNotice={() => setNotice(null)}
      onFilterChange={setResourceFilter}
      onIssueLimitChange={(issueLimit) => exploration.updateViewports({ issueLimit })}
      onNavigate={(id) => navigate(id)}
      onPageChange={setPreviewPage}
      onPin={setPinnedId}
      onPreviewChange={setPreview}
      onResourceLimitChange={(resourceLimit) => exploration.updateViewports({ resourceLimit })}
      onStructure={() => exploration.chooseSection('structure')}
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
            if (file) void loader.open(file);
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
            if (document) navigate(null, 'properties', 'overview');
          }}
          onOpenFile={openFile}
        />
        {loader.error && <ErrorBanner message={loader.error} onDismiss={() => loader.setError(null)} />}
        <WorkspaceContent
          about={about}
          empty={<EmptyWorkspace onFollowLink={followLink} onOpenFile={openFile} onSample={(file) => void loader.sample(file)} />}
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
