# Design system

The exact values (colours, type sizes, spacing, radii and dark-mode mappings) live in `src/index.css`, `src/app.css` and `src/components/hex-view.css`. Breakpoints are theme tokens in `src/styles/breakpoints.css`. The `surface-dark` utility in `src/styles/surfaces.css` gives an element the plum header colours in both themes by redefining the colour tokens, so everything inside follows it. `src/app.css` and `src/components/hex-view.css` are imported into the `legacy` layer, which sits above Tailwind's utilities, so their rules still win over them. Their global rules for `button`, `input`, `select`, `code` and `pre` (font and focus outline) outrank utilities too, so utilities that set font or outline on those elements take the `!` modifier. `cn` drops a `leading-*` that comes before a later `text-[..]`, so put `leading-*` last. The inspector panes style themselves with Tailwind utilities and share class strings from `src/components/inspector-styles.ts` (pane headings, references, notes, warnings and severity colours). The About page and the public articles share `src/components/reading-page.tsx` (page layout, section navigation and the related-reading list) and `src/components/prose.tsx`. `Prose` styles the plain HTML elements of an article from its wrapper and skips any element with a `class`, so a styled paragraph or link carries its own utilities. `Lead`, `ExamplePreview` and `ComparisonTable` cover the rest. `src/index.css` provides the `font-pdf` family for PDF syntax and the `reference`, `pdf-string` and `brand-*` colour utilities. This document describes how to use them. Use the semantic tokens and shadcn controls on Base UI rather than hard-coded values.

## Look and feel

A compact developer workspace in the logo's colours: a deep plum header (`surface-dark`), white inspection surfaces, a pale lilac explorer, fine borders and small type that leave room for PDF structure and bytes. Geist is used for interface text and explanations; system monospace for PDF syntax, object IDs, offsets and bytes.

The app follows the device's light or dark setting until the visitor picks one with the header's sun and moon button. `public/theme.js` applies the choice before the first render. Dark mode keeps every colour role on plum surfaces.

## Colour roles

- Red (`--primary`) is for primary actions only.
- Violet (`--reference`, `--ring`) marks navigable PDF references, keyboard focus and active navigation.
- Peach (`--byte-selection`) marks selected original bytes and their ASCII, kept distinct from violet navigation. Orange tokens are small source and graphic accents.
- Green (`--pdf-string`) is for PDF string syntax.
- `--destructive` is for invalid controls only.
- Document and reading surfaces stay white. Saturated colour is never used for large surfaces.

## Brand artwork

The welcome screen and About page show `public/brand/pdf-internals-logo.png` in light mode and `pdf-internals-logo-dark.png` in dark mode, at their full aspect ratio. Headers use the square mascot `pdf-internals-icon.png`, and `public/favicon.png` is the favicon.

## Layout

- The workspace fills the viewport: header, three resizable panes (explorer, inspector, original bytes) that scroll independently, and a status bar.
- At 900px and below, buttons switch between panes instead, and the header stays on one row with icon-only actions. Breakpoints use the `w360`, `w400`, `w480`, `w600`, `w760` and `w900` tokens: `max-w900:` and `width < theme(--breakpoint-w900)` both match widths below 901px.
- Search fits on one row on mobile, dropping to two rows at 360px and below. Touch targets are at least 44px.
- Public pages use a white reading layout with a section sidebar that becomes an expandable menu on narrow screens. Their footer shows only when no document is open.

## Components

- Buttons: solid red for the main action; outline, secondary and ghost variants for everything else.
- Inspector tabs: a flat line list, with the active tab in violet and a red underline.
- Badges label data and are never actions.
- References are violet, underline on hover and keep a visible focus ring.
- The byte grid keeps offsets, hex and ASCII in fixed-width columns, and selected bytes use the peach selection colours.
- Notices use neutral surfaces with an icon and short explanatory text.
- Transitions and animations respect reduced-motion preferences.

## Writing Tailwind classes

- Write classes at the element they style. A class constant is for a list that several elements share; one used by a single element goes inline.
- A list of up to about 100 characters stays one plain string.
- A longer list uses `cn()` and splits into groups, in this order: positioning, layout, sizing, spacing, typography, appearance, borders and effects, interaction, component states (`hover:`, `focus-visible:`, `data-*`, `aria-*`), responsive, dark mode, animation, overrides (`!` modifiers). Skip the groups an element doesn't use.
- Short neighbouring groups share a string, such as layout and spacing in `'flex items-center gap-2 px-3'`. States, responsive, dark mode and overrides always get their own string.
- Each group is its own `cn()` argument, so formatting keeps the groups apart. Oxfmt sorts the classes inside each string, and `preserveWhitespace` in `.oxfmtrc.json` leaves the spacing inside a string as written.
- Conditional classes go last in the call, as `condition && 'classes'` or an array.
- Arbitrary font families use the `family-name:` hint, as in `font-[family-name:SFMono-Regular,monospace]`, or the `[font-family:…]` property form. Without either, `cn` reads `font-[…]` as a font weight and a later `font-medium` drops it.
- Add a comment to a group only when its reason isn't visible in the classes.

```tsx
className={cn(
  'flex h-[42px] w-full items-center',
  'gap-2.5 px-[9px] text-left text-muted-foreground',
  'rounded-[4px] bg-transparent',
  'hover:bg-accent hover:text-foreground',
  'max-w900:h-11',
  'text-[11px]!',
  selected && 'bg-accent text-accent-foreground'
)}
```

## Rules

- Distinguish original file bytes, decoded data and the rendered preview.
- Keep saturated colour tied to actions, navigation or selection.
- Do not use reference violet as decoration or for byte selection.
- Do not replace the panes with a dashboard of cards, remove focus indicators or force desktop panes side by side on mobile.
