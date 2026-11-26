import { cn } from 'cn';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from '@/lib/pdf/types';

import { effectiveResources, property } from '@/lib/pdf/navigation';
const TREE_INTRO = 'mx-1.5 mt-1.5 mb-3 text-[11px] leading-[1.6] text-muted-foreground';
const TREE_DETAIL = 'mr-[5px] mb-[7px] ml-[26px] text-[10px] leading-[1.5] text-muted-foreground [overflow-wrap:anywhere]';
const TREE_TOGGLE = 'h-[30px] w-[26px] flex-[0_0_26px]';
const TREE_SELECT = cn('flex min-w-0 flex-1 flex-col items-start py-[5px] pr-[5px]', 'text-left [overflow-wrap:anywhere]', 'text-[11px]');
const TREE_MORE = 'm-1.5 p-[5px] text-[11px] text-reference underline underline-offset-[3px]';

export const PageTree = ({
  document,
  objects,
  selectedId,
  state,
  onStateChange,
  onNavigate,
}: {
  document: PdfDocumentInfo;
  objects: Map<string, PdfObjectRecord>;
  selectedId: string | null;
  state: PageTreeState;
  onStateChange: (state: PageTreeState) => void;
  onNavigate: (id: string, trail: ExplorationStep[]) => void;
}) => {
  const toggle = (key: string) => {
    const expanded = new Set(state.expanded);
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    onStateChange({ ...state, expanded });
  };
  const node = (
    value: PdfValue,
    label: string,
    key: string,
    owner: string,
    path: string[],
    trail: ExplorationStep[],
    ancestors: string[],
    depth: number,
    pageRoot = false
  ) => {
    const ref = value.type === 'reference' ? value.ref : undefined;
    const object = ref ? objects.get(ref) : undefined;
    const cycle = ref !== undefined && ancestors.includes(ref);
    const resolved = ref ? object?.value : value;
    const nextTrail = ref ? [...trail, ...path.map((segment) => ({ id: owner, label: segment })), { id: ref, label: `${ref} obj` }] : trail;
    const nextOwner = ref ?? owner;
    const nextPath = ref ? [] : path;
    const nextAncestors = ref ? [...ancestors, ref] : ancestors;
    let children: {
      value: PdfValue;
      label: string;
      segment: string;
      owner?: string;
      inherited?: boolean;
    }[] = [];
    if (!cycle && resolved) {
      if (dictionary(resolved) && 'entries' in resolved) {
        children = resolved.entries
          .filter((entry) => !pageRoot || ['Contents', 'Resources', 'Annots'].includes(entry.key.replace(/^\//, '')))
          .map((entry) => {
            const name = entry.key.replace(/^\//, '');
            return {
              label: labels[name] ? `${labels[name]} · /${name}` : `/${name}`,
              segment: `/${name}`,
              value: entry.value,
            };
          });
        if (pageRoot && object && !children.some((child) => child.segment === '/Resources')) {
          const resources = effectiveResources(object, objects);
          if (resources)
            children.push({
              inherited: true,
              label: 'Resources · /Resources (inherited)',
              owner: resources.inheritedFrom,
              segment: '/Resources',
              value: resources.value,
            });
        }
      } else if (resolved.type === 'array') {
        children = resolved.items.map((item, index) => ({
          label: `[${index}]`,
          segment: `[${index}]`,
          value: item,
        }));
      }
    }
    const bounded = depth >= 6 && children.length > 0;
    const expandable = children.length > 0 && !bounded;
    const expanded = state.expanded.has(key);
    const limit = state.limits[key] ?? 50;
    const fontName = object && property(object.value, 'BaseFont');
    const detail = object
      ? object.kind === 'Font' && fontName?.type === 'name'
        ? `${fontName.value} · ${object.label}`
        : object.kind
      : !ref && resolved && !dictionary(resolved) && resolved.type !== 'array'
        ? resolved.text
        : '';
    return (
      <li key={key}>
        <div
          className={cn(
            'flex min-h-[34px] items-center rounded-[5px] hover:bg-accent',
            ref && selectedId === ref && 'bg-accent shadow-[inset_0_0_0_1px_var(--border)]'
          )}
        >
          {expandable ? (
            <button
              className={cn(TREE_TOGGLE, 'grid place-items-center rounded-[4px]')}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}${ref ? ` ${ref}` : ''}`}
              aria-expanded={expanded}
              onClick={() => toggle(key)}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className={TREE_TOGGLE} />
          )}
          {ref && object ? (
            <button
              className={TREE_SELECT}
              aria-current={selectedId === ref ? 'true' : undefined}
              onClick={() => onNavigate(ref, pageRoot ? [{ id: ref, label }] : nextTrail)}
            >
              <span>{label}</span>
              <code className="text-[10px] text-muted-foreground">{ref} obj</code>
            </button>
          ) : (
            <span className={TREE_SELECT}>
              <span>{label}</span>
              {ref && <code className="text-[10px] text-muted-foreground">{ref} R</code>}
            </span>
          )}
        </div>
        {(detail || cycle || (ref && !object) || bounded || (object && object.referencedBy.length > 1 && !pageRoot)) && (
          <p className={TREE_DETAIL}>
            {[
              detail,
              cycle ? 'Already in this path' : '',
              ref && !object ? 'Unavailable reference' : '',
              bounded ? 'Expansion limit · inspect the containing object to continue' : '',
              object && object.referencedBy.length > 1 && !pageRoot ? 'Shared reference' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {expanded && expandable && (
          <ul className="ml-2.5 border-l pl-[7px]">
            {children.slice(0, limit).map((child, index) =>
              node(
                child.value,
                child.label,
                `${key}/${index}`,
                child.owner ?? nextOwner,
                child.inherited ? [child.segment] : [...nextPath, child.segment],
                child.inherited
                  ? [
                      ...(pageRoot ? [{ id: ref!, label }] : nextTrail),
                      {
                        id: child.owner!,
                        label: `Inherited from ${child.owner} obj`,
                      },
                    ]
                  : pageRoot
                    ? [{ id: ref!, label }]
                    : nextTrail,
                nextAncestors,
                depth + 1
              )
            )}
            {children.length > limit && (
              <li>
                <button
                  className={TREE_MORE}
                  onClick={() =>
                    onStateChange({
                      ...state,
                      limits: { ...state.limits, [key]: limit + 50 },
                    })
                  }
                >
                  Show {Math.min(50, children.length - limit)} more entries
                </button>
              </li>
            )}
          </ul>
        )}
        {pageRoot && object && !children.length && (
          <p className={TREE_DETAIL}>No content, resources, or annotations found in this page dictionary.</p>
        )}
      </li>
    );
  };
  // Root pagination is cheap and does not affect expanded branches.
  const rootLimit = state.limits.root ?? 50;
  return (
    <nav className="min-h-0 flex-1 overflow-auto px-2 pb-3" aria-label="Page relationships">
      <p className={TREE_INTRO}>Expand a page to explore its connections. Shared objects can appear on several paths.</p>
      <ul>
        {document.pages
          .slice(0, rootLimit)
          .map((id, index) =>
            node({ ref: id, text: `${id} R`, type: 'reference' }, `Page ${index + 1}`, `page-${index}`, id, [], [], [], 0, true)
          )}
      </ul>
      {document.pages.length > rootLimit && (
        <button
          className={TREE_MORE}
          onClick={() =>
            onStateChange({
              ...state,
              limits: { ...state.limits, root: rootLimit + 50 },
            })
          }
        >
          Show {Math.min(50, document.pages.length - rootLimit)} more pages
        </button>
      )}
      {!document.pages.length && <p className={TREE_INTRO}>No pages available in the indexed structure.</p>}
    </nav>
  );
};
const labels: Record<string, string> = {
  Annots: 'Annotations',
  ColorSpace: 'Colour spaces',
  Contents: 'Content streams',
  ExtGState: 'Graphics states',
  Font: 'Fonts',
  Pattern: 'Patterns',
  Resources: 'Resources',
  Shading: 'Shadings',
  XObject: 'Images & forms',
};
const dictionary = (value: PdfValue) => value.type === 'dictionary' || value.type === 'stream';
export interface PageTreeState {
  expanded: Set<string>;
  limits: Record<string, number>;
}
