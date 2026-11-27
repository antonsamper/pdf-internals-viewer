import type { MouseEvent } from 'react';

import type { SitePage } from '@/lib/site-content';

import { ContentHeaderLinks } from '@/components/content-navigation';
import { ArticleActions, ArticleSource, ComparisonTable, Lead } from '@/components/prose';
import { BackToWorkspace, ReadingPage } from '@/components/reading-page';
import { SiteHeader } from '@/components/site-header';
import { SiteLinks } from '@/components/site-links';
import { MAX_INPUT_BYTES, MAX_DISPLAY_BYTES, MAX_OBJECTS, MAX_DECODED_BYTES, OPERATION_TIMEOUT_MS } from '@/lib/pdf/limits';
import { PRIVACY_SUMMARY, PROJECT_URL } from '@/lib/site-content';
import { navigationLabel } from '@/lib/site-navigation';
import { cn } from '@/lib/utils';

import { Examples, LargePdfExample, IncorrectTextExample } from './examples';
import {
  FontExample,
  AttachmentExample,
  LogoExample,
  RotationExample,
  InheritanceExample,
  ActionExample,
  BrokenXrefExample,
  FindTextSourceExample,
} from './more-examples';
import { AudiencePage, InspectorVsViewerPage } from './overview-pages';
import { AttachmentsGuide, SearchGuide, SuspiciousFeaturesGuide } from './task-guides';
const SampleLinks = function SampleLinks({ sample, label }: { sample: string; label: string }) {
  return (
    <ArticleActions>
      <a href={`/?sample=${sample}`}>Explore {label}</a>
      <a href={`/samples/${sample}.pdf`} download>
        Download sample PDF
      </a>
    </ArticleActions>
  );
};
const Guide = function Guide() {
  return (
    <>
      <Lead>Start with a sample, then choose a task. Your PDF stays on your device; inspecting it does not change the file.</Lead>
      <h2>Try your first inspection</h2>
      <SampleLinks sample="minimal" label="A simple page" />
      <ol>
        <li>
          Choose <strong>First page</strong> in the document overview.
        </li>
        <li>
          Follow <code>/Contents</code> → <strong>4 0 R</strong> in the Inspector.
        </li>
        <li>
          Select <strong>Decoded</strong> to find <code>Hello, PDF internals.</code> in the drawing instructions. Open{' '}
          <strong>Page preview</strong> to see the result, or <strong>Original bytes</strong> to locate the selected object in the file.
        </li>
      </ol>
      <h2>Examples</h2>
      <p>
        Start with a symptom: <a href="/examples/large-pdf">an unexpectedly large invoice</a> or{' '}
        <a href="/examples/incorrect-text">an amount that extracts incorrectly</a>. See <a href="/examples">all examples</a>.
      </p>
      <h2>What would you like to do?</h2>
      <ul>
        <li>
          <a href="/guides/inspect-pdf-objects">Understand objects and references such as 3 0 R</a>
        </li>
        <li>
          <a href="/guides/decode-pdf-streams">Read and decode PDF streams</a>
        </li>
        <li>
          <a href="/guides/find-pdf-fonts-images">Find fonts and images</a>
        </li>
        <li>
          <a href="/guides/find-pdf-attachments">Find and extract attachments</a>
        </li>
        <li>
          <a href="/guides/search-bookmark-compare">Search, bookmark, and compare objects</a>
        </li>
        <li>
          <a href="/guides/investigate-suspicious-features">Investigate suspicious features</a>
        </li>
      </ul>
      <h2>Find your way around the workspace</h2>
      <p>
        Open a local PDF with the file picker, or drop it anywhere in the app. Use <strong>Properties</strong> for parsed values,{' '}
        <strong>Source</strong> for the object representation, and <strong>Raw stream</strong> or <strong>Decoded</strong> for stream data.
        Original bytes shows the file as stored, with the selected object's range highlighted when its location is known.
      </p>
      <p>
        Use <strong>Back</strong> and <strong>Forward</strong> to retrace objects, inspector tabs, sections, and selected byte ranges. Each
        visit restores its scroll positions. <strong>File structure</strong> opens the trailer and cross-reference entry point. Visiting a
        guide or example keeps your open PDF and selection in memory; choose <strong>Back to the workspace</strong> to continue.
      </p>
      <p>
        Expand <strong>Pages</strong> to browse each page's content streams, resources, and annotations. In the Inspector, follow{' '}
        <strong>References</strong> and <strong>Referenced by</strong> links, or expand a reference inline to keep its surrounding
        dictionary in view. The clickable exploration trail records your route through objects and dictionary keys. See the{' '}
        <a href="/guides/inspect-pdf-objects">objects and references guide</a> for a walkthrough.
      </p>
      <p>
        On a small screen, switch between the <strong>Explorer</strong>, <strong>Inspector</strong>, and <strong>Original bytes</strong>{' '}
        tabs. On desktop, drag the pane separators to resize them. Use the sun/moon button in the header to choose light or dark mode; your
        choice is saved in this browser. Before you choose, the app follows your device's appearance setting.
      </p>
      <h2 id="keyboard-shortcuts">Keyboard shortcuts</h2>
      <p>
        These shortcuts work in the workspace. Use <kbd>⌘</kbd> (Command) on macOS or <kbd>Ctrl</kbd> on Windows and Linux. Press{' '}
        <kbd>Tab</kbd> or <kbd>Shift</kbd> + <kbd>Tab</kbd> to move focus between controls.
      </p>
      <dl>
        <dt>
          <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>O</kbd>
        </dt>
        <dd>Open the PDF file picker.</dd>
        <dt>
          <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd>
        </dt>
        <dd>Focus the workspace search field.</dd>
        <dt>Arrow keys, with the Original bytes grid focused</dt>
        <dd>Move the byte cursor: left/right by one byte, or up/down by one row.</dd>
        <dt>
          <kbd>Home</kbd> / <kbd>End</kbd>, with the byte grid focused
        </dt>
        <dd>
          Move to the first/last byte of the row. Hold <kbd>⌘</kbd> or <kbd>Ctrl</kbd> to move to the first/last byte of the file.
        </dd>
        <dt>
          <kbd>Enter</kbd> or <kbd>Space</kbd>, with the byte grid focused
        </dt>
        <dd>Select the current byte and inspect its containing object, if known.</dd>
        <dt>
          <kbd>Enter</kbd>, in Go to offset
        </dt>
        <dd>
          Jump to a zero-based file offset. Enter a decimal number or prefix a hexadecimal value with <code>0x</code>.
        </dd>
        <dt>Arrow keys, with a pane separator focused</dt>
        <dd>Resize adjacent panes. Use left/right for the desktop columns and up/down for the comparison and inspector sections.</dd>
      </dl>
      <p>
        See <a href="/privacy">privacy and browser storage</a> or <a href="/limitations">supported features and limits</a> for details.
      </p>
    </>
  );
};
const ObjectsGuide = function ObjectsGuide() {
  return (
    <>
      <Lead>
        <code>3 0 R</code> is an indirect reference to PDF object number 3, generation 0. The generation number distinguishes versions of a
        reused object number. The letter R marks a reference: look up that object to read its value. An indirect object has its own number
        and can be referenced from elsewhere in the PDF.
      </Lead>
      <h2>Follow a page to its drawing instructions</h2>
      <p>
        The original <strong>A simple page</strong> sample contains five indirect objects. Object 1 is the document catalogue, object 2 is
        the page-tree root, object 3 is a page, object 4 holds drawing instructions, and object 5 is a Helvetica font resource.
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
        Here <code>/Parent 2 0 R</code> points to the page’s parent in the page tree. <code>/Contents 4 0 R</code> points to its content
        stream. <code>/MediaBox</code> is an array written directly in the page dictionary (a collection of key–value pairs). Its four
        numbers give the lower-left and upper-right corners of the page boundary in PDF user-space units.
      </p>
      <ol>
        <li>
          Open the sample and select <strong>First page</strong>.
        </li>
        <li>
          Inspect its Properties, then click <strong>4 0 R</strong> beside <code>/Contents</code>.
        </li>
        <li>
          Switch to <strong>Decoded</strong> to read the instructions, or <strong>Source</strong> to inspect the object representation.
        </li>
        <li>
          Use Back to return to the page. Follow <strong>2 0 R</strong> to see its parent and inherited resources.
        </li>
      </ol>
      <h2>When to use Properties or Original bytes</h2>
      <p>
        The example above adds line breaks for readability. Properties shows how the parser interprets each value. It may change the order
        of dictionary entries, keep only one value for duplicate keys, or display strings differently from how they were written. Use
        Original bytes to check the exact syntax stored in the file.
      </p>
      <p>
        To locate an object stored inside a compressed object stream, first decode its containing stream. The object’s offset is its
        position in those decoded bytes; it has no separate offset in the original file. The inspector labels recovered or unavailable
        source locations. A reference to an unavailable object does not prove that the object never existed.
      </p>
      <h2>Continue exploring</h2>
      <p>
        <a href="/guides/decode-pdf-streams">Learn about raw and decoded streams</a>, or{' '}
        <a href="/guides/find-pdf-fonts-images">follow the page’s font and image resources</a>.
      </p>
      <ArticleSource>
        Example source: <a href={fixtureSource}>original sample generator, baseObjects and minimalPdf</a>. This walkthrough covers the
        bundled sample. It does not establish support for every PDF allowed by the specification.
      </ArticleSource>
    </>
  );
};
const StreamsGuide = function StreamsGuide() {
  return (
    <>
      <Lead>
        A PDF stream stores data bytes after a dictionary of properties. Its <code>/Filter</code> entry names the encoding applied to those
        bytes, such as compression. Decoding reverses supported encodings so you can inspect the data. Positions within the decoded data
        differ from positions in the original file.
      </Lead>
      <h2>Know what the stream contains</h2>
      <p>
        A page’s
        <code> /Contents</code> stream holds drawing instructions, including text. Other streams can hold images, fonts or embedded files,
        so decoding does not always produce readable instructions.
      </p>
      <p>
        An object stream, identified by <code>/Type /ObjStm</code>, is a container for other PDF objects. Open the{' '}
        <a href="/?sample=compressed">Compressed objects sample</a> and inspect First page to find its containing object stream and position
        within that stream’s decoded bytes.
      </p>
      <h2>Inspect a Flate-compressed content stream</h2>
      <p>
        The <strong>Fonts &amp; resources</strong> sample stores object 4’s page instructions with <code>/Filter /FlateDecode</code>. Its
        decoded content includes:
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
          Choose <strong>First page</strong>, then follow <code>/Contents</code> to object 4.
        </li>
        <li>
          Inspect <code>/Filter</code> in Properties. Select <strong>Raw stream</strong> to see the compressed bytes stored in the PDF.
        </li>
        <li>
          Select <strong>Decoded</strong> to inspect the decoded bytes. Use <strong>Readable instructions</strong> for explanations and
          resource links.
        </li>
        <li>
          Find <code>/Im1 Do</code>, which draws the image named /Im1 in this example. Images and reusable groups of drawing instructions
          are called XObjects in PDF. Use Page preview to compare the instructions with the rendered page.
        </li>
      </ol>
      <h2 id="text-instructions">Find visible text in a decoded stream</h2>
      <p>
        To search for a word you can see on the page, choose <strong>Decoded streams</strong> and enter the word, for example “lorem”.
        Search checks the PDF syntax. A word split across several strings may not match, so try a shorter fragment such as <code>lor</code>.
        Open the matching stream in <strong>Readable instructions</strong> to see how the text is drawn.
      </p>
      <p>
        A PDF can split a word into pieces to control where it draws each letter. This allows it to adjust the gap between letters (kerning)
        or space a line to fit its width (justification). Decoding removes compression; it does not join these pieces into words.
      </p>
      <h3>Read the text instruction</h3>
      <p>
        For example, this instruction draws “at varius lorem ”, including the trailing space. It stores “lorem” as <code>(lor)</code> and{' '}
        <code>(em )</code>, with a spacing adjustment between them. This example is separate from the bundled sample above:
      </p>
      <pre>
        <code>{`[(at) -41 ( ) -48 (varius) -7 ( ) -82 (lor) 17 (em )] TJ`}</code>
      </pre>
      <ComparisonTable>
        <caption>Reading a TJ text instruction</caption>
        <colgroup>
          <col className="w-3/10" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Syntax</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              <code>[ … ]</code>
            </th>
            <td>An array of strings and spacing adjustments, read in order.</td>
          </tr>
          <tr>
            <th scope="row">
              <code>(lor)</code>, <code>(em )</code>
            </th>
            <td>
              Text strings. Parentheses mark where each string starts and ends; they do not appear on the page. The second string includes a
              trailing space.
            </td>
          </tr>
          <tr>
            <th scope="row">
              <code>( )</code>
            </th>
            <td>A string containing a space character.</td>
          </tr>
          <tr>
            <th scope="row">
              <code>17</code>, <code>-82</code>
            </th>
            <td>Move the text position without adding characters or marking word boundaries.</td>
          </tr>
          <tr>
            <th scope="row">
              <code>TJ</code>
            </th>
            <td>
              Draw the strings, applying each adjustment before continuing. The related <code>Tj</code> operator draws a single string
              without an array of adjustments.
            </td>
          </tr>
        </tbody>
      </ComparisonTable>
      <p>
        For other instructions, see the{' '}
        <a href="https://pdfa.org/download-area/cheat-sheets/OperatorsAndOperands.pdf" target="_blank" rel="noopener noreferrer">
          PDF operator reference
        </a>{' '}
        from the PDF Association (opens PDF in a new tab).
      </p>
      <h3>What do the positive and negative numbers mean?</h3>
      <p>
        Each number is measured in thousandths of a unit of text space. For ordinary horizontal text, a positive value pulls the next string
        back, tightening the gap; a negative value moves it forwards, opening the gap. The numbers adjust how far the text position normally
        advances after each letter or space. They do not specify absolute page coordinates.
      </p>
      <details
        className={cn(
          'my-4 text-reading leading-[1.85]',
          '[&_summary]:cursor-pointer [&_summary]:underline [&_summary]:underline-offset-3',
          '[&_p]:mt-3'
        )}
      >
        <summary>Convert a spacing adjustment to a distance</summary>
        <p>
          At a 12-point font size with no additional scaling,
          <code> 17</code> pulls the next string back by 17 / 1000 × 12 = 0.204 points. The final distance depends on the font size,
          horizontal scaling and transformation matrices set by the surrounding instructions.
        </p>
      </details>
      <h3>Compare instructions with the page</h3>
      <p>
        In <strong>Readable instructions</strong>, each array and its <code>TJ</code> operator occupy one row. That row may draw an entire
        line containing the word you searched for. Line wrapping in the inspector fits the panel; it does not represent line breaks on the
        PDF page. Use <strong>Page preview</strong> to compare the instruction with the rendered text.
      </p>
      <p>
        The hexadecimal label at the left of each row gives its byte offset within the decoded stream, measured from zero. It is separate
        from the page coordinates and the original file’s offsets.
      </p>
      <h3>When strings are not readable text</h3>
      <p>
        The selected font determines how to interpret the character codes in each string, so they may not look like readable letters. A{' '}
        <code>TJ</code> array can also contain hexadecimal strings such as
        <code> &lt;00120034&gt;</code>. If the text is unreadable, follow the font resource in the preceding <code>Tf</code> instruction and
        inspect its encoding and <code>/ToUnicode</code> mapping. The <a href="/examples/incorrect-text">incorrect copied text example</a>{' '}
        walks through this process.
      </p>
      <h2>Decoding limits</h2>
      <p>
        The inspector supports Flate, ASCIIHex, ASCII85, and supported chains of those filters. A filter chain applies several encodings in
        sequence. For other encodings, you can still inspect raw bytes where available. Page preview uses a separate renderer, so it may
        display content that the inspector cannot decode.
      </p>
      <p>
        Displayed stream previews stop at {MAX_DISPLAY_BYTES / 1024} KiB. Decoded search only checks those previews. It reads bytes as
        characters; it does not extract the text shown on a rendered page. Decoding is limited to {MAX_DECODED_BYTES / 1024 / 1024} MiB per
        stream. Read the <a href="/limitations">complete limitations</a> before drawing conclusions from partial results.
      </p>
      <ArticleSource>
        Example source: <a href={fixtureSource}>original sample generator, resourcesPdf and compressedPdf</a>.{' '}
        <a href="/guides/inspect-pdf-objects">Review objects and references</a>.
      </ArticleSource>
    </>
  );
};
const ResourcesGuide = function ResourcesGuide() {
  return (
    <>
      <Lead>
        A PDF page’s resources identify fonts, images, and other named objects available to its drawing instructions. Use the resource
        browser to inspect them, follow their references, and see which pages make them available. Availability alone does not prove that a
        resource is drawn.
      </Lead>
      <h2>Find the sample’s font and image</h2>
      <SampleLinks sample="resources" label="Fonts & resources" />
      <ol>
        <li>
          Open the sample and choose <strong>Resources</strong> in the Explorer.
        </li>
        <li>
          Choose <strong>Fonts</strong> to find the Helvetica font at object 5. Inspect its <code>/BaseFont</code> and <code>/Subtype</code>
          .
        </li>
        <li>
          Choose <strong>Images</strong> to find object 6: a 1 × 1 image with <code>/ColorSpace /DeviceRGB</code> and 8 bits per component.
        </li>
        <li>Inspect the page’s parent, object 2, to see the resources inherited by the page.</li>
        <li>
          Follow the page’s content stream to connect <code>/F1</code> and <code>/Im1</code> with the instructions using them.
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
        The sample’s Helvetica dictionary names a font but contains no embedded font file (a font program). In your own PDF, follow the font
        descriptor, which holds font properties and may link to a font stream. A supported embedded font offers Download font, but it may be
        a subset containing only characters used by the PDF. Extraction cannot restore the complete original font, and some font programs
        are not directly installable.
      </p>
      <h2>Image dimensions and page appearance differ</h2>
      <p>
        The sample’s 1 × 1 image is scaled by the page instructions. Download image exports the image at its stored pixel dimensions. It
        does not apply the scaling, rotation, or positioning used on the page. Supported RGB or greyscale samples export as PNG; supported
        standalone JPEG streams can be saved without re-encoding.
      </p>
      <p>
        PNG export does not support masks or custom colour spaces. JPEG extraction omits page masks and colour adjustments. PNG conversion
        is limited to 4 megapixels and 4096 pixels per side; image payloads are limited to 32 MiB. An image export is not necessarily an
        exact reproduction of its appearance on the page.
      </p>
      <h2>Attachments are separate resources</h2>
      <p>
        The sample also includes <code>notes.txt</code>. Choose <strong>Resources → Attachments</strong> to find and download it. An empty
        attachment list is not proof that a partially parsed document contains no attachments.
      </p>
      <ArticleSource>
        Example source: <a href={fixtureSource}>original sample generator, resourcesPdf</a>. See{' '}
        <a href="/limitations">supported operations and limits</a> and the <a href="/guide">workspace guide</a>.
      </ArticleSource>
    </>
  );
};
const Privacy = function Privacy() {
  return (
    <>
      <Lead>{PRIVACY_SUMMARY}</Lead>
      <h2>What stays in memory</h2>
      <p>
        Your PDF and its password are held in memory while the document is open. Closing or replacing it clears the active workspace and
        terminates its parser worker. The app does not upload your document to a processing service.
      </p>
      <h2>What persists in this browser</h2>
      <p>
        Your light or dark appearance choice is saved in this browser for future visits. Before you choose, the app follows your device’s
        appearance setting. Use the sun/moon button in the header to change it.
      </p>
      <p>
        Bookmarks, selected object or byte-range locations, labels, and notes are saved in local browser storage. The app calculates a
        SHA-256 hash (a fingerprint of the PDF’s contents) to match saved bookmarks to the same file when you reopen it, even if its
        filename changes. A changed file has separate bookmarks. The PDF and password are not saved.
      </p>
      <p>
        Notes created while inspecting an encrypted PDF remain readable in browser storage. Only add information you want to keep on this
        device.
      </p>
      <p>If browser storage is unavailable, bookmarks work for the current open file only, and the app explains that they are not saved.</p>
      <h2>Delete saved information</h2>
      <p>
        Use a bookmark’s trash button to remove that bookmark and its note. To remove all saved bookmarks, clear this site’s data in your
        browser settings. Closing the tab alone does not delete saved bookmarks.
      </p>
      <h2>Website requests</h2>
      <p>
        Your browser requests the application, fonts, worker assets, and any bundled sample you choose from the site host. The site host may
        process ordinary request information. Loading the website requires these network requests; processing your PDF happens on your
        device. Your browser also loads an analytics script from Cloudflare, described below.
      </p>
      <p>
        Please remove sensitive information before sharing examples in <a href={`${PROJECT_URL}/issues`}>GitHub feedback</a>.
      </p>
      <h2>Analytics</h2>
      <p>
        The site uses Cloudflare Web Analytics to count page views and measure how quickly pages load. Its script sends Cloudflare the page
        address, the page you came from, and performance data from your browser, including which page elements were slow to appear.
        Cloudflare also receives your browser, operating system, device type and country with the request. It says it discards your IP
        address and does not track visitors across sites. The script sets no cookies and stores nothing in your browser.{' '}
        <a href="https://developers.cloudflare.com/speed/observatory/rum-beacon/">Cloudflare lists the data the script collects</a>.
      </p>
      <p>
        Your PDF never reaches the analytics. The address bar only shows public page addresses and the names of bundled samples, never a
        local file, its name or anything inside it.
      </p>
      <ArticleSource>
        Implementation: <a href={`${PROJECT_URL}/blob/main/src/lib/pdf/bookmark-storage.ts`}>bookmark storage</a> and{' '}
        <a href={`${PROJECT_URL}/blob/main/src/lib/pdf/client.ts`}>local parser worker client</a>.
      </ArticleSource>
    </>
  );
};
const Limitations = function Limitations() {
  return (
    <>
      <Lead>
        PDF Internals is an early, read-only exploration tool. It can inspect the current object structure, references, streams, resources,
        and original bytes. Some PDFs are only partially supported; recovered or unavailable data is labelled.
      </Lead>
      <h2>File and processing limits</h2>
      <dl>
        <dt>Maximum input size</dt>
        <dd>{MAX_INPUT_BYTES / 1024 / 1024} MiB</dd>
        <dt>Maximum indexed objects</dt>
        <dd>{MAX_OBJECTS.toLocaleString('en-US')}</dd>
        <dt>Decoded bytes per stream</dt>
        <dd>{MAX_DECODED_BYTES / 1024 / 1024} MiB</dd>
        <dt>Displayed source/stream preview</dt>
        <dd>{MAX_DISPLAY_BYTES / 1024} KiB</dd>
        <dt>Parser operation timeout</dt>
        <dd>{OPERATION_TIMEOUT_MS / 1000} seconds</dd>
      </dl>
      <p>
        The inspector allows up to 128 MiB of decoded data across all streams in a document. The browser also needs memory for objects and
        their relationships, original bytes, copies, displayed text, and page rendering. A PDF with many objects can therefore use much more
        memory.
      </p>
      <h2>Decoding and encrypted PDFs</h2>
      <p>
        Supported inspector filters are Flate, ASCIIHex, ASCII85, and supported chains. Other filters retain raw inspection when available.
        Preview uses an independent renderer with different capabilities.
      </p>
      <p>
        Files with an empty opening password unlock automatically. Otherwise, enter an opening or owner password for supported local
        inspection and preview. Original source and raw stream bytes remain encrypted; readable properties and decoded streams are separate
        decrypted representations. Unsupported encryption remains unavailable.
      </p>
      <h2>Fidelity and incomplete results</h2>
      <p>
        Use Original bytes to check exactly what the file contains. Properties shows the parser’s interpretation, which may change how
        values are written and keep only one value for duplicate dictionary keys. Compressed objects are located within their decoded
        container; they have no separate offset in the original file. Recovery from damaged files may be incomplete.
      </p>
      <p>
        Decoded search checks only the first 256 KiB of each stream and stops at 500 results. It reads decoded bytes as characters, so it is
        not page text search. Font or image availability does not prove page usage. Resource lists cover indexed objects; unparsed objects
        can contain additional resources.
      </p>
      <h2>Page text search and source mapping</h2>
      <p>
        Page text search finds words extracted from pages that have a text layer. It runs locally in your browser, stops at 500 matches, and
        Open page preview highlights the returned matches on the rendered page.
      </p>
      <p>
        Mapping those words to source bytes works for common ASCII fonts and fixed-width ToUnicode maps in direct page content streams. In
        compressed or encrypted streams the decoded bytes are exact, while the original file highlights only the containing stream. Mapped
        locations are candidates for the page text and may differ from reading order.
      </p>
      <p>
        Some words are found but cannot be mapped: text with unsupported font encodings or inside Form XObjects, <code>/ActualText</code>{' '}
        replacement text, phrases that span content streams, and inherited or variable-width character maps. These results link to a
        candidate stream and highlight no word bytes. The <a href="/guides/search-bookmark-compare">search guide</a> explains the causes and
        byte representations.
      </p>
      <p>
        OCR for scanned pages without text is not available, and neither is guaranteed mapping from a specific rendered text occurrence to
        its source bytes.
      </p>
      <h2>Exports and comparisons</h2>
      <p>
        Dictionary comparison checks keys and values. It does not compare stream bytes or the exact syntax used to write an object.
        Attachment and font downloads require supported decoding and complete data, up to 32 MiB per file. An embedded font may contain only
        the characters used by the PDF. <a href="/guides/find-pdf-fonts-images">Image exports</a> are limited by image size, encoding,
        masks, and colour space. They do not apply the scaling, rotation, or positioning used on the page.
      </p>
      <h2>Unavailable operations</h2>
      <p>Editing, repair, saving modified PDFs, signature validation, historical object revisions, and OCR are not available.</p>
      <h2>Browser coverage and evidence</h2>
      <p>
        Automated checks target Chromium, Firefox, and WebKit. The Safari application and broader device/PDF combinations still need
        validation. <a href={`${PROJECT_URL}/blob/main/docs/CORPUS.md`}>Independent corpus observations</a> describe tested files and known
        partial results; they do not establish universal PDF support.
      </p>
      <h2>Credits</h2>
      <p>
        Application code is licensed under the Apache License 2.0. Parsing uses LibPDF; optional preview uses EmbedPDF and PDFium locally.
        Dependencies retain their own licences. Read the <a href="/THIRD-PARTY-NOTICES.txt">third-party notices</a>.
      </p>
    </>
  );
};
export const PublicPage = function PublicPage({
  page,
  onFollowLink,
  standalone,
}: {
  page: SitePage;
  onFollowLink?: (event: MouseEvent<HTMLElement>) => boolean;
  standalone?: boolean;
}) {
  return (
    <ReadingPage labelledBy="public-title" onClick={onFollowLink} path={page.path} standalone={standalone}>
      <BackToWorkspace />
      <nav className="mb-6 text-small leading-[1.8] [overflow-wrap:anywhere] text-muted-foreground" aria-label="Breadcrumb">
        <a href="/">PDF Internals</a>
        <span aria-hidden="true"> / </span>
        {page.path.startsWith('/guides/') && (
          <>
            <a href="/guide">Guide</a>
            <span aria-hidden="true"> / </span>
          </>
        )}
        {page.path.startsWith('/examples/') && (
          <>
            <a href="/examples">Examples</a>
            <span aria-hidden="true"> / </span>
          </>
        )}
        <span aria-current="page">{navigationLabel(page.path)}</span>
      </nav>
      <h1 id="public-title">{page.heading}</h1>
      {(page.path.startsWith('/guides/') || page.path.startsWith('/examples/')) && (
        <p className="mb-8 text-small leading-[1.85] text-muted-foreground">
          By <a href="https://github.com/antonsamper">Anton Samper</a> · Reviewed <time dateTime="2026-11-15">15 November 2026</time>
        </p>
      )}
      {page.path === '/who-its-for' ? (
        <AudiencePage />
      ) : page.path === '/pdf-inspector-vs-viewer' ? (
        <InspectorVsViewerPage />
      ) : page.path === '/examples' ? (
        <Examples />
      ) : page.path === '/examples/large-pdf' ? (
        <LargePdfExample />
      ) : page.path === '/examples/incorrect-text' ? (
        <IncorrectTextExample />
      ) : page.path === '/examples/find-text-source' ? (
        <FindTextSourceExample />
      ) : page.path === '/examples/broken-xref' ? (
        <BrokenXrefExample />
      ) : page.path === '/examples/embedded-font' ? (
        <FontExample />
      ) : page.path === '/examples/hidden-attachment' ? (
        <AttachmentExample />
      ) : page.path === '/examples/repeated-logo' ? (
        <LogoExample />
      ) : page.path === '/examples/page-rotation' ? (
        <RotationExample />
      ) : page.path === '/examples/inherited-resources' ? (
        <InheritanceExample />
      ) : page.path === '/examples/opening-action' ? (
        <ActionExample />
      ) : page.path === '/guide' ? (
        <Guide />
      ) : page.path === '/privacy' ? (
        <Privacy />
      ) : page.path === '/limitations' ? (
        <Limitations />
      ) : page.path === '/guides/inspect-pdf-objects' ? (
        <ObjectsGuide />
      ) : page.path === '/guides/decode-pdf-streams' ? (
        <StreamsGuide />
      ) : page.path === '/guides/find-pdf-attachments' ? (
        <AttachmentsGuide />
      ) : page.path === '/guides/search-bookmark-compare' ? (
        <SearchGuide />
      ) : page.path === '/guides/investigate-suspicious-features' ? (
        <SuspiciousFeaturesGuide />
      ) : (
        <ResourcesGuide />
      )}
    </ReadingPage>
  );
};
/** Direct article requests are complete documents and do not load the inspector. */
export const StaticPublicPage = function StaticPublicPage({ page }: { page: SitePage }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader content href="/">
        <ContentHeaderLinks path={page.path} />
      </SiteHeader>
      <PublicPage page={page} standalone />
      <SiteLinks />
    </div>
  );
};
const fixtureSource = `${PROJECT_URL}/blob/main/scripts/fixtures/pdf-fixtures.mjs`;
