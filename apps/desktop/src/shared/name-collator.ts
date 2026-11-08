/**
 * Orders names the way the user's language does, numbers included, so "2" comes before "10". One
 * collator serves every comparison: creating one per call is what makes `localeCompare` slow on
 * large folders.
 */
export const nameCollator = new Intl.Collator(undefined, { numeric: true });
