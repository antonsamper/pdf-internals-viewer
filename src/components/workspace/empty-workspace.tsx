import type { MouseEvent } from 'react';

import { cn } from 'cn';
import { ArrowUpRight, Braces, FilePlus2, FileCode2, Layers, LockKeyhole, Shield } from 'lucide-react';

import { BrandArtwork } from '@/components/brand-artwork';
import { Button } from '@/components/ui/button';
import { SAMPLES as SITE_SAMPLES } from '@/lib/site-content';

const sampleIcons = {
  compressed: Braces,
  minimal: FileCode2,
  resources: Layers,
};
const SAMPLES = SITE_SAMPLES.map((sample) => ({
  ...sample,
  icon: sampleIcons[sample.id],
}));
const trustBadge = cn(
  'inline-flex items-center gap-2 px-3 py-1.5',
  'font-medium whitespace-nowrap text-secondary-foreground',
  'bg-[color-mix(in_srgb,var(--brand-purple-soft)_65%,var(--background))]',
  'rounded-full'
);
export const EmptyWorkspace = ({
  onFollowLink,
  onOpenFile,
  onSample,
}: {
  onFollowLink: (event: MouseEvent<HTMLElement>) => boolean;
  onOpenFile: () => void;
  onSample: (file: string) => void;
}) => (
  <main
    className={cn(
      'min-h-0 flex-1 overflow-auto',
      'px-10 pt-[clamp(32px,6vh,72px)] pb-8',
      'focus:outline-none',
      'max-w760:px-6 max-w760:pt-11 max-w760:pb-6'
    )}
    data-welcome=""
    tabIndex={-1}
  >
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center',
        'mx-auto w-[min(100%,1040px)] gap-16',
        'max-w760:max-w-110 max-w760:grid-cols-1 max-w760:gap-10'
      )}
    >
      <BrandArtwork className="mx-auto w-full" />
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col items-start">
          <span
            className={cn(
              'mb-4.5 flex items-center gap-[9px]',
              // `family-name:` stops cn from reading the font list as a weight and dropping it.
              'font-[family-name:SFMono-Regular,Consolas,monospace] text-[10px] leading-[normal] font-medium tracking-[0.09em] text-(--brand-purple) uppercase',
              "before:h-[3px] before:w-[17px] before:bg-(--brand-orange) before:content-['']"
            )}
          >
            Structure & byte explorer
          </span>
          <h1 className="mb-5 text-[clamp(32px,3.8vw,48px)] leading-[1.15] font-[550] tracking-[-0.035em] text-balance">
            Look <span className="text-(--brand-red-ink)">inside</span> a PDF.
          </h1>
          <p className="mb-7 max-w-[42ch] text-[15px] leading-[1.8] text-muted-foreground">
            An open-source, read-only PDF inspector for developers. Explore PDF objects, follow references, and inspect raw or decoded
            streams alongside the original bytes.
          </p>
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3">
            <Button className="h-10 shrink-0 px-4" size="lg" onClick={onOpenFile}>
              <FilePlus2 size={16} />
              Open a PDF<span className="shortcut">⌘ O</span>
            </Button>
            <span className="flex-[1_1_150px] text-[11px] text-muted-foreground">or drop a file anywhere · up to 64 MiB</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-xs leading-normal">
            <span className={cn(trustBadge, 'font-semibold text-(--brand-purple)')}>
              <Shield size={16} aria-hidden="true" />
              Processed locally
            </span>
            <span className={trustBadge}>
              <LockKeyhole size={16} aria-hidden="true" />
              Read-only inspection
            </span>
          </div>
        </div>
        <section className="samples">
          <h2>Start with a sample</h2>
          <p className="samples-description">No file handy? Explore a PDF made for learning.</p>
          {SAMPLES.map(({ file, name, detail, icon: Icon, tone }) => (
            <button className="sample-row" data-tone={tone} key={file} onClick={() => onSample(file)}>
              <span className="sample-icon">
                <Icon size={19} strokeWidth={1.5} />
              </span>
              <span>
                <strong>{name}</strong>
                <span>{detail}</span>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
      </div>
    </div>
    <p
      className={cn(
        'mx-auto mt-16 w-[min(100%,1040px)] pt-5.5',
        'text-xs leading-[1.8] text-muted-foreground',
        'border-t border-border',
        'max-w760:mt-8 max-w760:max-w-110'
      )}
    >
      From a page to its content stream to the bytes behind it.
      <br />
      Read-only exploration, with the source always in view.
      <span className="mt-4 block text-xs leading-[1.8] [&_a]:text-(--reference) [&_a]:underline-offset-3">
        <a href="/guide" onClick={onFollowLink}>
          Learn how to inspect a PDF
        </a>{' '}
        ·{' '}
        <a href="/examples" onClick={onFollowLink}>
          Examples
        </a>{' '}
        ·{' '}
        <a href="/guides/inspect-pdf-objects" onClick={onFollowLink}>
          Objects &amp; references
        </a>{' '}
        ·{' '}
        <a href="/guides/decode-pdf-streams" onClick={onFollowLink}>
          Decode streams
        </a>{' '}
        ·{' '}
        <a href="/guides/find-pdf-fonts-images" onClick={onFollowLink}>
          Fonts &amp; images
        </a>
      </span>
    </p>
  </main>
);
