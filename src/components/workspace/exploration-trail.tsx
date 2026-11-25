import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';

import type { ExplorationStep } from '@/lib/pdf/exploration-trail';

import { REFERENCE } from '@/components/inspector-styles';

import type { Section } from './types';

import { uniqueKeys } from './keys';

const SECTION_LABELS: Partial<Record<Section, string>> = {
  issues: 'Issues',
  resources: 'Resources',
  structure: 'File structure',
};

export const ExplorationTrail = ({
  busy,
  section,
  trail,
  onSelectStep,
}: {
  busy: boolean;
  section: Section;
  trail: ExplorationStep[] | undefined;
  onSelectStep: (index: number) => void;
}) => {
  const steps = trail ?? [];
  const keys = uniqueKeys(steps, (step) => step.id ?? 'root');
  const fallback = SECTION_LABELS[section] ?? 'Document overview';
  return (
    <nav
      className={cn(
        'flex min-w-0 flex-1 items-center overflow-x-auto',
        'ml-2 [scrollbar-width:thin] gap-1 text-xs',
        'max-w360:[&>span:not(:last-child)]:hidden'
      )}
      aria-label="Exploration trail"
    >
      {busy ? 'Inspecting…' : steps.length ? undefined : fallback}
      {!busy &&
        steps.map((step, index) => (
          <span className="flex shrink-0 items-center gap-1" key={keys[index]}>
            {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {index === steps.length - 1 ? (
              <span aria-current="location" className="font-code text-[12px]">
                {step.label}
              </span>
            ) : (
              <button className={REFERENCE} onClick={() => onSelectStep(index)}>
                {step.label}
              </button>
            )}
          </span>
        ))}
    </nav>
  );
};
