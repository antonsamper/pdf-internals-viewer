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
    <>
      {[
        {
          mode: "light",
          file: "pdf-internals-logo.png",
          width: 1000,
          height: 667,
        },
        {
          mode: "dark",
          file: "pdf-internals-logo-dark.png",
          width: 1535,
          height: 1024,
        },
      ].map(({ mode, file, width, height }) => (
        <img
          key={mode}
          className={`brand-artwork brand-artwork-${mode} ${className}`}
          src={`${import.meta.env.BASE_URL}brand/${file}`}
          alt={
            decorative
              ? ""
              : "PDF Internals — a detective exploring PDF objects, pages, fonts, and streams"
          }
          width={width}
          height={height}
          decoding="async"
        />
      ))}
    </>
  )
}
