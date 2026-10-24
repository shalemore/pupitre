import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";

/**
 * MathJax behind one call: TeX source in, the SVG of the formula out. The module is only imported
 * once a formula shows up, because it is a megabyte of TeX packages.
 *
 * The full package set is used, so everything MathJax reads renders here too: ams environments
 * with `\label`/`\ref` numbering, macros, `\ce` chemistry, `\cancel`, `\color`, `\unicode`. The SVG
 * draws its glyphs as paths in `currentColor`, so a formula needs no font of its own and follows
 * the theme and the body font size, which sets its `ex`.
 */
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const document = mathjax.document("", {
  // "ams" is what numbers equations and makes \label and \ref work
  InputJax: new TeX({ packages: AllPackages, tags: "ams" }),
  OutputJax: new SVG({ fontCache: "local" }),
});

export function texToSvg(tex: string, display: boolean): string {
  return adaptor.innerHTML(document.convert(tex, { display }));
}
