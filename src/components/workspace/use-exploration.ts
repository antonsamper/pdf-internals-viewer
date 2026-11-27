import { useMemo, useState } from 'react';

import type { InspectorTab } from '@/components/object-inspector';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { ByteRange, PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';

import { extendExplorationTrail, referencePathOwners } from '@/lib/pdf/exploration-trail';

import type { Section, Selection } from './types';

import { newViewports } from './types';

const initialHistory = (): Selection[] => [{ id: null, section: 'overview', tab: 'properties' }];

/** Whether two selections show the same object, tab, section, byte range and trail. */
const sameSelection = (a: Selection, b: Selection) =>
  a.id === b.id &&
  a.tab === b.tab &&
  a.section === b.section &&
  a.range?.start === b.range?.start &&
  a.range?.end === b.range?.end &&
  JSON.stringify(a.trail) === JSON.stringify(b.trail);

interface ExplorationDeps {
  document: PdfDocumentInfo | null;
  objectMap: Map<string, PdfObjectRecord>;
  objects: PdfObjectRecord[];
  /** Reset per-visit view state; receives the section being left. */
  onArrive: (next: Selection, previousSection: Section) => void;
  setMobilePane: (pane: string) => void;
  setNotice: (notice: string | null) => void;
}

/** Back/forward history of what the user has inspected, plus per-visit scroll positions. */
export const useExploration = ({ document, objectMap, objects, onArrive, setMobilePane, setNotice }: ExplorationDeps) => {
  const [history, setHistory] = useState<Selection[]>(initialHistory);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewportHistory, setViewportHistory] = useState(() => [newViewports()]);
  const viewports = viewportHistory[historyIndex];
  const selection = history[historyIndex];
  const section = selection.section;
  const selected = selection.id ? objectMap.get(selection.id) : undefined;
  const selectedRange = useMemo(
    () =>
      selection.range ??
      (selected?.provenance.type === 'file'
        ? selected.provenance.range
        : selected?.provenance.type === 'decoded'
          ? selected.provenance.containerRange
          : undefined),
    [selection.range, selected]
  );

  const objectStep = (id: string): ExplorationStep => {
    const pageIndex = document?.pages.indexOf(id) ?? -1;
    return { id, label: pageIndex >= 0 ? `Page ${pageIndex + 1}` : `${id} obj` };
  };

  const visit = (next: Selection) => {
    onArrive(next, section);
    if (sameSelection(selection, next)) return;
    setViewportHistory(viewportHistory.slice(0, historyIndex + 1).concat(newViewports()));
    setHistory(history.slice(0, historyIndex + 1).concat(next));
    setHistoryIndex(historyIndex + 1);
  };

  const followReference = (id: string, referencePath?: string[]) => {
    if (!objectMap.has(id)) {
      setNotice(`Reference ${id} R has no available object in the current object set.`);
      return;
    }
    const source = selected ? objectStep(selected.id) : { id: null, label: section === 'structure' ? 'Trailer' : 'Document' };
    const trail = extendExplorationTrail(
      selection.trail ?? [],
      source,
      objectStep(id),
      referencePath,
      referencePathOwners(selected?.value ?? document!.trailer, referencePath ?? [], objectMap, source.id)
    );
    visit({ id, section, tab: 'properties', trail });
    setMobilePane('inspector');
  };

  const navigate = (id: string | null, tab: InspectorTab = 'properties', nextSection: Section = section) => {
    if (id && !objectMap.has(id)) {
      setNotice(`Reference ${id} R has no available object in the current object set.`);
      return;
    }
    visit({
      id,
      section: nextSection,
      tab,
      trail: id ? (id === selected?.id ? (selection.trail ?? [objectStep(id)]) : [objectStep(id)]) : undefined,
    });
    setMobilePane('inspector');
  };

  const selectRange = (range: ByteRange, message?: string) => {
    visit({ ...selection, notice: message, range });
    setMobilePane('bytes');
  };

  const travel = (direction: number) => {
    const index = Math.max(0, Math.min(history.length - 1, historyIndex + direction));
    const next = history[index];
    onArrive(next, section);
    setHistoryIndex(index);
    setMobilePane(next.range ? 'bytes' : 'inspector');
  };

  const selectByte = (offset: number) => {
    const object = objects.find(
      (candidate) =>
        candidate.provenance.type === 'file' && offset >= candidate.provenance.range.start && offset < candidate.provenance.range.end
    );
    if (object) navigate(object.id);
    else {
      selectRange({ end: offset + 1, start: offset }, `Byte 0x${offset.toString(16).toUpperCase()} has no known containing object.`);
    }
  };

  const chooseSection = (next: Section) => {
    if (next === 'overview' || next === 'structure' || next === 'resources' || next === 'issues') navigate(null, 'properties', next);
    else if (next === 'catalog' && document?.catalogId) navigate(document.catalogId, 'properties', next);
    else visit({ ...selection, section: next });
  };

  const selectTrailStep = (index: number) => {
    const trail = selection.trail!;
    visit({
      id: trail[index].id,
      section,
      tab: 'properties',
      trail: trail.slice(0, index + 1),
    });
    setMobilePane('inspector');
  };

  return {
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    chooseSection,
    followReference,
    navigate,
    objectStep,
    reset: () => {
      setHistory(initialHistory());
      setHistoryIndex(0);
      setViewportHistory([newViewports()]);
    },
    section,
    selectByte,
    selectRange,
    selectTrailStep,
    selected,
    selectedRange,
    selection,
    travel,
    updateViewports: (patch: Partial<ReturnType<typeof newViewports>>) =>
      setViewportHistory((entries) => entries.map((entry, index) => (index === historyIndex ? { ...entry, ...patch } : entry))),
    viewports,
    visit,
  };
};
