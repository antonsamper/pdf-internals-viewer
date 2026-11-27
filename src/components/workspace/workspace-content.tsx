import type { MouseEvent, ReactNode } from 'react';

import type { PdfDocumentInfo } from '@/lib/pdf/types';
import type { SitePath } from '@/lib/site-content';

import { AboutPage } from '@/components/about-page';
import { LoadingMessage } from '@/components/inspector/loading-message';
import { SiteLinks } from '@/components/site-links';
import { Button } from '@/components/ui/button';
import { PublicPage } from '@/content/public-page';
import { sitePage } from '@/lib/site-content';

import { StatusBar } from './status-bar';

type FollowLink = (event: MouseEvent<HTMLElement>) => boolean;

/** The page body: About, a public article, the open workspace, or the welcome screen. */
export const WorkspaceContent = ({
  about,
  empty,
  onFollowLink,
  path,
  showWorkspace,
  workspace,
}: {
  about: boolean;
  empty: ReactNode;
  onFollowLink: FollowLink;
  path: SitePath;
  showWorkspace: boolean;
  workspace: ReactNode;
}) => {
  if (about) return <AboutPage onFollowLink={onFollowLink} />;
  if (path !== '/') return <PublicPage key={path} page={sitePage(path)!} onFollowLink={onFollowLink} />;
  return showWorkspace ? workspace : empty;
};

/** Site links on public pages and the welcome screen; the status bar beside a document. */
export const WorkspaceFooter = ({
  busy,
  byteCount,
  document,
  objectCount,
  onFollowLink,
  path,
}: {
  busy: boolean;
  byteCount: number;
  document: PdfDocumentInfo | null;
  objectCount: number;
  onFollowLink: FollowLink;
  path: SitePath;
}) => {
  const hasWorkspace = byteCount > 0 || busy;
  if (path !== '/' || !hasWorkspace) return <SiteLinks onFollowLink={onFollowLink} />;
  return <StatusBar busy={busy} byteCount={byteCount} document={document} objectCount={objectCount} onFollowLink={onFollowLink} />;
};

export const OpeningProgress = ({ onCancel }: { onCancel: () => void }) => (
  <LoadingMessage render={<div />} className="border-b py-1.5 text-detail">
    Opening PDF…{' '}
    <Button variant="ghost" size="xs" className="text-detail" onClick={onCancel}>
      Cancel
    </Button>
  </LoadingMessage>
);
