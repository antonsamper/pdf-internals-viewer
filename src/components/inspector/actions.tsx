import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ActionRow = ({ className, ...props }: ComponentProps<'div'>) => {
  return <div className={cn('flex flex-wrap gap-2', className)} {...props} />;
};

export const ActionButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  return <Button variant="outline" className={cn('text-detail', className)} {...props} />;
};
