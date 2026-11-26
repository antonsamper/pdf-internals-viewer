import type { ComponentProps } from 'react';

import { cn } from 'cn';

/** Small explanatory text, such as what a representation shows and what it leaves out. */
export const Note = ({ className, ...props }: ComponentProps<'p'>) => (
  <p className={cn('mb-[15px] text-[10px] leading-[1.7] text-muted-foreground', className)} {...props} />
);

/** A full-width notice under a pane heading. */
export const Notice = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn(
      'flex items-start gap-[9px] px-[15px] py-2.5',
      'bg-muted text-[11px] leading-[1.65] [overflow-wrap:anywhere]',
      'border-b',
      className
    )}
    {...props}
  />
);

/** Muted text in the issues pane and the overview's issue section. */
export const IssueNote = ({ className, ...props }: ComponentProps<'p'>) => (
  <p className={cn('my-2 text-muted-foreground', className)} {...props} />
);
