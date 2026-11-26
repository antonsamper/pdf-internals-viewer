import { cn } from 'cn';

import type { IssueSeverity } from '@/lib/pdf/issues';

/* Class strings shared by the inspector panes. */

/** A pane's title row: fixed height, bottom border, small type. */
export const PANE_HEADING = 'flex h-[42px] min-h-[42px] shrink-0 items-center gap-2 border-b px-3.5 text-[11px] font-medium';

/** A scrolling inspector body. */
export const INSPECTOR_SCROLL = 'min-h-0 flex-1 overflow-auto p-[22px] max-w480:p-[18px]';

/** Section headings inside inspector bodies. */
export const SECTION_HEADING = 'mt-7 mb-3 text-[12px] font-[550]';

/** A navigable PDF reference: violet monospace text that underlines on hover. */
export const REFERENCE = cn(
  'inline-flex items-baseline gap-[5px]',
  'font-mono text-[11px] whitespace-nowrap text-reference',
  'bg-transparent',
  'hover:underline hover:underline-offset-[3px]'
);

/** Small explanatory text under a heading. */
export const REPRESENTATION_NOTE = 'mb-[15px] text-[10px] leading-[1.7] text-muted-foreground';

/** A full-width notice under a pane heading. */
export const NOTICE = cn(
  'flex items-start gap-[9px] px-[15px] py-2.5',
  'bg-muted text-[11px] leading-[1.65] [overflow-wrap:anywhere]',
  'border-b'
);

/** A spinner and its caption while content loads. */
export const LOADING_INLINE = 'flex items-center gap-2 p-[15px] text-[12px] text-muted-foreground';

/** An inline warning card. */
export const WARNING_INLINE = cn(
  'my-3 flex items-start gap-[9px] px-[15px] py-2.5',
  'bg-muted text-[11px] leading-[1.65] [overflow-wrap:anywhere]',
  'rounded-[5px] border'
);

/** Raw syntax or stream text. */
export const SOURCE_CODE = 'text-[11px] leading-[1.85] whitespace-pre-wrap [tab-size:2] [overflow-wrap:anywhere]';

/** A row of buttons under an inspector heading. */
export const ACTION_ROW = 'flex flex-wrap gap-2';

/** Buttons in an action row use compact type. */
export const ACTION_BUTTON = 'text-[11px]';

/** The icon, title and subtitle at the top of the overview and issues panes. */
export const OVERVIEW_ICON = 'mb-4 text-brand-purple';
export const OVERVIEW_TITLE = 'mb-2 text-[21px] font-[550] tracking-[-0.025em]';
export const OVERVIEW_SUBTITLE = 'mb-[26px] text-[12px] text-muted-foreground [overflow-wrap:anywhere]';

/** Muted body text in the overview and inspector panes. */
export const BODY_MUTED = 'text-[11px] leading-[1.8] text-muted-foreground';

/** Sets `--issue-ink` and `--issue-soft` for a severity, so its pills, icons and cards share two colours. */
const MUTED_TONE = '[--issue-ink:var(--muted-foreground)] [--issue-soft:var(--muted)]';
export const SEVERITY_TONE: Record<IssueSeverity, string> = {
  error: '[--issue-ink:var(--destructive)] [--issue-soft:var(--brand-red-soft)]',
  info: MUTED_TONE,
  limitation: MUTED_TONE,
  warning: '[--issue-ink:var(--brand-orange-ink)] [--issue-soft:var(--brand-orange-soft)]',
};

/** A severity pill, as in the issue summary and the issue titles. */
export const SEVERITY_PILL = cn(
  'inline-flex items-center gap-1.5 text-(--issue-ink)',
  'bg-(--issue-soft)',
  'border border-[color-mix(in_srgb,var(--issue-ink)_25%,transparent)]'
);
