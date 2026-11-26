import type { IssueSeverity } from '@/lib/pdf/issues';

/**
 * Sets `--issue-ink` and `--issue-soft` for a severity, so its pills, icons, counts and cards share two colours.
 * It stays a map because it goes on several kinds of element, often an ancestor of the ones that read the colours.
 */
export const SEVERITY_TONE: Record<IssueSeverity, string> = {
  error: '[--issue-ink:var(--destructive)] [--issue-soft:var(--brand-red-soft)]',
  info: '[--issue-ink:var(--muted-foreground)] [--issue-soft:var(--muted)]',
  limitation: '[--issue-ink:var(--muted-foreground)] [--issue-soft:var(--muted)]',
  warning: '[--issue-ink:var(--brand-orange-ink)] [--issue-soft:var(--brand-orange-soft)]',
};
