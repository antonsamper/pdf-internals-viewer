import type { MouseEvent } from 'react';

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
  <footer className="status-bar">
    <span>
      <ShieldCheck size={13} />
      Files stay on your device
      <span className="status-divider" aria-hidden="true" />
      <a className="status-limitations-link" href="/limitations" onClick={onFollowLink}>
        Limitations
      </a>
    </span>
    <span>
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
      <span className="status-divider" />
      {byteCount ? `${byteCount.toLocaleString()} bytes` : 'No file open'}
    </span>
  </footer>
);
