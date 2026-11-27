import { createCn } from 'cn/config';

/**
 * `cn` that knows the theme's type scale (`text-detail`, `text-body` and the rest) and its shadows
 * (`shadow-popover`, `shadow-menu`, `shadow-nav-menu`), so it merges them as font sizes and
 * shadows instead of reading them as colours.
 *
 * A font size doesn't remove an earlier `leading-*`. In Tailwind 4 a `leading-*` utility wins
 * over a size's own line height whatever the class order, so both classes are kept. A size with a
 * line-height modifier (`text-small/6`) still replaces an earlier `leading-*`.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'detail', 'small', 'nav', 'body', 'reading', 'intro', 'subheading', 'heading', 'title'] }],
    },
    theme: { shadow: ['popover', 'menu', 'nav-menu'] },
  },
  override: {
    conflictingClassGroups: { 'font-size': [] },
  },
});
