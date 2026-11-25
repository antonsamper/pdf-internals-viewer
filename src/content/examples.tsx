import { ARTICLE_ACTIONS, ExamplePreview, Lead } from '@/components/prose';
import { SITE_PAGES } from '@/lib/site-content';
export const ExampleActions = function ExampleActions({ sample }: { sample: string }) {
  return (
    <p className={ARTICLE_ACTIONS}>
      <a href={`/?sample=${sample}`}>Open this example</a>
      <a href={`/samples/${sample}.pdf`} download>
        Download sample PDF
      </a>
    </p>
  );
};
export const Examples = function Examples() {
  return (
    <>
      <Lead>
        Investigate file size, text mappings, fonts, attachments, and page behaviour with ten examples, including a deliberately damaged
        PDF. Each walkthrough includes an original sample PDF you can open in the inspector or download.
      </Lead>
      <h2>
        <a href="/examples/large-pdf">Why is this one-page PDF so large?</a>
      </h2>
      <p>
        A one-page invoice takes over 4 MB because of a small image. Check how many pixels it stores and how much space it occupies on the
        page.
      </p>
      <h2>
        <a href="/examples/incorrect-text">Why does copied PDF text differ from the page?</a>
      </h2>
      <p>
        The invoice shows £1,250.00, but a text extractor returns £9,250.00. Follow the content stream to its font and find the incorrect
        Unicode mapping.
      </p>
      {SITE_PAGES.filter(
        (page) => page.path.startsWith('/examples/') && page.path !== '/examples/large-pdf' && page.path !== '/examples/incorrect-text'
      ).map((page) => (
        <section key={page.path}>
          <h2>
            <a href={page.path}>{page.heading}</a>
          </h2>
          <p>{page.description}</p>
        </section>
      ))}
      <h2>Use the same approach on your own file</h2>
      <p>
        Start with the page preview, then follow its content and resource references to the bytes you need to inspect. Another PDF may have
        the same symptom for a different reason. Inspection is local and read-only. See the <a href="/guide">user guide</a> for the controls
        and <a href="/limitations">limitations</a> for supported files.
      </p>
    </>
  );
};
export const LargePdfExample = function LargePdfExample() {
  return (
    <>
      <Lead>
        This one-page invoice contains a little text and a small coloured square, yet the file is over 4 MB. Almost all of those bytes
        belong to the square's uncompressed image.
      </Lead>
      <ExampleActions sample="oversized-image" />
      <h2>1. Look at the page</h2>
      <p>
        Open the example, choose <strong>First page</strong>, then open the page preview. The coloured square takes up little space on the
        page, but the PDF still stores every pixel of its source image.
      </p>
      <ExamplePreview
        src="/examples/oversized-image.png"
        width={696}
        height={900}
        alt="The one-page example invoice, with a small coloured square above the total of £1,250.00."
        caption="The square contains 1.44 million pixels."
      />
      <h2>2. Find the image and its stored size</h2>
      <p>
        In <strong>Resources → Images</strong>, open image object <strong>6 0 R</strong>. In <strong>Properties</strong>, check these
        entries:
      </p>
      <dl>
        <dt>
          <code>/Width</code> and <code>/Height</code>
        </dt>
        <dd>1200 × 1200 pixels.</dd>
        <dt>
          <code>/ColorSpace</code>
        </dt>
        <dd>
          <code>/DeviceRGB</code>: three colour components per pixel.
        </dd>
        <dt>
          <code>/BitsPerComponent</code>
        </dt>
        <dd>8 bits, or one byte, per component.</dd>
        <dt>
          <code>/Length</code>
        </dt>
        <dd>
          4,320,000 stored stream bytes. There is no <code>/Filter</code> entry: this stream is uncompressed.
        </dd>
      </dl>
      <p>
        That adds up to <code>1200 × 1200 × 3 = 4,320,000</code> bytes, about 4.32 MB (4.12 MiB). The PDF structure and text add a small
        amount on top. Use the stored stream size to account for bytes in the PDF. Exporting the image as a PNG encodes it differently, so
        the download size can differ.
      </p>
      <h2>3. Check how the image is drawn</h2>
      <p>
        Return to page object <strong>3 0 R</strong>. Its <code>/Resources</code> dictionary maps <code>/XObject → /Im1</code> to{' '}
        <strong>6 0 R</strong>. Follow <code>/Contents</code> to <strong>4 0 R</strong> and choose{' '}
        <strong>Decoded → Decoded byte text</strong>. Find:
      </p>
      <pre>
        <code>{'q\n144 0 0 144 72 464 cm\n/Im1 Do\nQ'}</code>
      </pre>
      <p>
        In this sample's default page coordinates, the matrix draws the image 144 × 144 points, or two inches square. All 1200 × 1200 pixels
        are still stored, giving 600 pixels per inch at that size. The resource reference identifies the image; the <code>Do</code>{' '}
        instruction shows it is drawn.
      </p>
      <h2>What to change in the generator</h2>
      <p>
        One raw RGB image accounts for more than 99% of this file. Adjust the PDF generator to resize images for the intended output and
        compress them. Try lossless compression for this simple gradient, then compare the file size and visual quality.
      </p>
      <p>
        PDF Internals does not optimise or save modified PDFs, and it has no automatic size breakdown. Other large files may contain
        embedded fonts, attachments, duplicated resources, or earlier updates, so check what accounts for the bytes in your own file.
      </p>
    </>
  );
};
export const IncorrectTextExample = function IncorrectTextExample() {
  return (
    <>
      <Lead>
        This invoice shows £1,250.00 on the page, but Poppler's pdftotext extracts £9,250.00. The font has a deliberately incorrect Unicode
        mapping. Follow its references to find the entry responsible.
      </Lead>
      <ExampleActions sample="incorrect-unicode" />
      <h2>1. Compare appearance with extraction</h2>
      <p>Open the example's page preview to check the amount, then download the PDF and extract its text outside the inspector:</p>
      <pre>
        <code>pdftotext incorrect-unicode.pdf -</code>
      </pre>
      <p>
        With Poppler installed, this command produces a line containing <code>Invoice total: £9,250.00</code>. Readers and extractors may
        use different fallbacks, so clipboard behaviour can vary. PDF Internals can search page text. Its decoded stream view shows the
        underlying instructions and font encoding, not a full extraction.
      </p>
      <ExamplePreview
        src="/examples/incorrect-unicode.png"
        width={696}
        height={900}
        alt="The rendered example invoice shows Invoice total: £1,250.00."
        caption="The visible amount is £1,250.00. Poppler extracts £9,250.00."
      />
      <h2>2. Find the text instruction</h2>
      <p>
        Choose <strong>First page</strong>, follow <code>/Contents</code> to <strong>4 0 R</strong>, then select{' '}
        <strong>Decoded → Decoded byte text</strong>. The amount is written as:
      </p>
      <pre>
        <code>{'BT /F1 24 Tf 72 564 Td (Invoice total: \\2431,250.00) Tj ET'}</code>
      </pre>
      <p>
        <code>/F1 24 Tf</code> selects font resource F1 at size 24. The literal string contains the digit <code>1</code>, whose code is
        hexadecimal <code>31</code>. The octal escape <code>\243</code> supplies the pound sign's code in this font's WinAnsi encoding.
        These are drawing instructions containing character codes; extraction still has to map those codes to Unicode.
      </p>
      <h2>3. Follow the font to its Unicode map</h2>
      <p>
        Return to page <strong>3 0 R</strong>. Follow <code>/Resources → /Font → /F1</code> to font <strong>5 0 R</strong>. It names
        Helvetica and <code>/WinAnsiEncoding</code>, which supply the visible glyphs here. Its <code>/ToUnicode</code> reference points to{' '}
        <strong>6 0 R</strong>. Open that stream's <strong>Decoded</strong> tab and find the entry inside <code>beginbfchar</code>:
      </p>
      <pre>
        <code>{'<31> <0039>'}</code>
      </pre>
      <p>
        This maps source code <code>31</code> (the visible digit 1) to Unicode <code>U+0039</code> (the digit 9). For this sample, the
        intended mapping is <code>{'<31> <0031>'}</code>. The incorrect entry changes the extracted amount while leaving the visible glyph
        unchanged.
      </p>
      <h2>What to change in the generator</h2>
      <p>
        Correct the Unicode map in the generating software, regenerate the PDF, and verify both rendering and extraction. Removing a map is
        not a general fix: other fonts may need it to extract meaningful text at all.
      </p>
      <p>
        If you process invoices automatically, a readable page alone does not establish that the extracted amount is correct. Missing
        spaces, reading order, scanned pages, and absent mappings need separate investigations. PDF Internals does not repair mappings or
        validate an extraction pipeline.
      </p>
    </>
  );
};
