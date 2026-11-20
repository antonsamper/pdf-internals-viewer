import { localEngine, type SearchMatch } from "@embedpdf/engine"
import type { SearchSnippet } from "./search-snippet"
import { OPERATION_TIMEOUT_MS } from "./limits"

export interface PageTextHit {
  objectNumber: number
  count: number
  snippet: string
  context?: SearchSnippet
  matches: SearchMatch[]
}

/** A short-lived local engine, terminated on cancellation or completion. */
export async function searchPageText(
  bytes: Uint8Array,
  text: string,
  password: string | undefined,
  signal: AbortSignal
) {
  const engine = localEngine()
  const abort = () => {
    void engine.destroy().catch(() => undefined)
  }
  // A malformed file must not leave the search UI waiting on a stuck worker.
  async function bounded<T>(request: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        Promise.resolve(request),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort()
            reject(
              new Error(
                "Page text search exceeded 15 seconds. Try a smaller PDF or another search mode."
              )
            )
          }, OPERATION_TIMEOUT_MS)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
  signal.addEventListener("abort", abort, { once: true })
  try {
    signal.throwIfAborted()
    const document = await bounded(
      engine.open({ kind: "bytes", bytes: bytes.slice().buffer }, { password })
    )
    const listed = await bounded(document.pages.list())
    const pages = new Map(
      listed.pages.map((page, index) => [page.ref.objectNumber, index + 1])
    )
    const hits = new Map<number, PageTextHit>()
    let cursor: string | undefined
    let count = 0
    do {
      signal.throwIfAborted()
      const batch = await bounded(
        document.search.query({
          text,
          snippets: true,
          matchDiacritics: true,
          cursor,
          limit: { matches: 500 - count, pages: 25 },
        })
      )
      for (const match of batch.matches) {
        const objectNumber = match.page.objectNumber
        const prior = hits.get(objectNumber)
        if (prior) {
          prior.count++
          prior.matches.push(match)
        } else
          hits.set(objectNumber, {
            objectNumber,
            count: 1,
            matches: [match],
            context: match.snippet,
            snippet: match.snippet
              ? `${match.snippet.before}${match.snippet.match}${match.snippet.after}`
              : text,
          })
        count++
      }
      cursor = batch.nextCursor ?? undefined
    } while (cursor && count < 500)
    signal.throwIfAborted()
    return { hits: [...hits.values()], pages, limited: count >= 500 }
  } finally {
    signal.removeEventListener("abort", abort)
    await engine.destroy().catch(() => undefined)
  }
}
