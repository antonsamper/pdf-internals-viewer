import type { MouseEvent } from 'react';

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
export const EmptyWorkspace = ({
  onFollowLink,
  onOpenFile,
  onSample,
}: {
  onFollowLink: (event: MouseEvent<HTMLElement>) => boolean;
  onOpenFile: () => void;
  onSample: (file: string) => void;
}) => (
  <main className="empty-workspace" tabIndex={-1}>
    <div className="welcome-layout">
      <BrandArtwork className="welcome-artwork" />
      <div className="welcome-content">
        <div className="empty-introduction">
          <span className="welcome-eyebrow">Structure & byte explorer</span>
          <h1>
            Look <span>inside</span> a PDF.
          </h1>
          <p>
            An open-source, read-only PDF inspector for developers. Explore PDF objects, follow references, and inspect raw or decoded
            streams alongside the original bytes.
          </p>
          <div className="welcome-open-row">
            <Button size="lg" onClick={onOpenFile}>
              <FilePlus2 size={16} />
              Open a PDF<span className="shortcut">⌘ O</span>
            </Button>
            <span className="drop-hint">or drop a file anywhere · up to 64 MiB</span>
          </div>
          <div className="welcome-trust">
            <span className="welcome-trust-badge welcome-trust-local">
              <Shield size={16} aria-hidden="true" />
              Processed locally
            </span>
            <span className="welcome-trust-badge">
              <LockKeyhole size={16} aria-hidden="true" />
              Read-only inspection
            </span>
          </div>
        </div>
        <section className="samples">
          <h2>Start with a sample</h2>
          <p className="samples-description">No file handy? Explore a PDF made for learning.</p>
          {SAMPLES.map(({ file, name, detail, icon: Icon, tone }) => (
            <button className="sample-row" data-tone={tone} key={file} onClick={() => onSample(file)}>
              <span className="sample-icon">
                <Icon size={19} strokeWidth={1.5} />
              </span>
              <span>
                <strong>{name}</strong>
                <span>{detail}</span>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
      </div>
    </div>
    <p className="welcome-note">
      From a page to its content stream to the bytes behind it.
      <br />
      Read-only exploration, with the source always in view.
      <span className="welcome-docs">
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
