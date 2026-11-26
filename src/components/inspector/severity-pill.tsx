import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cn } from 'cn';

/** A severity pill, as in the issue summary and the issue titles. Set its colours with `SEVERITY_TONE` on it or an ancestor. */
export const SeverityPill = function SeverityPill({ className, render, ...props }: useRender.ComponentProps<'span'>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(
          'inline-flex items-center gap-1.5 text-(--issue-ink)',
          'bg-(--issue-soft)',
          'border border-[color-mix(in_srgb,var(--issue-ink)_25%,transparent)]',
          className
        ),
      },
      props
    ),
    render,
  });
};
