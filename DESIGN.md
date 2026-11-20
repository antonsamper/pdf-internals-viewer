---
name: PDF Internals Viewer
description: A neutral, read-only workspace for navigating PDF objects and original bytes.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  sidebar: "oklch(0.985 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  reference: "#215bc2"
  pdf-string: "#386644"
  selection-background: "#c9dcff"
  selection-foreground: "#172b4d"
typography:
  headline:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "clamp(32px, 3.8vw, 48px)"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "21px"
    fontWeight: 550
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "13px"
  label:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "11px"
    fontWeight: 500
  metadata:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "10px"
  object-title:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: "18px"
    fontWeight: 500
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: "11px"
  hex:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: "11px"
rounded:
  byte: "2px"
  compact: "4px"
  row: "5px"
  field: "6px"
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  pane-heading: "14px"
  mobile-content: "18px"
  inspector-content: "22px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  search-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    height: "30px"
    padding: "0 4px 0 9px"
  explorer-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.row}"
    typography: "{typography.label}"
    padding: "8px 10px"
  badge-kind:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.compact}"
    height: "20px"
    padding: "2px 8px"
  inspector-tabs:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    height: "37px"
    padding: "0 18px"
  reference:
    backgroundColor: "transparent"
    textColor: "{colors.reference}"
    typography: "{typography.code}"
  hex-byte-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.hex}"
    rounded: "{rounded.byte}"
    width: "23px"
    padding: "3px 0"
---

# Design system: PDF Internals Viewer

## Overview

The interface uses the shadcn neutral defaults and Base UI controls chosen by the user. Inspection surfaces are white, with a lightly tinted explorer, thin dividers, and compact type to leave room for PDF structure and original bytes. Theme and brand exploration are low priority.

The workspace is designed for dense data on desktop, with compact controls. Geist supports navigation and explanations; system monospace distinguishes PDF syntax, object identifiers, offsets, and bytes. Blue references provide the clearest navigational color cue.

The interface uses:

- Neutral light surfaces with thin structural borders.
- Compact controls and dense, independently scrolling data panes.
- System monospace for syntax and original-byte inspection.
- Blue object references; dark neutral byte selection.

The light interface is implemented in `src/index.css`, `src/app.css`, `src/components/hex-view.css`, and the existing UI components. The source also contains dark theme mappings, which have not had a separate visual review. The design uses neutral defaults without a creative metaphor.

## Colors

The palette is primarily achromatic. Color identifies navigation and syntax. Use the values in the frontmatter as the specification.

### Primary

- Dark neutral: primary actions and selected byte ranges, paired with near-white text.
- Reference blue: navigable PDF object references, with an underline on hover.

### Secondary

- String green: PDF string values, distinct from object references and neutral syntax.
- Destructive red: invalid-control treatments available in the shared primitives; ordinary warning surfaces remain neutral in the current UI.

### Neutral

- White workspace: the app background and inspection surfaces.
- Near-white explorer: navigation and bottom status surfaces.
- Soft gray: selected navigation, control hover, search result surrounds, and notices.
- Dark ink: primary text and object names.
- Muted gray: metadata, offsets, labels, secondary explanations, and zero bytes.
- Light gray border: pane dividers, row separators, fields, and selection outlines.
- Mid gray ring: keyboard focus and byte cursor outlines.
- Pale blue selection / dark blue selection ink: native text selection only.

Use reference blue for navigable object relationships; selected original bytes use the primary neutral pair.

## Typography

Body font: Geist Variable, falling back to sans-serif. No separate display face is used.

Syntax font: SFMono-Regular, Consolas, Liberation Mono, monospace for general code. Individual PDF syntax uses the shorter SFMono-Regular, Consolas, monospace stack. Hex uses the system UI monospace stack recorded above.

### Hierarchy

- Headline: the responsive empty-workspace heading; medium weight and tight tracking.
- Title: document overview heading. Object titles use the distinct monospace object-title role.
- Body: application base text; introductory copy is larger (14px) with generous line height (1.75).
- Label: pane headings and compact navigation, with contextual weights. Shared button defaults are 14px; workspace overrides commonly use 10 to 11px.
- Metadata: provenance, file sizes, and status. Section overlines and hex column headings reduce to 9px.
- Code / Hex: dense technical data. General code defaults to 12px; PDF values, source streams, and hex rows use the code-size roles above. Source text has relaxed line height (1.85).

Keep byte syntax and object identifiers in system monospace while navigation and explanatory copy remain in Geist.

## Layout

The app fills the viewport (`100dvh`). A 58px header and 29px bottom status bar frame the flexible workspace. Loaded documents add a toolbar at least 45px tall. Pane headings are 42px tall, and the hex toolbar is at least 45px tall.

On desktop, three horizontally resizable panes divide the workspace: explorer (20%), inspector (43%), and original bytes (37%). The explorer ranges from 180px to 35% wide. The inspector is at least 300px wide; original bytes is at least 290px wide. Thin handles separate the panes, which scroll independently.

At 900px and below, Explorer, Inspector, and Bytes buttons switch between panes. Search takes the toolbar's full width, header spacing tightens, and fewer secondary status details appear. At 480px and below, header decorations and the secondary status group disappear, and the inspector uses the mobile content padding. Hex columns tighten further at 400px.

The empty workspace places the introduction and sample list side by side within a 920px measure on desktop, stacking them within 440px on narrow screens. Its headline and top padding are responsive. Loaded inspector content uses the recorded inspector-content inset; pane headings and hex controls use the pane-heading inset. PDF dictionaries align keys and values in a two-column grid with a minimum key track (90px), proportion (32%), and gap (12px).

## Elevation and depth

The workspace is flat: backgrounds, subtle tonal changes, and single-pixel dividers establish hierarchy. Pane containers have no card elevation. Selected object rows add an inset border. Hex hover uses an inset border shadow. A rendered PDF page uses the shared small shadow against a muted canvas; shared default tabs also provide a small active shadow, while the implemented inspector uses the flat line variant.

Keyboard focus uses visible ring or outline treatments. General interactive elements have a ring-colored outline (2px) and offset (2px); shared controls also provide their shadcn ring treatment. These treatments indicate interaction state.

## Shapes

Workspace panes have square shared boundaries. Compact data controls use small corners: byte cells, badges, navigation rows, fields, and shared buttons follow the extracted radius roles. The root shadcn radius is (0.625rem); its small, medium, and large steps are recorded above. Small and extra-small buttons use the medium radius; default buttons use the large radius. Object-kind and pane-count badges use the compact radius, replacing the library's default pill shape.

## Components

### Buttons

Buttons use shadcn controls implemented with Base UI. The default variant is dark neutral; outline, secondary, and ghost variants support navigation and secondary actions. Default height is recorded above; extra-small, small, and large sizes are (24px), (28px), and (36px). Icon sizes follow the same height scale. Open PDF in the header uses the small size; the empty-state action has a local height override (37px).

Primary hover reduces the background opacity to (80%). Outline and ghost hover use muted surfaces; secondary hover mixes a small amount of foreground into its background. Keyboard focus uses the ring token. Active non-popup buttons move down (1px); disabled controls reduce opacity to (50%) and stop pointer interaction. Destructive and link variants exist in the shared library but do not establish additional workspace actions.

### Inputs and fields

The shared Base UI input provides a bordered, rounded field with placeholder-muted text, focus ring, and invalid/disabled states. The workspace search composes it into a bordered search group, locally removing the inner border, radius, and shadow. Search text is (11px); the adjacent scope select is (10px). The offset jump field uses a compact monospace input, the row radius, and an explicit focus outline.

### Navigation

Explorer rows sit on the near-white sidebar. Default labels are muted; hover and active states use the soft-gray accent surface and foreground text. Active rows gain medium weight. Object rows use the same selection colors with an inset border. They are 42px tall and truncate secondary labels. Mobile pane buttons use secondary for the current pane and ghost for others.

Pages uses an indented list of expandable connections. Separate native buttons expand a branch and select its object. Rows wrap friendly labels and exact keys above monospace object IDs; inherited, shared, cyclic and unavailable connections use muted supporting text. Selected rows retain the explorer’s neutral inset border. Other sections keep the flat object index.

Object headings include a short role explanation. Incoming and outgoing relationships use wrapping rows with dictionary/index paths and linked object IDs, preserving the existing reference color and global keyboard focus treatment.

### Tabs

Base UI tabs organize Properties, Source, Raw stream, and Decoded. The inspector uses a full-width transparent line list with a lower divider. An active tab uses foreground text and a narrow underline; inactive text is subdued. Compact text and horizontal gaps preserve inspector density.

### Badges

Object-kind badges use the secondary variant; count and stream metadata badges use outline. Inspector badges have compact corners and (10px) text; stream metadata can reduce to (9px). They label data and are not primary actions.

### PDF values and references

Dictionary entries use thin row dividers, muted monospace keys, and wrapping values. Names remain foreground, strings use string green, and indirect references use blue. Reference buttons stay on a transparent background and underline on hover. Arrays and reference lists wrap with small gaps.

### Original-byte grid

Offsets, hex cells, and ASCII align in fixed-width columns. Hex cells are (23px) wide and ASCII positions (8px); narrow layouts reduce them to (22px) and (7px). Zero bytes and offsets are muted. Hover adds an inset border; the byte cursor has a ring outline. Selected bytes and corresponding ASCII use the dark primary background and near-white foreground. Horizontal scrolling preserves byte alignment.

### Notices, samples, and preview

Notices and warnings use neutral surfaces, small explanatory type, icons, and borders. The empty state's sample choices are divider-separated rows with small muted icon tiles; their trailing arrow moves slightly on hover (150ms, ease-out). Rendered preview has a compact toolbar and a muted canvas, keeping the document image visually distinct from the original-byte grid. Tooltips use inverse foreground/background colors, compact padding, and the shared medium radius.

The application honors reduced-motion preferences by shortening transitions and animations; the preview loading icon also disables spinning under reduced motion.

## Usage rules

### Recommended

- Use the existing semantic neutral tokens and shadcn Base UI controls.
- Use monospace for object syntax, offsets, bytes, and references.
- Preserve the blue reference affordance and visible keyboard focus.
- Keep pane content independently scrollable and use the existing mobile pane switcher.
- Distinguish original file bytes from decoded data and rendered preview.

### Restrictions

- Do not introduce a new brand theme or decorative typeface without a user request.
- Do not replace the workspace panes with a dashboard of cards.
- Do not use reference blue as a general decorative surface or byte selection color.
- Do not remove focus indicators or force desktop panes side by side on mobile.

## Public pages

The homepage remains the tool entry point. Its introductory heading uses 32–48px Geist, with 15px supporting copy. At widths above 760px, the introduction and three sample rows share a two-column layout; below that, they stack in reading order. A quiet footer provides About, Feedback, and GitHub links, and disappears while inspecting a document.

About is a reading surface at `/about`, using a 640px article measure, a 30–40px heading, 18px introductory copy, 16px section headings, and 14px body copy. It shares the workspace header, neutral surfaces, and existing limitations dialog. Navigating between public pages keeps the document state in memory; refreshing still resets the session.
