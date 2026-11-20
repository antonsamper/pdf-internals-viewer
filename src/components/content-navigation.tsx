import type { MouseEvent } from 'react';

import { Menu, X } from 'lucide-react';

import type { SitePath } from '@/lib/site-content';

import { buttonVariants } from '@/components/ui/button-variants';
import { CONTENT_GROUPS, contentType, relatedPages } from '@/lib/site-navigation';
export const ContentHeaderLinks = function ContentHeaderLinks({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  const sectionLinks = CONTENT_GROUPS.slice(0, 3).map((group) => {
    const href = group.items[0][0];
    const active = group.items.some(([item]) => item === path);
    return (
      <a
        key={href}
        href={href}
        aria-current={path === href ? 'page' : undefined}
        className={[buttonVariants({ size: 'sm', variant: 'ghost' }), active ? 'active-section' : ''].join(' ')}
        onClick={onFollowLink}
      >
        {group.label}
      </a>
    );
  });
  return (
    <nav className="content-header-links" aria-label="Main navigation">
      <div className="content-header-sections">{sectionLinks}</div>
      <a className={`${buttonVariants({ size: 'sm', variant: 'ghost' })} content-open-link`} href="/" onClick={onFollowLink}>
        <span className="content-open-full">Open the inspector →</span>
        <span className="content-open-short">Inspector →</span>
      </a>
      <details className="content-header-menu" key={path}>
        <summary className={buttonVariants({ size: 'icon-lg', variant: 'ghost' })}>
          <Menu className="content-menu-open" size={16} aria-hidden="true" />
          <X className="content-menu-close" size={16} aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </summary>
        <div className="content-header-menu-links">{sectionLinks}</div>
      </details>
    </nav>
  );
};
const NavigationGroups = function NavigationGroups({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <nav aria-label="Content navigation">
      {CONTENT_GROUPS.map((group) => (
        <div className="content-nav-group" key={group.label}>
          <h2>{group.label}</h2>
          <ul>
            {group.items.map(([href, label]) => (
              <li key={href}>
                <a href={href} aria-current={path === href ? 'page' : undefined} onClick={onFollowLink}>
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
export const ContentNavigation = function ContentNavigation({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <>
      <aside className="content-sidebar">
        <NavigationGroups path={path} onFollowLink={onFollowLink} />
      </aside>
      <details className="content-mobile-nav">
        <summary>On this site</summary>
        <NavigationGroups path={path} onFollowLink={onFollowLink} />
      </details>
    </>
  );
};
export const RelatedContent = function RelatedContent({ path, onFollowLink }: { path: SitePath; onFollowLink?: FollowLink }) {
  return (
    <aside className="article-related" aria-label="Related reading">
      <h2>Keep exploring</h2>
      <ul>
        {relatedPages(path).map((page) => (
          <li key={page.path}>
            <span className="related-type">{contentType(page.path)}</span>
            <a href={page.path} onClick={onFollowLink}>
              {page.heading}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
type FollowLink = (event: MouseEvent<HTMLAnchorElement>) => boolean;
