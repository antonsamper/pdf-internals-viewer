import { ArrowLeft, ArrowRight } from 'lucide-react';

import type { ExplorationStep } from '@/lib/pdf/exploration-trail';

import { Button } from '@/components/ui/button';

import type { Section } from './types';
import type { useDocumentSearch } from './use-document-search';

import { ExplorationTrail } from './exploration-trail';
import { SearchForm } from './search-form';

export const WorkspaceToolbar = ({
  busy,
  canGoBack,
  canGoForward,
  search,
  section,
  trail,
  onSelectStep,
  onTravel,
}: {
  busy: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  search: ReturnType<typeof useDocumentSearch>;
  section: Section;
  trail: ExplorationStep[] | undefined;
  onSelectStep: (index: number) => void;
  onTravel: (direction: number) => void;
}) => (
  <div className="flex min-h-[45px] items-center justify-between gap-5 border-b px-3 py-1.5 max-w900:flex-wrap max-w900:gap-0.5 max-w900:px-2.5 max-w900:pt-1 max-w900:pb-2">
    <div className="flex min-w-0 flex-1 items-center gap-[3px] max-w900:min-h-8 max-w900:w-full">
      <Button variant="ghost" size="icon-sm" aria-label="Back" disabled={!canGoBack} onClick={() => onTravel(-1)}>
        <ArrowLeft size={15} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Forward" disabled={!canGoForward} onClick={() => onTravel(1)}>
        <ArrowRight size={15} />
      </Button>
      <ExplorationTrail busy={busy} section={section} trail={trail} onSelectStep={onSelectStep} />
    </div>
    <SearchForm busy={busy} search={search} />
  </div>
);
