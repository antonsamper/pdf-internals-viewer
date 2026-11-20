import { imageDownloadPlan } from "./pdf/image-download"
import { imagePlan, imageRgba } from "./pdf/resource-tools"
import type { PdfObjectRecord, StreamResult } from "./pdf/types"

// Serialize canvas work so a list of large images cannot allocate all surfaces at once.
let imageWork: Promise<unknown> = Promise.resolve()
export function queueImageWork<T>(work: () => Promise<T>): Promise<T> {
  const next = imageWork.then(work, work)
  imageWork = next.catch(() => {})
  return next
}

export async function buildImageFile(
  object: PdfObjectRecord,
  extractImage: (id: string) => Promise<StreamResult>
) {
  const plan = imageDownloadPlan(object)
  const result = await extractImage(object.id)
  if (result.error) throw new Error(result.error)
  if (result.truncated)
    throw new Error("Image data is incomplete. No image was exported.")
  if (plan.format === "jpeg") {
    if (
      result.encoding !== "jpeg" ||
      result.bytes[0] !== 0xff ||
      result.bytes[1] !== 0xd8
    )
      throw new Error(
        "The embedded stream does not contain a supported JPEG file."
      )
    return {
      filename: plan.filename,
      blob: new Blob([new Uint8Array(result.bytes)], { type: "image/jpeg" }),
    }
  }
  const pixels = imageRgba(plan.pixels, result.bytes)
  const canvas = document.createElement("canvas")
  try {
    canvas.width = plan.pixels.width
    canvas.height = plan.pixels.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The browser could not export this image.")
    const data = context.createImageData(canvas.width, canvas.height)
    data.data.set(pixels)
    context.putImageData(data, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("The browser could not encode a PNG.")),
        "image/png"
      )
    )
    return { filename: plan.filename, blob }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export async function imageThumbnail(object: PdfObjectRecord, blob: Blob) {
  // Validate color, masks, and bounds even when the JPEG itself is downloadable.
  const plan = imagePlan(object)
  const scale = Math.min(1, 160 / Math.max(plan.width, plan.height))
  const width = Math.max(1, Math.round(plan.width * scale))
  const height = Math.max(1, Math.round(plan.height * scale))
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: width,
    resizeHeight: height,
  })
  const canvas = document.createElement("canvas")
  try {
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context)
      throw new Error("The browser could not create an image preview.")
    context.drawImage(bitmap, 0, 0)
    return canvas.toDataURL("image/png")
  } finally {
    bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}
