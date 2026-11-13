import { useEffect, useState, type MouseEvent } from "react"

const home = import.meta.env.BASE_URL
const isAbout = () =>
  window.location.pathname.replace(/\/$/, "").replace(/\.html$/, "") ===
  `${home}about`

// Route within App so its in-memory document state survives a visit to About.
export function useSiteRoute() {
  const [about, setAbout] = useState(isAbout)
  useEffect(() => {
    const onPopState = () => setAbout(isAbout())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])
  useEffect(() => {
    document.title = about
      ? "About · PDF Internals"
      : "PDF Internals — Structure & Hex Explorer"
    const focusTarget =
      document.querySelector<HTMLElement>(
        about ? ".about-page" : ".empty-workspace"
      ) ?? document.querySelector<HTMLElement>(".app-identity")
    focusTarget?.focus()
  }, [about])

  function goHome() {
    if (!isAbout()) return
    window.history.pushState(null, "", home)
    setAbout(false)
  }
  function followLink(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return false
    event.preventDefault()
    const url = new URL(event.currentTarget.href)
    if (url.pathname !== window.location.pathname)
      window.history.pushState(null, "", url)
    setAbout(isAbout())
    return true
  }
  return { about, goHome, followLink }
}
