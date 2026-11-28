import { Lead } from '@/components/prose';
import { MAX_DECODED_BYTES, MAX_DISPLAY_BYTES } from '@/lib/pdf/limits';
export const AttachmentsGuide = function AttachmentsGuide() {
  return (
    <>
      <Lead>
        A PDF can carry other files inside it. Use the attachment list to find them, then inspect their references or download their
        contents.
      </Lead>
      <h2>Find an embedded file</h2>
      <ol>
        <li>
          Open your PDF and choose <strong>Resources → Attachments</strong>.
        </li>
        <li>Search by filename, then select an entry to inspect its object.</li>
        <li>
          Click <strong>Download attachment</strong> in the list or inspector to save its decoded contents. Inspecting a reference does not
          open the attached file.
        </li>
      </ol>
      <p>
        Each attachment is listed once per stream and filename, including identified embedded streams without file specifications. The size
        shown is the complete decoded file size where available. Resource filters persist when you inspect an object and return, and reset
        when you open another PDF.
      </p>
      <h2>Follow the references</h2>
      <p>
        In <strong>Document catalogue</strong>, follow <code>/Names</code> → <code>/EmbeddedFiles</code>. A name tree uses{' '}
        <code>/Kids</code> or <code>/Names</code> entries to lead to file specifications. Follow a file specification’s <code>/EF</code>{' '}
        reference to its embedded file stream.
      </p>
      <p>This illustrative file specification is not part of a bundled sample:</p>
      <pre>
        <code>{`<< /Type /Filespec
   /F (notes.txt)
   /EF << /F 12 0 R >> >>`}</code>
      </pre>
      <p>
        Here <code>/F (notes.txt)</code> names the file; <code>12 0 R</code> inside <code>/EF</code> points to the stream holding its
        contents. Follow that reference and check its dictionary and decoded bytes.
      </p>
      <p>
        Also check a page’s <code>/Annots</code> for <code>/FileAttachment</code> annotations and their <code>/FS</code> references, and
        look for associated files under <code>/AF</code>. Attachments may not appear in the page preview.
      </p>
      <h2>Understand the limits</h2>
      <p>
        Downloads require supported filters and are limited to {MAX_DECODED_BYTES / 1024 / 1024} MiB per decoded file. Incomplete files are
        not downloaded. The list covers indexed objects; unavailable or unparsed objects may contain other files. An empty list does not
        prove that the PDF has no attachments.
      </p>
      <p>
        For files you do not trust, continue with <a href="/guides/investigate-suspicious-features">investigating suspicious features</a>{' '}
        before opening an extracted attachment.
      </p>
    </>
  );
};
export const SearchGuide = function SearchGuide() {
  return (
    <>
      <Lead>
        Find a value, bookmark the evidence, and pin an object to compare it with another. These tools leave the original PDF unchanged.
      </Lead>
      <h2>Choose what to search</h2>
      <p>Use Ctrl/Cmd+K to focus search, then choose a mode:</p>
      <dl>
        <dt>Objects</dt>
        <dd>Find indexed objects by their number or description.</dd>
        <dt>Keys</dt>
        <dd>
          Find dictionary keys such as <code>MediaBox</code> or <code>JavaScript</code>.
        </dd>
        <dt>Page text</dt>
        <dd>
          Find words extracted from the page, including text split across drawing instructions. Results are grouped by page. Select a text
          byte location to highlight matching source syntax in the original or decoded hex view, or open a labelled candidate stream when
          exact mapping is unavailable. Open page preview highlights the returned matches on the rendered page, even when byte mapping is
          unavailable.
        </dd>
        <dt>File text</dt>
        <dd>Search the original file bytes as text.</dd>
        <dt>File hex</dt>
        <dd>Find a sequence of hexadecimal byte values.</dd>
        <dt>Decoded streams</dt>
        <dd>Search text in supported decoded stream previews.</dd>
      </dl>
      <p>
        Try the <a href="/?sample=minimal">A simple page sample</a>: choose <strong>Keys</strong>, search for <code>MediaBox</code>, and
        select the matching page. Use Back and Forward in the workspace to retrace your inspection.
      </p>
      <p>
        The first match opens automatically. Use the result counter and previous/next arrows to step through matches, wrapping at either
        end, or select a result directly. Results appear in a popover below the search field. Choosing a result reveals it in the workspace.
        Escape or clicking outside hides the popover without clearing the query; click the Results button or use Ctrl/Cmd+K to reopen it.
        Previous/next controls are in the results popover. Changing the search type immediately searches the current query again. From the
        search field, Down Arrow focuses the list; Up/Down moves through results and Enter chooses one. Results stop at 500; incomplete
        searches are labelled. File text treats the original bytes as Latin-1 text.
      </p>
      <p>
        Page text source mapping currently supports common ASCII fonts and fixed-width ToUnicode character and range maps in direct page
        content streams. Source locations may differ from rendered reading order. Compressed content has exact decoded ranges, with only its
        containing stream highlighted in the original file. Scanned pages without text need OCR. For a step-by-step walkthrough, see{' '}
        <a href="/examples/find-text-source">how to find the source bytes behind text</a>.
      </p>
      <p>
        Decoded search checks only the first {MAX_DISPLAY_BYTES / 1024} KiB of each stream. It reads bytes as characters, rather than
        extracting the text shown on a rendered page. Compressed or encrypted content may not match a file-text search.
      </p>
      <h2>Why can a word be found without exact byte highlights?</h2>
      <p>
        Page text search and source mapping are separate steps. The page search engine can find words that our source mapper cannot yet
        trace to bytes. “Exact text bytes could not be mapped” means the selected stream has no mapped match. It does not mean the page
        search failed or the PDF is damaged.
      </p>
      <p>
        Common causes include unsupported font encodings, text inside Form XObjects, spaces or reading order reconstructed from glyph
        positions, and incomplete stream inspection. The message alone cannot identify which cause applies. Check other source locations for
        Show bytes, or use Open page preview to inspect the page. Inspect content stream opens a candidate container; its highlight does not
        identify the word.
      </p>
      <p>
        Compression or encryption alone does not prevent decoded byte mapping. When mapping succeeds, Decoded bytes highlights the matching
        source text, while Original bytes can highlight only its containing stream.
      </p>
      <p>
        A visible word may be split across several strings: “lorem” can be stored as <code>(lor) 17 (em)</code>, where the number adjusts
        spacing. In File text or Decoded streams, try a shorter fragment, then read the surrounding instruction. The{' '}
        <a href="/guides/decode-pdf-streams">Streams guide</a> explains how to read these text and spacing instructions.
      </p>
      <h2>Save a finding</h2>
      <ol>
        <li>
          Select an object or a byte range and click <strong>Bookmark</strong>.
        </li>
        <li>Add a note describing what you found.</li>
        <li>Select the bookmark to return to it, or use its trash button to delete it.</li>
      </ol>
      <p>
        Bookmarks are saved in this browser and restored when you reopen the same PDF, even if it has been renamed. Changed files have
        separate bookmarks. The PDF and password are not saved. Clearing site data removes bookmarks; notes from encrypted PDFs remain
        readable in browser storage. See <a href="/privacy">privacy and browser storage</a>.
      </p>
      <p>
        If browser storage is unavailable, bookmarks remain usable for the current file and a status message explains that they are not
        saved.
      </p>
      <h2>Compare two objects</h2>
      <ol>
        <li>
          Select a page or object, then click <strong>Pin to compare</strong>.
        </li>
        <li>Select another object to compare its dictionary values with the pinned one.</li>
        <li>Choose differences only to narrow the comparison, or unpin to close it.</li>
      </ol>
      <p>
        For a PDF with several pages, compare <code>/MediaBox</code>, <code>/CropBox</code>, <code>/Rotate</code>, and resource references.
        Missing page entries may inherit values from a parent in the page tree. Comparison checks dictionary values; it does not compare
        stream bytes or original syntax.
      </p>
      <p>
        Drag the horizontal divider, or focus it and use the arrow keys, to resize the comparison. Closing or replacing the PDF clears the
        pin.
      </p>
    </>
  );
};
export const SuspiciousFeaturesGuide = function SuspiciousFeaturesGuide() {
  return (
    <>
      <Lead>
        Look for scripts, automatic actions, launch actions, and embedded files, then follow their references to understand what the PDF
        contains.
      </Lead>
      <h2>List the actions</h2>
      <ol>
        <li>
          Open the PDF and choose <strong>Actions</strong> in the explorer.
        </li>
        <li>
          Each row shows the trigger, the <code>/S</code> action type, a short target and the object that holds the action. Rows for{' '}
          <code>/JavaScript</code>, <code>/Launch</code>, <code>/SubmitForm</code> and <code>/ImportData</code>, and rendition actions that
          carry a script, have an orange rule and a label. Actions chained with <code>/Next</code> are indented under the action before
          them. Control and text-direction characters in targets are shown as code points, such as <code>⟨U+202E⟩</code>, so a file name
          can't disguise itself.
        </li>
        <li>
          For a script stored in a stream, choose <strong>Show decoded script</strong>. The text is decoded and nothing runs. Choose{' '}
          <strong>Inspect</strong> to open the stream, and check <strong>Original bytes</strong> when you need the exact syntax stored in
          the file.
        </li>
        <li>
          Document-level scripts sit in the catalogue’s <code>/Names /JavaScript</code> tree and run when the file opens. Each entry gets
          its own row, named after its key. <strong>Inspect holder</strong> opens the tree node that lists it. A node written inline has no
          object of its own, so the button opens the object that contains it.
        </li>
        <li>An action that is malformed or points to a missing object stays in the list with a note.</li>
      </ol>
      <h2>Search for what Actions leaves out</h2>
      <p>
        Actions reads the catalogue and its <code>/Names /JavaScript</code> tree, pages, annotations, form fields and outline. Scripts
        inside XFA forms and actions stored anywhere else are not listed. A note at the top of the list says when the document has an XFA
        form. To find them, select <strong>Keys</strong> in search and look for <code>JavaScript</code> and <code>JS</code>, then{' '}
        <code>OpenAction</code> and <code>AA</code>. Select a result to inspect the dictionary that holds it.
      </p>
      <h2>Read what you found</h2>
      <p>
        <code>/OpenAction</code> identifies an action or destination used when opening a document; it is not always a script.{' '}
        <code>/AA</code> holds additional actions associated with events. In an action dictionary, <code>/S /JavaScript</code> identifies a
        JavaScript action and <code>/JS</code> holds its script or a reference to it. <code>/S /Launch</code> identifies a launch action.
      </p>
      <p>These illustrative entries connect a catalogue’s opening action to a script stream. They are not part of the bundled samples:</p>
      <pre>
        <code>{`1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction 8 0 R >>
endobj

8 0 obj
<< /S /JavaScript /JS 9 0 R >>
endobj`}</code>
      </pre>
      <p>
        Actions shows this as one row: <strong>Document opens</strong>, <code>/S /JavaScript</code>, with the script in stream 9. To trace
        it by hand, start at object 1, follow <code>/OpenAction 8 0 R</code>, then <code>/JS 9 0 R</code> to inspect the script stream.
        Record the references and bookmark the relevant objects. Finding the word “JavaScript” alone gives less context than tracing this
        relationship.
      </p>
      <h2>Check embedded files and known strings</h2>
      <p>
        Use <a href="/guides/find-pdf-attachments">Resources → Attachments</a> to inspect embedded files and their file specifications. For
        a known string, choose <strong>Decoded streams</strong>; for a known byte sequence, choose <strong>File hex</strong>.
      </p>
      <h2>Review reported issues</h2>
      <p>
        Open <strong>Issues</strong> for parser diagnostics and object warnings, with links to affected objects or file structure. Error and
        warning counts are separate from inspection limitations and information notes. Stream-read failures appear when you inspect or
        search those streams; preview and download errors stay beside the relevant action.
      </p>
      <p>
        A clean result means the checks detected no issues; they do not validate every stream, page appearance, signature, or PDF
        conformance requirement. Locked and recovered documents identify incomplete coverage.
      </p>
      <h2>Interpret the results carefully</h2>
      <p>
        These features can have legitimate uses. A match identifies something to investigate; it does not establish that a file is
        malicious. PDF Internals does not run an antivirus signature scan, analyse what a payload would do when run, or declare a file safe.
      </p>
      <p>
        An empty search does not establish safety. Compression, encryption, unsupported filters, obfuscation, and unavailable objects can
        hide content. Decoded search covers only the first {MAX_DISPLAY_BYTES / 1024} KiB per stream. Review the{' '}
        <a href="/limitations">inspection limits</a> before drawing conclusions.
      </p>
    </>
  );
};
