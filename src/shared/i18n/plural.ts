/**
 * Slavic noun agreement after a count: 1 (but not 11) takes the first form, 2–4 (but not 12–14)
 * the second, and every other count the third. Russian, Ukrainian and Polish share this rule.
 */
export function slavicPlural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
