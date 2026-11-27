import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// @ts-expect-error Node ESM fixture generators have no declaration file.
import { actionsPdf } from '../scripts/fixtures/action-fixtures.mjs';
// @ts-expect-error Node ESM fixture generators have no declaration file.
import { classicPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { documentActions, flattenActions, scriptText } from '../src/lib/pdf/document-actions';
import { DocumentReceiver, DocumentTransfer } from '../src/lib/pdf/document-transfer';
import { PdfInspector } from '../src/lib/pdf/inspector';

const inspect = async (bytes: Uint8Array) => {
  const document = await new PdfInspector().open(bytes, 'actions.pdf');
  return documentActions(
    document,
    new Map(
      document.objects.map((object) => {
        return [object.id, object];
      })
    )
  );
};

const page = (extra = '') => {
  return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${extra} >>`;
};
const minimal = (catalog: string, pageExtra = '', more: [number, string][] = []) => {
  return classicPdf([
    [1, `<< /Type /Catalog /Pages 2 0 R ${catalog} >>`],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, page(pageExtra)],
    ...more,
  ]).bytes as Uint8Array;
};

const streamResult = (bytes: number[], text = '') => {
  return {
    bytes: new Uint8Array(bytes),
    mode: 'decoded' as const,
    objectId: '9 0',
    text,
    truncated: false,
  };
};

describe('documentActions', () => {
  it('lists actions from the catalogue, pages, annotations, form fields and outline', async () => {
    const report = await inspect(actionsPdf().bytes);
    const rows = report.actions.map((action) => {
      return [action.trigger, action.entry, action.holderId, action.type];
    });
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
    expect(
      [open, close, launch, keystroke, validate].map((action) => {
        return action.sensitive;
      })
    ).toEqual(['Runs a script', 'Sends form data', 'Opens a file or app', 'Runs a script', 'Loads form data']);
    expect(uri.sensitive).toBeUndefined();
    expect(keystroke.target).toEqual({ decodedString: true, label: 'Script', text: 'event.rc = true;' });
    expect(validate.target).toEqual({ label: 'File', text: 'values.fdf' });
  });

  it('keeps /Next chains in order, including arrays and shared actions', async () => {
    const uri = (await inspect(actionsPdf().bytes)).actions[3];
    expect(
      uri.next.map((action) => {
        return [action.entry, action.type, action.target?.text];
      })
    ).toEqual([
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
    expect(missing.actionId).toBeUndefined();
    expect(report.notes).toEqual(['Page 2 (4 0 obj): annotation 3 30 0 R could not be resolved.']);
    expect(report.total).toBe(14);
    expect(flattenActions(report.actions)).toHaveLength(14);
  });

  it('lists a widget reached from both the page and the form fields once', async () => {
    const actions = flattenActions((await inspect(actionsPdf().bytes)).actions);
    expect(
      actions.filter((action) => {
        return action.holderId === '13 0';
      })
    ).toHaveLength(2);
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
    expect(
      report.actions.map((action) => {
        return [action.trigger, action.notes];
      })
    ).toEqual([
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
    expect(
      report.actions.map((action) => {
        return action.context;
      })
    ).toEqual(['Outline item (Loop)']);
    expect(report.notes).toEqual([
      'Page 1 (3 0 obj): /Annots is not an array',
      'Outline: 6 0 obj is reached more than once, so the walk stops there.',
    ]);
  });

  it('reports no actions for a document without any', async () => {
    const report = await inspect(new Uint8Array(readFileSync('public/samples/minimal.pdf')));
    expect(report).toEqual({ actions: [], notes: [], total: 0 });
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

  it('caps /Next fan-out through shared actions with a report note', async () => {
    const more = Array.from({ length: 30 }, (_, i): [number, string] => {
      return [10 + i, `<< /S /Named /N /NextPage /Next [${11 + i} 0 R ${11 + i} 0 R] >>`];
    });
    more.push([40, '<< /S /Named /N /NextPage >>']);
    const report = await inspect(minimal('/OpenAction 10 0 R', '', more));
    expect(report.total).toBe(5000);
    expect(flattenActions(report.actions)).toHaveLength(5000);
    expect(report.notes).toContain('The list stops at 5000 actions. Later actions are not listed.');
  });

  it('stops a long chain of direct /Next dictionaries at 64 actions', async () => {
    const nested = Array.from({ length: 50 }).reduce<string>((inner) => {
      return `<< /S /Named /N /NextPage /Next ${inner} >>`;
    }, '<< /S /Named /N /LastPage >>');
    const more = Array.from({ length: 3 }, (_, i): [number, string] => {
      return [10 + i, nested.replace(/>>$/, ` >>`).replace('/LastPage', `/LastPage /Next ${11 + i} 0 R`)];
    });
    more.push([13, '<< /S /Named /N /FirstPage >>']);
    const report = await inspect(minimal('/OpenAction 10 0 R', '', more));
    const chain = flattenActions(report.actions);
    expect(chain).toHaveLength(64);
    expect(chain.at(-1)?.notes).toEqual(['The /Next chain is longer than 64 actions. Later actions are not listed.']);
  });

  it('stops a /Next cycle through an indirect array', async () => {
    const report = await inspect(
      minimal('/OpenAction 5 0 R', '', [
        [5, '<< /S /Named /N /NextPage /Next 6 0 R >>'],
        [6, '[<< /S /Named /N /PrevPage /Next 6 0 R >>]'],
      ])
    );
    const [open] = report.actions;
    expect(open.next).toHaveLength(1);
    expect(open.next[0].notes[0]).toMatch(/^Cycle: \/Next leads back to 6 0 obj/);
  });

  it('bounds form fields whose /Kids repeat or loop through an indirect array', async () => {
    const kids = Array.from({ length: 3000 }, () => {
      return '6 0 R';
    }).join(' ');
    const repeated = await inspect(
      minimal('/AcroForm << /Fields [5 0 R] >>', '', [
        [5, `<< /T (parent) /Kids [${kids}] >>`],
        [6, '<< /T (child) /AA << /K << /S /JavaScript /JS (1;) >> >> >>'],
      ])
    );
    expect(repeated.actions).toHaveLength(1);
    expect(repeated.notes).toEqual(['Form fields: 6 0 obj is reached more than once, so the walk stops there.']);
    const looped = await inspect(minimal('/AcroForm << /Fields 7 0 R >>', '', [[7, '[<< /T (loop) /Kids 7 0 R >>]']]));
    expect(looped.notes).toEqual(['Form fields: a dictionary is reached more than once, so the walk stops there.']);
    const wide = await inspect(minimal(`/AcroForm << /Fields [${'<< /T (f) >> '.repeat(10_001)}] >>`));
    expect(wide.notes).toEqual(['Form fields: more than 10000 items. Later items are not listed.']);
  });

  it('treats inherited JavaScript names such as /__proto__ as unknown', async () => {
    const report = await inspect(
      minimal('/OpenAction << /S /__proto__ /Next << /S /constructor >> >> /AA << /__proto__ << /S /URI /URI (x) >> >>')
    );
    expect(
      report.actions.map((action) => {
        return [action.trigger, action.type, action.sensitive, action.target];
      })
    ).toEqual([
      ['Document opens', '__proto__', undefined, undefined],
      ['Event /__proto__', 'URI', undefined, { label: 'URI', text: 'x' }],
    ]);
    expect(report.actions[0].next[0]).toMatchObject({ sensitive: undefined, target: undefined, type: 'constructor' });
  });

  it('shows hidden characters, launch parameters, rendition scripts and long values as decoded text', async () => {
    const report = await inspect(
      minimal(
        // The file name is UTF-16BE "i", U+202E, "x": a right-to-left override that would reverse what follows.
        '/OpenAction << /S /Launch /Win << /F <FEFF0069202E0078> /P (/c start) >> >>',
        `/Annots [<< /Subtype /Link /A << /S /Rendition /JS (play();) >> >> << /Subtype /Link /A << /S /URI /URI (${'a'.repeat(1200)}) >> >> << /Subtype /Link /A << /S /JavaScript /JS (${'b'.repeat(5000)}) >> >>]`
      )
    );
    const [launch, rendition, uri, longScript] = report.actions;
    expect(launch.target?.detail).toBe('Parameters: /c start');
    const marked = await inspect(minimal('/OpenAction << /S /URI /URI <FEFF0061061C00AD0062> >>'));
    expect(marked.actions[0].target?.text).toBe('a⟨U+061C⟩⟨U+00AD⟩b');
    expect(launch.target?.text).toBe('i⟨U+202E⟩x');
    expect(rendition).toMatchObject({ sensitive: 'Runs a script', target: { decodedString: true, label: 'Script', text: 'play();' } });
    expect(uri.target).toMatchObject({ truncated: true });
    expect(uri.target?.text).toHaveLength(1001);
    expect(longScript.target).toMatchObject({ decodedString: true, truncated: true });
    expect(longScript.target?.text).toHaveLength(4097);
  });

  it('notes unreadable sources and scripts the panel does not list', async () => {
    const report = await inspect(
      minimal('/Names << /JavaScript << /Names [(init) 5 0 R] >> >> /AcroForm << /Fields [] /XFA 6 0 R >>', '', [
        [5, '<< /S /JavaScript /JS (1;) >>'],
        [6, '(xfa)'],
      ])
    );
    expect(report.notes).toEqual([
      '1 0 obj has a /Names /JavaScript tree. Its document-level scripts are not listed here.',
      'The form in 1 0 obj has an /XFA entry. Scripts inside XFA forms are not listed here.',
    ]);
    const document = await new PdfInspector().open(minimal(''), 'broken.pdf');
    const objects = new Map(
      document.objects.map((object) => {
        return [object.id, object];
      })
    );
    objects.delete('1 0');
    objects.delete('3 0');
    expect(documentActions(document, objects).notes).toEqual([
      'The catalogue 1 0 obj could not be read, so catalogue, form field and outline actions are not listed.',
      'Page 1 (3 0 obj) could not be read, so its actions are not listed.',
    ]);
    expect(documentActions({ ...document, catalogId: undefined, pages: [] }, objects).notes).toEqual([
      'The trailer names no catalogue, so catalogue, form field and outline actions are not listed.',
      'No pages were read from the page tree, so page and annotation actions are not listed. See Issues.',
    ]);
  });

  it('decodes script stream text by its byte order mark and shows hidden characters', () => {
    expect(scriptText(streamResult([0xfe, 0xff, 0x00, 0x61, 0x00, 0x3b]))).toEqual({ encoding: 'UTF-16BE', text: 'a;' });
    expect(scriptText(streamResult([0xff, 0xfe, 0x61, 0x00]))).toEqual({ encoding: 'UTF-16LE', text: 'a' });
    expect(scriptText(streamResult([0x61, 0x0a, 0x00], 'a\n\u0000'))).toEqual({ encoding: 'one character per byte', text: 'a\n⟨U+0000⟩' });
  });

  it('stops reading pages, form fields and the outline once the list holds 5000 actions', async () => {
    const link = '<< /Subtype /Link /Rect [0 0 1 1] /A << /S /Named /N /NextPage >> >> ';
    const pages = Array.from({ length: 60 }, (_, i): [number, string] => {
      return [10 + i, page(`/Annots [${link.repeat(100)}]`)];
    });
    const bytes = classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [998 0 R] >> /Outlines << /First 999 0 R >> >>'],
      [
        2,
        `<< /Type /Pages /Kids [${pages
          .map(([id]) => {
            return `${id} 0 R`;
          })
          .join(' ')}] /Count 60 >>`,
      ],
      ...pages,
    ]).bytes as Uint8Array;
    const document = await new PdfInspector().open(bytes, 'many-links.pdf');
    const objects = new Map(
      document.objects.map((object) => {
        return [object.id, object];
      })
    );
    // Pages 51 to 60 hold actions past the cap. Removing one would add a "could not be read" note if the walk reached it,
    // and the missing field and outline objects would add notes too.
    objects.delete(document.pages[55]);
    const report = documentActions(document, objects);
    expect(report.total).toBe(5000);
    expect(report.actions.at(-1)?.context).toBe('Link annotation on page 50');
    expect(report.notes).toEqual(['The list stops at 5000 actions. Later actions are not listed.']);
  });

  it('stops a walk that would visit one shared /Annots array on every page, and the document still opens', async () => {
    // 2,000 pages share one array of 2,000 references to the same link, so a full walk makes 4,000,000 visits.
    const pages = Array.from({ length: 2000 }, (_, index) => {
      return 100 + index;
    });
    const kids = pages
      .map((id) => {
        return `${id} 0 R`;
      })
      .join(' ');
    const bytes = classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`],
      [
        9,
        `[${Array.from({ length: 2000 }, () => {
          return '10 0 R';
        }).join(' ')}]`,
      ],
      [10, '<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] >>'],
      ...pages.map((id, index): [number, string] => {
        return [id, page(`/Annots 9 0 R${index ? '' : ' /AA << /O << /S /GoTo /D [100 0 R /Fit] >> >>'}`)];
      }),
    ]).bytes as Uint8Array;
    const document = await new PdfInspector().open(bytes, 'shared-annots.pdf');
    const sender = new DocumentTransfer(document);
    const receiver = new DocumentReceiver();
    const start = performance.now();
    let done = false;
    while (!done) {
      const batch = structuredClone(sender.next());
      receiver.accept(batch.items);
      done = batch.done;
    }
    const elapsed = performance.now() - start;
    const opened = receiver.finish();
    expect(opened.pages).toHaveLength(2000);
    const report = opened.indexes?.actions;
    expect(
      report?.actions.map((action) => {
        return [action.trigger, action.context, action.type];
      })
    ).toEqual([['Page opens', 'Page 1', 'GoTo']]);
    expect(report?.notes).toEqual(['The list stops after 500000 steps. Later actions are not listed.']);
    // The full walk takes several seconds; the budget keeps the whole transfer well under the 15-second request limit.
    expect(elapsed).toBeLessThan(5000);
  });
});
