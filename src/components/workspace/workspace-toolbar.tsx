import { ArrowLeft, ArrowRight } from 'lucide-react';

import type { ExplorationStep } from '@/lib/pdf/exploration-trail';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
}) => {
  return (
    <div
      className={cn(
        'flex min-h-11.25 items-center justify-between',
        'gap-5 border-b px-3 py-1.5',
        'narrow:flex-wrap narrow:gap-0.5 narrow:px-2.5 narrow:pt-1 narrow:pb-2'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.75 narrow:min-h-8 narrow:w-full">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={() => {
            return onTravel(-1);
          }}
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={() => {
            return onTravel(1);
          }}
        >
          <ArrowRight size={15} />
        </Button>
        <ExplorationTrail busy={busy} section={section} trail={trail} onSelectStep={onSelectStep} />
      </div>
      <SearchForm busy={busy} search={search} />
    </div>
  );
};
