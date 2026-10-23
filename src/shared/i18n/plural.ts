/**
 * Slavic noun agreement after a count: 2–4 (but not 12–14) takes the second form and every other
 * count the third. The first form is used for 1 (but not 11) in Russian and Ukrainian; Polish
 * limits it to exactly 1 (`oneOnlyForOne`), so 21 is "21 słów".
 */
export function slavicPlural(
  count: number,
  one: string,
  few: string,
  many: string,
  oneOnlyForOne = false,
): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (oneOnlyForOne && count === 1) return one;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (!oneOnlyForOne && last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
