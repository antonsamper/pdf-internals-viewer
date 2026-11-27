import type { MouseEvent } from 'react';

import type { InspectorTab } from '@/components/object-inspector';
import type { EmbeddedDownload } from '@/lib/pdf/downloads';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { TextSource } from '@/lib/pdf/page-text';
import type { PdfObjectRecord, StreamResult } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { ObjectInspector } from '@/components/object-inspector';
import { effectiveResources } from '@/lib/pdf/navigation';

/** Inspector for the selected object, aware of the page the user came from. */
export const SelectedObjectPane = ({
  downloadIndex,
  objectMap,
  pages,
  scrollPositionRef,
  selected,
  tab,
  textSource,
  trail,
  extractImage,
  extractStream,
  readStream,
  onFollowLink,
  onFollowReference,
  onNavigate,
  onTabChange,
}: {
  downloadIndex: Map<string, EmbeddedDownload[]>;
  objectMap: Map<string, PdfObjectRecord>;
  pages: string[] | undefined;
  scrollPositionRef: ScrollPosition;
  selected: PdfObjectRecord;
  tab: InspectorTab;
  textSource: TextSource | null;
  trail: ExplorationStep[] | undefined;
  extractImage: (id: string) => Promise<StreamResult>;
  extractStream: (id: string, purpose?: 'download' | 'size') => Promise<StreamResult>;
  readStream: (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
  onFollowLink: (event: MouseEvent<HTMLElement>) => boolean;
  onFollowReference: (id: string, path?: string[]) => void;
  onNavigate: (id: string, tab?: InspectorTab) => void;
  onTabChange: (tab: InspectorTab) => void;
}) => {
  const pageIds = new Set(pages);
  return (
    <ObjectInspector
      onFollowLink={onFollowLink}
      object={selected}
      textMatchRanges={textSource?.id === selected.id ? textSource.ranges : undefined}
      scrollPositionRef={scrollPositionRef}
      tab={tab}
      resources={selected.kind === 'Page' ? effectiveResources(selected, objectMap) : undefined}
      onTabChange={onTabChange}
      onNavigate={onFollowReference}
      onInspect={(id) => {
        return onNavigate(id);
      }}
      objects={objectMap}
      downloadIndex={downloadIndex}
      pages={pages}
      contextPageId={
        (trail ?? []).toReversed().find((step) => {
          return step.id !== null && pageIds.has(step.id);
        })?.id ?? undefined
      }
      readStream={readStream}
      extractStream={extractStream}
      extractImage={extractImage}
    />
  );
};
