import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PdfInspector } from "../src/lib/pdf/inspector"

const fixture = (algorithm: string, password: boolean) =>
  new Uint8Array(
    readFileSync(
      `tests/fixtures/encryption/${algorithm}-${password ? "password" : "empty"}.pdf`
    )
  )

describe.each(["RC4-40", "RC4-128", "AES-128", "AES-256"])(
  "%s encryption",
  (algorithm) => {
    it("automatically unlocks empty-password files and preserves original bytes and raw streams", async () => {
      const bytes = fixture(algorithm, false)
      const original = bytes.slice()
      const inspector = new PdfInspector()
      const document = await inspector.open(bytes)
      expect(document.encrypted).toBe(true)
      expect(document.locked).toBe(false)
      expect(document.pages).toHaveLength(1)
      const info = document.objects.find(
        (object) =>
          object.value.type === "dictionary" &&
          object.value.entries.some((entry) => entry.key === "Title")
      )!
      expect(
        info.value.type === "dictionary" &&
          info.value.entries.find((entry) => entry.key === "Title")?.value
      ).toMatchObject({ value: "Encrypted fixture title" })
      const content = document.objects.find(
        (object) =>
          object.stream &&
          inspector.readStream(object.id, "decoded").text.includes("BT")
      )!
      expect(content).toBeDefined()
      expect(content.stream?.range).toBeDefined()
      const range = content.stream!.range!
      expect(inspector.readStream(content.id, "raw").bytes).toEqual(
        bytes.slice(range.start, range.end)
      )
      expect(inspector.readStream(content.id, "raw").bytes).not.toEqual(
        inspector.readStream(content.id, "decoded").bytes
      )
      expect(content.stream?.length).toBe(range.end - range.start)
      expect(bytes).toEqual(original)
    })

    it("keeps missing/wrong passwords locked and accepts user and owner passwords on retry", async () => {
      const bytes = fixture(algorithm, true)
      const original = bytes.slice()
      const inspector = new PdfInspector()
      for (const password of [
        undefined,
        "wrong",
        "secret",
        "owner-secret",
        "wrong",
      ]) {
        const document = await inspector.open(bytes, "encrypted.pdf", password)
        const locked = password !== "secret" && password !== "owner-secret"
        expect(document.locked).toBe(locked)
        expect(document.encrypted).toBe(true)
        expect(document.pages).toHaveLength(locked ? 0 : 1)
        expect(document.objects.length > 0).toBe(!locked)
      }
      expect(bytes).toEqual(original)
    })
  }
)

it("decrypts compressed objects and keeps their decoded provenance linked to encrypted source", async () => {
  const bytes = new Uint8Array(
    readFileSync("tests/fixtures/encryption/AES-128-compressed.pdf")
  )
  const inspector = new PdfInspector()
  const document = await inspector.open(bytes, "compressed.pdf", "secret")
  expect(document.locked).toBe(false)
  const compressed = document.objects.find(
    (object) => object.provenance.type === "decoded"
  )!
  expect(compressed.value.text).toContain("Compressed secret")
  expect(compressed.source).toContain("Compressed secret")
  expect(compressed.provenance).toMatchObject({
    type: "decoded",
    containerId: "7 0",
    containerRange: expect.any(Object),
  })
  const container = document.objects.find((object) => object.id === "7 0")!
  const range = container.stream!.range!
  expect(inspector.readStream(container.id, "raw").bytes).toEqual(
    bytes.slice(range.start, range.end)
  )
  expect(inspector.readStream(container.id, "decoded").text).toContain(
    "Compressed secret"
  )
})

it("reports decryption failure instead of presenting ciphertext as decoded content", async () => {
  const bytes = fixture("AES-128", false)
  const inspector = new PdfInspector()
  const valid = await inspector.open(bytes)
  const content = valid.objects.find((object) => object.stream)!
  // Flip the byte feeding the final padding byte in CBC, making padding invalid.
  bytes[content.stream!.range!.end - 17] ^= 0x80
  const damaged = await inspector.open(bytes)
  expect(damaged.warnings.join(" ")).toContain("Failed to decrypt object")
  expect(damaged.objects.some((object) => object.id === content.id)).toBe(false)
  expect(inspector.readStream(content.id, "decoded").error).toBeDefined()
})

it("accepts signed as well as unsigned R6 permission bits", async () => {
  const bytes = Buffer.from(fixture("AES-256", true))
  const marker = Buffer.from("/P 4294967292")
  const offset = bytes.indexOf(marker)
  expect(offset).toBeGreaterThan(0)
  bytes.set(Buffer.from("/P -000000004"), offset)
  const document = await new PdfInspector().open(bytes, "signed.pdf", "secret")
  expect(document.locked).toBe(false)
  expect(document.pages).toHaveLength(1)
})

it("distinguishes unusable encryption metadata from a missing password", async () => {
  const bytes = Buffer.from(fixture("AES-128", true))
  const offset = bytes.indexOf(Buffer.from("/ID"))
  expect(offset).toBeGreaterThan(0)
  bytes.set(Buffer.from("/XX"), offset)
  const document = await new PdfInspector().open(bytes)
  expect(document.locked).toBe(true)
  expect(document.encryptionError).toContain("invalid or unsupported")
  expect(document.objects).toHaveLength(0)
})
