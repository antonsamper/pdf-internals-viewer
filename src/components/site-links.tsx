import type { MouseEvent } from "react"

export const PROJECT_URL = "https://github.com/antonsamper/pdf-internals-viewer"

export function SiteLinks({
  onFollowLink,
}: {
  onFollowLink: (event: MouseEvent<HTMLAnchorElement>) => boolean
}) {
  return (
    <nav className="site-links" aria-label="Project">
      <span>An open-source tool for curious developers.</span>
      <div>
        <a href={`${import.meta.env.BASE_URL}about`} onClick={onFollowLink}>
          About
        </a>
        <a href={`${PROJECT_URL}/issues`} target="_blank" rel="noreferrer">
          Feedback
        </a>
        <a href={PROJECT_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </nav>
  )
}
