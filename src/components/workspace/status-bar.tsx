import type { MouseEvent } from 'react';

import { cn } from 'cn';
import { Check, ShieldCheck } from 'lucide-react';

import type { PdfDocumentInfo } from '@/lib/pdf/types';

export const StatusBar = ({
  busy,
  byteCount,
  document,
  objectCount,
  onFollowLink,
}: {
  busy: boolean;
  byteCount: number;
  document: PdfDocumentInfo | null;
  objectCount: number;
  onFollowLink: (event: MouseEvent<HTMLElement>) => boolean;
}) => (
  <footer
    className={cn(
      'flex items-center justify-between',
      'h-7.25 min-h-7.25 gap-3 px-4.5',
      'bg-sidebar text-[10px] text-muted-foreground',
      'border-t border-border',
      'max-w900:px-3 max-w480:h-8.5 max-w480:min-h-8.5'
    )}
  >
    <span className="flex items-center gap-1.5 whitespace-nowrap max-w480:gap-1.25 max-w480:text-[9px]">
      <ShieldCheck className="text-(--brand-purple)" size={13} />
      Files stay on your device
      <span className="mx-1.25 h-2.5 w-px bg-border max-w900:hidden max-w480:mx-0.75 max-w480:block" aria-hidden="true" />
      <a
        className={cn(
          'text-[length:inherit] whitespace-nowrap text-muted-foreground underline-offset-3',
          'hover:text-foreground hover:underline'
        )}
        href="/limitations"
        onClick={onFollowLink}
      >
        Limitations
      </a>
    </span>
    <span className="flex items-center gap-1.5 whitespace-nowrap max-w900:text-[9px] max-w480:hidden">
      {busy ? (
        'Inspecting'
      ) : document ? (
        <>
          <Check size={12} />
          {document.locked ? 'Locked document' : document.recovered ? 'Recovered structure' : `${objectCount} objects indexed`}
        </>
      ) : (
        'Read-only PDF exploration'
      )}
      <span className="mx-1.25 h-2.5 w-px bg-border max-w900:hidden" />
      {byteCount ? `${byteCount.toLocaleString()} bytes` : 'No file open'}
    </span>
  </footer>
);
