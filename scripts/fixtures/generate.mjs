import { mkdir, writeFile } from 'node:fs/promises';
import { minimalPdf, resourcesPdf, compressedPdf } from './pdf-fixtures.mjs';
const target = new URL('../../public/samples/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [name, fixture] of [['minimal', minimalPdf()], ['resources', resourcesPdf()], ['compressed', compressedPdf()]]) await writeFile(new URL(`${name}.pdf`, target), fixture.bytes);
console.log('Generated three project-owned sample PDFs.');
