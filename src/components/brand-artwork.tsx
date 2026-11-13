export function BrandArtwork({
  className = "",
  decorative = false,
}: {
  className?: string
  decorative?: boolean
}) {
  return (
    <img
      className={`brand-artwork ${className}`}
      src={`${import.meta.env.BASE_URL}brand/pdf-internals-logo.png`}
      alt={
        decorative
          ? ""
          : "PDF Internals — a detective exploring PDF objects, pages, fonts, and streams"
      }
      width={1535}
      height={1024}
      decoding="async"
    />
  )
}
