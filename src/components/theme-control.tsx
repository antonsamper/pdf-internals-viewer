import { Moon, Sun } from 'lucide-react';
/** CSS reflects the active theme on both interactive and static pages. Sits in the corner of the header. */
export const ThemeControl = function ThemeControl() {
  return (
    <button
      type="button"
      className="absolute top-[calc((var(--header-height)_-_var(--theme-control-size))/2)] right-(--header-inline-padding) inline-flex size-(--theme-control-size) shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-border bg-background p-0 text-foreground [color-scheme:dark] hover:bg-muted"
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
