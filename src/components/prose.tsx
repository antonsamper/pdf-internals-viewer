import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/*
 * Article typography for the public pages and the About page. Content is plain HTML, so `Prose` styles bare
 * elements from the wrapper. Elements with a `class` attribute style themselves and are skipped (`:not([class])`):
 * the lead paragraph, the action and source lines, and the About page's text button.
 */

export const Prose = function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        '[&_h1]:mb-4.5 [&_h1]:text-[clamp(30px,4vw,40px)] [&_h1]:leading-[1.2] [&_h1]:font-[550] [&_h1]:tracking-[-0.035em]',
        '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-subheading [&_h2]:font-[550]',
        '[&_h3]:mt-6 [&_h3]:mb-2.5 [&_h3]:text-reading [&_h3]:font-semibold',
        '[&_p:not([class])]:mb-3.5 [&_p:not([class])]:text-reading [&_p:not([class])]:leading-[1.85]',
        '[&_p:not([class])]:text-muted-foreground',
        '[&_dl]:text-reading [&_dl]:leading-[1.85] [&_dl]:text-muted-foreground',
        '[&_dd]:m-0 [&_dt]:mt-3 [&_dt]:font-semibold [&_dt]:text-foreground',
        '[&_ol]:mt-4 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_ol]:text-reading [&_ol]:leading-[1.85] [&_ol]:text-muted-foreground',
        '[&_ul]:mt-4 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ul]:text-reading [&_ul]:leading-[1.85] [&_ul]:text-muted-foreground',
        '[&_li]:my-2',
        '[&_pre]:my-6 [&_pre]:p-5 [&_pre]:leading-[1.7] [&_pre]:[overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap',
        '[&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_a:not([class])]:text-reference [&_a:not([class])]:underline-offset-3 [&_a:not([class])]:hover:underline',
        '[&_p_a:not([class])]:underline',
        'max-w760:[&_pre]:p-3.5',
        className
      )}
    >
      {children}
    </div>
  );
};

export const Lead = function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-10 text-heading leading-[1.7] text-muted-foreground">{children}</p>;
};

export const ArticleActions = function ArticleActions({ children }: { children: ReactNode }) {
  return (
    <p
      className={cn(
        'my-6 flex flex-wrap gap-x-6 gap-y-3',
        'text-reading leading-[1.85] text-muted-foreground',
        '[&_a]:inline-block [&_a]:font-[550]'
      )}
    >
      {children}
    </p>
  );
};

export const ArticleSource = function ArticleSource({ children }: { children: ReactNode }) {
  return <p className="mt-8 mb-3.5 text-small leading-[1.85] text-muted-foreground">{children}</p>;
};

export const ExamplePreview = function ExamplePreview({
  alt,
  caption,
  height,
  src,
  width,
}: {
  alt: string;
  caption: string;
  height: number;
  src: string;
  width: number;
}) {
  return (
    <figure
      className={cn(
        'my-6',
        '[&_img]:block [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[28rem]',
        '[&_img]:rounded-md [&_img]:border [&_img]:border-border',
        '[&_figcaption]:mt-3 [&_figcaption]:text-sm [&_figcaption]:leading-[inherit] [&_figcaption]:text-muted-foreground'
      )}
    >
      <img src={src} width={width} height={height} loading="lazy" alt={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
};

/** A two-column comparison. Children are the caption, column group, head and body. */
export const ComparisonTable = function ComparisonTable({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 mb-8 overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-reading leading-[1.7]',
          '[&_caption]:mb-3 [&_caption]:text-left [&_caption]:text-small [&_caption]:leading-[1.7] [&_caption]:text-muted-foreground',
          '[&_thead]:bg-sidebar',
          '[&_th]:border [&_th]:border-border [&_th]:p-3.5 [&_th]:text-left [&_th]:align-top [&_th]:font-[550]',
          '[&_td]:border [&_td]:border-border [&_td]:p-3.5 [&_td]:text-left [&_td]:align-top [&_td]:text-muted-foreground',
          'max-w600:[&_td]:p-2.5 max-w600:[&_th]:p-2.5'
        )}
      >
        {children}
      </table>
    </div>
  );
};
