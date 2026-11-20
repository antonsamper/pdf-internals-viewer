export const AudiencePage = function AudiencePage() {
  return (
    <>
      <p className="about-lead">
        PDF Internals is for developers and technically curious readers who need to understand how a PDF works. Follow objects, references,
        streams and original bytes to explain a document’s behaviour. Your file stays on your device.
      </p>
      <p>
        You do not need to know the PDF format before starting. The <a href="/guide">getting started guide</a> follows a small sample from
        its first page to its drawing instructions.
      </p>

      <h2>Developers generating PDFs</h2>
      <p>
        Does a one-page invoice take up several megabytes? Is the same logo embedded repeatedly? Has a page inherited an unexpected
        rotation? Inspect the output of your PDF generator to see which resources and page properties it actually wrote.
      </p>
      <p>
        Try the examples for <a href="/examples/large-pdf">an unexpectedly large PDF</a>,{' '}
        <a href="/examples/repeated-logo">repeated logos</a> and <a href="/examples/page-rotation">page rotation</a>. Use the findings to
        investigate your generator; PDF Internals does not rewrite or optimise the file.
      </p>

      <h2>Developers extracting text and processing documents</h2>
      <p>
        A page can look correct while copied or extracted text is wrong. Follow a content stream to the font it uses, then inspect the
        font’s Unicode mapping and embedded resources to understand the discrepancy.
      </p>
      <p>
        The <a href="/examples/incorrect-text">incorrect copied text example</a> demonstrates a deliberately mismatched amount. The{' '}
        <a href="/examples/embedded-font">embedded font example</a> shows how to distinguish a font name from an embedded font program.
      </p>

      <h2>QA and support engineers investigating PDF issues</h2>
      <p>
        Turn a report such as “the logo appears on every page, but the file keeps growing” into a specific finding. Follow each page’s
        resource references, compare dictionaries and bookmark objects with notes for your investigation.
      </p>
      <p>
        Read <a href="/guides/search-bookmark-compare">how to search, bookmark and compare objects</a>, then try it on the{' '}
        <a href="/examples/repeated-logo">repeated-logo sample</a>. Bookmarks and notes are stored in your browser; see{' '}
        <a href="/privacy">privacy and browser storage</a> before recording sensitive details.
      </p>

      <h2>Students, educators and people learning the PDF format</h2>
      <p>
        Connect a visible page to the structures behind it. Start with a small, known PDF, follow a reference such as <code>3 0 R</code> and
        compare decoded drawing instructions with the page preview and original file bytes.
      </p>
      <p>
        Start with <a href="/guides/inspect-pdf-objects">objects and references</a> or{' '}
        <a href="/guides/decode-pdf-streams">raw and decoded streams</a>. Each guide links to a bundled sample you can inspect yourself.
      </p>

      <h2>Security analysts inspecting document structure</h2>
      <p>
        Locate automatic actions, JavaScript entries and embedded files, then follow their references. This can help you understand what a
        document contains, within the parser’s supported features and limits.
      </p>
      <p>
        Read the <a href="/guides/investigate-suspicious-features">suspicious-feature guide</a> and the{' '}
        <a href="/examples/opening-action">automatic-action example</a>. An empty search does not prove a PDF is safe. This tool does not
        provide a malware verdict, sanitise documents or replace a dedicated security workflow.
      </p>

      <h2>Is this the right tool for your task?</h2>
      <p>
        If you need to read, print, annotate or edit a document, a PDF viewer or editor is usually the appropriate starting point. PDF
        Internals is a read-only inspection workspace. See <a href="/pdf-inspector-vs-viewer">when to use a PDF inspector or viewer</a> and
        the <a href="/limitations">supported features and limitations</a>.
      </p>
      <p className="article-actions">
        <a href="/?sample=minimal">Explore a simple sample PDF →</a>
        <a href="/">Open the inspector →</a>
      </p>
    </>
  );
};
export const InspectorVsViewerPage = function InspectorVsViewerPage() {
  return (
    <>
      <p className="about-lead">
        A PDF viewer shows the rendered page. A PDF inspector helps explain how the file produces it: the objects, references, fonts,
        images, streams and bytes behind what you see.
      </p>
      <p>
        Use a viewer for everyday reading and printing. Use an inspector when you need to investigate why a PDF behaves unexpectedly or
        understand its structure. Some viewers also offer advanced inspection tools; the distinction here is the task you need to complete.
      </p>

      <h2>Which tool fits the task?</h2>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <caption>Everyday viewing and structural inspection</caption>
          <thead>
            <tr>
              <th scope="col">Your task</th>
              <th scope="col">Where to start</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Read or print a document</th>
              <td>A normal PDF viewer shows the page and provides reading and printing controls.</td>
            </tr>
            <tr>
              <th scope="row">Annotate, fill in or edit a PDF</th>
              <td>A viewer or editor with those features. PDF Internals cannot modify the file.</td>
            </tr>
            <tr>
              <th scope="row">Explain an unexpectedly large file</th>
              <td>
                An inspector lets you follow image resources and examine stream sizes. Try the{' '}
                <a href="/examples/large-pdf">large-PDF example</a>.
              </td>
            </tr>
            <tr>
              <th scope="row">Investigate incorrect copied text</th>
              <td>
                An inspector lets you trace drawing instructions to font resources and Unicode mappings. Try the{' '}
                <a href="/examples/incorrect-text">incorrect-text example</a>.
              </td>
            </tr>
            <tr>
              <th scope="row">Trace repeated images or rotated pages</th>
              <td>
                An inspector helps you compare resource references and follow inherited page properties. Try{' '}
                <a href="/examples/repeated-logo">repeated logos</a> or <a href="/examples/page-rotation">page rotation</a>.
              </td>
            </tr>
            <tr>
              <th scope="row">Investigate attachments and automatic actions</th>
              <td>
                A viewer may expose attachments or navigation behaviour. An inspector helps trace their underlying entries and references.
                See <a href="/examples/hidden-attachment">attachments</a> and <a href="/examples/opening-action">opening actions</a>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Example: the page looks right, but copied text is wrong</h2>
      <p>
        Our bundled invoice sample visibly shows <strong>£1,250.00</strong>, while its deliberately incorrect text mapping makes extraction
        produce <strong>£9,250.00</strong>. Looking at the rendered page alone does not explain the difference.
      </p>
      <p>
        The <a href="/examples/incorrect-text">investigation</a> follows the page’s drawing instructions to its font and{' '}
        <code>/ToUnicode</code> map. The map sends the source code for the visible digit 1 to the Unicode character 9.
      </p>
      <p className="article-actions">
        <a href="/?sample=incorrect-unicode">Inspect the incorrect-text sample →</a>
        <a href="/examples/incorrect-text">Follow the example</a>
      </p>

      <h2>Use the page preview and inspector together</h2>
      <p>
        PDF Internals includes an optional page preview so you can connect the visible result to the file structure. Follow a page to its
        content stream, read supported decoded data and locate available source ranges in Original bytes.
      </p>
      <p>
        The preview renderer and structural parser are independent. A page may render even when some structures cannot be decoded or
        inspected. Read <a href="/limitations">supported features and limitations</a> when interpreting partial results.
      </p>

      <h2>Can an inspector fix a broken PDF?</h2>
      <p>
        PDF Internals helps you investigate a problem, but it does not repair, compress, edit or sanitise the document. Your original file
        stays unchanged. Apply any fix in the generating software or an appropriate PDF editing tool, then inspect the new output if needed.
      </p>

      <h2>Do I need to upload my PDF?</h2>
      <p>
        No. PDF processing and page rendering happen on your device. Bookmarks and notes are saved in this browser; the app does not upload
        or save your PDF. Read <a href="/privacy">privacy and browser storage</a> for details.
      </p>
      <p className="article-actions">
        <a href="/guide">Start with the inspection guide</a>
        <a href="/">Open the inspector →</a>
      </p>
    </>
  );
};
