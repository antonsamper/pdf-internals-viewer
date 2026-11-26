import type { ComponentProps } from 'react';

import { cn } from 'cn';

import { Button } from '@/components/ui/button';

/** A row of buttons under a pane heading. */
export const ActionRow = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('flex flex-wrap gap-2', className)} {...props} />
);

/** An outline button in an action row, in the panes' compact type. */
export const ActionButton = ({ className, ...props }: ComponentProps<typeof Button>) => (
  <Button variant="outline" className={cn('text-[11px]', className)} {...props} />
);
