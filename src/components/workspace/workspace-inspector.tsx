import type { ComponentProps } from 'react';

import type { PdfActionReport } from '@/lib/pdf/document-actions';
import type { TextSource } from '@/lib/pdf/page-text';
import type { ResourceCategory } from '@/lib/pdf/resource-catalog';
import type { PdfObjectRecord } from '@/lib/pdf/types';

import type { useBookmarks } from './use-bookmarks';
import type { useDocumentLoader } from './use-document-loader';
import type { useDocumentSearch } from './use-document-search';
import type { useExploration } from './use-exploration';
import type { useResourceIndex } from './use-resource-index';

import { InspectorPane } from './inspector-pane';
import { OverviewPane } from './overview-pane';
import { SelectedObjectPane } from './selected-object-pane';

export const WorkspaceInspector = ({
  actionReport,
  bookmarks,
  exploration,
  loader,
  notice,
  objectMap,
  objects,
  pinnedId,
  preview,
  previewPage,
  resourceCategory,
  resourceFilter,
  resources,
  search,
  textSource,
  onCategoryChange,
  onFilterChange,
  onFollowLink,
  onMobilePane,
  onNotice,
  onOpenFile,
  onPageChange,
  onPin,
  onPreviewChange,
}: {
  actionReport: PdfActionReport;
  bookmarks: ReturnType<typeof useBookmarks>;
  exploration: ReturnType<typeof useExploration>;
  loader: ReturnType<typeof useDocumentLoader>;
  notice: string | null;
  objectMap: Map<string, PdfObjectRecord>;
  objects: PdfObjectRecord[];
  pinnedId: string | null;
  preview: boolean;
  previewPage: number;
  resourceCategory: ResourceCategory;
  resourceFilter: string;
  resources: ReturnType<typeof useResourceIndex>;
  search: ReturnType<typeof useDocumentSearch>;
  textSource: TextSource | null;
  onCategoryChange: (category: ResourceCategory) => void;
  onFilterChange: (filter: string) => void;
  onFollowLink: ComponentProps<typeof SelectedObjectPane>['onFollowLink'];
  onMobilePane: (pane: string) => void;
  onNotice: (notice: string | null) => void;
  onOpenFile: () => void;
  onPageChange: (page: number) => void;
  onPin: (id: string | null) => void;
  onPreviewChange: (preview: boolean) => void;
}) => {
  const { busy, bytes, document, filename } = loader;
  const { navigate, section, selected, selection, viewports } = exploration;
  const { downloadIndex, resourceEntries, resourceObjects } = resources;
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
      onOpenFile={onOpenFile}
      onPreview={() => {
        return onPreviewChange(true);
      }}
      onSelectRange={exploration.selectRange}
      onShowBytes={() => {
        exploration.selectRange({ end: Math.min(bytes.length, 1), start: 0 });
        onMobilePane('bytes');
      }}
      onUnlock={(password) => {
        return void loader.unlock(password);
      }}
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
      onFollowLink={onFollowLink}
      onFollowReference={exploration.followReference}
      onNavigate={navigate}
      onTabChange={(tab) => {
        return navigate(selected.id, tab);
      }}
    />
  ) : null;

  return (
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
      onBookmark={() => {
        return bookmarks.add(selection);
      }}
      onBrowseResources={() => {
        return navigate(null, 'properties', 'resources');
      }}
      onCategoryChange={onCategoryChange}
      onDismissNotice={() => {
        return onNotice(null);
      }}
      onFilterChange={onFilterChange}
      onActionLimitChange={(actionLimit) => {
        return exploration.updateViewports({ actionLimit });
      }}
      onIssueLimitChange={(issueLimit) => {
        return exploration.updateViewports({ issueLimit });
      }}
      onNavigate={(id) => {
        return navigate(id);
      }}
      onPageChange={onPageChange}
      onPin={onPin}
      onPreviewChange={onPreviewChange}
      onResourceLimitChange={(resourceLimit) => {
        return exploration.updateViewports({ resourceLimit });
      }}
      onStructure={() => {
        return exploration.chooseSection('structure');
      }}
    />
  );
};
