import type { MouseEvent } from 'react';

import { cn } from 'cn';
import { Menu, X } from 'lucide-react';

import type { SitePath } from '@/lib/site-content';

import { buttonVariants } from '@/components/ui/button-variants';
import { CONTENT_GROUPS, contentType, relatedPages } from '@/lib/site-navigation';
const SECTION_LINK = 'text-inherit underline-offset-5 no-underline';
const SECTION_LINK_ACTIVE = 'underline';
/* `buttonVariants` stays a plain concatenation: `cn` would drop `text-sm`'s line-height and `rounded-lg`. The menu's overrides take `!`. */
const MENU_LINK = 'flex! min-h-11 rounded-[4px]! px-3! hover:bg-muted hover:bg-clip-border! dark:hover:bg-muted!';

const SectionLinks = function SectionLinks({ menu, path, onFollowLink }: { menu: boolean; path: SitePath; onFollowLink?: FollowLink }) {
  return CONTENT_GROUPS.slice(0, 3).map((group) => {
    const href = group.items[0][0];
    const active = group.items.some(([item]) => item === path);
    return (
      <a
        key={href}
        href={href}
        aria-current={path === href ? 'page' : undefined}
        className={[
          buttonVariants({ size: 'sm', variant: 'ghost' }),
          SECTION_LINK,
          active && SECTION_LINK_ACTIVE,
          menu && MENU_LINK,
          menu && active && 'bg-muted bg-clip-border!',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onFollowLink}
      >
        {group.label}
      </a>
    );
  });
};

/** The header's section links. Below 760px they collapse into a menu and the inspector link shortens. */
export const ContentHeaderLinks = function ContentHeaderLinks({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <nav className="ml-auto flex flex-nowrap items-center gap-2 text-[13px] whitespace-nowrap" aria-label="Main navigation">
      <div className="flex items-center gap-1 max-w760:hidden">
        <SectionLinks menu={false} path={path} onFollowLink={onFollowLink} />
      </div>
      <a className={`${buttonVariants({ size: 'sm', variant: 'ghost' })} ${SECTION_LINK} max-w760:min-h-9`} href="/" onClick={onFollowLink}>
        <span className="max-w760:hidden">Open the inspector →</span>
        <span className="hidden max-w760:inline">Inspector →</span>
      </a>
      <details className="group relative hidden max-w760:block" key={path}>
        <summary
          className={`${buttonVariants({ size: 'icon-lg', variant: 'ghost' })} flex! cursor-pointer list-none group-open:bg-muted group-open:bg-clip-border! hover:bg-clip-border! dark:hover:bg-muted! [&::-webkit-details-marker]:hidden`}
        >
          <Menu className="group-open:hidden" size={16} aria-hidden="true" />
          <X className="hidden group-open:block" size={16} aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </summary>
        <div className="absolute top-[calc(100%+8px)] right-0 z-10 grid w-[210px] rounded-[8px] border border-border bg-background p-1.5 shadow-[0_8px_24px_#0003]">
          <SectionLinks menu path={path} onFollowLink={onFollowLink} />
        </div>
      </details>
    </nav>
  );
};
const NavigationGroups = function NavigationGroups({
  className,
  path,
  onFollowLink,
}: {
  className?: string;
  path: SitePath;
  onFollowLink?: FollowLink;
}) {
  return (
    <nav className={className} aria-label="Content navigation">
      {CONTENT_GROUPS.map((group) => (
        <div className="not-first:mt-5.5" key={group.label}>
          <h2 className="mb-1.5 text-[12px] font-[650] text-foreground">{group.label}</h2>
          <ul className="grid gap-0.5 text-[12px] leading-[1.5]">
            {group.items.map(([href, label]) => (
              <li key={href}>
                <a
                  className="block rounded-[5px] px-2.5 py-1.5 text-muted-foreground hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:font-semibold aria-[current=page]:text-reference"
                  href={href}
                  aria-current={path === href ? 'page' : undefined}
                  onClick={onFollowLink}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};
/** Section navigation: a sticky sidebar from 900px up, a disclosure above the article below that. */
export const ContentNavigation = function ContentNavigation({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <>
      <aside className="sticky top-0 max-h-[calc(100dvh-160px)] overflow-y-auto pr-3 pb-4 max-w900:hidden">
        <NavigationGroups path={path} onFollowLink={onFollowLink} />
      </aside>
      <details className="mb-7 hidden rounded-[6px] border border-border max-w900:block">
        <summary className="cursor-pointer px-4 py-3 text-[13px] font-[550]">On this site</summary>
        <NavigationGroups className="px-4 pt-1 pb-5" path={path} onFollowLink={onFollowLink} />
      </details>
    </>
  );
};
/** Three curated next steps. `about` matches the About page's compact list. */
export const RelatedContent = function RelatedContent({
  about = false,
  path,
  onFollowLink,
}: {
  about?: boolean;
  path: SitePath;
  onFollowLink?: FollowLink;
}) {
  return (
    <aside className="mt-10 border-t border-border" aria-label="Related reading">
      <h2 className="mt-8 mb-3 text-[16px] font-[550]">Keep exploring</h2>
      <ul className={cn(!about && 'mt-4 mb-6 text-[14px] leading-[1.85] text-muted-foreground')}>
        {relatedPages(path).map((page) => (
          <li className="my-4" key={page.path}>
            <span className="block text-[11px] text-muted-foreground">{contentType(page.path)}</span>
            <a className="text-[14px] text-reference underline-offset-3 hover:underline" href={page.path} onClick={onFollowLink}>
              {page.heading}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
type FollowLink = (event: MouseEvent<HTMLAnchorElement>) => boolean;
