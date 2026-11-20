import type { RefObject } from "react"
import {
  ArrowRight,
  Binary,
  BookmarkPlus,
  Braces,
  Files,
  Image,
  ListTree,
  Paperclip,
  Pin,
  Search,
  ShieldCheck,
  Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function UserGuide({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="limitations-dialog user-guide-dialog"
        finalFocus={returnFocusRef}
      >
        <DialogHeader className="limitations-heading">
          <DialogTitle>User guide</DialogTitle>
          <DialogDescription>
            Follow a page to its objects, then see the bytes behind them.
          </DialogDescription>
        </DialogHeader>
        <div
          className="limitations-body user-guide-body"
          tabIndex={0}
          aria-label="User guide details"
        >
          <section aria-label="Workspace map" className="guide-map">
            <div>
              <div className="guide-step-heading">
                <span className="guide-step-icon">
                  <ListTree aria-hidden="true" />
                </span>
                <span className="guide-step-number">01</span>
              </div>
              <strong>Explorer</strong>
              <span>Choose a page or resource.</span>
            </div>
            <ArrowRight aria-hidden="true" className="guide-map-arrow" />
            <div>
              <div className="guide-step-heading">
                <span className="guide-step-icon">
                  <Braces aria-hidden="true" />
                </span>
                <span className="guide-step-number">02</span>
              </div>
              <strong>Inspector</strong>
              <span>
                Follow references like <code>3 0 R</code>.
              </span>
            </div>
            <ArrowRight aria-hidden="true" className="guide-map-arrow" />
            <div>
              <div className="guide-step-heading">
                <span className="guide-step-icon">
                  <Binary aria-hidden="true" />
                </span>
                <span className="guide-step-number">03</span>
              </div>
              <strong>Original bytes</strong>
              <span>See the selection in the file.</span>
            </div>
          </section>
          <section className="guide-tools" aria-label="Useful controls">
            <div>
              <Search aria-hidden="true" />
              <div>
                <h2>Find your way</h2>
                <p>
                  Search objects, dictionary keys, file text, hex, or decoded
                  streams. Use Back and the trail above the panes to retrace
                  your steps.
                </p>
              </div>
            </div>
            <div>
              <BookmarkPlus aria-hidden="true" />
              <div>
                <h2>Bookmark a finding</h2>
                <p>
                  Select an object or byte range, click Bookmark, and add a
                  note. Reopen the same PDF to restore your bookmarks.
                </p>
              </div>
            </div>
            <div>
              <Pin aria-hidden="true" />
              <div>
                <h2>Pin to compare</h2>
                <p>
                  Pin one object, then select another. Compare their dictionary
                  values side by side, or show differences only.
                </p>
              </div>
            </div>
          </section>
          <section className="guide-examples">
            <h2>Try it yourself</h2>
            <p>
              Start with a sample from the home screen, or explore your own PDF.
            </p>
            <details open>
              <summary>
                <Type aria-hidden="true" />
                Trace text to drawing commands
              </summary>
              <div>
                <p>
                  Open <strong>A simple page</strong>, choose{" "}
                  <strong>First page</strong>, then follow its{" "}
                  <code>/Contents</code> reference. Switch to{" "}
                  <strong>Decoded</strong> to find{" "}
                  <code>Hello, PDF internals.</code> inside the text drawing
                  commands.
                </p>
                <p>
                  Use <strong>Page preview</strong> to connect those commands to
                  what the page looks like.
                </p>
              </div>
            </details>
            <details>
              <summary>
                <Image aria-hidden="true" />
                Find embedded fonts and images
              </summary>
              <div>
                <p>
                  Open <strong>Fonts &amp; resources</strong> and choose{" "}
                  <strong>Resources</strong> in the Explorer. Choose the
                  <strong> Fonts</strong> or <strong>Images</strong> filter to
                  narrow the list. Inspect a font or image to see its dictionary
                  and the pages where it is available. Availability does not
                  prove it is drawn on a page.
                </p>
                <p>
                  In your own PDFs, follow a font’s descriptor to its font
                  stream, or inspect an image’s dimensions and filters. A font
                  resource does not always contain an embedded font file.
                </p>
                <p>
                  In <strong>Resources → Images</strong>, click
                  <strong> Download image</strong> to export supported RGB or
                  grayscale images as full-size PNGs, or embedded JPEGs as JPEG
                  files. The same button appears in the image’s inspector.
                  Exports do not include page transforms. JPEG exports also omit
                  page masks and color adjustments; PNG export does not support
                  masks or custom color spaces.
                </p>
                <p>
                  Image previews appear automatically as you scroll. When a
                  preview cannot be generated, its reason appears in place of
                  the image. Download sizes show the exported file’s size;
                  <strong> In PDF</strong> is the stored stream size and can
                  differ because of compression or conversion to PNG.
                </p>
                <p>
                  When a font file is embedded, its inspector offers
                  <strong> Download font</strong>. Fonts may be partial and
                  contain only the characters used in this PDF; extraction does
                  not restore the complete original font.
                </p>
              </div>
            </details>
            <details>
              <summary>
                <Files aria-hidden="true" />
                Compare page settings
              </summary>
              <div>
                <p>
                  Open a PDF with several pages. Select a page in{" "}
                  <strong>Pages</strong>, click <strong>Pin to compare</strong>,
                  then select another page.
                </p>
                <p>
                  Compare <code>/MediaBox</code>, <code>/CropBox</code>,{" "}
                  <code>/Rotate</code>, and resource references. Missing page
                  entries may inherit values from a parent in the page tree.
                </p>
              </div>
            </details>
            <details>
              <summary>
                <Paperclip aria-hidden="true" />
                Look for attachments
              </summary>
              <div>
                <p>
                  Choose <strong>Resources → Attachments</strong> to see
                  identified attachments by filename. Search by filename and
                  click <strong>Download attachment</strong> directly in the
                  list, or open its object to inspect it.
                </p>
                <p>
                  In <strong>Document catalog</strong>, follow{" "}
                  <code>/Names</code> → <code>/EmbeddedFiles</code>. Follow the
                  name tree’s <code>/Kids</code> or <code>/Names</code> entries
                  to a file specification, then <code>/EF</code> to its embedded
                  file stream.
                </p>
                <p>
                  Also check page <code>/Annots</code> for{" "}
                  <code>/FileAttachment</code> annotations and their{" "}
                  <code>/FS</code> references, and <code>/AF</code> for
                  associated files. These files may not appear in the page
                  preview.
                </p>
                <p>
                  Click <strong>Download attachment</strong> on the file
                  specification or embedded stream to save its decoded contents.
                  Downloads require supported filters and are limited to 32 MiB
                  per decoded file. Incomplete files are not downloaded.
                </p>
                <p>
                  The attachment list covers indexed objects. Unavailable or
                  unparsed objects may contain other files; an empty list does
                  not prove that a PDF has no attachments.
                </p>
              </div>
            </details>
            <details>
              <summary>
                <ShieldCheck aria-hidden="true" />
                Investigate suspicious features
              </summary>
              <div>
                <p>
                  Use <strong>Keys</strong> search for <code>JavaScript</code>,{" "}
                  <code>JS</code>, <code>OpenAction</code>, <code>AA</code>, or{" "}
                  <code>Launch</code>, then follow their references. Use
                  decoded-stream search for a known text string, or file hex
                  search for a known byte sequence.
                </p>
                <p>
                  These features can have legitimate uses. Search matches are
                  clues, not virus detections: there is no antivirus signature
                  database, payload execution analysis, or safe-file verdict.
                  Compression, encryption, unsupported filters, and obfuscation
                  can hide content from searches.
                </p>
              </div>
            </details>
          </section>
          <details className="guide-details">
            <summary>More about inspection, bookmarks, and comparison</summary>
            <p>
              <strong>Inspection:</strong> Properties shows values and
              relationships; Source shows syntax. Streams also offer Raw stream
              and Decoded tabs. Decoded offsets differ from original file
              offsets. Click a byte or jump to an offset in Original bytes.
            </p>
            <p>
              <strong>Workspace:</strong> Overview summarizes the PDF; File
              structure shows trailer and cross-reference information; All
              objects lists indexed objects. Drag dividers to resize panes. On
              small screens, use Explorer, Inspector, and Original bytes tabs.
            </p>
            <p>
              <strong>Bookmarks:</strong> Saved in this browser using a hash of
              the PDF’s contents, even if you rename the file. Changed PDFs have
              separate bookmarks. The PDF and password are not saved. Clearing
              site data removes bookmarks; notes from encrypted PDFs remain
              readable in browser storage. Use a bookmark’s trash button to
              delete it.
            </p>
            <p>
              <strong>Comparison:</strong> Checks dictionary values, not stream
              payloads or original syntax. Drag the horizontal divider or focus
              it and use arrow keys. Unpin object closes the comparison; closing
              or replacing the PDF clears the pin.
            </p>
          </details>
        </div>
        <DialogFooter className="limitations-footer">
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
