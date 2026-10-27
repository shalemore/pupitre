/** The units a byte count is read in, stepped by 1024 as file managers show them. */
const UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

/**
 * A byte count as short as it reads, such as "20 MiB" or "1.5 KiB". The number is written in the
 * reader's language, while the unit keeps its ASCII spelling, which every language shares.
 */
export function formatFileSize(bytes: number, locale?: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return `${number} ${UNITS[unit]}`;
}
