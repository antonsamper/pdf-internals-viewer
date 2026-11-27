import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';

/** CSS reflects the active theme on both interactive and static pages. Sits in the corner of the header. */
export const ThemeControl = function ThemeControl() {
  return (
    <button
      type="button"
      className={cn(
        'absolute top-[calc((var(--header-height)_-_var(--theme-control-size))/2)] right-(--header-inline-padding)',
        'inline-flex size-(--theme-control-size) shrink-0 items-center justify-center p-0',
        'bg-background text-foreground [color-scheme:dark]',
        'cursor-pointer rounded-sm border border-border',
        'hover:bg-muted'
      )}
      title="Toggle light and dark mode"
      data-theme-control=""
    >
      <span className="flex dark:hidden">
        <Moon size={16} aria-hidden="true" />
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="hidden dark:flex">
        <Sun size={16} aria-hidden="true" />
        <span className="sr-only">Switch to light mode</span>
      </span>
    </button>
  );
};
