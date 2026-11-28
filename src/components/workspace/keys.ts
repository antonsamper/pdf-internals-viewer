/** Stable React keys for lists whose natural identifiers may repeat: later duplicates get a suffix. */
export const uniqueKeys = <T>(items: T[], identify: (item: T) => string): string[] => {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const base = identify(item);
    const occurrence = seen.get(base) ?? 0;

    seen.set(base, occurrence + 1);

    return occurrence ? `${base}#${occurrence}` : base;
  });
};
