import { cn } from 'cn';
import { Image as ImageIcon, Paperclip, Type, Shapes, Layers } from 'lucide-react';
import { useMemo } from 'react';

import type { ResourceCategory, ResourceEntry } from '@/lib/pdf/resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { EmbeddedDownloads } from '@/components/embedded-downloads';
import { ImageDownload } from '@/components/image-download';
import { REFERENCE } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { property } from '@/lib/pdf/navigation';
import { resourcePageAccess } from '@/lib/pdf/resource-tools';
import { useScrollRestoration, type ScrollPosition } from '@/lib/scroll-restoration';
const detail = function detail(object: PdfObjectRecord, key: string) {
  const value = property(object.value, key);
  return value?.text ?? 'Not specified';
};
export const ResourceBrowser = function ResourceBrowser({
  scrollPositionRef,
  limit,
  onLimitChange,
  document,
  objectMap,
  extractStream,
  extractImage,
  resources,
  category,
  onCategoryChange,
  filter,
  onFilterChange,
  onNavigate,
}: {
  scrollPositionRef: ScrollPosition;
  limit: number;
  onLimitChange: (limit: number) => void;
  document: PdfDocumentInfo;
  objectMap: Map<string, PdfObjectRecord>;
  extractStream: (id: string, purpose?: 'download' | 'size') => Promise<StreamResult>;
  extractImage: (id: string) => Promise<StreamResult>;
  resources: ResourceEntry[];
  category: ResourceCategory;
  onCategoryChange: (category: ResourceCategory) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  onNavigate: (id: string) => void;
}) {
  const scroll = useScrollRestoration(scrollPositionRef);
  const access = useMemo(() => resourcePageAccess(document, objectMap), [document, objectMap]);
  const matching = resources.filter(
    ({ object, kind, downloads }) =>
      (category === 'All' || kind === category) &&
      `${object.id} ${object.label} ${detail(object, 'BaseFont')} ${kind} ${downloads.map((asset) => asset.filename).join(' ')}`
        .toLowerCase()
        .includes(filter.toLowerCase())
  );
  return (
    <section {...scroll} aria-label="Visual resource browser" className="min-h-0 flex-1 overflow-auto p-5">
      <h1 className="mb-2 text-xl font-medium">Resources</h1>
      <p className={cn('max-w-prose', 'mb-4', 'text-xs leading-relaxed text-muted-foreground')}>
        Find fonts, attachments, images, and reusable forms. Download embedded files directly, or open an object for a closer look. Page
        links show where a resource is available, including inherited and nested resources; they do not prove it is drawn on the page. Image
        previews load automatically as you scroll.
      </p>
      <div className="mt-[18px] mb-3.5 flex flex-wrap gap-1.5" role="group" aria-label="Resource categories">
        {(
          [
            ['All', 'All', Layers],
            ['Font', 'Fonts', Type],
            ['Attachment', 'Attachments', Paperclip],
            ['Image', 'Images', ImageIcon],
            ['Form', 'Forms', Shapes],
          ] as const
        ).map(([value, label, Icon]) => (
          <Button
            key={value}
            variant={category === value ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={category === value}
            onClick={() => {
              onCategoryChange(value);
              onLimitChange(50);
            }}
          >
            <Icon aria-hidden="true" size={14} />
            {label}{' '}
            <span className={cn('px-[5px]', 'text-[10px] text-muted-foreground tabular-nums', 'bg-muted', 'rounded-[4px]')}>
              {value === 'All' ? resources.length : resources.filter((entry) => entry.kind === value).length}
            </span>
          </Button>
        ))}
      </div>
      <Input
        aria-label="Filter resources"
        placeholder="Search by filename, font name, or object ID…"
        value={filter}
        onChange={(event) => {
          onFilterChange(event.target.value);
          onLimitChange(50);
        }}
      />
      {filter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onFilterChange('');
            onLimitChange(50);
          }}
        >
          Clear search
        </Button>
      )}
      <p className="my-3 text-xs text-muted-foreground" role="status">
        {matching.length} resource{matching.length === 1 ? '' : 's'}
        {access.incomplete
          ? ' · Some page-resource links may be missing: an inspection limit was reached or references were unavailable.'
          : ''}
      </p>
      {category === 'Attachment' && (
        <p className="mb-3 text-xs text-muted-foreground">
          Attachments found in indexed objects. Unavailable or unparsed objects may contain other files.
        </p>
      )}
      <div className="divide-y">
        {matching.slice(0, limit).map(({ object, kind, downloads }) => {
          const pages = access.pages.get(object.id) ?? [];
          return (
            <article key={object.id} aria-label={`${kind} ${object.id}`} className="min-w-0 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[12px] leading-[calc(1.25/0.875)] font-[550]">{kind}</h2>
                <button className={REFERENCE} onClick={() => onNavigate(object.id)}>
                  {object.id} obj
                </button>
              </div>
              <p className="mt-1 text-xs break-words text-muted-foreground">{object.label}</p>
              {downloads.length > 0 && (
                <EmbeddedDownloads className="mx-0 my-3" object={object} assets={downloads} extractStream={extractStream} />
              )}
              {kind === 'Font' ? (
                <>
                  {!downloads.length && <p className="my-3 text-xs text-muted-foreground">No embedded font file available to download.</p>}
                  <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Base font</dt>
                    <dd className="font-mono break-all">{detail(object, 'BaseFont')}</dd>
                    <dt className="text-muted-foreground">Subtype</dt>
                    <dd className="font-mono break-all">{detail(object, 'Subtype')}</dd>
                    <dt className="text-muted-foreground">Encoding</dt>
                    <dd className="font-mono break-all">{detail(object, 'Encoding')}</dd>
                  </dl>
                </>
              ) : kind === 'Image' ? (
                <>
                  <p className="mt-2 text-xs">
                    {detail(object, 'Width')} × {detail(object, 'Height')} · {detail(object, 'ColorSpace')} ·{' '}
                    {detail(object, 'BitsPerComponent')} bits/component
                  </p>
                  <ImageDownload showPreview key={`download-${object.id}`} object={object} extractImage={extractImage} />
                </>
              ) : kind === 'Form' ? (
                <p className="my-3 text-xs text-muted-foreground">
                  A form XObject is a reusable group of drawing instructions. Open the object to inspect those instructions and its
                  resources. Forms are not shown as image thumbnails.
                </p>
              ) : null}
              {kind !== 'Attachment' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Available to:</span>
                  {pages.length ? (
                    <>
                      {pages.slice(0, 30).map((page) => (
                        <button className={REFERENCE} key={page} onClick={() => onNavigate(document.pages[page - 1])}>
                          Page {page}
                        </button>
                      ))}
                      {pages.length > 30 && <span className="text-muted-foreground">and {pages.length - 30} more pages</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No page found in the indexed resource paths.</span>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Open the object to see its dictionary, source location, and original bytes.
              </p>
            </article>
          );
        })}
      </div>
      {!matching.length && (
        <div className="py-6">
          <p className="text-sm text-muted-foreground">
            {resources.length
              ? 'No resources match this filter.'
              : 'No fonts, attachments, images, or forms were identified in the indexed objects.'}
          </p>
          {(category !== 'All' || filter) && (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => {
                onFilterChange('');
                onCategoryChange('All');
                onLimitChange(50);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
      {matching.length > limit && (
        <Button variant="outline" size="sm" onClick={() => onLimitChange(limit + 50)}>
          Show 50 more resources
        </Button>
      )}
    </section>
  );
};
