---
name: PDF Internals Viewer
description: A logo-inspired, read-only workspace for navigating PDF objects and original bytes.
colors:
  background: "#ffffff"
  foreground: "#281a3c"
  primary: "#cc1746"
  primary-foreground: "#ffffff"
  secondary: "#f0e8fa"
  secondary-foreground: "#54268e"
  muted: "#f7f3fa"
  muted-foreground: "#74667f"
  accent: "#f0e8fa"
  accent-foreground: "#54268e"
  border: "#e7deed"
  input: "#d7c9e3"
  ring: "#6935ac"
  sidebar: "#faf7fd"
  destructive: "#ba2532"
  reference: "#6935ac"
  brand-orange: "#e97820"
  brand-orange-ink: "#a24b12"
  byte-selection: "#ffead1"
  byte-selection-foreground: "#62300f"
  pdf-string: "#386644"
  selection-background: "#e9dafa"
  selection-foreground: "#391d59"
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
    backgroundColor: "{colors.byte-selection}"
    textColor: "{colors.byte-selection-foreground}"
    typography: "{typography.hex}"
    rounded: "{rounded.byte}"
    width: "23px"
    padding: "3px 0"
---

# Design system: PDF Internals Viewer

## Overview

The interface brings the logo's dark purple ink, goggle red, violet layers, and warm orange into a compact developer workspace. A deep plum header anchors the application. White inspection surfaces, a pale lilac explorer, fine borders, and compact type leave room for PDF structure and original bytes.

Geist supports navigation and explanations; system monospace distinguishes PDF syntax, object identifiers, offsets, and bytes. Color has a role: red actions, violet navigation, orange source and byte highlights. The existing pane layout, typefaces, and control sizes remain the foundation.

The theme is implemented in `src/index.css`, `src/app.css`, `src/components/hex-view.css`, and the shared controls. Dark token mappings retain the same roles on plum surfaces; light mode is the public default.

## Brand artwork

Use the supplied full-color PDF Internals illustration from `public/brand/pdf-internals-logo.png` on the welcome screen and About page. Keep its full aspect ratio and original colors, with responsive sizing on white. The compact workspace header frames the detective mascot from the same artwork as its brand mark.

## Colors

Use the values in the frontmatter as the specification. Brand colors should communicate hierarchy and selection while keeping dense data readable.

### Primary

- Plum ink `#281a3c`: typography and the solid header. The header uses warm white text, lilac metadata, and a thin red lower edge.
- Goggle red `#cc1746`: primary actions and the welcome heading's emphasis. Buttons darken to `#ad1039` on hover, with white labels. Avoid gradient buttons.
- Violet `#6935ac`: navigable PDF references, keyboard focus, active navigation, and the simple-page sample. Lilac washes support selections and secondary controls. Active inspector tabs use violet labels with a red underline.

### Secondary

- Orange `#e97820`: small graphic accents. Use the darker `#a24b12` for source icons and the compressed-stream sample icon. Use peach `#ffead1` with dark brown `#62300f` for selected original bytes and matching ASCII, distinguishing byte selection from violet navigation.
- Rose: the fonts-and-resources sample uses red ink on a pale rose tile.
- String green `#386644`: preserve PDF string syntax independently of the brand palette.
- Destructive red `#ba2532`: invalid-control treatments remain distinct from normal action styling through icons, labels, and their tinted treatment.

### Surfaces and contrast

- Keep document and public reading surfaces white. The original logo has a white background.
- Use near-white lilac `#faf7fd` for the explorer/status surfaces; `#f7f3fa` for muted areas; `#e7deed` for structural borders.
- Use muted plum `#74667f` for metadata and supporting text. Bright orange is decorative; orange text uses the darker ink token.
- Native text selection stays lilac with dark purple text. Original-byte selection has its own peach tokens and must not inherit the action red.
- Dark mappings use plum backgrounds, lighter violet links, pale rose text accents, and deeper peach byte selections. The header retains its dark plum identity.

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

The empty workspace places the logo by itself on the left and stacks the introduction and sample list on the right within a 1040px measure on desktop. On narrow screens, the logo appears above the content within 440px. Its headline and top padding are responsive. Loaded inspector content uses the recorded inspector-content inset; pane headings and hex controls use the pane-heading inset. PDF dictionaries align keys and values in a two-column grid with a minimum key track (90px), proportion (32%), and gap (12px).

## Elevation and depth

The workspace is flat: backgrounds, subtle tonal changes, and single-pixel dividers establish hierarchy. Pane containers have no card elevation. Selected object rows add an inset border. Hex hover uses an inset border shadow. A rendered PDF page uses the shared small shadow against a muted canvas; shared default tabs also provide a small active shadow, while the implemented inspector uses the flat line variant.

Keyboard focus uses visible ring or outline treatments. General interactive elements have a ring-colored outline (2px) and offset (2px); shared controls also provide their shadcn ring treatment. These treatments indicate interaction state.

## Shapes

Workspace panes have square shared boundaries. Compact data controls use small corners: byte cells, badges, navigation rows, fields, and shared buttons follow the extracted radius roles. The root shadcn radius is (0.625rem); its small, medium, and large steps are recorded above. Small and extra-small buttons use the medium radius; default buttons use the large radius. Object-kind and pane-count badges use the compact radius, replacing the library's default pill shape.

## Components

### Buttons

Buttons use shadcn controls implemented with Base UI. The default variant is solid goggle red with white text and a darker red hover; outline, secondary, and ghost variants support navigation and secondary actions. Default height is recorded above; extra-small, small, and large sizes are (24px), (28px), and (36px). Icon sizes follow the same height scale. Open PDF in the header uses the small size; the empty-state action has a local height override (40px).

Primary hover uses solid darker red `#ad1039`. Outline and ghost hover use muted surfaces; secondary hover mixes a small amount of foreground into its background. Keyboard focus uses the ring token. Active non-popup buttons move down (1px); disabled controls reduce opacity to (50%) and stop pointer interaction. Destructive and link variants exist in the shared library but do not establish additional workspace actions.

### Inputs and fields

The shared Base UI input provides a bordered, rounded field with placeholder-muted text, focus ring, and invalid/disabled states. The workspace search composes it into a bordered search group, locally removing the inner border, radius, and shadow. Search text is (11px); the adjacent scope select is (10px). The offset jump field uses a compact monospace input, the row radius, and an explicit focus outline.

### Navigation

Explorer rows sit on the near-white lilac sidebar. Default labels are muted; hover and active states use the lilac accent surface and purple text. Active rows gain medium weight. Object rows use the same selection colors with an inset border. They are 42px tall and truncate secondary labels. Mobile pane buttons use secondary for the current pane and ghost for others.

Pages uses an indented list of expandable connections. Separate native buttons expand a branch and select its object. Rows wrap friendly labels and exact keys above monospace object IDs; inherited, shared, cyclic and unavailable connections use muted supporting text. Selected rows retain the explorer’s lilac inset border. Other sections keep the flat object index.

Object headings include a short role explanation. Incoming and outgoing relationships use wrapping rows with dictionary/index paths and linked object IDs, preserving the existing reference color and global keyboard focus treatment.

Comparison and object inspection use independently scrolling panels separated by a 12px neutral horizontal divider with a visible grip. Dragging or focusing the divider and using arrow keys resizes the panels. The header’s User guide opens a scrollable reading surface using the existing dialog typography and spacing.

### Tabs

Base UI tabs organize Properties, Source, Raw stream, and Decoded. The inspector uses a full-width transparent line list with a lower divider. An active tab uses violet text and a narrow red underline; inactive text is subdued. Compact text and horizontal gaps preserve inspector density.

### Badges

Object-kind badges use the secondary variant; count and stream metadata badges use outline. Inspector badges have compact corners and (10px) text; stream metadata can reduce to (9px). They label data and are not primary actions.

### PDF values and references

Dictionary entries use thin row dividers, muted monospace keys, and wrapping values. Names remain foreground, strings use string green, and indirect references use violet. Reference buttons stay on a transparent background and underline on hover. Arrays and reference lists wrap with small gaps.

### Original-byte grid

Offsets, hex cells, and ASCII align in fixed-width columns. Hex cells are (23px) wide and ASCII positions (8px); narrow layouts reduce them to (22px) and (7px). Zero bytes and offsets are muted. Hover adds an inset border; the byte cursor has a ring outline. Selected bytes and corresponding ASCII use the peach selection background and dark brown foreground. Horizontal scrolling preserves byte alignment.

### Notices, samples, and preview

Notices and warnings use neutral surfaces, small explanatory type, icons, and borders. The empty state's sample choices are divider-separated rows with small violet, rose, and orange icon tiles; their trailing arrow moves slightly on hover (150ms, ease-out). Rendered preview has a compact toolbar and a muted canvas, keeping the document image visually distinct from the original-byte grid. Tooltips use inverse foreground/background colors, compact padding, and the shared medium radius.

The application honors reduced-motion preferences by shortening transitions and animations; the preview loading icon also disables spinning under reduced motion.

## Usage rules

### Recommended

- Use the existing semantic theme tokens and shadcn Base UI controls.
- Use monospace for object syntax, offsets, bytes, and references.
- Preserve the violet reference affordance and visible keyboard focus.
- Keep pane content independently scrollable and use the existing mobile pane switcher.
- Distinguish original file bytes from decoded data and rendered preview.

### Restrictions

- Keep saturated color tied to actions, navigation, or source/selection cues; avoid broad colored document surfaces.
- Do not replace the workspace panes with a dashboard of cards.
- Do not use reference violet as a general decorative surface or byte selection color.
- Do not remove focus indicators or force desktop panes side by side on mobile.

## Public pages

The homepage remains the tool entry point. Its introductory heading uses 32–48px Geist, with 15px supporting copy. At widths above 760px, the logo occupies the left column while the introduction and sample rows stack on the right; below that, the logo appears above the content. A quiet footer provides About, Feedback, and GitHub links, and disappears while inspecting a document.

About is a reading surface at `/about`, using a 640px article measure, a 30–40px heading, 18px introductory copy, 16px section headings, and 14px body copy. It shares the plum workspace header, white reading surfaces, and existing limitations dialog. Navigating between public pages keeps the document state in memory; refreshing resets the open document and navigation; bookmarks and notes restore from browser storage when the same PDF is reopened.
