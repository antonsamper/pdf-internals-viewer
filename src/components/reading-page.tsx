import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';

import { ArrowLeft } from 'lucide-react';

import type { SitePath } from '@/lib/site-content';

import { ContentNavigation, RelatedContent } from '@/components/content-navigation';
import { Prose } from '@/components/prose';
import { cn } from '@/lib/utils';

type FollowLink = (event: MouseEvent<HTMLAnchorElement>) => boolean;

/** The first link of every article. */
export const BackToWorkspace = function BackToWorkspace({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <a
      className={cn(
        'mb-10 inline-flex items-center gap-2 text-small text-muted-foreground',
        'hover:text-foreground hover:underline hover:underline-offset-4'
      )}
      href={import.meta.env.BASE_URL}
      onClick={onClick}
    >
      <ArrowLeft size={14} aria-hidden="true" /> Back to the workspace
    </a>
  );
};

/**
 * The scrolling page for About and the public articles: section navigation beside one reading column.
 * `about` keeps the About page's links in the foreground colour and its roomier bottom padding.
 * `standalone` lets a static page scroll with the document instead of inside the shell.
 */
export const ReadingPage = function ReadingPage({
  about = false,
  children,
  labelledBy,
  onClick,
  onFollowLink,
  path,
  standalone = false,
}: {
  about?: boolean;
  children: ReactNode;
  labelledBy: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onFollowLink?: FollowLink;
  path: SitePath;
  standalone?: boolean;
}) {
  return (
    <main
      className={cn(
        'min-h-0 flex-1 px-6 pt-12 pb-16',
        'focus:outline-none',
        'max-w760:pt-8',
        standalone ? 'overflow-visible' : 'overflow-auto',
        !about && 'max-w760:pb-12'
      )}
      data-reading-page=""
      tabIndex={-1}
      aria-labelledby={labelledBy}
    >
      <div
        onClick={onClick}
        role="presentation"
        className={cn(
          'mx-auto grid max-w-[988px] grid-cols-[220px_minmax(0,720px)] items-start gap-12',
          'narrow:block narrow:max-w-[720px]'
        )}
      >
        <ContentNavigation path={path} onFollowLink={onFollowLink} />
        <article className="mx-auto w-full max-w-[720px] min-w-0">
          <Prose className={cn(about && '[&_a:not([class])]:text-foreground [&_a:not([class])]:hover:underline-offset-4')}>
            {children}
          </Prose>
          <RelatedContent path={path} onFollowLink={onFollowLink} about={about} />
        </article>
      </div>
    </main>
  );
};
