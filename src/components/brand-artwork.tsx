export function BrandIcon() {
  return (
    <img
      className="brand-icon"
      src={`${import.meta.env.BASE_URL}brand/pdf-internals-icon.png?v=c793e37b`}
      alt=""
      width={128}
      height={128}
      decoding="async"
    />
  )
}

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
      width={1000}
      height={667}
      decoding="async"
    />
  )
}
