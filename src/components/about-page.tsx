import type { MouseEvent } from "react"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { PROJECT_URL } from "@/components/site-links"

export function AboutPage({
  onFollowLink,
  onLimitations,
}: {
  onFollowLink: (event: MouseEvent<HTMLAnchorElement>) => boolean
  onLimitations: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <main className="about-page" tabIndex={-1} aria-labelledby="about-title">
      <article>
        <a
          className="back-to-workspace"
          href={import.meta.env.BASE_URL}
          onClick={onFollowLink}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to the workspace
        </a>
        <h1 id="about-title">A closer look at PDF.</h1>
        <p className="about-lead">
          PDF Internals connects the document you see to the objects,
          references, and bytes that make it work.
        </p>
        <section>
          <h2>Built for exploring</h2>
          <p>
            A PDF is more than a collection of pages. It contains dictionaries,
            fonts, images, and streams of drawing instructions, linked together
            by references. This workspace helps developers follow those
            connections while keeping the original file bytes in view.
          </p>
          <p>
            Open your own PDF or start with a bundled sample. Follow a page to
            its content stream, compare objects, or inspect the bytes behind a
            value. The tool is read-only, so exploring leaves your file
            unchanged.
          </p>
        </section>
        <section>
          <h2>Your files stay with you</h2>
          <p>
            PDF processing and page rendering happen on your device. The app
            does not upload or save your PDF. Documents, bookmarks, and notes
            stay in memory for the current session and clear when you close or
            replace the document.
          </p>
        </section>
        <section>
          <h2>An early, open-source project</h2>
          <p>
            Built by{" "}
            <a
              href="https://github.com/antonsamper"
              target="_blank"
              rel="noreferrer"
            >
              @antonsamper
            </a>
            . The application code is MIT licensed, and the source is available
            on{" "}
            <a href={PROJECT_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
          <p>
            Some PDFs and features are only partially supported. The inspector
            labels recovered structure and unavailable data; page rendering and
            byte inspection have different capabilities.
          </p>
          <button
            className="about-text-button"
            aria-haspopup="dialog"
            aria-controls="limitations-dialog"
            onClick={onLimitations}
          >
            Read the limitations and credits{" "}
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </section>
        <section className="about-feedback">
          <h2>Help make it better</h2>
          <p>
            Found a bug, have a question, or wish the viewer explained something
            better?{" "}
            <a href={`${PROJECT_URL}/issues`} target="_blank" rel="noreferrer">
              Leave feedback on GitHub
            </a>
            . Please remove sensitive information from any examples you share.
          </p>
        </section>
      </article>
    </main>
  )
}
