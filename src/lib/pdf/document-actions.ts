import type { PdfDocumentInfo, PdfObjectRecord, PdfValue, StreamResult } from './types';

import { property } from './navigation';

/** Action types that run code, open files or move form data. The panel marks them so they stand out. */
const SENSITIVE_ACTIONS: Record<string, string> = {
  ImportData: 'Loads form data',
  JavaScript: 'Runs a script',
  Launch: 'Opens a file or app',
  SubmitForm: 'Sends form data',
};

/** What an action points at. `text` is a decoded value; `streamId` names a script stream to read on demand. */
export interface PdfActionTarget {
  label: string;
  text?: string;
  /** Extra decoded detail, such as a launch action's parameters. */
  detail?: string;
  /** Set when `text` is a script decoded from a string value. */
  decodedString?: boolean;
  /** Set when `text` was cut short for display. */
  truncated?: boolean;
  streamId?: string;
}

export interface PdfAction {
  /** Unique within the report. */
  key: string;
  /** The event that runs the action, such as "Document opens". */
  trigger: string;
  /** The dictionary key path the action was read from, such as `/AA /O`. */
  entry: string;
  /** Where the entry sits, such as "Page 1" or "Link annotation on page 2". */
  context: string;
  /** The indirect object whose dictionary holds the entry. */
  holderId?: string;
  /** The action's own object, when the action dictionary is indirect. */
  actionId?: string;
  /** The `/S` value, without the slash. Unset for a destination or a malformed action. */
  type?: string;
  /** Why the action is marked, such as "Runs a script". Unset for the other types. */
  sensitive?: string;
  /** Set when an `/OpenAction` holds a destination array instead of an action dictionary. */
  destination?: boolean;
  target?: PdfActionTarget;
  notes: string[];
  next: PdfAction[];
}

export interface PdfActionReport {
  actions: PdfAction[];
  /** Problems met while walking the sources, outside any one action. */
  notes: string[];
  /** The number of actions, chained ones included. */
  total: number;
}

type Objects = Map<string, PdfObjectRecord>;
interface Resolved {
  value?: PdfValue;
  id?: string;
  note?: string;
}
interface Origin {
  trigger: string;
  entry: string;
  context: string;
  holderId?: string;
  allowDestination?: boolean;
}
interface Walk {
  objects: Objects;
  rows: Map<string, PdfAction>;
  notes: string[];
  noted: Set<string>;
  hiddenNotes: number;
  total: number;
  /** Pages, annotations, action entries and tree items visited, repeats included. */
  steps: number;
}
/** The action objects and `/Next` arrays above an action, and how many actions deep it is. */
interface Chain {
  ids: string[];
  depth: number;
}

/** How many top-level actions the panel shows at first, and how many more each "Show more" adds. */
export const ACTION_PAGE_SIZE = 100;

const MAX_HOPS = 8;
const MAX_CHAIN = 64;
const MAX_ACTIONS = 5000;
const MAX_NOTES = 200;
const MAX_WALK = 10_000;
const MAX_NAME_TREE_DEPTH = 32;
/** Visits per walk. A shared `/Annots` array is visited once per page, so a small file can ask for millions. */
const MAX_STEPS = 500_000;
const MAX_SCRIPT_TEXT = 4096;
const MAX_TARGET_TEXT = 1000;
const MAX_LABEL_TEXT = 120;

const CATALOG_TRIGGERS: Record<string, string> = {
  DP: 'After the document is printed',
  DS: 'After the document is saved',
  WC: 'Before the document closes',
  WP: 'Before the document is printed',
  WS: 'Before the document is saved',
};
const PAGE_TRIGGERS: Record<string, string> = { C: 'Page closes', O: 'Page opens' };
// A widget annotation and its form field often share one dictionary, so the two sets are read together.
const ANNOTATION_TRIGGERS: Record<string, string> = {
  Bl: 'Loses input focus',
  C: 'Field value is recalculated',
  D: 'Mouse button pressed',
  E: 'Pointer enters',
  F: 'Field value is formatted',
  Fo: 'Receives input focus',
  K: 'Keystroke or selection change',
  PC: 'Containing page closes',
  PI: 'Containing page is no longer visible',
  PO: 'Containing page opens',
  PV: 'Containing page becomes visible',
  U: 'Mouse button released',
  V: 'Field value is validated',
  X: 'Pointer exits',
};

/** Looks up a PDF name in a table without reaching inherited keys such as `__proto__`. */
const lookup = <T>(table: Record<string, T>, key: string): T | undefined => {
  return Object.hasOwn(table, key) ? table[key] : undefined;
};

// Control, zero-width and bidirectional characters can disguise a target, so they are shown as code points.
const HIDDEN_RANGES: [number, number][] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x61c, 0x61c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
  [0xe0000, 0xe007f],
];
const LINE_BREAKS = new Set([0x09, 0x0a, 0x0d]);
const isHidden = (code: number, multiline: boolean) => {
  return (
    (!multiline && LINE_BREAKS.has(code)) ||
    HIDDEN_RANGES.some(([low, high]) => {
      return code >= low && code <= high;
    })
  );
};
const showHidden = (raw: string, multiline: boolean) => {
  return Array.from(raw, (character) => {
    const code = character.codePointAt(0)!;
    return isHidden(code, multiline) ? `⟨U+${code.toString(16).toUpperCase().padStart(4, '0')}⟩` : character;
  }).join('');
};

/** Decoded text made safe to read: hidden characters become visible, and long text is cut short. */
const displayText = (raw: string, max: number, multiline = false) => {
  const text = showHidden(raw.length > max * 2 ? raw.slice(0, max * 2) : raw, multiline);
  return text.length > max ? { text: `${text.slice(0, max)}…`, truncated: true } : { text };
};

const shortLabel = (raw: string | undefined) => {
  return raw ? displayText(raw, MAX_LABEL_TEXT).text : undefined;
};

/** Follows references until a direct value, noting a missing object instead of throwing. */
const resolve = (value: PdfValue | undefined, objects: Objects): Resolved => {
  let current = value;
  let id: string | undefined;
  for (let hop = 0; current?.type === 'reference'; hop++) {
    if (hop >= MAX_HOPS) {
      return { id, note: `Reference chain from ${current.ref} R is too long to follow.` };
    }
    const record = objects.get(current.ref);
    if (!record) {
      return { id: current.ref, note: `${current.ref} R could not be resolved.` };
    }
    id = current.ref;
    current = record.value;
  }
  if (current?.type === 'raw') {
    return { id, note: `The value could not be parsed: ${shortLabel(current.text)}` };
  }
  return { id, value: current };
};

const isDictionary = (value: PdfValue | undefined) => {
  return value?.type === 'dictionary' || value?.type === 'stream';
};

const textOf = (value: PdfValue | undefined): string | undefined => {
  if (value?.type === 'string' || value?.type === 'name') {
    return value.value;
  }
  return value?.text;
};

const resolvedText = (value: PdfValue | undefined, objects: Objects) => {
  return textOf(resolve(value, objects).value);
};

/** The file a `/F` entry names: a string, or a file specification's `/UF`, `/F` or `/Win /F`. */
const fileName = (value: PdfValue | undefined, objects: Objects): string | undefined => {
  const file = resolve(value, objects).value;
  if (!file || !isDictionary(file)) {
    return textOf(file);
  }
  const win = resolve(property(file, 'Win'), objects).value;
  const name = property(file, 'UF') ?? property(file, 'F') ?? (win && property(win, 'F'));
  return resolvedText(name, objects);
};

const labelled = (label: string, raw: string | undefined): PdfActionTarget | undefined => {
  return raw ? { label, ...displayText(raw, MAX_TARGET_TEXT) } : undefined;
};

const script = (value: PdfValue | undefined, objects: Objects): PdfActionTarget | undefined => {
  const resolved = resolve(value, objects);
  if (resolved.value?.type === 'stream') {
    return { label: 'Script', streamId: resolved.id };
  }
  if (resolved.value?.type !== 'string') {
    return undefined;
  }
  return { decodedString: true, label: 'Script', ...displayText(resolved.value.value, MAX_SCRIPT_TEXT, true) };
};

/** A launch action's file, from `/F` or `/Win`, with the Windows parameters that go with it. */
const launchTarget = (action: PdfValue, objects: Objects) => {
  const target = labelled('File', fileName(property(action, 'F') ?? property(action, 'Win'), objects));
  const win = resolve(property(action, 'Win'), objects).value;
  const parameters = win && isDictionary(win) ? resolvedText(property(win, 'P'), objects) : undefined;
  if (!target || !parameters) {
    return target;
  }
  const shown = displayText(parameters, MAX_TARGET_TEXT);
  target.detail = `Parameters: ${shown.text}${shown.truncated ? ' (truncated)' : ''}`;
  return target;
};

const SUMMARIES: Record<string, (action: PdfValue, objects: Objects) => PdfActionTarget | undefined> = {
  GoTo: (action, objects) => {
    return labelled('Destination', resolvedText(property(action, 'D'), objects));
  },
  GoToE: (action, objects) => {
    return labelled('File', fileName(property(action, 'F'), objects));
  },
  GoToR: (action, objects) => {
    return labelled('File', fileName(property(action, 'F'), objects));
  },
  Hide: (action, objects) => {
    return labelled('Annotations', resolvedText(property(action, 'T'), objects));
  },
  ImportData: (action, objects) => {
    return labelled('File', fileName(property(action, 'F'), objects));
  },
  JavaScript: (action, objects) => {
    return script(property(action, 'JS'), objects);
  },
  Launch: launchTarget,
  Named: (action, objects) => {
    return labelled('Operation', resolvedText(property(action, 'N'), objects));
  },
  // A rendition action can carry a script in /JS as well as a media clip.
  Rendition: (action, objects) => {
    return script(property(action, 'JS'), objects);
  },
  SubmitForm: (action, objects) => {
    return labelled('Submit to', fileName(property(action, 'F'), objects));
  },
  URI: (action, objects) => {
    return labelled('URI', resolvedText(property(action, 'URI'), objects));
  },
};

const MISSING_TARGET: Record<string, string> = {
  GoTo: '/D',
  GoToE: '/F',
  GoToR: '/F',
  Hide: '/T',
  ImportData: '/F',
  JavaScript: '/JS',
  Launch: '/F',
  Named: '/N',
  SubmitForm: '/F',
  URI: '/URI',
};

/** Adds a walk note once, keeping at most `MAX_NOTES` so a damaged file cannot flood the panel. */
const addNote = (walk: Walk, note: string) => {
  if (walk.noted.has(note)) {
    return;
  }
  walk.noted.add(note);
  if (walk.notes.length < MAX_NOTES) {
    walk.notes.push(note);
  } else {
    walk.hiddenNotes++;
  }
};

const blankAction = (origin: Origin, key: string, actionId?: string): PdfAction => {
  return {
    actionId,
    context: origin.context,
    entry: origin.entry,
    holderId: origin.holderId,
    key,
    next: [],
    notes: [],
    trigger: origin.trigger,
  };
};

/** The `/S` type, its target and the notes for a well-formed action dictionary. */
const describe = (action: PdfAction, value: PdfValue, objects: Objects) => {
  const type = resolve(property(value, 'S'), objects).value;
  if (type?.type !== 'name') {
    action.notes.push(type ? 'The /S action type is not a name.' : 'The action dictionary has no /S action type.');
    return;
  }
  action.type = shortLabel(type.value);
  action.target = lookup(SUMMARIES, type.value)?.(value, objects);
  action.sensitive = lookup(SENSITIVE_ACTIONS, type.value) ?? (action.target?.label === 'Script' ? 'Runs a script' : undefined);
  const missing = lookup(MISSING_TARGET, type.value);
  if (missing && !action.target) {
    action.notes.push(`The ${missing} entry is missing or could not be read.`);
  }
};

const unexpected = (value: PdfValue | undefined, allowDestination: boolean | undefined) => {
  const found = value?.type === 'array' ? 'an array' : `a ${value?.type ?? 'missing value'}`;
  return `Expected an action dictionary${allowDestination ? ' or a destination array' : ''}, found ${found}.`;
};

const cycleNote = (id: string) => {
  return `Cycle: /Next leads back to ${id} obj, which already runs earlier in this chain. The chain stops here.`;
};

/** Fills in an action from its resolved value: a destination, a malformed value or an action dictionary and its chain. */
const readValue = (walk: Walk, action: PdfAction, value: PdfValue, origin: Origin, chain: Chain) => {
  if (origin.allowDestination && value.type === 'array') {
    action.destination = true;
    action.target = labelled('Destination', value.text);
  } else if (!isDictionary(value)) {
    action.notes.push(unexpected(value, origin.allowDestination));
  } else {
    describe(action, value, walk.objects);
    readNext(walk, action, value, { depth: chain.depth + 1, ids: action.actionId ? [...chain.ids, action.actionId] : chain.ids });
  }
};

/** True once the report holds `MAX_ACTIONS` actions or the walk has used `MAX_STEPS`. Every loop over the sources stops then, so the rest of a large file isn't read. */
const isFull = (walk: Walk) => {
  return walk.total >= MAX_ACTIONS || walk.steps > MAX_STEPS;
};

/** Counts one visit. False once the walk is full, so the caller reads nothing more. */
const spend = (walk: Walk) => {
  walk.steps++;
  return !isFull(walk);
};

/** Reads one action and its `/Next` chain, or nothing once the report holds `MAX_ACTIONS` actions. */
const readAction = (walk: Walk, value: PdfValue, origin: Origin, key: string, chain: Chain): PdfAction | undefined => {
  if (!spend(walk)) {
    return undefined;
  }
  walk.total++;
  const resolved = resolve(value, walk.objects);
  // Link the action's own object only when it exists, so a missing reference offers nothing to inspect.
  const action = blankAction(origin, key, resolved.id && walk.objects.has(resolved.id) ? resolved.id : undefined);
  if (resolved.note || !resolved.value) {
    action.notes.push(resolved.note ?? 'The action is empty.');
  } else if (resolved.id && chain.ids.includes(resolved.id)) {
    action.notes.push(cycleNote(resolved.id));
  } else {
    readValue(walk, action, resolved.value, origin, chain);
  }
  return action;
};

/** The actions a `/Next` entry lists, and the object of an indirect `/Next` array. */
const nextItems = (next: PdfValue, objects: Objects) => {
  const resolved = resolve(next, objects);
  return resolved.value?.type === 'array' ? { arrayId: resolved.id, items: resolved.value.items } : { items: [next] };
};

/** `/Next` holds one action or an array of them, each with its own chain. */
const readNext = (walk: Walk, action: PdfAction, value: PdfValue, chain: Chain) => {
  const next = property(value, 'Next');
  if (!next) {
    return;
  }
  if (chain.depth >= MAX_CHAIN) {
    action.notes.push(`The /Next chain is longer than ${MAX_CHAIN} actions. Later actions are not listed.`);
    return;
  }
  const { arrayId, items } = nextItems(next, walk.objects);
  // An indirect /Next array can list the action that holds it, so the array's own object counts as part of the chain.
  if (arrayId && chain.ids.includes(arrayId)) {
    return void action.notes.push(cycleNote(arrayId));
  }
  const ids = arrayId ? [...chain.ids, arrayId] : chain.ids;
  const origin = { context: action.context, entry: '/Next', holderId: action.actionId ?? action.holderId, trigger: 'Then' };
  action.next = items
    .map((item, index) => {
      return readAction(walk, item, origin, `${action.key}/Next[${index}]`, { depth: chain.depth, ids });
    })
    .filter((item): item is PdfAction => {
      return !!item;
    });
};

/** Adds a top-level row and returns it, or nothing when the walk is full or the row is already listed. */
const addAction = (walk: Walk, value: PdfValue | undefined, origin: Origin, place: string) => {
  if (!value || !spend(walk)) {
    return undefined;
  }
  const key = `${place}|${origin.entry}`;
  if (walk.rows.has(key)) {
    return undefined;
  }
  const action = readAction(walk, value, origin, key, { depth: 0, ids: [] });
  if (action) {
    walk.rows.set(key, action);
  }
  return action;
};

/** A row for an `/AA` entry that isn't a dictionary, counted like any other action. */
const addMalformedAdditional = (walk: Walk, origin: Omit<Origin, 'entry' | 'trigger'>, place: string, note: string) => {
  if (isFull(walk)) {
    return;
  }
  walk.total++;
  const row = blankAction({ ...origin, entry: '/AA', trigger: 'Additional actions' }, `${place}|/AA`);
  row.notes.push(note);
  walk.rows.set(row.key, row);
};

/** Every event in an `/AA` dictionary, labelled from `triggers` or shown by its key. */
const addAdditional = (
  walk: Walk,
  holder: PdfValue,
  origin: Omit<Origin, 'entry' | 'trigger'>,
  place: string,
  triggers: Record<string, string>
) => {
  const entry = property(holder, 'AA');
  if (!entry) {
    return;
  }
  const additional = resolve(entry, walk.objects);
  const events = additional.value;
  if (events?.type !== 'dictionary' && events?.type !== 'stream') {
    return addMalformedAdditional(walk, origin, place, additional.note ?? unexpected(events, false));
  }
  for (const { key, value } of events.entries) {
    if (isFull(walk)) {
      return;
    }
    const name = shortLabel(key);
    addAction(walk, value, { ...origin, entry: `/AA /${name}`, trigger: lookup(triggers, key) ?? `Event /${name}` }, place);
  }
};

/** Notes the script source the panel doesn't list, so an empty list isn't read as "no scripts". */
const noteUnlistedScripts = (walk: Walk, catalog: PdfObjectRecord) => {
  const form = resolve(property(catalog.value, 'AcroForm'), walk.objects);
  if (form.value && isDictionary(form.value) && property(form.value, 'XFA')) {
    addNote(walk, `The form in ${form.id ?? catalog.id} obj has an /XFA entry. Scripts inside XFA forms are not listed here.`);
  }
};

const addCatalog = (walk: Walk, catalog: PdfObjectRecord) => {
  const origin = { context: 'Document catalogue', holderId: catalog.id };
  addAction(
    walk,
    property(catalog.value, 'OpenAction'),
    { ...origin, allowDestination: true, entry: '/OpenAction', trigger: 'Document opens' },
    catalog.id
  );
  addAdditional(walk, catalog.value, origin, catalog.id, CATALOG_TRIGGERS);
  addDocumentScripts(walk, catalog);
  noteUnlistedScripts(walk, catalog);
};

const subtypeOf = (value: PdfValue, objects: Objects) => {
  return shortLabel(resolvedText(property(value, 'Subtype'), objects));
};

const activationTrigger = (subtype: string | undefined) => {
  if (subtype === 'Link') {
    return 'Link clicked';
  }
  if (subtype === 'Widget') {
    return 'Widget activated';
  }
  return 'Annotation activated';
};

const fieldName = (value: PdfValue, objects: Objects) => {
  return shortLabel(resolvedText(property(value, 'T'), objects));
};

/** An annotation's or form field's `/A` and `/AA`. `place` identifies a direct dictionary that has no object of its own. */
const addWidgetLike = (walk: Walk, value: PdfValue, holderId: string | undefined, place: string, context: string) => {
  const origin = { context, holderId };
  addAction(walk, property(value, 'A'), { ...origin, entry: '/A', trigger: activationTrigger(subtypeOf(value, walk.objects)) }, place);
  addAdditional(walk, value, origin, place, ANNOTATION_TRIGGERS);
};

const annotationContext = (value: PdfValue, objects: Objects, pageNumber: number) => {
  const subtype = subtypeOf(value, objects);
  const name = fieldName(value, objects);
  return `${subtype ? `${subtype} annotation` : 'Annotation'}${name ? ` (${name})` : ''} on page ${pageNumber}`;
};

const addAnnotation = (walk: Walk, page: PdfObjectRecord, pageNumber: number, item: PdfValue, index: number) => {
  if (!spend(walk)) {
    return;
  }
  const annotation = resolve(item, walk.objects);
  if (!annotation.value || !isDictionary(annotation.value)) {
    addNote(walk, `Page ${pageNumber} (${page.id} obj): annotation ${index + 1} ${annotation.note ?? 'is not a dictionary'}`);
    return;
  }
  const place = annotation.id ?? `${page.id}/Annots[${index}]`;
  addWidgetLike(walk, annotation.value, annotation.id ?? page.id, place, annotationContext(annotation.value, walk.objects, pageNumber));
};

const addAnnotations = (walk: Walk, page: PdfObjectRecord, pageNumber: number) => {
  const entry = property(page.value, 'Annots');
  if (!entry) {
    return;
  }
  const annots = resolve(entry, walk.objects);
  if (annots.value?.type !== 'array') {
    addNote(walk, `Page ${pageNumber} (${page.id} obj): /Annots ${annots.note ?? 'is not an array'}`);
    return;
  }
  const items = annots.value.items;
  for (let index = 0; index < items.length && !isFull(walk); index++) {
    addAnnotation(walk, page, pageNumber, items[index], index);
  }
};

const addPage = (walk: Walk, id: string, pageNumber: number) => {
  if (!spend(walk)) {
    return;
  }
  const page = walk.objects.get(id);
  if (!page) {
    return addNote(walk, `Page ${pageNumber} (${id} obj) could not be read, so its actions are not listed.`);
  }
  addAdditional(walk, page.value, { context: `Page ${pageNumber}`, holderId: id }, id, PAGE_TRIGGERS);
  addAnnotations(walk, page, pageNumber);
};

const addPages = (walk: Walk, pages: string[]) => {
  if (!pages.length) {
    addNote(walk, 'No pages were read from the page tree, so page and annotation actions are not listed. See Issues.');
  }
  for (let index = 0; index < pages.length && !isFull(walk); index++) {
    addPage(walk, pages[index], index + 1);
  }
};

interface TreeItem {
  place: string;
  value: PdfValue;
  /** How many levels below a root the item sits. */
  depth: number;
  /** The nearest object above the item, so a direct dictionary still has an object to inspect. */
  holderId?: string;
}
type Visit = (value: PdfValue, id: string | undefined, place: string, item: TreeItem) => PdfValue[];

/** Visits a dictionary and places its children one level down, under its own object or its nearest one above. */
const visitChildren = (value: PdfValue, id: string | undefined, item: TreeItem, visit: Visit): TreeItem[] => {
  const base = id ?? item.place;
  const holderId = id ?? item.holderId;
  return visit(value, id, base, { ...item, holderId }).map((child, index) => {
    return { depth: item.depth + 1, holderId, place: `${base}/${index}`, value: child };
  });
};

/** Visits one tree item and returns its children, or none when it repeats or isn't a dictionary. */
const visitItem = (walk: Walk, label: string, seen: Set<PdfValue>, item: TreeItem, visit: Visit): TreeItem[] => {
  if (!spend(walk)) {
    return [];
  }
  const { place, value } = item;
  const resolved = resolve(value, walk.objects);
  // Parsed values are shared, so one dictionary reached twice, directly or through a reference, is the same object.
  if (resolved.value && seen.has(resolved.value)) {
    addNote(walk, `${label}: ${resolved.id ? `${resolved.id} obj` : 'a dictionary'} is reached more than once, so the walk stops there.`);
    return [];
  }
  if (resolved.value) {
    seen.add(resolved.value);
  }
  if (!resolved.value || !isDictionary(resolved.value)) {
    addNote(walk, `${label}: ${resolved.note ?? `an item at ${place} is not a dictionary`}`);
    return [];
  }
  return visitChildren(resolved.value, resolved.id, item, visit);
};

/** Depth-first walk of a linked tree, guarding against cycles and very large trees. */
const walkTree = (walk: Walk, roots: PdfValue[], label: string, visit: Visit, holderId?: string) => {
  const seen = new Set<PdfValue>();
  const stack = roots
    .map((value, index): TreeItem => {
      return { depth: 0, holderId, place: `${label}[${index}]`, value };
    })
    .toReversed();
  for (let steps = 0; stack.length && !isFull(walk); steps++) {
    if (steps + stack.length > MAX_WALK) {
      return addNote(walk, `${label}: more than ${MAX_WALK} items. Later items are not listed.`);
    }
    const children = visitItem(walk, label, seen, stack.pop()!, visit);
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push(children[index]);
    }
  }
};

const arrayItems = (value: PdfValue | undefined, objects: Objects) => {
  const resolved = resolve(value, objects).value;
  return resolved?.type === 'array' ? resolved.items : [];
};

const addFields = (walk: Walk, catalog: PdfObjectRecord) => {
  const form = resolve(property(catalog.value, 'AcroForm'), walk.objects).value;
  if (!form || !isDictionary(form)) {
    return;
  }
  walkTree(walk, arrayItems(property(form, 'Fields'), walk.objects), 'Form fields', (value, id, place) => {
    const name = fieldName(value, walk.objects);
    addWidgetLike(walk, value, id, place, name ? `Form field (${name})` : 'Form field');
    return arrayItems(property(value, 'Kids'), walk.objects);
  });
};

const addOutline = (walk: Walk, catalog: PdfObjectRecord) => {
  const outlines = resolve(property(catalog.value, 'Outlines'), walk.objects).value;
  if (!outlines || !isDictionary(outlines)) {
    return;
  }
  const first = property(outlines, 'First');
  walkTree(walk, first ? [first] : [], 'Outline', (value, id, place) => {
    const title = shortLabel(resolvedText(property(value, 'Title'), walk.objects));
    const origin = {
      context: title ? `Outline item (${title})` : 'Outline item',
      entry: '/A',
      holderId: id,
      trigger: 'Outline item selected',
    };
    addAction(walk, property(value, 'A'), origin, place);
    // An outline item's /Next is its next sibling, not an action chain.
    return [property(value, 'First'), property(value, 'Next')].filter((child): child is PdfValue => {
      return !!child;
    });
  });
};

const SCRIPTS_LABEL = 'Document-level scripts';

/** A name-tree node's `/Kids` or `/Names` array, noting an entry that is there but isn't an array. */
const nodeArray = (walk: Walk, node: PdfValue, key: string, label: string): PdfValue[] => {
  const entry = property(node, key);
  if (!entry) {
    return [];
  }
  const resolved = resolve(entry, walk.objects);
  if (resolved.value?.type !== 'array') {
    addNote(walk, `${SCRIPTS_LABEL}: /${key} in ${label} ${resolved.note ? `could not be read. ${resolved.note}` : 'is not an array.'}`);
    return [];
  }
  return resolved.value.items;
};

/**
 * Readers run every entry in the tree as a script, so the row is marked even when `/S` is missing or different,
 * and a `/JS` entry is shown when `/S` didn't lead to one.
 */
const markScript = (walk: Walk, action: PdfAction, value: PdfValue) => {
  action.sensitive ??= SENSITIVE_ACTIONS.JavaScript;
  const resolved = resolve(value, walk.objects).value;
  if (!action.target && resolved && isDictionary(resolved)) {
    action.target = script(property(resolved, 'JS'), walk.objects);
  }
};

const addScript = (walk: Walk, key: PdfValue, value: PdfValue, place: string, holderId: string | undefined) => {
  const name = resolve(key, walk.objects).value;
  const label = name?.type === 'string' ? shortLabel(name.value) : undefined;
  const origin = {
    context: label ? `Document-level script (${label})` : 'Document-level script',
    entry: '/Names /JavaScript',
    holderId,
    trigger: 'Document opens',
  };
  const action = addAction(walk, value, origin, place);
  if (!action) {
    return;
  }
  markScript(walk, action, value);
  if (name?.type !== 'string') {
    action.notes.push(`The script's name is ${name ? `a ${name.type}` : 'missing'}, not a string.`);
  }
};

/** A leaf's `/Names` array holds name and script pairs. */
const addScripts = (walk: Walk, names: PdfValue[], place: string, holderId: string | undefined, label: string) => {
  if (names.length % 2) {
    addNote(walk, `${SCRIPTS_LABEL}: /Names in ${label} has an odd number of items. The last name has no script and is skipped.`);
  }
  for (let index = 0; index + 1 < names.length && !isFull(walk); index += 2) {
    addScript(walk, names[index], names[index + 1], `${place}/Names[${index}]`, holderId);
  }
};

/** One node of the `/Names /JavaScript` tree: its scripts, then its `/Kids` unless the tree is too deep. */
const visitScriptNode = (walk: Walk, node: PdfValue, id: string | undefined, place: string, { depth, holderId }: TreeItem) => {
  const label = id ? `${id} obj` : `a node in ${holderId} obj`;
  if (!property(node, 'Names') && !property(node, 'Kids')) {
    addNote(walk, `${SCRIPTS_LABEL}: ${label} has neither /Names nor /Kids.`);
  }
  addScripts(walk, nodeArray(walk, node, 'Names', label), place, holderId, label);
  const kids = nodeArray(walk, node, 'Kids', label);
  if (kids.length && depth + 1 >= MAX_NAME_TREE_DEPTH) {
    addNote(walk, `${SCRIPTS_LABEL}: the tree is more than ${MAX_NAME_TREE_DEPTH} levels deep, so the /Kids of ${label} are not listed.`);
    return [];
  }
  return kids;
};

/** Each entry in the catalogue's `/Names /JavaScript` tree, which readers run when the document opens. */
const addDocumentScripts = (walk: Walk, catalog: PdfObjectRecord) => {
  const names = resolve(property(catalog.value, 'Names'), walk.objects);
  const tree = names.value && isDictionary(names.value) ? property(names.value, 'JavaScript') : undefined;
  if (!tree) {
    return;
  }
  walkTree(
    walk,
    [tree],
    SCRIPTS_LABEL,
    (node, id, place, item) => {
      return visitScriptNode(walk, node, id, place, item);
    },
    names.id ?? catalog.id
  );
};

/** The catalogue as a dictionary, or a note saying why catalogue, form and outline actions can't be read. */
const readCatalog = (walk: Walk, document: PdfDocumentInfo) => {
  const catalog = document.catalogId ? walk.objects.get(document.catalogId) : undefined;
  if (catalog && isDictionary(catalog.value)) {
    return catalog;
  }
  const reason = document.catalogId ? `The catalogue ${document.catalogId} obj could not be read` : 'The trailer names no catalogue';
  addNote(walk, `${reason}, so catalogue, form field and outline actions are not listed.`);
  return undefined;
};

const walkSources = (walk: Walk, document: PdfDocumentInfo) => {
  const catalog = readCatalog(walk, document);
  if (catalog) {
    addCatalog(walk, catalog);
  }
  addPages(walk, document.pages);
  if (catalog) {
    addFields(walk, catalog);
    addOutline(walk, catalog);
  }
};

/** Every action reachable from the catalogue and its document-level scripts, pages, annotations, form fields and outline. Nothing is run. */
export const documentActions = function documentActions(document: PdfDocumentInfo, objects: Objects): PdfActionReport {
  const walk: Walk = { hiddenNotes: 0, noted: new Set(), notes: [], objects, rows: new Map(), steps: 0, total: 0 };
  try {
    walkSources(walk, document);
  } catch (error) {
    // Keep what was read: a failure here must not hide the rest of the inspection.
    addNote(walk, `The action walk stopped early: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (walk.total >= MAX_ACTIONS) {
    walk.notes.push(`The list stops at ${MAX_ACTIONS} actions. Later actions are not listed.`);
  }
  if (walk.steps > MAX_STEPS) {
    walk.notes.push(`The list stops after ${MAX_STEPS} steps. Later actions are not listed.`);
  }
  if (walk.hiddenNotes) {
    walk.notes.push(`${walk.hiddenNotes} more parse notes are not shown.`);
  }
  return { actions: [...walk.rows.values()], notes: walk.notes, total: walk.total };
};

/** Every action, chained ones included, in list order. */
export const flattenActions = function flattenActions(actions: PdfAction[]): PdfAction[] {
  return actions.flatMap((action) => {
    return [action, ...flattenActions(action.next)];
  });
};

const BYTE_ORDER_MARKS: [number[], string, string][] = [
  [[0xfe, 0xff], 'utf-16be', 'UTF-16BE'],
  [[0xff, 0xfe], 'utf-16le', 'UTF-16LE'],
  [[0xef, 0xbb, 0xbf], 'utf-8', 'UTF-8'],
];

/**
 * Script text from a decoded stream preview. A byte order mark selects UTF-16 or UTF-8; other bytes stay one character per byte.
 * Hidden characters are shown as code points. The text is only displayed, never run.
 */
export const scriptText = function scriptText(result: StreamResult): { text: string; encoding: string } {
  const bytes = result.bytes;
  const mark = BYTE_ORDER_MARKS.find(([prefix]) => {
    return prefix.every((byte, index) => {
      return bytes[index] === byte;
    });
  });
  if (!mark) {
    return { encoding: 'one character per byte', text: showHidden(result.text, true) };
  }
  const [prefix, label, name] = mark;
  return { encoding: name, text: showHidden(new TextDecoder(label).decode(bytes.subarray(prefix.length)), true) };
};
