import type { MouseEventHandler, ReactNode } from 'react';

import { cn } from 'cn';

import { BrandIcon } from '@/components/brand-artwork';
import { ThemeControl } from '@/components/theme-control';

/** The plum header shared by the workspace and the public pages. `content` selects the article-page layout. */
export const SiteHeader = function SiteHeader({
  children,
  content,
  href,
  onIdentityClick,
}: {
  children: ReactNode;
  content: boolean;
  href: string;
  onIdentityClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <header
      className={cn(
        'relative flex h-(--header-height) min-h-(--header-height) items-center gap-5 border-b border-border px-(--header-inline-padding) pr-[calc(var(--header-inline-padding)+var(--theme-control-size)+12px)] surface-dark shadow-[inset_0_-2px_var(--brand-red)] [--header-height:58px] [--header-inline-padding:22px] [--theme-control-size:32px] max-w900:gap-3 max-w900:[--header-inline-padding:14px]',
        content
          ? 'max-w760:gap-2 max-w760:pr-[calc(var(--header-inline-padding)+var(--theme-control-size)+8px)] max-w760:[--theme-control-size:36px] max-w760:has-[nav+button]:gap-1'
          : 'max-w600:grid max-w600:grid-cols-[auto_minmax(0,1fr)_auto] max-w600:gap-2 max-w600:py-2 max-w600:[--theme-control-size:36px]'
      )}
    >
      <a
        className={cn(
          'flex items-center gap-2.5 text-[14px] font-semibold tracking-tight whitespace-nowrap max-w900:text-[13px] max-w480:gap-1.75',
          content && 'max-w760:min-w-0'
        )}
        data-app-identity=""
        href={href}
        onClick={onIdentityClick}
      >
        <span className={cn('relative size-8 shrink-0 overflow-hidden rounded-[6px]', !content && 'max-w480:size-6.25')}>
          <BrandIcon className="block size-full object-contain" />
        </span>
        <span className={cn(content && 'max-w760:overflow-hidden max-w760:text-ellipsis max-w360:sr-only')}>PDF Internals</span>
      </a>
      {children}
      <ThemeControl />
    </header>
  );
};
