/**
 * Picks the noun form that agrees with a count by the language's CLDR plural rules. Counts are
 * whole numbers, which in these languages only fall into `one`, `few` or `many`.
 */
export function createPlural(
  locale: string,
  forms: { one: string; few: string; many: string },
): (count: number) => string {
  const rules = new Intl.PluralRules(locale);
  return (count) => {
    const category = rules.select(count);
    return category === "one" || category === "few" ? forms[category] : forms.many;
  };
}
