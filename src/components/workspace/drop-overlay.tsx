import { ShieldCheck } from 'lucide-react';

import { BrandIcon } from '@/components/brand-artwork';

export const DropOverlay = () => (
  <div className="drop-overlay">
    <div className="drop-target">
      <div className="drop-mascot" aria-hidden="true">
        <BrandIcon />
      </div>
      <span className="drop-eyebrow">Ready to investigate</span>
      <p>Let’s look inside.</p>
      <span className="drop-instruction">Drop your PDF anywhere on this window</span>
      <div className="drop-overlay-privacy">
        <ShieldCheck size={14} aria-hidden="true" />
        Processed locally · up to 64 MiB
      </div>
    </div>
  </div>
);
