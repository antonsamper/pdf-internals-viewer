import type { ReactNode } from 'react';

import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from '@/lib/pdf/types';

import { effectiveResources, property } from '@/lib/pdf/navigation';
import { cn } from '@/lib/utils';
/** A sentence at the top of the tree, or in place of it when there are no pages. */
const TreeIntro = ({ children }: { children: ReactNode }) => (
  <p className="mx-1.5 mt-1.5 mb-3 text-detail leading-[1.6] text-muted-foreground">{children}</p>
);

/** Details under a node, such as its object kind or why it stops expanding. */
const NodeDetail = ({ children }: { children: ReactNode }) => (
  <p className="mr-1.25 mb-1.75 ml-6.5 text-caption [overflow-wrap:anywhere] text-muted-foreground">{children}</p>
);

/** The expand button, or a spacer of the same width when the node has no children. */
const NodeToggle = ({ expanded, label, onToggle }: { expanded: boolean; label: string; onToggle?: () => void }) =>
  onToggle ? (
    <button
      className="grid h-7.5 w-6.5 shrink-0 grow-0 basis-6.5 place-items-center rounded-[4px]"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  ) : (
    <span className="h-7.5 w-6.5 shrink-0 grow-0 basis-6.5" />
  );

/** A node's label and object number: a button when the node opens an object. */
const NodeLabel = ({ children, current, onSelect }: { children: ReactNode; current?: boolean; onSelect?: () => void }) => {
  const className = cn('flex min-w-0 flex-1 flex-col items-start py-1.25 pr-1.25', 'text-left text-detail [overflow-wrap:anywhere]');
  return onSelect ? (
    <button className={className} aria-current={current ? 'true' : undefined} onClick={onSelect}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
};

const ShowMoreButton = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button className="m-1.5 p-1.25 text-detail text-reference underline underline-offset-3" onClick={onClick}>
    {children}
  </button>
);

type Entries = Extract<PdfValue, { type: 'dictionary' | 'stream' }>['entries'];

/** A branch below a node, before it is resolved. */
interface TreeChild {
  value: PdfValue;
  label: string;
  segment: string;
  owner?: string;
  inherited?: boolean;
}

/** Everything a node needs to render itself and its branches. */
interface TreeNodeProps {
  value: PdfValue;
  label: string;
  nodeKey: string;
  owner: string;
  path: string[];
  trail: ExplorationStep[];
  ancestors: string[];
  depth: number;
  pageRoot?: boolean;
}

/** The tree's shared data and callbacks. */
interface TreeContext {
  objects: Map<string, PdfObjectRecord>;
  selectedId: string | null;
  state: PageTreeState;
  onNavigate: (id: string, trail: ExplorationStep[]) => void;
  onShowMore: (key: string, limit: number) => void;
  onToggle: (key: string) => void;
}

/** A page shows only these entries, so its tree stays about drawing. */
const PAGE_ROOT_KEYS = ['Contents', 'Resources', 'Annots'];

/** Follows a reference one step: the object it opens, and the trail, owner and path below it. */
const resolveNode = ({ value, owner, path, trail, ancestors }: TreeNodeProps, objects: Map<string, PdfObjectRecord>) => {
  if (value.type !== 'reference')
    return { ancestors, cycle: false, object: undefined, owner, path, ref: undefined, resolved: value, trail };
  const { ref } = value;
  const object = objects.get(ref);
  return {
    ancestors: [...ancestors, ref],
    cycle: ancestors.includes(ref),
    object,
    owner: ref,
    path: [],
    ref,
    resolved: object?.value,
    trail: [...trail, ...path.map((segment) => ({ id: owner, label: segment })), { id: ref, label: `${ref} obj` }],
  };
};

/** A dictionary's entries as branches, with a page's inherited resources when it has none of its own. */
const dictionaryChildren = (
  entries: Entries,
  object: PdfObjectRecord | undefined,
  objects: Map<string, PdfObjectRecord>,
  pageRoot: boolean
) => {
  const children: TreeChild[] = entries
    .filter((entry) => !pageRoot || PAGE_ROOT_KEYS.includes(entry.key.replace(/^\//, '')))
    .map((entry) => {
      const name = entry.key.replace(/^\//, '');
      return {
        label: labels[name] ? `${labels[name]} · /${name}` : `/${name}`,
        segment: `/${name}`,
        value: entry.value,
      };
    });
  if (!pageRoot || !object || children.some((child) => child.segment === '/Resources')) return children;
  const resources = effectiveResources(object, objects);
  if (resources)
    children.push({
      inherited: true,
      label: 'Resources · /Resources (inherited)',
      owner: resources.inheritedFrom,
      segment: '/Resources',
      value: resources.value,
    });
  return children;
};

/** The branches below a resolved value: dictionary entries or array items. */
const nodeChildren = (
  resolved: PdfValue | undefined,
  object: PdfObjectRecord | undefined,
  objects: Map<string, PdfObjectRecord>,
  pageRoot: boolean
): TreeChild[] => {
  if (!resolved) return [];
  if (dictionary(resolved) && 'entries' in resolved) return dictionaryChildren(resolved.entries, object, objects, pageRoot);
  if (resolved.type === 'array') return resolved.items.map((item, index) => ({ label: `[${index}]`, segment: `[${index}]`, value: item }));
  return [];
};

/** The node's own description: the object kind (with a font's name), or a direct value's text. */
const kindDetail = (object: PdfObjectRecord | undefined, ref: string | undefined, resolved: PdfValue | undefined) => {
  if (object) {
    const fontName = property(object.value, 'BaseFont');
    return object.kind === 'Font' && fontName?.type === 'name' ? `${fontName.value} · ${object.label}` : object.kind;
  }
  return !ref && resolved && !dictionary(resolved) && resolved.type !== 'array' ? resolved.text : '';
};

/** The child's props: an inherited branch starts a new path in the object it is inherited from. */
const childNode = (child: TreeChild, index: number, parent: { key: string; owner: string; path: string[]; trail: ExplorationStep[] }) => ({
  label: child.label,
  nodeKey: `${parent.key}/${index}`,
  owner: child.owner ?? parent.owner,
  path: child.inherited ? [child.segment] : [...parent.path, child.segment],
  trail: child.inherited ? [...parent.trail, { id: child.owner!, label: `Inherited from ${child.owner} obj` }] : parent.trail,
  value: child.value,
});

const NodeRow = ({
  expanded,
  label,
  object,
  refId,
  selectTrail,
  tree,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  object: PdfObjectRecord | undefined;
  refId: string | undefined;
  selectTrail: ExplorationStep[];
  tree: TreeContext;
  onToggle?: () => void;
}) => {
  const selected = !!refId && tree.selectedId === refId;
  return (
    <div
      className={cn(
        'flex min-h-8.5 items-center rounded-[5px] hover:bg-accent',
        selected && 'bg-accent shadow-[inset_0_0_0_1px_var(--border)]'
      )}
    >
      <NodeToggle
        expanded={expanded}
        label={`${expanded ? 'Collapse' : 'Expand'} ${label}${refId ? ` ${refId}` : ''}`}
        onToggle={onToggle}
      />
      {refId && object ? (
        <NodeLabel current={selected} onSelect={() => tree.onNavigate(refId, selectTrail)}>
          <span>{label}</span>
          <code className="text-caption text-muted-foreground">{refId} obj</code>
        </NodeLabel>
      ) : (
        <NodeLabel>
          <span>{label}</span>
          {refId && <code className="text-caption text-muted-foreground">{refId} R</code>}
        </NodeLabel>
      )}
    </div>
  );
};

const NodeChildren = ({
  branches,
  nodeKey,
  parent,
  tree,
  ...node
}: {
  branches: TreeChild[];
  nodeKey: string;
  parent: { owner: string; path: string[]; trail: ExplorationStep[] };
  tree: TreeContext;
  ancestors: string[];
  depth: number;
}) => {
  const limit = tree.state.limits[nodeKey] ?? 50;
  return (
    <ul className="ml-2.5 border-l pl-1.75">
      {branches.slice(0, limit).map((child, index) => {
        const props = childNode(child, index, { ...parent, key: nodeKey });
        return <PageTreeNode key={props.nodeKey} {...props} ancestors={node.ancestors} depth={node.depth + 1} tree={tree} />;
      })}
      {branches.length > limit && (
        <li>
          <ShowMoreButton onClick={() => tree.onShowMore(nodeKey, limit + 50)}>
            Show {Math.min(50, branches.length - limit)} more entries
          </ShowMoreButton>
        </li>
      )}
    </ul>
  );
};

/** The notes under a node: what it is, and why it stops or appears elsewhere. */
const nodeDetails = ({ cycle, object, ref, resolved }: ReturnType<typeof resolveNode>, bounded: boolean, pageRoot: boolean) =>
  [
    kindDetail(object, ref, resolved),
    cycle ? 'Already in this path' : '',
    ref && !object ? 'Unavailable reference' : '',
    bounded ? 'Expansion limit · inspect the containing object to continue' : '',
    object && object.referencedBy.length > 1 && !pageRoot ? 'Shared reference' : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** What a node shows: its resolved value, its branches and the notes under it. */
const nodeModel = (node: TreeNodeProps, tree: TreeContext) => {
  const pageRoot = node.pageRoot ?? false;
  const resolved = resolveNode(node, tree.objects);
  const branches = resolved.cycle ? [] : nodeChildren(resolved.resolved, resolved.object, tree.objects, pageRoot);
  const bounded = node.depth >= 6 && branches.length > 0;
  const expandable = branches.length > 0 && !bounded;
  return {
    // A page starts a fresh trail, so its branches lead back to the page rather than to the page tree.
    branchTrail: pageRoot ? [{ id: resolved.ref!, label: node.label }] : resolved.trail,
    branches,
    details: nodeDetails(resolved, bounded, pageRoot),
    emptyPage: pageRoot && !!resolved.object && !branches.length,
    expandable,
    open: expandable && tree.state.expanded.has(node.nodeKey),
    resolved,
  };
};

const PageTreeNode = ({ tree, ...node }: TreeNodeProps & { tree: TreeContext }) => {
  const { branches, branchTrail, details, emptyPage, expandable, open, resolved } = nodeModel(node, tree);
  return (
    <li>
      <NodeRow
        expanded={tree.state.expanded.has(node.nodeKey)}
        label={node.label}
        object={resolved.object}
        refId={resolved.ref}
        selectTrail={branchTrail}
        tree={tree}
        onToggle={expandable ? () => tree.onToggle(node.nodeKey) : undefined}
      />
      {details && <NodeDetail>{details}</NodeDetail>}
      {open && (
        <NodeChildren
          ancestors={resolved.ancestors}
          branches={branches}
          depth={node.depth}
          nodeKey={node.nodeKey}
          parent={{ owner: resolved.owner, path: resolved.path, trail: branchTrail }}
          tree={tree}
        />
      )}
      {emptyPage && <NodeDetail>No content, resources, or annotations found in this page dictionary.</NodeDetail>}
    </li>
  );
};

/** A page at the top of the tree. Its node key, like every branch's, is its position, which the expanded state and limits use. */
const pageNode = (id: string, index: number): TreeNodeProps => ({
  ancestors: [],
  depth: 0,
  label: `Page ${index + 1}`,
  nodeKey: `page-${index}`,
  owner: id,
  pageRoot: true,
  path: [],
  trail: [],
  value: { ref: id, text: `${id} R`, type: 'reference' },
});

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
  const tree: TreeContext = {
    objects,
    onNavigate,
    onShowMore: (key, limit) => onStateChange({ ...state, limits: { ...state.limits, [key]: limit } }),
    onToggle: (key) => {
      const expanded = new Set(state.expanded);
      if (expanded.has(key)) expanded.delete(key);
      else expanded.add(key);
      onStateChange({ ...state, expanded });
    },
    selectedId,
    state,
  };
  // Root pagination is cheap and does not affect expanded branches.
  const rootLimit = state.limits.root ?? 50;
  return (
    <nav className="min-h-0 flex-1 overflow-auto px-2 pb-3" aria-label="Page relationships">
      <TreeIntro>Expand a page to explore its connections. Shared objects can appear on several paths.</TreeIntro>
      <ul>
        {document.pages.slice(0, rootLimit).map((id, index) => {
          const root = pageNode(id, index);
          return <PageTreeNode key={root.nodeKey} {...root} tree={tree} />;
        })}
      </ul>
      {document.pages.length > rootLimit && (
        <ShowMoreButton onClick={() => tree.onShowMore('root', rootLimit + 50)}>
          Show {Math.min(50, document.pages.length - rootLimit)} more pages
        </ShowMoreButton>
      )}
      {!document.pages.length && <TreeIntro>No pages available in the indexed structure.</TreeIntro>}
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
