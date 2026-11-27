import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from './types';

import { property } from './navigation';

/** Action types that run code, open files or move form data. The panel marks them so they stand out. */
export const SENSITIVE_ACTIONS: Record<string, string> = {
  ImportData: 'Loads form data',
  JavaScript: 'Runs a script',
  Launch: 'Opens a file or app',
  SubmitForm: 'Sends form data',
};

/** What an action points at. `text` is a decoded value; `streamId` names a script stream to read on demand. */
export interface PdfActionTarget {
  label: string;
  text?: string;
  /** Set when `text` is a script decoded from a string value. */
  decodedString?: boolean;
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
}

const MAX_HOPS = 8;
const MAX_CHAIN = 64;
const MAX_WALK = 10_000;
const MAX_SCRIPT_TEXT = 4096;

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

/** Follows references until a direct value, noting a missing object instead of throwing. */
const resolve = (value: PdfValue | undefined, objects: Objects): Resolved => {
  let current = value;
  let id: string | undefined;
  for (let hop = 0; current?.type === 'reference'; hop++) {
    if (hop >= MAX_HOPS) return { id, note: `Reference chain from ${current.ref} R is too long to follow.` };
    const record = objects.get(current.ref);
    if (!record) return { id: current.ref, note: `${current.ref} R could not be resolved.` };
    id = current.ref;
    current = record.value;
  }
  if (current?.type === 'raw') return { id, note: `The value could not be parsed: ${current.text.slice(0, 80)}` };
  return { id, value: current };
};

const isDictionary = (value: PdfValue | undefined) => value?.type === 'dictionary' || value?.type === 'stream';

const textOf = (value: PdfValue | undefined): string | undefined => {
  if (value?.type === 'string' || value?.type === 'name') return value.value;
  return value?.text;
};

/** The file a `/F` entry names: a string, or a file specification's `/UF`, `/F` or `/Win /F`. */
const fileName = (value: PdfValue | undefined, objects: Objects): string | undefined => {
  const file = resolve(value, objects).value;
  if (!isDictionary(file)) return textOf(file);
  const win = resolve(property(file!, 'Win'), objects).value;
  const name = property(file!, 'UF') ?? property(file!, 'F') ?? (win && property(win, 'F'));
  return textOf(resolve(name, objects).value);
};

const destinationText = (value: PdfValue | undefined, objects: Objects) => textOf(resolve(value, objects).value);

const script = (value: PdfValue | undefined, objects: Objects): PdfActionTarget | undefined => {
  const resolved = resolve(value, objects);
  if (resolved.value?.type === 'stream') return { label: 'Script', streamId: resolved.id };
  if (resolved.value?.type !== 'string') return undefined;
  const text = resolved.value.value;
  return {
    decodedString: true,
    label: 'Script',
    text: text.length > MAX_SCRIPT_TEXT ? `${text.slice(0, MAX_SCRIPT_TEXT)}…` : text,
  };
};

const labelled = (label: string, text: string | undefined): PdfActionTarget | undefined => (text ? { label, text } : undefined);

const SUMMARIES: Record<string, (action: PdfValue, objects: Objects) => PdfActionTarget | undefined> = {
  GoTo: (action, objects) => labelled('Destination', destinationText(property(action, 'D'), objects)),
  GoToE: (action, objects) => labelled('File', fileName(property(action, 'F'), objects)),
  GoToR: (action, objects) => labelled('File', fileName(property(action, 'F'), objects)),
  Hide: (action, objects) => labelled('Annotations', destinationText(property(action, 'T'), objects)),
  ImportData: (action, objects) => labelled('File', fileName(property(action, 'F'), objects)),
  JavaScript: (action, objects) => script(property(action, 'JS'), objects),
  Launch: (action, objects) => labelled('File', fileName(property(action, 'F') ?? property(action, 'Win'), objects)),
  Named: (action, objects) => labelled('Operation', destinationText(property(action, 'N'), objects)),
  SubmitForm: (action, objects) => labelled('Submit to', fileName(property(action, 'F'), objects)),
  URI: (action, objects) => labelled('URI', destinationText(property(action, 'URI'), objects)),
};

const MISSING_TARGET: Record<string, string> = {
  GoTo: '/D',
  GoToE: '/F',
  GoToR: '/F',
  ImportData: '/F',
  JavaScript: '/JS',
  Launch: '/F',
  SubmitForm: '/F',
  URI: '/URI',
};

const blankAction = (origin: Origin, key: string, actionId?: string): PdfAction => ({
  actionId,
  context: origin.context,
  entry: origin.entry,
  holderId: origin.holderId,
  key,
  next: [],
  notes: [],
  trigger: origin.trigger,
});

/** The `/S` type, its target and the notes for a well-formed action dictionary. */
const describe = (action: PdfAction, value: PdfValue, objects: Objects) => {
  const type = resolve(property(value, 'S'), objects).value;
  if (type?.type !== 'name') {
    action.notes.push(type ? 'The /S action type is not a name.' : 'The action dictionary has no /S action type.');
    return;
  }
  action.type = type.value;
  action.target = SUMMARIES[type.value]?.(value, objects);
  const missing = MISSING_TARGET[type.value];
  if (missing && !action.target) action.notes.push(`The ${missing} entry is missing or could not be read.`);
};

const unexpected = (value: PdfValue, allowDestination: boolean | undefined) =>
  `Expected an action dictionary${allowDestination ? ' or a destination array' : ''}, found ${value.type === 'array' ? 'an array' : `a ${value.type}`}.`;

/** Reads one action and its `/Next` chain. `path` holds the action objects above it, to stop a cycle. */
const readAction = (value: PdfValue, origin: Origin, key: string, objects: Objects, path: string[]): PdfAction => {
  const resolved = resolve(value, objects);
  const action = blankAction(origin, key, resolved.id);
  if (resolved.note || !resolved.value) {
    action.notes.push(resolved.note ?? 'The action is empty.');
    return action;
  }
  if (resolved.id && path.includes(resolved.id)) {
    action.notes.push(`Cycle: /Next leads back to ${resolved.id} obj, which already runs earlier in this chain. The chain stops here.`);
    return action;
  }
  if (origin.allowDestination && resolved.value.type === 'array') {
    action.destination = true;
    action.target = { label: 'Destination', text: resolved.value.text };
    return action;
  }
  if (!isDictionary(resolved.value)) {
    action.notes.push(unexpected(resolved.value, origin.allowDestination));
    return action;
  }
  describe(action, resolved.value, objects);
  readNext(action, resolved.value, objects, resolved.id ? [...path, resolved.id] : path);
  return action;
};

/** `/Next` holds one action or an array of them, each with its own chain. */
const readNext = (action: PdfAction, value: PdfValue, objects: Objects, path: string[]) => {
  const next = property(value, 'Next');
  if (!next) return;
  if (path.length >= MAX_CHAIN) {
    action.notes.push(`The /Next chain is longer than ${MAX_CHAIN} actions. Later actions are not listed.`);
    return;
  }
  const resolved = resolve(next, objects);
  const items = resolved.value?.type === 'array' ? resolved.value.items : [next];
  const origin = { context: action.context, entry: '/Next', holderId: action.actionId ?? action.holderId, trigger: 'Then' };
  action.next = items.map((item, index) => readAction(item, origin, `${action.key}/Next[${index}]`, objects, path));
};

const addAction = (walk: Walk, value: PdfValue | undefined, origin: Origin, place: string) => {
  if (!value) return;
  const key = `${place}|${origin.entry}`;
  if (!walk.rows.has(key)) walk.rows.set(key, readAction(value, origin, key, walk.objects, []));
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
  if (!entry) return;
  const additional = resolve(entry, walk.objects);
  const events = additional.value;
  if (events?.type !== 'dictionary' && events?.type !== 'stream') {
    const row = blankAction({ ...origin, entry: '/AA', trigger: 'Additional actions' }, `${place}|/AA`);
    row.notes.push(additional.note ?? unexpected(events!, false));
    walk.rows.set(row.key, row);
    return;
  }
  for (const { key, value } of events.entries) {
    addAction(walk, value, { ...origin, entry: `/AA /${key}`, trigger: triggers[key] ?? `Event /${key}` }, place);
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
};

const subtypeOf = (value: PdfValue, objects: Objects) => textOf(resolve(property(value, 'Subtype'), objects).value);

const activationTrigger = (subtype: string | undefined) => {
  if (subtype === 'Link') return 'Link clicked';
  if (subtype === 'Widget') return 'Widget activated';
  return 'Annotation activated';
};

const fieldName = (value: PdfValue, objects: Objects) => textOf(resolve(property(value, 'T'), objects).value);

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

const addAnnotations = (walk: Walk, page: PdfObjectRecord, pageNumber: number) => {
  const entry = property(page.value, 'Annots');
  if (!entry) return;
  const annots = resolve(entry, walk.objects);
  if (annots.value?.type !== 'array') {
    walk.notes.push(`Page ${pageNumber} (${page.id} obj): /Annots ${annots.note ?? 'is not an array'}`);
    return;
  }
  annots.value.items.forEach((item, index) => {
    const annotation = resolve(item, walk.objects);
    if (!isDictionary(annotation.value)) {
      walk.notes.push(`Page ${pageNumber} (${page.id} obj): annotation ${index + 1} ${annotation.note ?? 'is not a dictionary'}`);
      return;
    }
    const place = annotation.id ?? `${page.id}/Annots[${index}]`;
    addWidgetLike(walk, annotation.value!, annotation.id ?? page.id, place, annotationContext(annotation.value!, walk.objects, pageNumber));
  });
};

const addPages = (walk: Walk, pages: string[]) => {
  pages.forEach((id, index) => {
    const page = walk.objects.get(id);
    if (!page) return;
    addAdditional(walk, page.value, { context: `Page ${index + 1}`, holderId: id }, id, PAGE_TRIGGERS);
    addAnnotations(walk, page, index + 1);
  });
};

/** Depth-first walk of a linked tree, guarding against cycles and very large trees. */
const walkTree = (
  walk: Walk,
  roots: PdfValue[],
  label: string,
  visit: (value: PdfValue, id: string | undefined, place: string) => PdfValue[]
) => {
  const seen = new Set<string>();
  const stack = roots.map((value, index) => ({ place: `${label}[${index}]`, value }));
  while (stack.length) {
    if (seen.size >= MAX_WALK) {
      walk.notes.push(`${label}: more than ${MAX_WALK} items. Later items are not listed.`);
      return;
    }
    const { place, value } = stack.pop()!;
    const resolved = resolve(value, walk.objects);
    if (resolved.id && seen.has(resolved.id)) {
      walk.notes.push(`${label}: ${resolved.id} obj is reached more than once, so the walk stops there.`);
      continue;
    }
    if (resolved.id) seen.add(resolved.id);
    if (!isDictionary(resolved.value)) {
      walk.notes.push(`${label}: ${resolved.note ?? `an item at ${place} is not a dictionary`}`);
      continue;
    }
    const children = visit(resolved.value!, resolved.id, resolved.id ?? place);
    stack.push(...children.toReversed().map((child, index) => ({ place: `${resolved.id ?? place}/${index}`, value: child })));
  }
};

const arrayItems = (value: PdfValue | undefined, objects: Objects) => {
  const resolved = resolve(value, objects).value;
  return resolved?.type === 'array' ? resolved.items : [];
};

const addFields = (walk: Walk, catalog: PdfObjectRecord) => {
  const form = resolve(property(catalog.value, 'AcroForm'), walk.objects).value;
  if (!form || !isDictionary(form)) return;
  walkTree(walk, arrayItems(property(form, 'Fields'), walk.objects), 'Form fields', (value, id, place) => {
    const name = fieldName(value, walk.objects);
    addWidgetLike(walk, value, id, place, name ? `Form field (${name})` : 'Form field');
    return arrayItems(property(value, 'Kids'), walk.objects);
  });
};

const addOutline = (walk: Walk, catalog: PdfObjectRecord) => {
  const outlines = resolve(property(catalog.value, 'Outlines'), walk.objects).value;
  if (!outlines || !isDictionary(outlines)) return;
  const first = property(outlines, 'First');
  walkTree(walk, first ? [first] : [], 'Outline', (value, id, place) => {
    const title = textOf(resolve(property(value, 'Title'), walk.objects).value);
    const origin = {
      context: title ? `Outline item (${title})` : 'Outline item',
      entry: '/A',
      holderId: id,
      trigger: 'Outline item selected',
    };
    addAction(walk, property(value, 'A'), origin, place);
    // An outline item's /Next is its next sibling, not an action chain.
    return [property(value, 'First'), property(value, 'Next')].filter((child): child is PdfValue => !!child);
  });
};

/** Every action reachable from the catalogue, pages, annotations, form fields and outline. Nothing is run. */
export const documentActions = function documentActions(document: PdfDocumentInfo, objects: Objects): PdfActionReport {
  const walk: Walk = { notes: [], objects, rows: new Map() };
  const catalog = document.catalogId ? objects.get(document.catalogId) : undefined;
  if (catalog) addCatalog(walk, catalog);
  addPages(walk, document.pages);
  if (catalog) {
    addFields(walk, catalog);
    addOutline(walk, catalog);
  }
  return { actions: [...walk.rows.values()], notes: walk.notes };
};

/** The number of actions, chained ones included. */
export const actionCount = function actionCount(actions: PdfAction[]): number {
  return actions.reduce((total, action) => total + 1 + actionCount(action.next), 0);
};

/** Every action, chained ones included, in list order. */
export const flattenActions = function flattenActions(actions: PdfAction[]): PdfAction[] {
  return actions.flatMap((action) => [action, ...flattenActions(action.next)]);
};
