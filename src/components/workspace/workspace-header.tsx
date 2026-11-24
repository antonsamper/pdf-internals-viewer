import type { MouseEvent } from 'react';

import { BookOpen, File as FileIcon, FolderOpen, X } from 'lucide-react';

import { ContentHeaderLinks } from '@/components/content-navigation';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { sitePage, type SitePath } from '@/lib/site-content';

import { size } from './types';

type FollowLink = (event: MouseEvent<HTMLElement>) => boolean;

const closeLabel = (busy: boolean) => (busy ? 'Cancel opening PDF' : 'Close PDF');

const PublicPageActions = ({
  busy,
  filename,
  path,
  onClose,
  onFollowLink,
}: {
  busy: boolean;
  filename: string;
  path: SitePath;
  onClose: () => void;
  onFollowLink: FollowLink;
}) => (
  <>
    <ContentHeaderLinks path={sitePage(path)!.path} onFollowLink={onFollowLink} />
    {filename && (
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel(busy)} title={closeLabel(busy)}>
        <X size={15} aria-hidden="true" />
      </Button>
    )}
  </>
);

const FileName = ({ byteCount, filename }: { byteCount: number; filename: string }) => (
  <div className="filename">
    {filename ? (
      <>
        <FileIcon size={14} />
        <span title={filename}>{filename}</span>
        <span className="file-size">{size(byteCount)}</span>
      </>
    ) : (
      <span className="muted">Local workspace</span>
    )}
  </div>
);

const FileAction = ({
  busy,
  hasFile,
  onClose,
  onOpenFile,
}: {
  busy: boolean;
  hasFile: boolean;
  onClose: () => void;
  onOpenFile: () => void;
}) =>
  hasFile ? (
    <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel(busy)} title={closeLabel(busy)}>
      <X size={15} aria-hidden="true" />
      <span className="header-action-label">{closeLabel(busy)}</span>
    </Button>
  ) : (
    <Button onClick={onOpenFile} size="sm" aria-label="Open PDF" title="Open PDF">
      <FolderOpen size={15} aria-hidden="true" />
      <span className="header-action-label">Open PDF</span>
    </Button>
  );

const WorkspaceActions = ({
  busy,
  byteCount,
  filename,
  onClose,
  onFollowLink,
  onOpenFile,
}: {
  busy: boolean;
  byteCount: number;
  filename: string;
  onClose: () => void;
  onFollowLink: FollowLink;
  onOpenFile: () => void;
}) => (
  <>
    <span className="header-divider" />
    <FileName byteCount={byteCount} filename={filename} />
    <div className="header-actions">
      <a
        className={buttonVariants({ size: 'sm', variant: 'ghost' })}
        href="/guide"
        aria-label="User guide"
        title="User guide"
        onClick={onFollowLink}
      >
        <BookOpen size={15} aria-hidden="true" /> <span className="header-action-label">User guide</span>
      </a>
      <FileAction busy={busy} hasFile={Boolean(filename)} onClose={onClose} onOpenFile={onOpenFile} />
    </div>
  </>
);

export const WorkspaceHeader = ({
  busy,
  byteCount,
  filename,
  path,
  onClose,
  onFollowLink,
  onHome,
  onOpenFile,
}: {
  busy: boolean;
  byteCount: number;
  filename: string;
  path: SitePath;
  onClose: () => void;
  onFollowLink: FollowLink;
  onHome: () => void;
  onOpenFile: () => void;
}) => (
  <SiteHeader
    content={path !== '/'}
    href={import.meta.env.BASE_URL}
    onIdentityClick={(event) => {
      if (onFollowLink(event)) onHome();
    }}
  >
    {path !== '/' ? (
      <PublicPageActions busy={busy} filename={filename} path={path} onClose={onClose} onFollowLink={onFollowLink} />
    ) : (
      <WorkspaceActions
        busy={busy}
        byteCount={byteCount}
        filename={filename}
        onClose={onClose}
        onFollowLink={onFollowLink}
        onOpenFile={onOpenFile}
      />
    )}
  </SiteHeader>
);
