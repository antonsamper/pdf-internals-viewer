import { cn } from '@/lib/utils';

export const BrandIcon = function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src={`${import.meta.env.BASE_URL}brand/pdf-internals-icon.png?v=c793e37b`}
      alt=""
      width={128}
      height={128}
      decoding="async"
    />
  );
};

export const BrandArtwork = function BrandArtwork({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <>
      {[
        {
          file: 'pdf-internals-logo.png',
          height: 667,
          mode: 'light',
          width: 1000,
        },
        {
          file: 'pdf-internals-logo-dark.png',
          height: 1024,
          mode: 'dark',
          width: 1535,
        },
      ].map(({ mode, file, width, height }) => {
        return (
          <img
            key={mode}
            className={cn('h-auto max-w-full', mode === 'light' ? 'block dark:hidden' : 'hidden dark:block', className)}
            data-brand-artwork={mode}
            src={`${import.meta.env.BASE_URL}brand/${file}`}
            alt={decorative ? '' : 'PDF Internals — a detective exploring PDF objects, pages, fonts, and streams'}
            width={width}
            height={height}
            decoding="async"
          />
        );
      })}
    </>
  );
};
