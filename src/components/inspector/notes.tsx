import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export const Note = ({ className, ...props }: ComponentProps<'p'>) => {
  return <p className={cn('mb-3.75 text-caption leading-[1.7] text-muted-foreground', className)} {...props} />;
};

export const Notice = ({ className, ...props }: ComponentProps<'div'>) => {
  return (
    <div
      className={cn(
        'flex items-start gap-2.25 px-3.75 py-2.5',
        'bg-muted text-detail leading-[1.65] [overflow-wrap:anywhere]',
        'border-b',
        className
      )}
      {...props}
    />
  );
};

export const IssueNote = ({ className, ...props }: ComponentProps<'p'>) => {
  return <p className={cn('my-2 text-muted-foreground', className)} {...props} />;
};
