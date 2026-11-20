import type { MouseEvent } from "react"
import { BrandArtwork } from "@/components/brand-artwork"
import { SiteLinks } from "@/components/site-links"
import {
  PRIVACY_SUMMARY,
  PROJECT_URL,
  SITE_PAGES,
  type SitePage,
} from "@/lib/site-content"
import {
  MAX_INPUT_BYTES,
  MAX_DISPLAY_BYTES,
  MAX_OBJECTS,
  MAX_DECODED_BYTES,
  OPERATION_TIMEOUT_MS,
} from "@/lib/pdf/limits"

const fixtureSource = `${PROJECT_URL}/blob/main/scripts/fixtures/pdf-fixtures.mjs`
function SampleLinks({ sample, label }: { sample: string; label: string }) {
  return (
    <p className="article-actions">
      <a href={`/?sample=${sample}`}>Explore {label}</a>
      <a href={`/samples/${sample}.pdf`} download>
        Download sample PDF
      </a>
    </p>
  )
}

function Guide() {
  return (
    <>
      <p className="about-lead">
        Open a PDF, select a page, follow its references, and inspect the
        original bytes. PDF Internals is a read-only browser workspace for
        developers; PDF processing happens locally without uploading your
        document.
      </p>
      <h2>Start with a known example</h2>
      <SampleLinks sample="minimal" label="A simple page" />
      <ol>
        <li>
          Open <strong>A simple page</strong>, then choose{" "}
          <strong>First page</strong> in the document overview.
        </li>
        <li>
          In the Inspector, follow the page’s <code>/Contents</code> reference,{" "}
          <code>4 0 R</code>.
        </li>
        <li>
          Choose <strong>Decoded</strong> to read the text drawing commands,
          including <code>Hello, PDF internals.</code>
        </li>
        <li>
          Use <strong>Original bytes</strong> to see the selected object’s
          location in the unchanged file. Open <strong>Page preview</strong> to
          see the rendered page.
        </li>
      </ol>
      <h2>Understand the three views</h2>
      <dl>
        <dt>Explorer</dt>
        <dd>Choose pages, resources, file structure, or individual objects.</dd>
        <dt>Inspector</dt>
        <dd>
          Read properties, follow references, compare dictionaries, and inspect
          source or stream representations.
        </dd>
        <dt>Original bytes</dt>
        <dd>
          Examine the file in hex and byte text. Compressed objects identify
          their container and decoded offset instead of an individual
          original-file range.
        </dd>
      </dl>
      <h2>Investigate a question</h2>
      <ul>
        <li>
          <a href="/guides/inspect-pdf-objects">
            Understand objects and references such as 3 0 R
          </a>
          .
        </li>
        <li>
          <a href="/guides/decode-pdf-streams">
            Compare raw, decoded, and compressed stream representations
          </a>
          .
        </li>
        <li>
          <a href="/guides/find-pdf-fonts-images">
            Find font and image resources
          </a>
          .
        </li>
      </ul>
      <h2>Search, bookmark, and compare</h2>
      <p>
        Search objects, dictionary keys, file byte text, hex, or decoded stream
        byte text. Decoded search reads bounded previews; it does not extract
        rendered page text. Use Back and Forward to retrace your inspection.
      </p>
      <p>
        Bookmark an object or byte range and add a note. Bookmarks persist in
        this browser when storage is available. Pin one object, then select
        another to compare dictionary values. Stream payloads are not compared.
      </p>
      <p>
        Use Ctrl/Cmd+O to open a PDF and Ctrl/Cmd+K to focus search. On narrow
        screens, switch between Explorer, Inspector, and Original bytes tabs.
      </p>
      <p>
        Before investigating your own document, review{" "}
        <a href="/privacy">browser storage and privacy</a> and{" "}
        <a href="/limitations">supported features and limits</a>.
      </p>
    </>
  )
}
function ObjectsGuide() {
  return (
    <>
      <p className="about-lead">
        <code>3 0 R</code> is an indirect reference to PDF object number 3,
        generation 0. It points to an object defined elsewhere in the file,
        rather than containing that object’s value inline.
      </p>
      <h2>Follow a page to its drawing instructions</h2>
      <p>
        The original <strong>A simple page</strong> sample contains five
        indirect objects. Object 1 is the document catalog, object 2 is the
        page-tree root, object 3 is a page, object 4 holds drawing instructions,
        and object 5 is a Helvetica font resource.
      </p>
      <SampleLinks sample="minimal" label="A simple page" />
      <pre>
        <code>{`3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 612 792]
   /Contents 4 0 R >>
endobj`}</code>
      </pre>
      <p>
        Here <code>/Parent 2 0 R</code> points to the page’s parent in the page
        tree. <code>/Contents 4 0 R</code> points to its content stream.{" "}
        <code>/MediaBox</code> is an inline array describing the page boundary
        in PDF user-space units.
      </p>
      <ol>
        <li>
          Open the sample and select <strong>First page</strong>.
        </li>
        <li>
          Inspect its Properties, then click <strong>4 0 R</strong> beside{" "}
          <code>/Contents</code>.
        </li>
        <li>
          Switch to <strong>Decoded</strong> to read the instructions, or{" "}
          <strong>Source</strong> to inspect the object representation.
        </li>
        <li>
          Use Back to return to the page. Follow <strong>2 0 R</strong> to see
          its parent and inherited resources.
        </li>
      </ol>
      <h2>Properties and original syntax are different evidence</h2>
      <p>
        The snippet above reformats the sample for readability. The Properties
        view is a semantic interpretation: dictionary order, duplicate keys, and
        exact string spellings may be normalized. Use Original bytes when exact
        file syntax matters.
      </p>
      <p>
        Objects stored inside compressed object streams have decoded locations
        within a container, not separate original-file offsets. Recovered or
        unavailable positions are explicitly labeled. A reference to an
        unavailable object does not prove that the object never existed.
      </p>
      <h2>Continue exploring</h2>
      <p>
        <a href="/guides/decode-pdf-streams">
          Learn about raw and decoded streams
        </a>
        , or{" "}
        <a href="/guides/find-pdf-fonts-images">
          follow the page’s font and image resources
        </a>
        .
      </p>
      <p className="article-source">
        Example source:{" "}
        <a href={fixtureSource}>
          original sample generator, baseObjects and minimalPdf
        </a>
        . This is a walkthrough of the bundled fixture, not a claim of complete
        PDF conformance.
      </p>
    </>
  )
}
function StreamsGuide() {
  return (
    <>
      <p className="about-lead">
        A PDF stream stores bytes alongside a dictionary describing them. When a
        stream has a supported <code>/Filter</code>, decoding reverses that
        encoding so you can inspect its contents. Decoded byte positions are
        separate from original file offsets.
      </p>
      <h2>Inspect a Flate-compressed content stream</h2>
      <p>
        The <strong>Fonts &amp; resources</strong> sample stores object 4’s page
        instructions with <code>/Filter /FlateDecode</code>. Its decoded content
        includes:
      </p>
      <pre>
        <code>{`BT
/F1 24 Tf
72 700 Td
(Resources and references) Tj
ET
q
120 0 0 120 72 500 cm
/Im1 Do
Q`}</code>
      </pre>
      <SampleLinks sample="resources" label="Fonts & resources" />
      <ol>
        <li>
          Choose <strong>First page</strong>, then follow <code>/Contents</code>{" "}
          to object 4.
        </li>
        <li>
          Inspect <code>/Filter</code> in Properties. Select{" "}
          <strong>Raw stream</strong> to see the stored, compressed payload.
        </li>
        <li>
          Select <strong>Decoded</strong> to inspect the decoded bytes. Use{" "}
          <strong>Readable instructions</strong> for explanations and resource
          links.
        </li>
        <li>
          Find <code>/Im1 Do</code>, which invokes the named XObject in this
          example. Use Page preview to compare the instructions with the
          rendered page.
        </li>
      </ol>
      <h2>A compressed object stream is a different concept</h2>
      <p>
        A content stream holds page drawing instructions. An object stream,
        identified by <code>/Type /ObjStm</code>, packs other objects into its
        decoded payload. The <strong>Compressed objects</strong> sample packs
        its catalog, page tree, page, and font into object 6. Object 4’s page
        content remains outside that container.
      </p>
      <SampleLinks sample="compressed" label="Compressed objects" />
      <p>
        Open that sample and inspect First page. Its provenance identifies the
        object-stream container and decoded position. Do not interpret that
        decoded offset as an offset into the original file.
      </p>
      <h2>Decoding limits</h2>
      <p>
        The inspector supports Flate, ASCIIHex, ASCII85, and supported chains of
        those filters. Other encodings retain raw inspection where available.
        The independent page renderer may display content that the inspector
        cannot decode.
      </p>
      <p>
        Displayed stream previews stop at {MAX_DISPLAY_BYTES / 1024} KiB.
        Decoded search only checks those previews and is byte-text search, not
        extracted page text. Decoding is limited to{" "}
        {MAX_DECODED_BYTES / 1024 / 1024} MiB per stream. Read the{" "}
        <a href="/limitations">complete limitations</a> before drawing
        conclusions from partial results.
      </p>
      <p className="article-source">
        Example source:{" "}
        <a href={fixtureSource}>
          original sample generator, resourcesPdf and compressedPdf
        </a>
        .{" "}
        <a href="/guides/inspect-pdf-objects">Review objects and references</a>.
      </p>
    </>
  )
}
function ResourcesGuide() {
  return (
    <>
      <p className="about-lead">
        A PDF page’s resources identify fonts, images, and other named objects
        available to its drawing instructions. Use the resource browser to
        inspect them, then follow their references and page context.
        Availability alone does not prove that a resource is drawn.
      </p>
      <h2>Find the sample’s font and image</h2>
      <SampleLinks sample="resources" label="Fonts & resources" />
      <ol>
        <li>
          Open the sample and choose <strong>Resources</strong> in the Explorer.
        </li>
        <li>
          Choose <strong>Fonts</strong> to find the Helvetica font at object 5.
          Inspect its <code>/BaseFont</code> and <code>/Subtype</code>.
        </li>
        <li>
          Choose <strong>Images</strong> to find object 6: a 1 × 1 image with{" "}
          <code>/ColorSpace /DeviceRGB</code> and 8 bits per component.
        </li>
        <li>
          Inspect the page’s parent, object 2, to see the resources inherited by
          the page.
        </li>
        <li>
          Follow the page’s content stream to connect <code>/F1</code> and{" "}
          <code>/Im1</code> with the instructions using them.
        </li>
      </ol>
      <pre>
        <code>{`/Resources <<
  /Font << /F1 5 0 R >>
  /XObject << /Im1 6 0 R >>
>>`}</code>
      </pre>
      <h2>A font resource may have no embedded file</h2>
      <p>
        The sample’s Helvetica dictionary does not embed a font program. For
        your own PDF, follow a font’s descriptor to its font stream if one
        exists. A supported embedded font offers Download font, but it may be a
        subset containing only characters used by the PDF. Extraction cannot
        restore the complete original font, and some font programs are not
        directly installable.
      </p>
      <h2>Image dimensions and page appearance differ</h2>
      <p>
        The sample’s 1 × 1 image is scaled by the page instructions. Download
        image exports its stored dimensions, without page transforms. Supported
        RGB or grayscale samples export as PNG; supported standalone JPEG
        streams can be saved without re-encoding.
      </p>
      <p>
        PNG export does not support masks or custom color spaces. JPEG
        extraction omits page masks and color adjustments. PNG conversion is
        limited to 4 megapixels and 4096 pixels per side; image payloads are
        limited to 32 MiB. An image export is not necessarily an exact
        reproduction of its appearance on the page.
      </p>
      <h2>Attachments are separate resources</h2>
      <p>
        The sample also includes <code>notes.txt</code>. Choose{" "}
        <strong>Resources → Attachments</strong> to find and download it. An
        empty attachment list is not proof that a partially parsed document
        contains no attachments.
      </p>
      <p className="article-source">
        Example source:{" "}
        <a href={fixtureSource}>original sample generator, resourcesPdf</a>. See{" "}
        <a href="/limitations">supported operations and limits</a> and the{" "}
        <a href="/guide">workspace guide</a>.
      </p>
    </>
  )
}
function Privacy() {
  return (
    <>
      <p className="about-lead">{PRIVACY_SUMMARY}</p>
      <h2>What stays in memory</h2>
      <p>
        Your PDF and its password are held in memory while the document is open.
        Closing or replacing it clears the active workspace and terminates its
        parser worker. The app does not upload your document to a processing
        service.
      </p>
      <h2>What persists in this browser</h2>
      <p>
        Bookmarks, selected object or byte-range locations, labels, and notes
        are saved in local browser storage. A SHA-256 hash of the PDF contents
        associates those bookmarks with the same file when you reopen it, even
        if its filename changes. A changed file has separate bookmarks. The PDF
        and password are not saved.
      </p>
      <p>
        Notes created while inspecting an encrypted PDF remain readable in
        browser storage. Do not put information in a note that you do not want
        retained on this device.
      </p>
      <p>
        If browser storage is unavailable, bookmarks work for the current open
        file only, and the app explains that they are not saved.
      </p>
      <h2>Delete saved information</h2>
      <p>
        Use a bookmark’s trash button to remove that bookmark and its note. To
        remove all saved bookmarks, clear this site’s data in your browser
        settings. Closing the tab alone does not delete saved bookmarks.
      </p>
      <h2>Website requests</h2>
      <p>
        Your browser requests the application, fonts, worker assets, and any
        bundled sample you choose from the site host. Hosting infrastructure may
        process ordinary request information. Local PDF processing does not mean
        that loading the website involves no network requests.
      </p>
      <p>
        The application has no analytics integration. Please remove sensitive
        information before sharing examples in{" "}
        <a href={`${PROJECT_URL}/issues`}>GitHub feedback</a>.
      </p>
      <p className="article-source">
        Implementation:{" "}
        <a href={`${PROJECT_URL}/blob/main/src/lib/pdf/bookmark-storage.ts`}>
          bookmark storage
        </a>{" "}
        and{" "}
        <a href={`${PROJECT_URL}/blob/main/src/lib/pdf/client.ts`}>
          local parser worker client
        </a>
        .
      </p>
    </>
  )
}
function Limitations() {
  return (
    <>
      <p className="about-lead">
        PDF Internals is an early, read-only exploration tool. It can inspect
        the current object structure, references, streams, resources, and
        original bytes. Some PDFs are only partially supported; recovered or
        unavailable data is labeled.
      </p>
      <h2>File and processing limits</h2>
      <dl>
        <dt>Maximum input size</dt>
        <dd>{MAX_INPUT_BYTES / 1024 / 1024} MiB</dd>
        <dt>Maximum indexed objects</dt>
        <dd>{MAX_OBJECTS.toLocaleString("en-US")}</dd>
        <dt>Decoded bytes per stream</dt>
        <dd>{MAX_DECODED_BYTES / 1024 / 1024} MiB</dd>
        <dt>Displayed source/stream preview</dt>
        <dd>{MAX_DISPLAY_BYTES / 1024} KiB</dd>
        <dt>Parser operation timeout</dt>
        <dd>{OPERATION_TIMEOUT_MS / 1000} seconds</dd>
      </dl>
      <p>
        The cumulative decoded-data budget is 128 MiB per document. This is not
        a total browser-memory limit: object graphs, original bytes, copies, UI
        strings, and page rendering require additional memory. Large object
        graphs can still be expensive.
      </p>
      <h2>Decoding and encrypted PDFs</h2>
      <p>
        Supported inspector filters are Flate, ASCIIHex, ASCII85, and supported
        chains. Other filters retain raw inspection when available. Preview uses
        an independent renderer with different capabilities.
      </p>
      <p>
        Files with an empty opening password unlock automatically. Otherwise,
        enter an opening or owner password for supported local inspection and
        preview. Original source and raw stream bytes remain encrypted; readable
        properties and decoded streams are separate decrypted representations.
        Unsupported encryption remains unavailable.
      </p>
      <h2>Fidelity and incomplete results</h2>
      <p>
        Original bytes are authoritative. Semantic properties may normalize
        syntax and collapse duplicate dictionary keys. Compressed objects have
        decoded locations in their container, not individual original-file
        offsets. Damaged-file recovery may be incomplete.
      </p>
      <p>
        Decoded search checks bounded previews, stops at 500 results, and does
        not extract rendered page text. Font or image availability does not
        prove page usage. Resource lists cover indexed objects; unparsed objects
        can contain additional resources.
      </p>
      <h2>Exports and comparisons</h2>
      <p>
        Dictionary comparison does not compare stream payloads or original
        syntax. Attachment and font downloads require supported decoding and
        complete data, up to 32 MiB per file. Fonts can be incomplete subsets.{" "}
        <a href="/guides/find-pdf-fonts-images">Image exports</a> have size,
        codec, mask, color-space, and page-transform restrictions.
      </p>
      <h2>Unavailable operations</h2>
      <p>
        Editing, repair, saving modified PDFs, signature validation, historical
        object revisions, precise rendered-content-to-byte mapping, and
        extracted page-text search are not available.
      </p>
      <h2>Browser coverage and evidence</h2>
      <p>
        Automated checks target Chromium, Firefox, and WebKit. The Safari
        application and broader device/PDF combinations still need validation.{" "}
        <a href={`${PROJECT_URL}/blob/main/docs/CORPUS.md`}>
          Independent corpus observations
        </a>{" "}
        describe tested files and known partial results; they do not establish
        universal PDF support.
      </p>
      <h2>Credits</h2>
      <p>
        Application code is licensed under the Apache License 2.0. Parsing uses LibPDF; optional preview
        uses EmbedPDF and PDFium locally. Dependencies retain their own
        licenses. Read the{" "}
        <a href="/THIRD-PARTY-NOTICES.txt">third-party notices</a>.
      </p>
    </>
  )
}

export function PublicPage({
  page,
  onFollowLink,
}: {
  page: SitePage
  onFollowLink?: (event: MouseEvent<HTMLElement>) => boolean
}) {
  return (
    <main
      className="about-page public-page"
      tabIndex={-1}
      aria-labelledby="public-title"
      onClick={onFollowLink}
    >
      <article>
        <a className="back-to-workspace" href="/">
          <span aria-hidden="true">← </span>Back to the workspace
        </a>
        <nav className="article-breadcrumbs" aria-label="Breadcrumb">
          <a href="/">PDF Internals</a>
          <span aria-hidden="true"> / </span>
          {page.path.startsWith("/guides/") && (
            <>
              <a href="/guide">Guide</a>
              <span aria-hidden="true"> / </span>
            </>
          )}
          <span aria-current="page">
            {page.path === "/guide"
              ? "Guide"
              : page.path === "/privacy"
                ? "Privacy"
                : page.path === "/limitations"
                  ? "Limitations"
                  : "Tutorial"}
          </span>
        </nav>
        <h1 id="public-title">{page.heading}</h1>
        {page.path.startsWith("/guides/") && (
          <p className="article-byline">
            By <a href="https://github.com/antonsamper">Anton Samper</a> ·
            Reviewed <time dateTime="2026-11-14">14 November 2026</time>
          </p>
        )}
        {page.path === "/guide" ? (
          <Guide />
        ) : page.path === "/privacy" ? (
          <Privacy />
        ) : page.path === "/limitations" ? (
          <Limitations />
        ) : page.path === "/guides/inspect-pdf-objects" ? (
          <ObjectsGuide />
        ) : page.path === "/guides/decode-pdf-streams" ? (
          <StreamsGuide />
        ) : (
          <ResourcesGuide />
        )}
        <aside className="article-related" aria-label="More documentation">
          <h2>Keep exploring</h2>
          <ul>
            {SITE_PAGES.filter(
              (p) =>
                p.path !== "/" && p.path !== "/about" && p.path !== page.path
            ).map((p) => (
              <li key={p.path}>
                <a href={p.path}>{p.heading}</a>
              </li>
            ))}
          </ul>
        </aside>
      </article>
    </main>
  )
}

/** Direct article requests are complete documents and do not load the inspector. */
export function StaticPublicPage({ page }: { page: SitePage }) {
  return (
    <div className="app-shell static-public-shell">
      <header className="app-header">
        <a className="app-identity" href="/">
          <span className="app-mark">
            <BrandArtwork decorative />
          </span>
          <span>PDF Internals</span>
        </a>
        <a className="static-open-link" href="/">
          Open the inspector →
        </a>
      </header>
      <PublicPage page={page} />
      <SiteLinks />
    </div>
  )
}
