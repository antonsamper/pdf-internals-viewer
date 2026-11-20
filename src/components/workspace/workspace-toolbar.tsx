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
  <div className="workspace-toolbar">
    <div className="history-controls">
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
