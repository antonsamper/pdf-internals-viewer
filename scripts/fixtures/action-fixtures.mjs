/** Original action fixtures. The scripts are inert sample text; nothing here is meant to run. */
import { deflateSync } from 'node:zlib';
import { classicPdf } from './pdf-fixtures.mjs';

const ascii = text => Buffer.from(text, 'latin1');
const stream = (data, dictionary = '', compress = false) => {
    const raw = ascii(data);
    const bytes = compress ? deflateSync(raw) : raw;
    return Buffer.concat([ascii(`<< /Length ${bytes.length} ${compress ? '/Filter /FlateDecode ' : ''}${dictionary} >>\nstream\n`), bytes, ascii('\nendstream')]);
};
const page = (extra = '') => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R ${extra} >>`;

/**
 * One document with an action from every source the Actions panel reads:
 * the catalogue's /OpenAction and /AA, page /AA, link and widget annotations, a form field and the outline.
 * Object 7 chains to 8 and 8 back to 7, a /Next cycle. Object 30 is missing, and object 12 has no /S.
 */
export const actionsPdf = () => classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R /OpenAction 6 0 R /AA << /WC 9 0 R >> /AcroForm << /Fields [13 0 R] >> /Outlines 16 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'],
    [3, page('/AA << /O 7 0 R >> /Annots [10 0 R << /Type /Annot /Subtype /Link /Rect [72 600 300 620] /A << /S /Launch /F (report.exe) >> >>]')],
    [4, page('/Annots [11 0 R 13 0 R 30 0 R]')],
    [5, stream('BT /F1 14 Tf 72 700 Td (Actions sample) Tj ET')],
    [6, '<< /Type /Action /S /JavaScript /JS 14 0 R >>'],
    [7, '<< /Type /Action /S /GoTo /D [4 0 R /Fit] /Next 8 0 R >>'],
    [8, '<< /Type /Action /S /Named /N /NextPage /Next 7 0 R >>'],
    [9, '<< /Type /Action /S /SubmitForm /F << /FS /URL /F (https://example.invalid/collect) >> >>'],
    [10, '<< /Type /Annot /Subtype /Link /Rect [72 640 300 660] /A << /S /URI /URI (https://example.invalid/) /Next [<< /S /Named /N /PrevPage >> 6 0 R] >> >>'],
    [11, '<< /Type /Annot /Subtype /Link /Rect [72 680 300 700] /A 12 0 R >>'],
    [12, '<< /Type /Action /URI (https://example.invalid/missing-type) >>'],
    [13, '<< /Type /Annot /Subtype /Widget /FT /Tx /T (total) /Rect [72 500 300 520] /AA << /K << /S /JavaScript /JS (event.rc = true;) >> /V << /S /ImportData /F (values.fdf) >> >> >>'],
    [14, stream('app.alert("Sample script text. The viewer does not run it.");', '', true)],
    [16, '<< /Type /Outlines /First 17 0 R /Last 18 0 R /Count 2 >>'],
    [17, '<< /Title (Chapter one) /Parent 16 0 R /Next 18 0 R /A << /S /GoTo /D [3 0 R /XYZ 0 792 0] >> >>'],
    [18, '<< /Title (Chapter two) /Parent 16 0 R /Prev 17 0 R /A 99 0 R >>'],
]);
