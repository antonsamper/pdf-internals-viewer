import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A row of buttons under a pane heading. */
export const ActionRow = ({ className, ...props }: ComponentProps<'div'>) => {
  return <div className={cn('flex flex-wrap gap-2', className)} {...props} />;
};

/** An outline button in an action row, in the panes' compact type. */
export const ActionButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  return <Button variant="outline" className={cn('text-detail', className)} {...props} />;
};
