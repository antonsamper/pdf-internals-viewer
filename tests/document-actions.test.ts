import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// @ts-expect-error Node ESM fixture generators have no declaration file.
import { actionsPdf } from '../scripts/fixtures/action-fixtures.mjs';
// @ts-expect-error Node ESM fixture generators have no declaration file.
import { classicPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { actionCount, documentActions, flattenActions } from '../src/lib/pdf/document-actions';
import { PdfInspector } from '../src/lib/pdf/inspector';

const inspect = async (bytes: Uint8Array) => {
  const document = await new PdfInspector().open(bytes, 'actions.pdf');
  return documentActions(document, new Map(document.objects.map((object) => [object.id, object])));
};

const page = (extra = '') => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${extra} >>`;
const minimal = (catalog: string, pageExtra = '', more: [number, string][] = []) =>
  classicPdf([
    [1, `<< /Type /Catalog /Pages 2 0 R ${catalog} >>`],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, page(pageExtra)],
    ...more,
  ]).bytes as Uint8Array;

describe('documentActions', () => {
  it('lists actions from the catalogue, pages, annotations, form fields and outline', async () => {
    const report = await inspect(actionsPdf().bytes);
    const rows = report.actions.map((action) => [action.trigger, action.entry, action.holderId, action.type]);
    expect(rows).toEqual([
      ['Document opens', '/OpenAction', '1 0', 'JavaScript'],
      ['Before the document closes', '/AA /WC', '1 0', 'SubmitForm'],
      ['Page opens', '/AA /O', '3 0', 'GoTo'],
      ['Link clicked', '/A', '10 0', 'URI'],
      ['Link clicked', '/A', '3 0', 'Launch'],
      ['Link clicked', '/A', '11 0', undefined],
      ['Keystroke or selection change', '/AA /K', '13 0', 'JavaScript'],
      ['Field value is validated', '/AA /V', '13 0', 'ImportData'],
      ['Outline item selected', '/A', '17 0', 'GoTo'],
      ['Outline item selected', '/A', '18 0', undefined],
    ]);
    expect(report.actions[2].context).toBe('Page 1');
    expect(report.actions[4].context).toBe('Link annotation on page 1');
    expect(report.actions[6].context).toBe('Widget annotation (total) on page 2');
    expect(report.actions[8].context).toBe('Outline item (Chapter one)');
  });

  it('summarises targets and keeps script text as a decoded string or a stream to read', async () => {
    const [open, close, , uri, launch, , keystroke, validate] = (await inspect(actionsPdf().bytes)).actions;
    expect(open.actionId).toBe('6 0');
    expect(open.target).toEqual({ label: 'Script', streamId: '14 0' });
    expect(close.target).toEqual({ label: 'Submit to', text: 'https://example.invalid/collect' });
    expect(uri.target).toEqual({ label: 'URI', text: 'https://example.invalid/' });
    expect(launch.target).toEqual({ label: 'File', text: 'report.exe' });
    expect(keystroke.target).toEqual({ decodedString: true, label: 'Script', text: 'event.rc = true;' });
    expect(validate.target).toEqual({ label: 'File', text: 'values.fdf' });
  });

  it('keeps /Next chains in order, including arrays and shared actions', async () => {
    const uri = (await inspect(actionsPdf().bytes)).actions[3];
    expect(uri.next.map((action) => [action.entry, action.type, action.target?.text])).toEqual([
      ['/Next', 'Named', 'PrevPage'],
      ['/Next', 'JavaScript', undefined],
    ]);
    // Object 6 also runs on opening. Sharing it is not a cycle.
    expect(uri.next[1].notes).toEqual([]);
    expect(uri.next[1].actionId).toBe('6 0');
  });

  it('stops a /Next cycle with a note', async () => {
    const goTo = (await inspect(actionsPdf().bytes)).actions[2];
    expect(goTo.next).toHaveLength(1);
    const named = goTo.next[0];
    expect(named).toMatchObject({ actionId: '8 0', holderId: '7 0', type: 'Named' });
    expect(named.next).toHaveLength(1);
    expect(named.next[0].actionId).toBe('7 0');
    expect(named.next[0].notes[0]).toMatch(/^Cycle: \/Next leads back to 7 0 obj/);
    expect(named.next[0].next).toEqual([]);
  });

  it('notes malformed and unresolvable actions and keeps the rest', async () => {
    const report = await inspect(actionsPdf().bytes);
    const [noType, missing] = [report.actions[5], report.actions[9]];
    expect(noType.notes).toEqual(['The action dictionary has no /S action type.']);
    expect(missing.notes).toEqual(['99 0 R could not be resolved.']);
    expect(report.notes).toEqual(['Page 2 (4 0 obj): annotation 3 30 0 R could not be resolved.']);
    expect(actionCount(report.actions)).toBe(14);
  });

  it('lists a widget reached from both the page and the form fields once', async () => {
    const actions = flattenActions((await inspect(actionsPdf().bytes)).actions);
    expect(actions.filter((action) => action.holderId === '13 0')).toHaveLength(2);
  });

  it('reads an /OpenAction destination array and explains other non-action values', async () => {
    const [destination] = (await inspect(minimal('/OpenAction [3 0 R /Fit]'))).actions;
    expect(destination).toMatchObject({ destination: true, notes: [], target: { label: 'Destination', text: '[ 3 0 R /Fit ]' } });
    expect(destination.type).toBeUndefined();
    const [name] = (await inspect(minimal('/OpenAction /Start'))).actions;
    expect(name.notes).toEqual(['Expected an action dictionary or a destination array, found a name.']);
    const [link] = (await inspect(minimal('', '/Annots [<< /Subtype /Link /A [1 2] >>]'))).actions;
    expect(link.notes).toEqual(['Expected an action dictionary, found an array.']);
  });

  it('notes a broken /AA entry, an unknown event and a missing target', async () => {
    const report = await inspect(minimal('/AA 5 0 R', '/AA << /Zz << /S /URI >> >>', [[5, '(not a dictionary)']]));
    expect(report.actions.map((action) => [action.trigger, action.notes])).toEqual([
      ['Additional actions', ['Expected an action dictionary, found a string.']],
      ['Event /Zz', ['The /URI entry is missing or could not be read.']],
    ]);
  });

  it('stops an outline sibling loop and an /Annots value that is not an array', async () => {
    const report = await inspect(
      minimal('/Outlines 5 0 R', '/Annots 9 0 R', [
        [5, '<< /First 6 0 R >>'],
        [6, '<< /Title (Loop) /Next 7 0 R /A << /S /Named /N /FirstPage >> >>'],
        [7, '<< /Title (Back) /Next 6 0 R >>'],
        [9, '<< /Not /AnArray >>'],
      ])
    );
    expect(report.actions.map((action) => action.context)).toEqual(['Outline item (Loop)']);
    expect(report.notes).toEqual([
      'Page 1 (3 0 obj): /Annots is not an array',
      'Outline: 6 0 obj is reached more than once, so the walk stops there.',
    ]);
  });

  it('reports no actions for a document without any', async () => {
    const report = await inspect(new Uint8Array(readFileSync('public/samples/minimal.pdf')));
    expect(report).toEqual({ actions: [], notes: [] });
  });

  it('reads the opening-action sample as a single GoTo', async () => {
    const report = await inspect(new Uint8Array(readFileSync('public/samples/opening-action.pdf')));
    expect(report.actions).toHaveLength(1);
    expect(report.actions[0]).toMatchObject({
      actionId: '6 0',
      holderId: '1 0',
      target: { label: 'Destination', text: '[ 3 0 R /Fit ]' },
      trigger: 'Document opens',
      type: 'GoTo',
    });
  });
});
