import type { ReactNode } from 'react';

import { cn } from 'cn';

/*
 * Article typography for the public pages and the About page. Content is plain HTML, so `Prose` styles bare
 * elements from the wrapper. Elements with a `class` attribute style themselves and are skipped (`:not([class])`):
 * the lead paragraph, the action and source lines, and the About page's text button.
 */

const TITLE = '[&_h1]:mb-4.5 [&_h1]:text-[clamp(30px,4vw,40px)] [&_h1]:leading-[1.2] [&_h1]:font-[550] [&_h1]:tracking-[-0.035em]';

const HEADINGS =
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-[550] [&_h3]:mt-6 [&_h3]:mb-2.5 [&_h3]:text-[14px] [&_h3]:font-semibold';

const PARAGRAPHS =
  '[&_p:not([class])]:mb-3.5 [&_p:not([class])]:text-[14px] [&_p:not([class])]:leading-[1.85] [&_p:not([class])]:text-muted-foreground';

const LISTS =
  '[&_dl]:text-[14px] [&_dl]:leading-[1.85] [&_dl]:text-muted-foreground [&_ol]:mt-4 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-[14px] [&_ol]:leading-[1.85] [&_ol]:text-muted-foreground [&_ul]:mt-4 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[14px] [&_ul]:leading-[1.85] [&_ul]:text-muted-foreground [&_li]:my-2 [&_dt]:mt-3 [&_dt]:font-semibold [&_dt]:text-foreground [&_dd]:m-0';

const BLOCKS =
  '[&_pre]:my-6 [&_pre]:rounded-[8px] [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-5 [&_pre]:leading-[1.7] [&_pre]:[overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap max-w760:[&_pre]:p-3.5 [&_strong]:font-semibold [&_strong]:text-foreground';

/** Links are violet and underline on hover; inside a paragraph they are always underlined. */
const LINKS =
  '[&_a:not([class])]:text-reference [&_a:not([class])]:underline-offset-3 [&_a:not([class])]:hover:underline [&_p_a:not([class])]:underline';

/** The reading column of an article: titles, headings, paragraphs, lists, code blocks and links. */
export const Prose = function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(TITLE, HEADINGS, PARAGRAPHS, LISTS, BLOCKS, LINKS, className)}>{children}</div>;
};

/** The paragraph under the title. */
export const Lead = function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-10 text-[18px] leading-[1.7] text-muted-foreground">{children}</p>;
};

/** A row of links such as "Explore this sample" and "Download sample PDF". */
export const ARTICLE_ACTIONS =
  'my-6 flex flex-wrap gap-x-6 gap-y-3 text-[14px] leading-[1.85] text-muted-foreground [&_a]:inline-block [&_a]:font-[550]';

/** The "Example source" line at the end of an example. */
export const ARTICLE_SOURCE = 'mt-8 mb-3.5 text-[12px] leading-[1.85] text-muted-foreground';

/** The "Convert a spacing adjustment" disclosure. */
export const DISCLOSURE =
  'my-4 text-[14px] leading-[1.85] [&_p]:mt-3 [&_summary]:cursor-pointer [&_summary]:underline [&_summary]:underline-offset-3';

/** An example's preview image and caption. */
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
    <figure className="my-6 [&_figcaption]:mt-3 [&_figcaption]:text-[0.875rem] [&_figcaption]:text-muted-foreground [&_img]:block [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[28rem] [&_img]:rounded-[0.5rem] [&_img]:border [&_img]:border-border">
      <img src={src} width={width} height={height} loading="lazy" alt={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
};

/** A two-column comparison. Children are the caption, column group, head and body. */
export const ComparisonTable = function ComparisonTable({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 mb-8 overflow-x-auto">
      <table className="w-full border-collapse text-[14px] leading-[1.7] [&_caption]:mb-3 [&_caption]:text-left [&_caption]:text-[12px] [&_caption]:text-muted-foreground [&_td]:border [&_td]:border-border [&_td]:p-3.5 [&_td]:text-left [&_td]:align-top [&_td]:text-muted-foreground max-w600:[&_td]:p-2.5 [&_th]:border [&_th]:border-border [&_th]:p-3.5 [&_th]:text-left [&_th]:align-top [&_th]:font-[550] max-w600:[&_th]:p-2.5 [&_thead]:bg-sidebar">
        {children}
      </table>
    </div>
  );
};
