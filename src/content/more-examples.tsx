import { ExampleActions } from './examples';
const Preview = function Preview({
  sample,
  alt,
  caption,
  landscape = false,
}: {
  sample: string;
  alt: string;
  caption: string;
  landscape?: boolean;
}) {
  return (
    <figure className="example-preview">
      <img src={`/examples/${sample}.png`} width={landscape ? 900 : 696} height={landscape ? 696 : 900} loading="lazy" alt={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
};
export const FontExample = function FontExample() {
  return (
    <>
      <p className="about-lead">
        The page uses two fonts. Helvetica supplies the heading; an embedded TrueType font supplies the four large H characters. Follow each
        font reference to see which one includes a font program.
      </p>
      <ExampleActions sample="embedded-font" />
      <h2>1. Find the font used by the text</h2>
      <p>
        Open <strong>First page</strong>, follow <code>/Contents</code> to object <strong>4 0 R</strong>, and select{' '}
        <strong>Decoded → Decoded byte text</strong>. The heading uses <code>/F1</code>. The four H characters use:
      </p>
      <pre>
        <code>{'BT /F2 48 Tf 72 540 Td (HHHH) Tj ET'}</code>
      </pre>
      <p>
        <code>/F2</code> is a resource name local to this page's resource dictionary. To find the font's name and data, return to page{' '}
        <strong>3 0 R</strong> and follow <code>/Resources → /Font → /F2</code> to <strong>6 0 R</strong>.
      </p>
      <Preview
        sample="embedded-font"
        alt="An invoice heading followed by four large geometric H characters."
        caption="The heading and the H characters use different font resources."
      />
      <h2>2. Follow the embedded font program</h2>
      <p>
        Font <strong>6 0 R</strong> has <code>/Subtype /TrueType</code> and <code>/BaseFont /ExampleMark</code>. Follow{' '}
        <code>/FontDescriptor</code> to <strong>7 0 R</strong>, then <code>/FontFile2</code> to stream <strong>8 0 R</strong>. That stream
        contains the TrueType program. You can also find ExampleMark under <strong>Resources → Fonts</strong> and download its decoded
        bytes.
      </p>
      <p>
        ExampleMark is an original, deliberately small font with an H glyph and a missing-glyph entry. It can draw the sample's four H
        characters but cannot supply the other letters in a document. An embedded font in another PDF may be a subset of a larger font,
        containing only some of its characters.
      </p>
      <h2>3. Compare the other font</h2>
      <p>
        Return to page <strong>3 0 R</strong> and follow <code>/Resources → /Font → /F1</code> to <strong>5 0 R</strong>. Its{' '}
        <code>/BaseFont</code> is Helvetica. It has no embedded font program. Helvetica is one of PDF's standard 14 fonts; its absence from
        the file is intentional here. A font name alone does not establish that a PDF embeds that font.
      </p>
      <h2>What to check in your generator</h2>
      <p>
        If text is substituted or missing, check the resource used by the affected text and whether the PDF includes its expected font
        program. Finding an embedded program does not prove that every needed glyph is present or that character mappings are correct. For a
        visible amount that extracts incorrectly, follow the <a href="/examples/incorrect-text">Unicode mapping example</a>.
      </p>
    </>
  );
};
export const AttachmentExample = function AttachmentExample() {
  return (
    <>
      <p className="about-lead">
        The invoice shows a total of £1,250.00. It also carries a CSV file with the line item, though nothing on the page lists an
        attachment. Find the file and follow the references that give it a name.
      </p>
      <ExampleActions sample="hidden-attachment" />
      <h2>1. Find the attachment</h2>
      <p>
        Open the page preview to check the invoice, then choose <strong>Resources → Attachments</strong>. The list contains{' '}
        <code>line-items.csv</code>. Select it to inspect its object, or use <strong>Download attachment</strong> to save the CSV.
      </p>
      <Preview
        sample="hidden-attachment"
        alt="A one-page invoice showing £1,250.00 with no attachment listed on the page."
        caption="The CSV is stored in the PDF but has no visible attachment annotation."
      />
      <h2>2. Follow the filename to its bytes</h2>
      <p>
        Open <strong>Document catalogue</strong>, object <strong>1 0 R</strong>. Follow <code>/Names → /EmbeddedFiles → /Names</code> to the
        file specification, <strong>6 0 R</strong>. Its entries include:
      </p>
      <pre>
        <code>{'/F (line-items.csv)\n/EF << /F 7 0 R >>'}</code>
      </pre>
      <p>
        The first <code>/F</code> gives the filename. The reference inside <code>/EF</code> points to the embedded bytes. Follow{' '}
        <strong>7 0 R</strong> and open <strong>Decoded</strong> to read:
      </p>
      <pre>
        <code>{'description,amount\nService charge,1250.00'}</code>
      </pre>
      <h2>3. Check the downloaded contents</h2>
      <p>
        Open the downloaded CSV in a text editor. It contains one line item whose amount matches the page total. Downloading the attachment
        leaves the original PDF unchanged. The filename comes from the file specification; the embedded stream itself holds the CSV data.
      </p>
      <h2>When the page is not enough</h2>
      <p>
        If a workflow needs supporting data, check attachments as well as visible page content. Other PDFs may attach files through
        annotations or associated file entries. The resource list covers indexed objects; unavailable objects can contain further files. See
        the <a href="/guides/find-pdf-attachments">attachment guide</a> for these paths and download limits.
      </p>
    </>
  );
};
export const LogoExample = function LogoExample() {
  return (
    <>
      <p className="about-lead">
        All three pages show the same logo. The first two share one image object; the third points to a separate copy. Compare their
        references to see how repeated artwork can add unnecessary bytes.
      </p>
      <ExampleActions sample="repeated-logo" />
      <h2>1. Find the image objects</h2>
      <p>
        Open <strong>Resources → Images</strong>. There are two image objects, <strong>7 0 R</strong> and <strong>8 0 R</strong>, each 24 ×
        24 pixels. Both store 1,728 uncompressed RGB bytes. The first two pages reuse one of these objects.
      </p>
      <Preview
        sample="repeated-logo"
        alt="A page headed Repeated logo with a small coloured square."
        caption="All three pages look the same. Their image references differ."
      />
      <h2>2. Compare page references</h2>
      <p>
        Choose <strong>Pages</strong> and select the first page, <strong>3 0 R</strong>. Its <code>/Resources → /XObject → /Logo</code>{' '}
        points to <strong>7 0 R</strong>. Use <strong>Pin to compare</strong>, then select the second page, <strong>4 0 R</strong>. It
        points to that same object. Select the third page, <strong>5 0 R</strong>, and the reference changes to <strong>8 0 R</strong>.
      </p>
      <pre>
        <code>{'Page 1 (3 0 R): /Logo 7 0 R\nPage 2 (4 0 R): /Logo 7 0 R\nPage 3 (5 0 R): /Logo 8 0 R'}</code>
      </pre>
      <h2>3. Check that the pages draw the resource</h2>
      <p>
        Each page's <code>/Contents</code> points to stream <strong>6 0 R</strong>. Open <strong>Decoded → Decoded byte text</strong> and
        find <code>/Logo Do</code>. The name is resolved using the resources of the page drawing it, so the same content stream uses object
        7 on the first two pages and object 8 on the third.
      </p>
      <p>
        The two image payloads in this sample are identical. Matching dimensions and dictionaries in another PDF would not prove its image
        bytes match: dictionary comparison does not compare stream payloads.
      </p>
      <h2>Reuse images in the generator</h2>
      <p>
        Reuse one image object for repeated artwork when the image data and its interpretation are the same. The extra copy here adds 1,728
        stream bytes plus object overhead. Large logos repeated across many pages can cost much more. For another source of image bloat, see
        the <a href="/examples/large-pdf">oversized image example</a>.
      </p>
    </>
  );
};
export const RotationExample = function RotationExample() {
  return (
    <>
      <p className="about-lead">
        Both pages contain sideways text, but their page rotations differ. The first inherits a 90-degree page rotation. The second has a
        zero-degree page rotation and turns part of its content with a drawing matrix.
      </p>
      <ExampleActions sample="page-rotation" />
      <h2>1. Find the inherited rotation</h2>
      <p>
        The document overview reports mixed page rotation. Choose <strong>First page</strong>, object <strong>3 0 R</strong>. There is no{' '}
        <code>/Rotate</code> entry. Follow <code>/Parent</code> to <strong>2 0 R</strong> and find <code>/Rotate 90</code>. The page
        inherits this value, which turns the displayed page clockwise.
      </p>
      <Preview
        sample="page-rotation"
        landscape
        alt="A landscape page with its heading turned clockwise along the right edge."
        caption="Page 1 inherits its 90-degree rotation from the page tree."
      />
      <h2>2. Check the second page's override</h2>
      <p>
        In <strong>Pages</strong>, select page 2, object <strong>4 0 R</strong>. It has <code>/Rotate 0</code>, overriding the parent's
        value. Preview this page: its heading is upright, though the words “Content stream rotation” run vertically. A zero page rotation
        does not mean every mark is upright.
      </p>
      <h2>3. Read the content transform</h2>
      <p>
        Follow the second page's <code>/Contents</code> to <strong>6 0 R</strong>. In <strong>Decoded → Decoded byte text</strong>, find:
      </p>
      <pre>
        <code>{'q\n0 1 -1 0 450 80 cm\nBT /F1 24 Tf 0 0 Td (Content stream rotation) Tj ET\nQ'}</code>
      </pre>
      <p>
        Here the matrix rotates the text 90 degrees anticlockwise and positions it on the page. The surrounding <code>q</code> and{' '}
        <code>Q</code> save and restore graphics state, so this transform does not affect the earlier heading.
      </p>
      <h2>Choose which rotation to change</h2>
      <p>
        For a whole page displayed at the wrong angle, check its effective <code>/Rotate</code>, including inherited values. For one
        sideways item on an otherwise upright page, inspect the transforms in its content stream. Change the responsible value in your
        generator; PDF Internals does not edit the file.
      </p>
    </>
  );
};
export const InheritanceExample = function InheritanceExample() {
  return (
    <>
      <p className="about-lead">
        The page's dictionary has no <code>/Resources</code> entry. Its parent supplies the font and image used to draw the text and
        coloured square. Follow the parent reference to find both resources.
      </p>
      <ExampleActions sample="inherited-resources" />
      <h2>1. Check the page dictionary</h2>
      <p>
        Open <strong>First page</strong>, object <strong>3 0 R</strong>. It has <code>/Parent 2 0 R</code> and <code>/Contents 4 0 R</code>,
        but no <code>/Resources</code>. Preview the page to confirm it still draws its text and image.
      </p>
      <Preview
        sample="inherited-resources"
        alt="A page with text and a coloured square whose resources come from its parent."
        caption="The page renders using resources stored on the page-tree parent."
      />
      <h2>2. Follow the parent</h2>
      <p>
        Follow <code>/Parent</code> to <strong>2 0 R</strong>. Its dictionary contains:
      </p>
      <pre>
        <code>{'/Resources <<\n  /Font << /F1 5 0 R >>\n  /XObject << /Im1 6 0 R >>\n>>'}</code>
      </pre>
      <p>
        The page inherits this dictionary. <code>/F1</code> resolves to Helvetica at <strong>5 0 R</strong>, and <code>/Im1</code> resolves
        to the image at <strong>6 0 R</strong>. In <strong>Pages</strong>, expanding the first page's resources also identifies the parent
        as their source.
      </p>
      <h2>3. Match the names to drawing instructions</h2>
      <p>
        Return to the page and follow <code>/Contents</code> to <strong>4 0 R</strong>. Select{' '}
        <strong>Decoded → Readable instructions</strong>. The font selection and image drawing instructions link to resources in this
        inherited context. In <strong>Decoded byte text</strong>, look for <code>/F1</code> and <code>/Im1 Do</code>.
      </p>
      <h2>Check inheritance before declaring a resource missing</h2>
      <p>
        When a page has no resource dictionary, follow its page-tree ancestors. A dictionary on the page itself replaces the inherited
        resource dictionary; its individual entries are not merged with the parent's. A generator that writes only a new image entry on the
        page can therefore hide a font that was previously inherited. Check the full effective dictionary when adding resources.
      </p>
    </>
  );
};
export const ActionExample = function ActionExample() {
  return (
    <>
      <p className="about-lead">
        A PDF action is a stored instruction asking a reader to do something when an event occurs, such as opening the document or clicking
        a link. Actions can navigate to a page, open a website, work with form data, or run JavaScript. This example uses an opening action
        to fit the first page in the reader’s window, with no script or external target.
      </p>
      <ExampleActions sample="opening-action" />
      <h2>What triggers a PDF action?</h2>
      <p>
        The trigger and the action type are separate. The catalogue’s <code>/OpenAction</code> specifies what happens on opening; a link,
        outline bookmark, or form widget can use <code>/A</code> for its action. Additional-action dictionaries (<code>/AA</code>) associate
        actions with events such as entering a field or opening a page. An action dictionary’s <code>/S</code> entry identifies its type. An
        optional <code>/Next</code> entry can chain further actions.
      </p>
      <p>
        <code>/OpenAction</code> can also hold a destination directly, rather than an action dictionary. Finding it does not by itself mean
        that the PDF contains JavaScript.
      </p>
      <h2>Common PDF action types and what they do</h2>
      <dl>
        <dt>
          <code>/GoTo</code>, <code>/GoToR</code>, <code>/GoToE</code>
        </dt>
        <dd>
          Navigate to a destination in this PDF, another PDF, or an embedded file respectively. Destinations can specify a page and viewing
          scale.
        </dd>
        <dt>
          <code>/URI</code>
        </dt>
        <dd>Follow a URI, commonly a website address in a clickable link.</dd>
        <dt>
          <code>/Named</code>
        </dt>
        <dd>
          Request a reader-defined operation, such as <code>/NextPage</code> or <code>/PrevPage</code>.
        </dd>
        <dt>
          <code>/JavaScript</code>
        </dt>
        <dd>
          Run a script, for example to calculate or validate form values. The <code>/JS</code> entry holds the script text or a stream
          reference.
        </dd>
        <dt>
          <code>/SubmitForm</code>, <code>/ResetForm</code>, <code>/ImportData</code>
        </dt>
        <dd>Send form data to a target, restore fields to their defaults, or load field values from a file respectively.</dd>
        <dt>
          <code>/Launch</code>
        </dt>
        <dd>Request that the reader open a file or start an application.</dd>
        <dt>
          <code>/Hide</code>, <code>/SetOCGState</code>
        </dt>
        <dd>Change annotation visibility or the state of optional content groups (PDF layers) respectively.</dd>
        <dt>
          <code>/Thread</code>, <code>/Rendition</code>, <code>/GoTo3DView</code>
        </dt>
        <dd>Start reading an article thread, control multimedia playback, or select a view of 3D content respectively.</dd>
      </dl>
      <p>
        These are common types, not an exhaustive list. Support depends on the reader, PDF version, and security settings; a stored
        instruction may be ignored, blocked, or require permission. For definitions, see Adobe’s{' '}
        <a href="https://developer.adobe.com/acrobat-pdfl-sdk/guides/pdfmark/pdfmark-actions">actions and destinations</a> and the{' '}
        <a href="https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.7old.pdf">PDF 1.7 reference, section 8.5</a>.
      </p>
      <h2>1. Locate the opening action</h2>
      <p>
        Choose <strong>Document catalogue</strong>, object <strong>1 0 R</strong>. It has <code>/OpenAction 6 0 R</code>. You can also
        select <strong>Keys</strong> in search and look for <code>OpenAction</code>. Follow the value to read the requested action.
      </p>
      <Preview
        sample="opening-action"
        alt="A simple page whose catalogue requests that the first page be fitted in the reader window."
        caption="The requested opening behaviour is stored in the catalogue, outside the page's drawing instructions."
      />
      <h2>2. Read the action dictionary</h2>
      <p>
        Follow <strong>6 0 R</strong> and check <strong>Properties</strong> or <strong>Source</strong>:
      </p>
      <pre>
        <code>{'<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>'}</code>
      </pre>
      <p>
        <code>/S /GoTo</code> requests navigation within the document. The <code>/D</code> array targets page <strong>3 0 R</strong>, and{' '}
        <code>/Fit</code> requests that the whole page fit the reader's window. Follow the page reference to confirm where it leads.
      </p>
      <h2>3. Check how readers handle the action</h2>
      <p>
        A reader may honour or ignore an opening action. PDF Internals exposes the stored request for inspection without executing the
        action. Its page preview is not a test of whether another reader executes it. This sample has no JavaScript, launch action, or
        remote destination.
      </p>
      <h2>Investigate other action types</h2>
      <p>
        For another PDF, inspect the action's <code>/S</code> value and follow its references. An opening action can serve a routine
        navigation purpose, as it does here. Its presence alone does not make a file malicious, and its absence does not establish safety.
        See the <a href="/guides/investigate-suspicious-features">suspicious features guide</a> for scripts, additional actions, and
        inspection limits.
      </p>
    </>
  );
};
export const BrokenXrefExample = function BrokenXrefExample() {
  return (
    <>
      <p className="about-lead">
        This sample deliberately points one cross-reference entry outside the file. The page objects remain intact, but the metadata object
        is unavailable to the inspector. Open Issues to see a red error and the related amber warning.
      </p>
      <ExampleActions sample="broken-xref" />
      <h2>1. Open Issues</h2>
      <p>
        Open the example, then choose <strong>Issues</strong> in the explorer or
        <strong> View issues and coverage</strong> in Overview. The summary shows
        <strong> 1 error</strong> and <strong>1 warning</strong>.
      </p>
      <p>
        The red <strong>Invalid cross-reference target</strong> error reports that object <code>6 0</code> has an invalid offset of{' '}
        <code>999999</code>. This byte offset is beyond the end of this small PDF.
      </p>
      <figure className="example-preview">
        <img
          src="/examples/broken-xref.png"
          width="619"
          height="926"
          loading="lazy"
          alt="Issues panel showing one red invalid cross-reference error and one amber unresolved reference warning for the broken metadata object."
        />
        <figcaption>Both findings come from the deliberately damaged metadata index entry.</figcaption>
      </figure>
      <h2>2. Inspect the broken index entry</h2>
      <p>
        Under the error, choose <strong>Inspect file structure</strong>. Follow
        <strong> startxref → …</strong> to highlight the original index bytes. The table starts with <code>0 7</code>: seven entries,
        beginning with object zero. The last row, for object six, is:
      </p>
      <pre>
        <code>0000999999 00000 n</code>
      </pre>
      <p>
        The first field should locate object six in the file; it has deliberately been replaced with <code>999999</code>. The metadata
        stream still exists in the original bytes, but the index does not point to it. The inspector does not silently invent a replacement
        object or repair the PDF.
      </p>
      <h2>3. Follow the related warning</h2>
      <p>
        Return to <strong>Issues</strong>. The amber <strong>Unresolved object reference</strong> warning reports <code>6 0 R</code>. Choose
        <strong> Inspect 1 0 obj</strong> to see the referring catalogue's
        <code> /Metadata 6 0 R</code> entry. The warning and error have the same underlying cause: the metadata target could not be indexed.
      </p>
      <h2>A visible page does not prove the structure is sound</h2>
      <p>
        Choose <strong>Preview</strong> to try rendering the page. Its drawing instructions and font are intact, so a reader can display the
        page while handling the broken metadata reference differently. Readers may recover, ignore the metadata or report a problem. This
        example demonstrates one specific structural defect; Issues is not a complete PDF conformance validator. PDF Internals keeps the
        original bytes unchanged.
      </p>
    </>
  );
};
