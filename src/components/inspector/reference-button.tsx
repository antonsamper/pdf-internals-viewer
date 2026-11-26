import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** A navigable PDF reference: violet monospace text that underlines on hover. */
export const ReferenceButton = ({ className, ...props }: ComponentProps<'button'>) => (
  <button
    className={cn(
      'inline-flex items-baseline gap-[5px]',
      'font-mono text-detail leading-[inherit] whitespace-nowrap text-reference',
      'bg-transparent',
      'hover:underline hover:underline-offset-[3px]',
      className
    )}
    {...props}
  />
);
