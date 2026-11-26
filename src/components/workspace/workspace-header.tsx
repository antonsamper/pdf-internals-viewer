import type { MouseEvent } from 'react';

import { cn } from 'cn';
import { BookOpen, File as FileIcon, FolderOpen, X } from 'lucide-react';

import { ContentHeaderLinks, HeaderLink } from '@/components/content-navigation';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { sitePage, type SitePath } from '@/lib/site-content';

import { size } from './types';

type FollowLink = (event: MouseEvent<HTMLElement>) => boolean;

const closeLabel = (busy: boolean) => (busy ? 'Cancel opening PDF' : 'Close PDF');

/** Header actions shrink to 36px squares of icon only once the header becomes a grid. */
const ACTION_COMPACT = 'max-w600:size-9 max-w600:p-0';
const ACTION_LABEL = 'max-w600:hidden';

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
  <div
    data-filename=""
    className={cn(
      'flex min-w-0 flex-1 items-center gap-[9px]',
      'text-[12px] text-muted-foreground',
      'max-w600:col-start-2 max-w600:row-start-1 max-w600:text-[11px]',
      !filename && 'max-w600:hidden'
    )}
  >
    {filename ? (
      <>
        <FileIcon className="max-w600:hidden" size={14} />
        <span
          className={cn(
            'max-w-[50vw] overflow-hidden text-ellipsis whitespace-nowrap text-foreground',
            'min-w600:narrow:max-w-[25vw]',
            'max-w600:max-w-none'
          )}
          title={filename}
        >
          {filename}
        </span>
        <span className="text-[11px] narrow:hidden">{size(byteCount)}</span>
      </>
    ) : (
      <span>Local workspace</span>
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
    <Button className={ACTION_COMPACT} variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel(busy)} title={closeLabel(busy)}>
      <X size={15} aria-hidden="true" />
      <span data-action-label="" className={ACTION_LABEL}>
        {closeLabel(busy)}
      </span>
    </Button>
  ) : (
    <Button className={ACTION_COMPACT} onClick={onOpenFile} size="sm" aria-label="Open PDF" title="Open PDF">
      <FolderOpen size={15} aria-hidden="true" />
      <span data-action-label="" className={ACTION_LABEL}>
        Open PDF
      </span>
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
    <span className="h-[19px] w-px bg-border max-w600:hidden" />
    <FileName byteCount={byteCount} filename={filename} />
    <div className={cn('flex items-center gap-2', 'max-w600:col-start-3 max-w600:row-start-1', 'max-w480:gap-0.5')} data-header-actions="">
      <HeaderLink className={ACTION_COMPACT} href="/guide" aria-label="User guide" title="User guide" onClick={onFollowLink}>
        <BookOpen size={15} aria-hidden="true" />{' '}
        <span data-action-label="" className={ACTION_LABEL}>
          User guide
        </span>
      </HeaderLink>
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
