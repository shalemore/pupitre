import prettyBytes from "pretty-bytes";

/**
 * A byte count as short as it reads, such as "20 MiB" or "1.5 KiB". The number is written in the
 * reader's language, while the unit keeps its ASCII spelling, which every language shares.
 */
export function formatFileSize(bytes: number, locale?: string): string {
  return prettyBytes(bytes, {
    binary: true,
    maximumFractionDigits: 1,
    locale: locale ?? false,
  });
}
