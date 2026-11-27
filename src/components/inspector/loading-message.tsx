import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '@/lib/utils';

/** A spinner and its caption while content loads. A paragraph by default. */
export const LoadingMessage = function LoadingMessage({ className, render, ...props }: useRender.ComponentProps<'p'>) {
  return useRender({
    defaultTagName: 'p',
    props: mergeProps<'p'>(
      { className: cn('flex items-center gap-2 p-[15px] text-small leading-[inherit] text-muted-foreground', className) },
      props
    ),
    render,
  });
};
