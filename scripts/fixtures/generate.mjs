import { mkdir, writeFile } from 'node:fs/promises';
import { minimalPdf, resourcesPdf, compressedPdf } from './pdf-fixtures.mjs';
import { oversizedImagePdf, incorrectUnicodePdf, ADDITIONAL_EXAMPLES } from './example-fixtures.mjs';
const target = new URL('../../public/samples/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [name, fixture] of [['minimal', minimalPdf()], ['resources', resourcesPdf()], ['compressed', compressedPdf()], ['oversized-image', oversizedImagePdf()], ['incorrect-unicode', incorrectUnicodePdf()], ...ADDITIONAL_EXAMPLES.map(([name, generate]) => [name, generate()])]) await writeFile(new URL(`${name}.pdf`, target), fixture.bytes);
console.log('Generated eleven project-owned sample PDFs.');
