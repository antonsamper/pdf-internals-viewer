import type { ComponentProps, MouseEvent } from 'react';

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
/** A pill stating how the app treats the file. */
const TrustBadge = ({ className, ...props }: ComponentProps<'span'>) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5',
      'font-medium whitespace-nowrap text-secondary-foreground',
      'bg-[color-mix(in_srgb,var(--brand-purple-soft)_65%,var(--background))]',
      'rounded-full',
      className
    )}
    {...props}
  />
);
const SAMPLE_TONES = {
  orange: '[--sample-ink:var(--brand-orange-ink)] [--sample-wash:var(--brand-orange-soft)]',
  purple: '[--sample-ink:var(--brand-purple)] [--sample-wash:var(--brand-purple-soft)]',
  red: '[--sample-ink:var(--brand-red-ink)] [--sample-wash:var(--brand-red-soft)]',
};
/** A row that opens one of the sample PDFs, in that sample's colours. */
const SampleButton = ({
  sample: { detail, icon: Icon, name, tone },
  onClick,
}: {
  sample: (typeof SAMPLES)[number];
  onClick: () => void;
}) => (
  <button
    className={cn(
      'group/sample flex w-full items-center gap-[13px] px-0.5 py-3.5 text-left',
      'border-t border-border bg-transparent',
      'transition-[background-color,border-color] duration-150 ease-[ease]',
      'hover:border-t-(--sample-ink) hover:bg-[color-mix(in_srgb,var(--sample-wash),var(--background)_60%)]',
      SAMPLE_TONES[tone]
    )}
    onClick={onClick}
  >
    <span
      className={cn(
        'grid size-[34px] place-items-center',
        'rounded-[6px] border border-[color-mix(in_srgb,var(--sample-ink)_18%,transparent)] bg-(--sample-wash)',
        'text-(--sample-ink)'
      )}
    >
      <Icon size={19} strokeWidth={1.5} />
    </span>
    <span className="min-w-0 flex-1">
      <strong className="mb-1 block text-[12px] font-medium">{name}</strong>
      <span className="text-[11px] text-muted-foreground">{detail}</span>
    </span>
    <ArrowUpRight
      className={cn(
        'text-muted-foreground transition-transform duration-150 ease-out',
        'group-hover/sample:[transform:translate(2px,-2px)] group-hover/sample:text-(--sample-ink)'
      )}
      size={15}
    />
  </button>
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
              'font-mono text-[10px] leading-[normal] font-medium tracking-[0.09em] text-(--brand-purple) uppercase',
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
              Open a PDF<span className="ml-5 text-[11px] opacity-90">⌘ O</span>
            </Button>
            <span className="flex-[1_1_150px] text-[11px] text-muted-foreground">or drop a file anywhere · up to 64 MiB</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-xs leading-normal">
            <TrustBadge className="font-semibold text-(--brand-purple)">
              <Shield size={16} aria-hidden="true" />
              Processed locally
            </TrustBadge>
            <TrustBadge>
              <LockKeyhole size={16} aria-hidden="true" />
              Read-only inspection
            </TrustBadge>
          </div>
        </div>
        <section className="min-w-0">
          <h2 className="mb-2 text-[14px] font-[550]">Start with a sample</h2>
          <p className="mb-[22px] text-[12px] leading-[1.6] text-muted-foreground">No file handy? Explore a PDF made for learning.</p>
          {SAMPLES.map((sample) => (
            <SampleButton key={sample.file} sample={sample} onClick={() => onSample(sample.file)} />
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
