import { Moon, Sun } from 'lucide-react';
/** CSS reflects the active theme on both interactive and static pages. */
export const ThemeControl = function ThemeControl() {
  return (
    <button type="button" className="theme-control" title="Toggle light and dark mode" data-theme-control="">
      <span className="theme-switch-dark">
        <Moon size={16} aria-hidden="true" />
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="theme-switch-light">
        <Sun size={16} aria-hidden="true" />
        <span className="sr-only">Switch to light mode</span>
      </span>
    </button>
  );
};
