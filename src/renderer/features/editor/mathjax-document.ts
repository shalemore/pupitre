import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/action/ActionConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js";
import "@mathjax/src/js/input/tex/bbox/BboxConfiguration.js";
import "@mathjax/src/js/input/tex/begingroup/BegingroupConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/js/input/tex/html/HtmlConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/noerrors/NoErrorsConfiguration.js";
import "@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js";
import "@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/js/input/tex/setoptions/SetOptionsConfiguration.js";
import "@mathjax/src/js/input/tex/tagformat/TagFormatConfiguration.js";
import "@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js";
import "@mathjax/src/js/input/tex/units/UnitsConfiguration.js";
import "@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js";
import "@mathjax/src/js/input/tex/verb/VerbConfiguration.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

/**
 * MathJax 4 splits the less-common TeX glyph ranges of its New Computer Modern font (`\mathbb`,
 * `\mathcal`, `\mathfrak`, `\mathscr`, `\mathsf`, `\mathtt`, extra arrows, relations and symbols)
 * into files loaded through `mathjax.asyncLoad`. Its built-in `asyncLoad/esm.js` calls
 * `import(name)` with a bare package specifier that Vite cannot see at build time, so glob the
 * TeX math ranges instead to turn each into an on-demand chunk; prose scripts outside TeX fall
 * back to `<text>` in the document font.
 */
const dynamicFonts = import.meta.glob(
  "../../../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/{accents,arrows,calligraphic,double-struck,fraktur,math,monospace,sans-serif,script,shapes,symbols,variants}.js",
);
mathjax.asyncLoad = (name: string) => {
  const file = name.slice(name.lastIndexOf("/") + 1);
  const load =
    dynamicFonts[`../../../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/${file}`];
  return load ? load() : Promise.resolve();
};

/**
 * The TeX packages this app reads. MathJax 4 dropped the AllPackages list, and its autoload and
 * require extensions only work in its component framework, so every package is imported above for
 * its configuration and named here for the input jax.
 */
const PACKAGES = [
  "base",
  "action",
  "ams",
  "amscd",
  "bbox",
  "begingroup",
  "boldsymbol",
  "braket",
  "bussproofs",
  "cancel",
  "cases",
  "centernot",
  "color",
  "colortbl",
  "configmacros",
  "empheq",
  "enclose",
  "extpfeil",
  "gensymb",
  "html",
  "mathtools",
  "mhchem",
  "newcommand",
  "noerrors",
  "noundefined",
  "physics",
  "setoptions",
  "tagformat",
  "textcomp",
  "textmacros",
  "unicode",
  "units",
  "upgreek",
  "verb",
];

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
  InputJax: new TeX({ packages: PACKAGES, tags: "ams" }),
  OutputJax: new SVG({ fontCache: "local" }),
});

export async function texToSvg(tex: string, display: boolean): Promise<string> {
  return adaptor.innerHTML(await document.convertPromise(tex, { display }));
}
