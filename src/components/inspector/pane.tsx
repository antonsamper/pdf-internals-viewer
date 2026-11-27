import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const PaneHeading = ({ className, ...props }: ComponentProps<'div'>) => {
  return (
    <div
      className={cn('flex h-10.5 min-h-10.5 shrink-0 items-center gap-2 border-b px-3.5 text-detail font-medium', className)}
      {...props}
    />
  );
};

/** A pane's scrolling body. Tab panels render it through `render={<PaneBody />}`. */
export const PaneBody = ({ className, ...props }: ComponentProps<'div'>) => {
  return <div className={cn('min-h-0 flex-1 overflow-auto p-5.5 max-w480:p-4.5', className)} {...props} />;
};

export const PaneIntro = ({ children, icon: Icon, title }: { children: ReactNode; icon: LucideIcon; title: ReactNode }) => {
  return (
    <div>
      <Icon size={25} className="mb-4 text-brand-purple" aria-hidden="true" />
      <h1 className="mb-2 text-title font-[550] tracking-[-0.025em]">{title}</h1>
      {children}
    </div>
  );
};

export const PaneSubtitle = ({ className, ...props }: ComponentProps<'p'>) => {
  return <p className={cn('mb-6.5 text-small [overflow-wrap:anywhere] text-muted-foreground', className)} {...props} />;
};

export const SectionHeading = ({ className, ...props }: ComponentProps<'h2'>) => {
  return <h2 className={cn('mt-7 mb-3 text-small font-[550]', className)} {...props} />;
};
