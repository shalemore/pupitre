/**
 * The page with every script taken out: the image export loads it in a window that only measures
 * it, so nothing in the document may run. A page the editor builds carries no script; one that
 * does is parsed and stripped rather than trusted.
 */
export function withoutScripts(page: string): string {
  if (!/<script/i.test(page)) return page;
  const parsed = new DOMParser().parseFromString(page, "text/html");
  for (const script of parsed.querySelectorAll("script")) script.remove();
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}
