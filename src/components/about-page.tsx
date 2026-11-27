import type { MouseEvent } from 'react';

import { ArrowUpRight } from 'lucide-react';

import { BrandArtwork } from '@/components/brand-artwork';
import { Lead } from '@/components/prose';
import { BackToWorkspace, ReadingPage } from '@/components/reading-page';
import { PROJECT_URL } from '@/components/site-links';
import { PRIVACY_SUMMARY } from '@/lib/site-content';
import { cn } from '@/lib/utils';

export const AboutPage = function AboutPage({ onFollowLink }: { onFollowLink: (event: MouseEvent<HTMLAnchorElement>) => boolean }) {
  return (
    <ReadingPage about labelledBy="about-title" onFollowLink={onFollowLink} path="/about">
      <BackToWorkspace onClick={onFollowLink} />
      <BrandArtwork className="mb-8 w-90" />
      <h1 id="about-title">A closer look at PDF.</h1>
      <Lead>PDF Internals connects the document you see to the objects, references, and bytes that make it work.</Lead>
      <section>
        <h2>Built for exploring</h2>
        <p>
          A PDF stores page properties in dictionaries (collections of key–value pairs). References link them to fonts, images, and streams
          of drawing instructions. This workspace helps developers follow those connections while keeping the original file bytes in view.
        </p>
        <p>
          Open your own PDF or start with a bundled sample. Follow a page to its content stream, compare objects, or inspect the bytes
          behind a value. The tool is read-only, so exploring leaves your file unchanged.
        </p>
      </section>
      <section>
        <h2>Your files stay with you</h2>
        <p>
          {PRIVACY_SUMMARY} Clearing site data removes saved bookmarks. Notes from encrypted PDFs remain readable in browser storage. See{' '}
          <a href="/privacy" onClick={onFollowLink}>
            privacy and browser storage
          </a>{' '}
          for details.
        </p>
      </section>
      <section>
        <h2>An early, open-source project</h2>
        <p>
          Built by{' '}
          <a href="https://github.com/antonsamper" target="_blank" rel="noreferrer">
            @antonsamper
          </a>
          . The application code is licensed under the Apache License 2.0, and the source is available on{' '}
          <a href={PROJECT_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
        <p>
          Some PDFs and features are only partially supported. The inspector labels recovered structure and unavailable data. Page preview
          may display content that the inspector cannot decode.
        </p>
        <a
          className={cn(
            'inline-flex items-center gap-[5px] py-1',
            'text-body text-foreground underline underline-offset-3',
            'hover:underline-offset-4'
          )}
          href="/limitations"
          onClick={onFollowLink}
        >
          Read the limitations <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </section>
      <section>
        <h2>Explore the sample PDFs</h2>
        <p>
          Follow the{' '}
          <a href="/guide" onClick={onFollowLink}>
            workspace guide
          </a>{' '}
          to explore objects, decode streams, and find resources using the bundled sample PDFs. Read the{' '}
          <a href="/limitations" onClick={onFollowLink}>
            supported features and limitations
          </a>
          .
        </p>
      </section>
      <section className="mt-8 border-t border-border">
        <h2>Feedback and contact</h2>
        <p>
          Found a bug or wish the viewer explained something better? Report it in{' '}
          <a href={`${PROJECT_URL}/issues`} target="_blank" rel="noreferrer">
            GitHub issues
          </a>
          . Ask a question or share an idea in{' '}
          <a href={`${PROJECT_URL}/discussions`} target="_blank" rel="noreferrer">
            GitHub Discussions
          </a>
          . Report security problems privately, as described in the{' '}
          <a href={`${PROJECT_URL}/security/policy`} target="_blank" rel="noreferrer">
            security policy
          </a>
          .
        </p>
        <p>Issues and discussions are public, so remove sensitive information from any examples you share.</p>
      </section>
    </ReadingPage>
  );
};
