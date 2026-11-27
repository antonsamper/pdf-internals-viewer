import type { ComponentProps, MouseEvent } from 'react';

import { Menu, X } from 'lucide-react';

import type { SitePath } from '@/lib/site-content';

import { buttonVariants } from '@/components/ui/button-variants';
import { CONTENT_GROUPS, contentType, relatedPages } from '@/lib/site-navigation';
import { cn } from '@/lib/utils';
/** A header link shaped like a small ghost button, in medium-weight type a little under 13px. */
export const HeaderLink = function HeaderLink({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        buttonVariants({ size: 'sm', variant: 'ghost' }),
        'text-nav font-medium',
        // The base button's radius and icon size, which the `sm` size would otherwise replace.
        "rounded-lg [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
};

/** A main-navigation link in the header's text colour. The caller underlines the current section. */
const NavigationLink = ({ className, ...props }: ComponentProps<'a'>) => (
  <HeaderLink className={cn('text-inherit no-underline underline-offset-5', className)} {...props} />
);

const SectionLinks = function SectionLinks({ menu, path, onFollowLink }: { menu: boolean; path: SitePath; onFollowLink?: FollowLink }) {
  return CONTENT_GROUPS.slice(0, 3).map((group) => {
    const href = group.items[0][0];
    const active = group.items.some(([item]) => item === path);
    return (
      <NavigationLink
        key={href}
        href={href}
        aria-current={path === href ? 'page' : undefined}
        className={cn(
          menu && ['flex min-h-11 px-3', 'rounded-[4px]', 'hover:bg-muted hover:bg-clip-border', 'dark:hover:bg-muted'],
          active && 'underline',
          menu && active && 'bg-muted bg-clip-border'
        )}
        onClick={onFollowLink}
      >
        {group.label}
      </NavigationLink>
    );
  });
};

/** The header's section links. Below 760px they collapse into a menu and the inspector link shortens. */
export const ContentHeaderLinks = function ContentHeaderLinks({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <nav className="ml-auto flex flex-nowrap items-center gap-2 text-body whitespace-nowrap" aria-label="Main navigation">
      <div className="flex items-center gap-1 max-w760:hidden">
        <SectionLinks menu={false} path={path} onFollowLink={onFollowLink} />
      </div>
      <NavigationLink className="max-w760:min-h-9" href="/" onClick={onFollowLink}>
        <span className="max-w760:hidden">Open the inspector →</span>
        <span className="hidden max-w760:inline">Inspector →</span>
      </NavigationLink>
      <details className="group relative hidden max-w760:block" key={path}>
        <summary
          className={cn(
            buttonVariants({ size: 'icon-lg', variant: 'ghost' }),
            'flex list-none [&::-webkit-details-marker]:hidden',
            'cursor-pointer',
            'group-open:bg-muted group-open:bg-clip-border hover:bg-clip-border',
            'dark:hover:bg-muted'
          )}
        >
          <Menu className="group-open:hidden" size={16} aria-hidden="true" />
          <X className="hidden group-open:block" size={16} aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </summary>
        <div
          className={cn(
            'absolute top-[calc(100%+8px)] right-0 z-10 grid w-[210px] p-1.5',
            'rounded-[8px] border border-border bg-background shadow-[0_8px_24px_#0003]'
          )}
        >
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
          <h2 className="mb-1.5 text-small font-[650] text-foreground">{group.label}</h2>
          <ul className="grid gap-0.5 text-small">
            {group.items.map(([href, label]) => (
              <li key={href}>
                <a
                  className={cn(
                    'block px-2.5 py-1.5 text-muted-foreground',
                    'rounded-[5px]',
                    'hover:bg-muted',
                    'aria-[current=page]:bg-secondary aria-[current=page]:font-semibold aria-[current=page]:text-reference'
                  )}
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
      <aside className="sticky top-0 max-h-[calc(100dvh-160px)] overflow-y-auto pr-3 pb-4 narrow:hidden">
        <NavigationGroups path={path} onFollowLink={onFollowLink} />
      </aside>
      <details className="mb-7 hidden rounded-[6px] border border-border narrow:block">
        <summary className="cursor-pointer px-4 py-3 text-body font-[550]">On this site</summary>
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
      <h2 className="mt-8 mb-3 text-subheading font-[550]">Keep exploring</h2>
      <ul className={cn(!about && 'mt-4 mb-6 text-reading leading-[1.85] text-muted-foreground')}>
        {relatedPages(path).map((page) => (
          <li className="my-4" key={page.path}>
            <span className="block text-detail leading-[inherit] text-muted-foreground">{contentType(page.path)}</span>
            <a
              className="text-reading leading-[inherit] text-reference underline-offset-3 hover:underline"
              href={page.path}
              onClick={onFollowLink}
            >
              {page.heading}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
type FollowLink = (event: MouseEvent<HTMLAnchorElement>) => boolean;
