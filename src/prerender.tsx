import { StrictMode } from "react"
import { renderToString, renderToStaticMarkup } from "react-dom/server"
import App from "./App"
import { StaticPublicPage } from "./content/public-page"
import {
  SITE_PAGES,
  SITE_URL,
  pageHead,
  type SitePage,
} from "./lib/site-content"

export { SITE_PAGES, SITE_URL, pageHead }
export function renderPage(page: SitePage) {
  return page.path === "/" || page.path === "/about"
    ? renderToString(
        <StrictMode>
          <App initialPath={page.path} />
        </StrictMode>
      )
    : renderToStaticMarkup(<StaticPublicPage page={page} />)
}
