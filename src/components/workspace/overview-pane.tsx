import { cn } from 'cn';
import { ArrowUpRight, FileCode2, Files, FolderOpen, Image, LockKeyhole } from 'lucide-react';
import { useMemo, type ComponentProps, type ReactNode } from 'react';

import type { PdfIssue } from '@/lib/pdf/issues';
import type { ByteRange, PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { InspectionUnavailable } from '@/components/inspection-unavailable';
import { ActionButton, ActionRow } from '@/components/inspector/actions';
import { IssueNote, Note } from '@/components/inspector/notes';
import { PaneBody, PaneIntro, PaneSubtitle, SectionHeading } from '@/components/inspector/pane';
import { Warning } from '@/components/inspector/warning';
import { IssueSummary } from '@/components/issues-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ValueView } from '@/components/value-view';
import { hasSubtype } from '@/lib/pdf/navigation';
import { pageRotationSummary } from '@/lib/pdf/page-rotation';
import { useScrollRestoration } from '@/lib/scroll-restoration';

import { size, type Section } from './types';

export interface OverviewPaneProps {
  byteCount: number;
  document: PdfDocumentInfo | null;
  filename: string;
  inspectionError: string | null;
  issues: PdfIssue[];
  objectMap: Map<string, PdfObjectRecord>;
  objects: PdfObjectRecord[];
  resourceObjects: PdfObjectRecord[];
  scrollPositionRef: ScrollPosition;
  section: Section;
  unlockError: string | null;
  unlocking: boolean;
  onChooseSection: (section: Section) => void;
  onFollowReference: (id: string, path?: string[]) => void;
  onNavigate: (id: string, tab?: 'properties', section?: Section) => void;
  onOpenFile: () => void;
  onPreview: () => void;
  onSelectRange: (range: ByteRange) => void;
  onShowBytes: () => void;
  onUnlock: (password: string) => void;
}

type DocumentProps = OverviewPaneProps & { document: PdfDocumentInfo };

/** A paragraph of muted body text in the overview. */
const OverviewText = ({ className, ...props }: ComponentProps<'p'>) => (
  <p className={cn('text-[11px] leading-[1.8] text-muted-foreground', className)} {...props} />
);

const Fact = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="flex justify-between gap-3 border-b py-[11px] text-[11px]">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="tabular-nums">{children}</dd>
  </div>
);

const DocumentFacts = ({ byteCount, document, objectMap, objects }: DocumentProps) => {
  const pageRotation = useMemo(() => (document.locked ? 'Locked' : pageRotationSummary(document.pages, objectMap)), [document, objectMap]);
  return (
    <dl data-document-facts>
      <Fact label="PDF version">
        {document.version}
        {document.catalogVersion ? ` (catalogue ${document.catalogVersion})` : ''}
      </Fact>
      <Fact label="File size">{size(byteCount)}</Fact>
      <Fact label="Pages">{document.locked ? 'Locked' : document.pages.length}</Fact>
      <Fact label="Page rotation">{pageRotation}</Fact>
      <Fact label="Indirect objects">{document.locked ? 'Locked' : objects.length}</Fact>
      <Fact label="Cross-references">{document.xrefFormat}</Fact>
      <Fact label="Encryption">{document.encrypted ? 'Encrypted' : 'None'}</Fact>
    </dl>
  );
};

const UnlockForm = ({ unlockError, unlocking, onUnlock }: Pick<OverviewPaneProps, 'unlockError' | 'unlocking' | 'onUnlock'>) => (
  <form
    className="flex flex-wrap items-end gap-2"
    aria-label="Unlock PDF"
    onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = new FormData(form).get('password') as string;
      onUnlock(password);
    }}
  >
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor="pdf-password" className="text-xs font-medium">
        PDF password
      </label>
      <Input
        id="pdf-password"
        name="password"
        type="password"
        className="text-[11px] leading-[1.65]"
        autoComplete="off"
        disabled={unlocking}
        aria-invalid={Boolean(unlockError)}
        aria-describedby={unlockError ? 'pdf-password-help pdf-password-error' : 'pdf-password-help'}
      />
    </div>
    <Button type="submit" className="text-[11px] leading-[1.65]" disabled={unlocking}>
      {unlocking ? 'Unlocking…' : 'Unlock PDF'}
    </Button>
    <p id="pdf-password-help" className="w-full text-xs text-muted-foreground">
      The password stays in memory for this document and is cleared when you close it.
    </p>
  </form>
);

const EncryptionNotice = (props: DocumentProps) => {
  const { document, unlockError } = props;
  if (document.locked)
    return (
      <Warning render={<div />}>
        <LockKeyhole size={16} />
        <div className="min-w-0 flex-1 space-y-3">
          <p>
            This PDF is encrypted. {document.encryptionError ?? 'Enter its opening or owner password to inspect the structure.'} Original
            bytes remain available.
          </p>
          {!document.encryptionError && <UnlockForm {...props} />}
          {unlockError && (
            <p id="pdf-password-error" role="alert" className="text-xs">
              {unlockError}
            </p>
          )}
        </div>
      </Warning>
    );
  if (document.encrypted)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Encrypted PDF unlocked locally. Properties and decoded streams are decrypted. Source and raw streams show the original encrypted
        bytes.
      </p>
    );
  return null;
};

const StructureSection = ({ byteCount, document, onFollowReference, onSelectRange }: DocumentProps) => (
  <>
    <SectionHeading>Cross-reference entry point</SectionHeading>
    {document.startXref !== undefined ? (
      <Button
        variant="outline"
        className="font-mono text-[12px]"
        onClick={() => {
          onSelectRange({
            end: Math.min(byteCount, document.startXref! + 32),
            start: document.startXref!,
          });
        }}
      >
        startxref → 0x{document.startXref.toString(16).toUpperCase()}
        <ArrowUpRight size={14} />
      </Button>
    ) : (
      <OverviewText>No reliable startxref location available.</OverviewText>
    )}
    <SectionHeading>Trailer dictionary</SectionHeading>
    <ValueView value={document.trailer} onNavigate={onFollowReference} />
  </>
);

const ExploreSection = ({ document, objects, resourceObjects, onNavigate, onPreview }: DocumentProps) => (
  <>
    <SectionHeading>Start exploring</SectionHeading>
    <ActionRow>
      <ActionButton disabled={!document.catalogId} onClick={() => document.catalogId && onNavigate(document.catalogId)}>
        <FolderOpen size={15} />
        Document catalogue
        <ArrowUpRight size={13} />
      </ActionButton>
      <ActionButton
        disabled={!document.pages.length}
        onClick={() => {
          onNavigate(document.pages[0], 'properties', 'pages');
        }}
      >
        <Files size={15} />
        First page
        <ArrowUpRight size={13} />
      </ActionButton>
      <ActionButton disabled={document.locked} onClick={onPreview}>
        <Image size={15} />
        Page preview
      </ActionButton>
    </ActionRow>
    <OverviewText className="mt-4">
      Follow a reference such as <code>4 0 R</code> to inspect another object. Its source bytes highlight in the hex view.
    </OverviewText>
    <SectionHeading>Resources</SectionHeading>
    <OverviewText>
      {resourceObjects.filter((object) => object.kind === 'Font').length} font objects ·{' '}
      {resourceObjects.filter((object) => hasSubtype(object, 'Image')).length} image objects ·{' '}
      {objects.filter((object) => object.stream).length} streams
    </OverviewText>
    <Note>Counts describe the indexed object set, including unreferenced objects. They are not a content inventory.</Note>
  </>
);

const IssuesOverview = ({ document, issues, onChooseSection }: DocumentProps) => (
  <section className="mt-5 border-t py-3.5 text-[12px] leading-[1.7]">
    <SectionHeading>Issues</SectionHeading>
    {document.locked ? (
      <IssueNote>Structure checks unavailable while locked.</IssueNote>
    ) : (
      <IssueSummary issues={issues} empty={IssueNote} />
    )}
    <Button variant="outline" size="sm" className="text-[12px] leading-[1.7]" onClick={() => onChooseSection('issues')}>
      View issues and coverage
    </Button>
  </section>
);

export const OverviewPane = (props: OverviewPaneProps) => {
  const { document, filename, inspectionError, scrollPositionRef, section, onOpenFile, onShowBytes } = props;
  const scroll = useScrollRestoration(scrollPositionRef);
  return (
    <PaneBody {...scroll}>
      <PaneIntro icon={FileCode2} title={section === 'structure' ? 'File structure' : 'Document overview'}>
        <PaneSubtitle>{filename}</PaneSubtitle>
      </PaneIntro>
      {document ? (
        <>
          <DocumentFacts {...props} document={document} />
          <EncryptionNotice {...props} document={document} />
          {section === 'structure' ? (
            <StructureSection {...props} document={document} />
          ) : (
            <ExploreSection {...props} document={document} />
          )}
          <IssuesOverview {...props} document={document} />
        </>
      ) : (
        <InspectionUnavailable reason={inspectionError ?? undefined} onOpenFile={onOpenFile} onShowBytes={onShowBytes} />
      )}
    </PaneBody>
  );
};
