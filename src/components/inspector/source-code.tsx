import type { ComponentProps } from 'react';

import { cn } from 'cn';

/** Raw object syntax or stream text. */
export const SourceCode = ({ className, ...props }: ComponentProps<'pre'>) => (
  <pre className={cn('text-[11px] leading-[1.85] [overflow-wrap:anywhere] whitespace-pre-wrap [tab-size:2]', className)} {...props} />
);
