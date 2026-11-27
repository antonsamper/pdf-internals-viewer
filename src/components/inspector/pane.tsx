import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A pane's title row: fixed height, bottom border, small type. */
export const PaneHeading = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn('flex h-[42px] min-h-[42px] shrink-0 items-center gap-2 border-b px-3.5 text-detail font-medium', className)}
    {...props}
  />
);

/** A pane's scrolling body. Tab panels render it through `render={<PaneBody />}`. */
export const PaneBody = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('min-h-0 flex-1 overflow-auto p-[22px] max-w480:p-[18px]', className)} {...props} />
);

/** The icon, title and subtitle at the top of the overview and issues panes. */
export const PaneIntro = ({ children, icon: Icon, title }: { children: ReactNode; icon: LucideIcon; title: ReactNode }) => (
  <div>
    <Icon size={25} className="mb-4 text-brand-purple" aria-hidden="true" />
    <h1 className="mb-2 text-title font-[550] tracking-[-0.025em]">{title}</h1>
    {children}
  </div>
);

export const PaneSubtitle = ({ className, ...props }: ComponentProps<'p'>) => (
  <p className={cn('mb-[26px] text-small [overflow-wrap:anywhere] text-muted-foreground', className)} {...props} />
);

/** A heading for a section inside a pane body. */
export const SectionHeading = ({ className, ...props }: ComponentProps<'h2'>) => (
  <h2 className={cn('mt-7 mb-3 text-small font-[550]', className)} {...props} />
);
