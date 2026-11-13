import type { RefObject } from "react"
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
      <DialogContent className="limitations-dialog" finalFocus={returnFocusRef}>
        <DialogHeader className="limitations-heading">
          <DialogTitle>User guide</DialogTitle>
          <DialogDescription>
            Open a PDF or a sample, then follow its objects to the bytes behind
            them.
          </DialogDescription>
        </DialogHeader>
        <div
          className="limitations-body"
          tabIndex={0}
          aria-label="User guide details"
        >
          <section>
            <h2>Explore the document</h2>
            <p>
              The left pane is your map. Overview summarizes the file; Catalog
              opens its root dictionary; Pages follows the page tree; Resources
              lists fonts, images, and other page resources; All objects lists
              the indexed objects; File structure shows the trailer and
              cross-reference information.
            </p>
            <p>
              Click a blue reference such as 3 0 R to inspect its object. The
              trail above the workspace shows the route you followed. Use Back,
              Forward, or a trail link to retrace your steps.
            </p>
          </section>
          <section>
            <h2>Inspect objects and bytes</h2>
            <p>
              The middle pane shows the selected object. Properties presents its
              values and relationships; Source shows its syntax. Streams also
              have Raw stream and Decoded tabs. Page preview renders the
              document separately from byte inspection.
            </p>
            <p>
              The right pane shows the original file bytes, with the selected
              object highlighted when its file location is known. Click a byte
              or jump to an offset to select a location. Decoded stream offsets
              are separate from original file offsets.
            </p>
            <p>
              Search by object, dictionary key, file text, file hex, or decoded
              stream. Drag the pane dividers to adjust the workspace. On smaller
              screens, switch between Explorer, Inspector, and Original bytes.
            </p>
          </section>
          <section>
            <h2>Bookmark a finding</h2>
            <p>
              Select an object or byte range and click Bookmark. Bookmarks
              appear below the explorer; add a note, click a bookmark to restore
              its location and inspector tab, or use its trash button to remove
              it.
            </p>
            <p>
              Bookmarks and notes are saved in this browser, keyed by a hash of
              the PDF’s contents. Reopen the same PDF to restore them, even if
              you renamed it. A changed PDF has separate bookmarks. The PDF
              itself and its password are not saved. Clearing browser site data
              removes saved bookmarks; notes from encrypted PDFs remain readable
              in browser storage.
            </p>
          </section>
          <section>
            <h2>Pin to compare</h2>
            <p>
              Open an object and click Pin to compare, then navigate to another
              object. The comparison above the inspector shows values side by
              side, marking entries as added, removed, changed, or the same
              relative to the pinned object. Show differences only hides
              matching entries.
            </p>
            <p>
              Drag the horizontal divider to give either section more room. You
              can also focus it and use the arrow keys. Each section scrolls
              independently. Unpin object closes the comparison. Pins last until
              you close or replace the PDF.
            </p>
            <p>
              Comparison checks dictionary entries and values; it does not
              compare stream payloads or original syntax.
            </p>
          </section>
        </div>
        <DialogFooter className="limitations-footer">
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
