import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cn } from 'cn';

/** An inline warning card. A paragraph by default; `render={<div />}` for one that holds other blocks. */
export const Warning = function Warning({ className, render, ...props }: useRender.ComponentProps<'p'>) {
  return useRender({
    defaultTagName: 'p',
    props: mergeProps<'p'>(
      {
        className: cn(
          'my-3 flex items-start gap-[9px] px-[15px] py-2.5',
          'bg-muted text-[11px] leading-[1.65] [overflow-wrap:anywhere]',
          'rounded-[5px] border',
          className
        ),
      },
      props
    ),
    render,
  });
};
