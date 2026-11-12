import type { RefObject } from "react"
import { ShieldCheck } from "lucide-react"
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

export function LimitationsDialog({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean
  returnFocusRef: RefObject<HTMLElement | null>
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="limitations-dialog"
        className="limitations-dialog"
        finalFocus={returnFocusRef}
      >
        <DialogHeader className="limitations-heading">
          <DialogTitle>About & limitations</DialogTitle>
          <DialogDescription>
            PDF Internals is an early, read-only exploration tool. Some PDFs and
            features are only partially supported.
          </DialogDescription>
        </DialogHeader>
        <div
          className="limitations-body"
          tabIndex={0}
          aria-label="Limitations details"
        >
          <section>
            <h2>What you can inspect</h2>
            <p>
              Explore the current object structure, follow references, inspect
              streams, and view original file bytes. Editing, repair, signature
              validation, and browsing older revisions are not available.
            </p>
          </section>
          <section>
            <h2>File and decoding support</h2>
            <ul>
              <li>
                <strong>Encrypted PDFs:</strong> original bytes remain
                available, but password entry and structure inspection are not
                supported.
              </li>
              <li>
                <strong>Stream decoding:</strong> Flate, ASCIIHex, ASCII85, and
                chains of these filters are supported. Other filters remain
                available as raw bytes. Page preview uses a separate renderer
                and may display content that the inspector cannot decode.
              </li>
              <li>
                <strong>Browser coverage:</strong> automated coverage targets
                Chromium, Firefox, and WebKit. The Safari application itself still
                needs verification.
              </li>
            </ul>
          </section>
          <section>
            <h2>Reading the results</h2>
            <p>
              Original bytes are the source of truth. Readable properties may
              normalize syntax or collapse duplicate dictionary keys. Objects in
              compressed streams have decoded positions, not individual file
              offsets. Recovered or unavailable source locations are labeled;
              results from damaged files may be incomplete.
            </p>
            <p>
              Stream text is a Latin-1 byte display, not extracted page text.
              Source and stream previews show up to 256 KiB each. Decoded search
              only checks that preview, so it can miss later content. Search
              results stop at 500 matches.
            </p>
          </section>
          <section>
            <h2>Resource limits</h2>
            <dl className="limitations-limits">
              <div>
                <dt>Maximum file size</dt>
                <dd>64 MiB</dd>
              </div>
              <div>
                <dt>Maximum indexed objects</dt>
                <dd>100,000</dd>
              </div>
              <div>
                <dt>Decoded data per stream</dt>
                <dd>32 MiB</dd>
              </div>
              <div>
                <dt>Total decoded-data budget</dt>
                <dd>128 MiB</dd>
              </div>
              <div>
                <dt>Parser operation timeout</dt>
                <dd>15 seconds</dd>
              </div>
            </dl>
            <p>
              Complex files may reach these limits. The decoded-data budget is
              not a cap on all browser memory; large documents may use more.
              Closing or replacing a document resets its workspace.
            </p>
          </section>
          <p className="limitations-privacy">
            <ShieldCheck size={15} aria-hidden="true" />
            Your PDF is processed on this device. The app does not upload or
            save it.
          </p>
        </div>
        <DialogFooter className="limitations-footer">
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
