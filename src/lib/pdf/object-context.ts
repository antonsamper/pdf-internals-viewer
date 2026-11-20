import { hasSubtype, property } from "./navigation"
import type { PdfObjectRecord, PdfValue } from "./types"

export interface ObjectRelationship {
  sourceId: string
  targetId: string
  path: string[]
}

/** Walk only the stored value, never follow references into the document graph. */
export function referencePaths(object: PdfObjectRecord) {
  const links: ObjectRelationship[] = []
  let remaining = 5000
  let incomplete = false
  function walk(value: PdfValue, path: string[], depth: number) {
    if (--remaining < 0 || depth > 32 || links.length >= 200) {
      incomplete = true
      return
    }
    if (value.type === "reference") {
      links.push({ sourceId: object.id, targetId: value.ref, path })
    } else if (value.type === "array") {
      for (let i = 0; i < value.items.length; i++) {
        if (remaining <= 0 || links.length >= 200) {
          incomplete = true
          break
        }
        walk(value.items[i], [...path, `[${i}]`], depth + 1)
      }
    } else if (value.type === "dictionary" || value.type === "stream") {
      for (const entry of value.entries) {
        if (remaining <= 0 || links.length >= 200) {
          incomplete = true
          break
        }
        walk(
          entry.value,
          [...path, `/${entry.key.replace(/^\//, "")}`],
          depth + 1
        )
      }
    }
  }
  walk(object.value, [], 0)
  return { links, incomplete }
}

export function objectRelationships(
  object: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>
) {
  const outgoing = referencePaths(object)
  const incoming: ObjectRelationship[] = []
  let incomplete = outgoing.incomplete || object.referencedBy.length > 200
  for (const id of object.referencedBy.slice(0, 200)) {
    const source = objects.get(id)
    if (!source) {
      incomplete = true
      continue
    }
    const result = referencePaths(source)
    incomplete ||= result.incomplete
    for (const link of result.links) {
      if (link.targetId === object.id) {
        if (incoming.length >= 200) {
          incomplete = true
          break
        }
        incoming.push(link)
      }
    }
    if (incoming.length >= 200) {
      incomplete = true
      break
    }
  }
  return { outgoing: outgoing.links, incoming, incomplete }
}

export function objectName(
  id: string,
  objects: Map<string, PdfObjectRecord>,
  pages: string[]
) {
  const index = pages.indexOf(id)
  return index >= 0
    ? `Page ${index + 1}`
    : (objects.get(id)?.kind ?? "Unavailable object")
}

export function objectSummary(
  object: PdfObjectRecord,
  pages: string[],
  incoming: ObjectRelationship[],
  objects: Map<string, PdfObjectRecord>
) {
  const page = pages.indexOf(object.id)
  if (page >= 0)
    return `Page ${page + 1} of ${pages.length}. Its dictionary connects the page to drawing instructions, resources, and any annotations.`
  if (object.kind === "Catalog")
    return "The document’s main entry point. Its dictionary links to the page tree and other document-level features."
  if (object.kind === "Pages")
    return "A branch of the page tree. It groups pages and can supply inherited page properties and resources."
  if (hasSubtype(object, "Image")) {
    const width = property(object.value, "Width"),
      height = property(object.value, "Height")
    return `An image resource${width?.type === "number" && height?.type === "number" ? ` with ${width.value} × ${height.value} pixels` : ""}. A resource reference makes it available; it does not prove the image is drawn.`
  }
  if (hasSubtype(object, "Form"))
    return "A reusable group of drawing instructions (a form XObject). It can have its own resources; this is different from an interactive form field."
  if (object.kind === "Font") {
    const name = property(object.value, "BaseFont")
    return `A font dictionary${name?.type === "name" ? ` for ${name.value}` : ""}. It describes how character codes are interpreted and drawn; a reference does not prove the font is used.`
  }
  const contentPages = incoming
    .filter(
      (link) => link.path[0] === "/Contents" && pages.includes(link.sourceId)
    )
    .map((link) => pages.indexOf(link.sourceId) + 1)
  if (object.stream && contentPages.length) {
    const unique = [...new Set(contentPages)]
    return `A content stream referenced by ${unique
      .slice(0, 5)
      .map((n) => `Page ${n}`)
      .join(
        ", "
      )}${unique.length > 5 ? ` and ${unique.length - 5} more pages` : ""}. Its decoded bytes contain page drawing instructions.`
  }
  if (object.stream)
    return "A stream object: a dictionary followed by a byte payload. Raw stream shows stored bytes; Decoded applies supported filters. Its role depends on the references and dictionary below."
  if (
    object.value.type === "dictionary" &&
    incoming.some((link) => link.path.at(-1) === "/Resources")
  )
    return "A resource dictionary referenced through /Resources. It maps resource names to objects available in that context, rather than proving they are drawn."
  const owner = incoming[0]
  return owner
    ? `This ${object.value.type} is referenced by ${objectName(owner.sourceId, objects, pages)} through ${owner.path.join(" → ") || "a direct reference"}. Inspect its properties and connections below to determine its role.`
    : `An indirect ${object.value.type} object. Its role could not be established from the available indexed references; inspect its properties and source below.`
}
