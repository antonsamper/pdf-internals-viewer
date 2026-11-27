import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export const ReferenceButton = ({ className, ...props }: ComponentProps<'button'>) => {
  return (
    <button
      className={cn(
        'inline-flex items-baseline gap-1.25',
        'font-mono text-detail leading-[inherit] whitespace-nowrap text-reference',
        'bg-transparent',
        'hover:underline hover:underline-offset-3',
        className
      )}
      {...props}
    />
  );
};
