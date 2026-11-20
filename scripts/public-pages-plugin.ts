import type { Plugin } from "vite"
import { sitePage, pageHead } from "../src/lib/site-content.ts"

/** Serve the same static article components during development as in production. */
export function publicPages(): Plugin {
  return {
    name: "public-pages",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        const page = sitePage(
          context.path === "/index.html" ? "/" : context.path
        )
        if (!page) return html
        return html
          .replace(/<title>[\s\S]*?<\/title>/, "")
          .replace(/<meta name="description"[^>]*>/, "")
          .replace("</head>", `${pageHead(page)}\n</head>`)
      },
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost")
          .pathname
        const page = sitePage(pathname)
        if (!page || page.path === "/" || page.path === "/about") return next()
        try {
          const { renderPage } =
            await server.ssrLoadModule("/src/prerender.tsx")
          const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"><link rel="stylesheet" href="/src/app.css"></head><body><div id="root">${renderPage(page)}</div></body></html>`
          response.setHeader("Content-Type", "text/html; charset=utf-8")
          response.end(await server.transformIndexHtml(page.path, html))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
