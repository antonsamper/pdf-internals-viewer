import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export const SourceCode = ({ className, ...props }: ComponentProps<'pre'>) => {
  return (
    <pre className={cn('text-detail leading-[1.85] [overflow-wrap:anywhere] whitespace-pre-wrap [tab-size:2]', className)} {...props} />
  );
};
