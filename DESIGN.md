# Design system

Components are styled with Tailwind utilities, shadcn variants on Base UI and the theme tokens. There is no component stylesheet, and class names are utilities. Tests select by role, label or `data-*` attribute. Use the semantic tokens rather than hard-coded values.

## Where styles live

- `src/index.css` holds the tokens (colours, radii, the type scale, the popover and menu shadows, the `font-mono` family, the `reference`, `pdf-string`, `byte-selection`, `preview-highlight` and `brand-*` colour utilities, dark-mode mappings) and a `base` layer with the page reset: full-height `html`, `body` and `#root`, the `text-body` size on `body`, selection colours, thin scrollbars, pointer cursors on buttons, `text-small` monospace on `code` and `pre`, the focus outline on `button`, `a` and `select`, and the reduced-motion rule.
- `src/styles/breakpoints.css` defines the breakpoint tokens. See Layout.
- `src/styles/surfaces.css` defines the `surface-dark` utility, which gives an element the plum header colours in both themes by redefining the colour tokens, so everything inside follows it.
- `src/styles/shadcn.css` is the vendored shadcn stylesheet. Don't edit it.
- The CSS layers are Tailwind's own: `properties`, `theme`, `base`, `components` and `utilities`, in that order. Global element rules go in the `base` layer, below the utilities, so a utility or a shadcn variant overrides them without `!`. Tailwind's preflight, also in `base`, gives form controls `font: inherit`. Don't add a layer above the utilities or an unlayered element rule.
- No selector may restyle a shadcn component from outside. Change its variant or pass utilities to it.
- The vendored files in `src/components/ui` are edited where the app's look differs from shadcn's. The `Button`, `Input` and `TabsTrigger` variants set the control type the app renders: `text-body` in normal weight, the same as body text. Every button size uses it. A call site whose container uses other type passes its own size, such as `text-detail` in the panes or `text-sm` inside a tab panel, and that size's line height comes with it. `HeaderLink` in `content-navigation.tsx` gives header links the small ghost button's shape with their own `text-nav` medium type.
- The inspector panes share small components from `src/components/inspector/`: `PaneHeading`, `PaneBody`, `PaneIntro`, `PaneSubtitle` and `SectionHeading` in `pane.tsx`, `Note`, `IssueNote` and `Notice` in `notes.tsx`, and `Warning`, `LoadingMessage`, `SourceCode`, `ReferenceButton`, `ActionRow`, `ActionButton` and `SeverityPill` in their own files. Each owns its element and classes and passes `className` and the other props through. `Warning`, `LoadingMessage` and `SeverityPill` take a Base UI `render` prop for a different element, such as `render={<div />}` or `render={<Badge variant="outline" />}`. Pass extra classes through `className`, not on the `render` element: Base UI joins the element's own classes without tailwind-merge, so they can lose to the component's. A tab panel renders a pane body with `<TabsContent render={<PaneBody />}>`.
- `SEVERITY_TONE` in `src/components/inspector/severity-tone.ts` maps each issue severity to the `--issue-ink` and `--issue-soft` colours. It stays a class map because it goes on several kinds of element, often an ancestor of the pills, icons and counts that read the colours.
- The hex view keeps its grid and byte-column components in `src/components/hex-view.tsx`. The byte button and ASCII cell classes stay module constants there, because a row renders one of each per byte and the list is merged once instead of once per cell.
- The About page and the public articles share `src/components/reading-page.tsx` (page layout, section navigation and the related-reading list) and `src/components/prose.tsx`. `Prose` styles the plain HTML elements of an article from its wrapper and skips any element with a `class`, so a styled paragraph or link carries its own utilities. `Lead`, `ExamplePreview` and `ComparisonTable` cover the rest.
- Import `cn` from `@/lib/utils`, not from the `cn` package. The configured `cn` knows the type scale and the shadow tokens: the package's default reads `text-detail` as a colour and drops it next to `text-muted-foreground`, and reads `shadow-popover` as a shadow colour, so `shadow-none` wouldn't replace it. It also keeps a `leading-*` that comes before a size, because in Tailwind 4 a `leading-*` utility wins over a size's own line height whatever the class order.

## Look and feel

A compact developer workspace in the logo's colours: a deep plum header (`surface-dark`), white inspection surfaces, a pale lilac explorer, fine borders and small type that leave room for PDF structure and bytes. Geist is used for interface text and explanations. The `font-mono` token covers PDF syntax, code, object IDs, offsets and bytes. It starts with `ui-monospace`, which gives SF Mono in Safari; other browsers fall through to SF Mono, Menlo, Consolas or Liberation Mono, whichever is installed.

The app follows the device's light or dark setting until the visitor picks one with the header's sun and moon button. `public/theme.js` applies the choice before the first render. Dark mode keeps every colour role on plum surfaces.

## Type

Font sizes come from the type scale in `src/index.css`, named by what each size is for:

| Class             | Size   | Used for                                                                                     |
| ----------------- | ------ | -------------------------------------------------------------------------------------------- |
| `text-micro`      | 9px    | Hex column labels, explorer group labels, stream filter badges, status text on small screens |
| `text-caption`    | 10px   | Counts, small badges, offsets, uppercase eyebrow labels, the status bar                      |
| `text-detail`     | 11px   | Pane headings, explorer rows, actions, values and other secondary text                       |
| `text-small`      | 12px   | Pane text, notes, tables, `code` and `pre`                                                   |
| `text-nav`        | 12.8px | Header links                                                                                 |
| `text-body`       | 13px   | Body text and the controls                                                                   |
| `text-reading`    | 14px   | Article text, site navigation, the search field on mobile                                    |
| `text-intro`      | 15px   | The welcome screen's introduction                                                            |
| `text-subheading` | 16px   | Article and failure headings, the search field on iOS, where a smaller field zooms the page  |
| `text-heading`    | 18px   | Object titles and article lead paragraphs                                                    |
| `text-title`      | 21px   | Pane titles                                                                                  |

- Every size has a 1.5 line height, the page default, apart from `text-nav`, which keeps the `text-sm` line height. Reading text and notes set a looser `leading-*` next to the size, from 1.6 to 1.85.
- A size sets its own line height, so it doesn't take a line height inherited from its container. Inside a container with another line height, give the sized element its own `leading-*`. An element that follows the text around it in more than one kind of container, such as `ReferenceButton`, the dictionary rows in a tab panel or the severity pills, uses `leading-[inherit]`. It copies the container's line height only while the element's size has no breakpoint variant: a `narrow:text-*` on the same element falls back to the size's own line height, so give that element an explicit `leading-*` instead.
- Tailwind's `text-xs` and `text-sm` stay in the shadcn components and the panels that use them, with their own line heights: 16px and 20px. The scale is in pixels apart from `text-nav`; text that should follow the visitor's browser font size, such as figure captions, uses `text-sm`.
- Don't add `text-[Npx]`. Add a size to the scale and to the `font-size` group in `src/lib/utils.ts`. The fluid display headings (the article title, the welcome screen and the drop overlay) keep arbitrary `text-[clamp(…)]` sizes, and the status bar's links use `text-[length:inherit]` to match the text around them.

## Radii, shadows and spacing

- Radii come from the theme where one matches: `rounded-xs` (2px), `rounded-sm` (6px), `rounded-md` (8px) and `rounded-lg` (10px). The 4px and 5px corners of small controls and rows, and a few one-off shapes such as the drop overlay, keep arbitrary values.
- Floating surfaces use the shadow tokens: `shadow-popover` for the search results popover, `shadow-menu` for the search scope menu and `shadow-nav-menu` for the public pages' mobile menu. Add a token to `src/index.css` and to the `shadow` theme scale in `src/lib/utils.ts` for a new floating surface instead of writing `shadow-[…]`. Inset rings and the header's red rule stay arbitrary.
- Spacing and sizing use the spacing scale, where each step is 4px: `px-3.75` is 15px and `h-10.5` is 42px. Don't write `px-[15px]`; any whole number of pixels has a step. Bracketed values stay for `calc()`, `min()`, `max()` and CSS variables.

## Colour roles

- Red (`--primary`) is for primary actions only.
- Violet (`--reference`, `--ring`) marks navigable PDF references, keyboard focus and active navigation.
- Peach (`--byte-selection`) marks selected original bytes and their ASCII, kept distinct from violet navigation. Orange tokens are small source and graphic accents.
- Green (`--pdf-string`) is for PDF string syntax.
- Yellow (`--preview-highlight`) marks search matches over the rendered page preview. The page stays white in both themes, so the colour does too.
- `--destructive` is for invalid controls only.
- Document and reading surfaces stay white. Saturated colour is never used for large surfaces.
- Use a colour's utility where the theme has one (`text-reference`, `bg-byte-selection`), not `text-(--reference)`. Colours without a utility, such as `--brand-red-ink` and the local `--issue-*` and `--sample-*` colours, are written as `text-(--brand-red-ink)` or `bg-(--issue-soft)`.

## Brand artwork

The welcome screen and About page show `public/brand/pdf-internals-logo.png` in light mode and `pdf-internals-logo-dark.png` in dark mode, at their full aspect ratio. Headers use the square mascot `pdf-internals-icon.png`, and `public/favicon.png` is the favicon.

## Layout

- The workspace fills the viewport: header, three resizable panes (explorer, inspector, original bytes) that scroll independently, and a status bar.
- At 900px and below, buttons switch between panes instead, and the header stays on one row with icon-only actions. Breakpoints are theme tokens in `src/styles/breakpoints.css`. They use the `w360`, `w400`, `w480`, `w600`, `w760` and `w900` tokens: `max-w900:` and `width < theme(--breakpoint-w900)` both match widths below 901px.
- App components use only these breakpoints, not Tailwind's default `sm:` to `2xl:`; only the vendored shadcn files keep those. The object comparison puts the pinned and current columns side by side from 601px (`min-w600:`).
- The mobile ranges have named variants, defined in the same file: `narrow:` for 900px and below, and `w360-w900:` for 361px to 900px. Use them instead of `max-w900:` and `min-w360:max-w900:`.
- Named variants come after every built-in variant in the CSS, so a `narrow:` class beats a class on the same property whose variants add no selector specificity: smaller breakpoints, `md:`, `pointer-coarse:` and shadcn's `data-open:`-style variants. `narrow:gap-3` beats `max-w600:gap-2`, for example. `hover:`, `dark:`, `aria-*:` and `data-[…]:` still win through specificity. When a smaller breakpoint has to win, bound the range (`min-w600:narrow:max-w-[25vw]`) or stack it under the named variant that sets the property (`narrow:max-w480:block`, or `w360-w900:max-w480:` against a `w360-w900:` class).
- Search fits on one row on mobile, dropping to two rows at 360px and below. Touch targets are at least 44px.
- Public pages use a white reading layout with a section sidebar that becomes an expandable menu on narrow screens. Their footer shows only when no document is open.

## Components

- Buttons: solid red for the main action; outline, secondary and ghost variants for everything else.
- Inspector tabs: a flat line list, with the active tab in violet and a red underline.
- Badges label data and are never actions.
- References are violet, underline on hover and keep a visible focus ring.
- Keyboard focus on buttons, tab triggers, links and selects is one 2px solid `--ring` outline with a 2px offset, the same on native and shadcn controls. The `base` rule in `index.css` gives it to every `button`, `a` and `select` that doesn't set its own outline. The shadcn button and tab trigger variants set the same outline in place of shadcn's ring and border, so a focused control never shows more than one ring. The search scope and the search result rows draw the 2px ring inside their edge so it isn't clipped. The shadcn `Input` keeps its violet border and soft ring, and the search field shows that highlight only while the query input has focus.
- The byte grid keeps offsets, hex and ASCII in fixed-width columns, and selected bytes use the peach selection colours.
- Notices use neutral surfaces with an icon and short explanatory text.
- Transitions and animations respect reduced-motion preferences.

## Writing Tailwind classes

- Write classes at the element they style. A list used by a single element goes inline.
- When several elements share a list, extract a small component that renders the element with those classes, even when the list is short. Name it after what it renders (`SectionHeading`, `Note`, `ReferenceButton`), not how it looks (`MutedText`). It passes `className` through `cn()` and spreads the other props, so a call site can add classes. A component used by one module stays in that module; one used across modules goes in a module of its own, such as `src/components/inspector/`.
- A class constant is only for a list that has to go on different kinds of element, such as a class map keyed by severity or a list given to both a `Button` and a `HeaderLink`, or one kept out of a hot render path. Say why in a comment. Don't keep a class constant just to keep a component under react-doctor's size limit: extract a subcomponent instead.
- A single utility, such as `text-muted-foreground`, stays inline even when it repeats.
- A list of up to about 100 characters stays one plain string.
- A longer list uses `cn()` and splits into groups, in this order: positioning, layout, sizing, spacing, typography, appearance, borders and effects, interaction, component states (`hover:`, `focus-visible:`, `data-*`, `aria-*`), responsive, dark mode, animation, overrides (`!` modifiers). Skip the groups an element doesn't use.
- Short neighbouring groups share a string, such as layout and spacing in `'flex items-center gap-2 px-3'`. States, responsive, dark mode and overrides always get their own string.
- Each group is its own `cn()` argument, so formatting keeps the groups apart. Oxfmt sorts the classes inside each string, and `preserveWhitespace` in `.oxfmtrc.json` leaves the spacing inside a string as written.
- Conditional classes go last in the call, as `condition && 'classes'` or an array.
- Font families come from the tokens: `font-sans`, `font-heading` and `font-mono`. Don't set an arbitrary family; add a token to `src/index.css` instead.
- Add a comment to a group only when its reason isn't visible in the classes.
- Write a static style as a utility, not a `style` prop. A `style` prop is for values computed at render time, such as virtualised row offsets, the preview zoom and CSS variables set from props.

```tsx
className={cn(
  'flex h-10.5 w-full items-center',
  'gap-2.5 px-2.25 text-left text-detail text-muted-foreground',
  'rounded-[4px] bg-transparent',
  'hover:bg-accent hover:text-foreground',
  'narrow:h-11',
  selected && 'bg-accent text-accent-foreground'
)}
```

## Rules

- Distinguish original file bytes, decoded data and the rendered preview.
- Keep saturated colour tied to actions, navigation or selection.
- Do not use reference violet as decoration or for byte selection.
- Do not replace the panes with a dashboard of cards, remove focus indicators or force desktop panes side by side on mobile.
