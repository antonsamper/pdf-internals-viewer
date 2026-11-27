import type { PdfDocumentInfo } from '@/lib/pdf/types';

import type { Section, Selection } from './types';
import type { useSourceReveal } from './use-source-reveal';

interface ArrivalDeps {
  document: PdfDocumentInfo | null;
  reveal: ReturnType<typeof useSourceReveal>;
  setNotice: (notice: string | null) => void;
  setObjectScroll: (top: number) => void;
  setPreview: (preview: boolean) => void;
  setPreviewPage: (page: number) => void;
}

/** View state to reset whenever the user arrives at a new selection. */
export const useArrival = ({ document, reveal, setNotice, setObjectScroll, setPreview, setPreviewPage }: ArrivalDeps) => {
  return (next: Selection, previousSection: Section) => {
    reveal.clear();
    if (next.section !== previousSection) {
      setObjectScroll(0);
    }
    setNotice(next.notice ?? null);
    setPreview(false);
    const page = document?.pages.indexOf(next.id ?? '') ?? -1;
    if (page >= 0) {
      setPreviewPage(page + 1);
    }
  };
};
