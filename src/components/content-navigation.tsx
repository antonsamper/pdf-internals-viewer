import type { MouseEvent } from "react"
import type { SitePath } from "@/lib/site-content"
import {
  CONTENT_GROUPS,
  contentType,
  relatedPages,
} from "@/lib/site-navigation"

type FollowLink = (event: MouseEvent<HTMLAnchorElement>) => boolean

export function ContentHeaderLinks({
  path,
  onFollowLink,
}: {
  path: SitePath
  onFollowLink?: FollowLink
}) {
  return (
    <nav className="content-header-links" aria-label="Main navigation">
      {CONTENT_GROUPS.slice(0, 3).map((group) => {
        const href = group.items[0][0]
        const active = group.items.some(([item]) => item === path)
        return (
          <a
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={active ? "active-section" : undefined}
            onClick={onFollowLink}
          >
            {group.label}
          </a>
        )
      })}
      <a className="content-open-link" href="/" onClick={onFollowLink}>
        Open the inspector →
      </a>
    </nav>
  )
}

function NavigationGroups({
  path,
  onFollowLink,
}: {
  path: SitePath
  onFollowLink?: FollowLink
}) {
  return (
    <nav aria-label="Content navigation">
      {CONTENT_GROUPS.map((group) => (
        <div className="content-nav-group" key={group.label}>
          <h2>{group.label}</h2>
          <ul>
            {group.items.map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  aria-current={path === href ? "page" : undefined}
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
  )
}

export function ContentNavigation({
  path,
  onFollowLink,
}: {
  path: SitePath
  onFollowLink?: FollowLink
}) {
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
  )
}

export function RelatedContent({
  path,
  onFollowLink,
}: {
  path: SitePath
  onFollowLink?: FollowLink
}) {
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
  )
}
