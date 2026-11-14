import { imagePlan } from "./resource-tools"
import { hasSubtype } from "./navigation"
import type { PdfObjectRecord } from "./types"

export function imageDownloadPlan(object: PdfObjectRecord) {
  if (!object.stream || !hasSubtype(object, "Image"))
    throw new Error("This object is not an image stream.")
  const filename = `image-${object.id.replace(/ /g, "-")}`
  if (
    object.stream.filters.length === 1 &&
    ["DCTDecode", "DCT"].includes(object.stream.filters[0])
  ) {
    return { format: "jpeg" as const, filename: `${filename}.jpg` }
  }
  const supported = new Set([
    "FlateDecode",
    "Fl",
    "ASCIIHexDecode",
    "AHx",
    "ASCII85Decode",
    "A85",
  ])
  const unsupported = object.stream.filters.find(
    (filter) => !supported.has(filter)
  )
  if (unsupported)
    throw new Error(
      `Image export unavailable: /${unsupported} is not supported for this image. Inspect its stream instead.`
    )
  try {
    return {
      format: "png" as const,
      filename: `${filename}.png`,
      pixels: imagePlan(object),
    }
  } catch (error) {
    throw new Error(
      (error instanceof Error
        ? error.message
        : "Image export unavailable."
      ).replace("Thumbnail unavailable:", "Image export unavailable:"),
      { cause: error }
    )
  }
}
