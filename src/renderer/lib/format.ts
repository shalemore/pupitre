import { currentLocale, intlLocale } from "@/i18n";

function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(currentLocale()), options).format(value);
}

export function formatDecimal(value: number, digits: number): string {
  return formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(value: number): string {
  return formatNumber(value, { style: "percent" });
}
