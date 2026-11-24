# Design system

The exact values (colours, type sizes, spacing, radii and dark-mode mappings) live in `src/index.css`, `src/app.css` and `src/components/hex-view.css`. Breakpoints are theme tokens in `src/styles/breakpoints.css`. The `surface-dark` utility in `src/styles/surfaces.css` gives an element the plum header colours in both themes by redefining the colour tokens, so everything inside follows it. `src/app.css` and `src/components/hex-view.css` are imported into the `legacy` layer, which sits above Tailwind's utilities, so their rules still win over them. Their global rules for `button`, `input`, `select` and `code` (font and focus outline) outrank utilities too, so utilities that set font or outline on those elements take the `!` modifier. This document describes how to use them. Use the semantic tokens and shadcn controls on Base UI rather than hard-coded values.

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

## Rules

- Distinguish original file bytes, decoded data and the rendered preview.
- Keep saturated colour tied to actions, navigation or selection.
- Do not use reference violet as decoration or for byte selection.
- Do not replace the panes with a dashboard of cards, remove focus indicators or force desktop panes side by side on mobile.
