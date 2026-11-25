import { cn } from 'cn';
import { ShieldCheck } from 'lucide-react';

import { BrandIcon } from '@/components/brand-artwork';

export const DropOverlay = () => (
  <div
    className={cn(
      'fixed inset-0 z-100',
      'flex items-center justify-center px-6 pt-20 pb-8',
      'bg-[color-mix(in_srgb,var(--background)_78%,transparent)] backdrop-blur-[6px]',
      'pointer-events-none'
    )}
    data-testid="drop-overlay"
  >
    <div
      className={cn(
        'relative flex w-[min(100%,520px)] flex-col items-center',
        'px-6 pt-19 pb-9 text-center',
        'bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--brand-purple-soft)_80%,transparent),transparent_75%)]',
        'rounded-[28px] border-2 border-dashed border-[color-mix(in_srgb,var(--brand-purple)_60%,transparent)]'
      )}
      data-testid="drop-target"
    >
      <div
        className={cn(
          'absolute -top-15.5 size-30',
          '-rotate-8 drop-shadow-[0_8px_16px_color-mix(in_srgb,var(--brand-purple)_20%,transparent)]'
        )}
        aria-hidden="true"
      >
        <BrandIcon className="block size-full object-contain" />
      </div>
      <span className="font-[family-name:SFMono-Regular,Consolas,monospace] text-[10px] leading-[normal] font-medium tracking-[0.1em] text-(--brand-purple) uppercase">
        Ready to investigate
      </span>
      <p className="mt-3.5 mb-3 text-[clamp(28px,4vw,38px)] leading-[1.15] font-[550] tracking-[-0.035em]">Let’s look inside.</p>
      <span className="max-w-[28ch] text-sm leading-[1.6] text-balance text-muted-foreground">Drop your PDF anywhere on this window</span>
      <div
        className={cn(
          'inline-flex items-center',
          'mt-7 gap-[7px] px-3 py-[7px]',
          'rounded-full bg-background text-[11px] text-muted-foreground'
        )}
      >
        <ShieldCheck className="shrink-0 text-(--brand-purple)" size={14} aria-hidden="true" />
        Processed locally · up to 64 MiB
      </div>
    </div>
  </div>
);
