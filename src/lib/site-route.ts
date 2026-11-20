import { useEffect, useState, type MouseEvent } from "react"
import {
  SITE_PAGES,
  SITE_URL,
  sitePage,
  structuredData,
  type SitePath,
} from "./site-content"

function updateMetadata(path: SitePath) {
  const page = sitePage(path) ?? SITE_PAGES[0]
  document.title = page.title
  const set = (selector: string, attributes: Record<string, string>) => {
    const element =
      document.head.querySelector(selector) ??
      document.head.appendChild(
        document.createElement(selector.startsWith("link") ? "link" : "meta")
      )
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value)
  }
  set('meta[name="description"]', {
    name: "description",
    content: page.description,
  })
  set('link[rel="canonical"]', { rel: "canonical", href: SITE_URL + path })
  for (const [name, content] of Object.entries({
    "og:title": page.title,
    "og:description": page.description,
    "og:url": SITE_URL + path,
    "og:type": path.startsWith("/guides/") ? "article" : "website",
  }))
    set(`meta[property="${name}"]`, { property: name, content })
  for (const [name, content] of Object.entries({
    "twitter:title": page.title,
    "twitter:description": page.description,
  }))
    set(`meta[name="${name}"]`, { name, content })
  const schema =
    document.getElementById("site-schema") ??
    document.head.appendChild(
      Object.assign(document.createElement("script"), {
        id: "site-schema",
        type: "application/ld+json",
      })
    )
  schema.textContent = JSON.stringify(structuredData(page))
}

// Keep the PDF workspace mounted while visiting public content.
export function useSiteRoute(initialPath: SitePath = "/") {
  const [path, setPath] = useState<SitePath>(initialPath)
  useEffect(() => {
    const onPopState = () =>
      setPath(sitePage(window.location.pathname)?.path ?? "/")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])
  useEffect(() => {
    updateMetadata(path)
    const focusTarget =
      document.querySelector<HTMLElement>(
        path !== "/" ? ".about-page" : ".empty-workspace"
      ) ?? document.querySelector<HTMLElement>(".app-identity")
    focusTarget?.focus()
  }, [path])

  function goHome() {
    if (path === "/") return
    window.history.pushState(null, "", "/")
    setPath("/")
  }
  function followLink(event: MouseEvent<HTMLElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return false
    const anchor =
      event.target instanceof Element ? event.target.closest("a") : null
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      anchor.target === "_blank"
    )
      return false
    const url = new URL(anchor.href)
    const next = sitePage(url.pathname)
    // Sample links intentionally load a fresh workspace, and external links stay native.
    if (
      url.origin !== window.location.origin ||
      !next ||
      url.search ||
      url.hash
    )
      return false
    event.preventDefault()
    if (url.pathname !== window.location.pathname)
      window.history.pushState(null, "", url)
    setPath(next.path)
    return true
  }
  return { path, about: path === "/about", goHome, followLink }
}
