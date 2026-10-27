import { describe, expect, it } from "vitest";
import { renderMath } from "./mathjax";

describe("renderMath", () => {
  it("renders glyphs from MathJax 4's dynamically loaded font ranges", async () => {
    const svg = await renderMath(
      String.raw`\mathbb{R} \mathcal{A} \mathfrak{g} \mathscr{L} \mathsf{T} \mathtt{x} \implies \leqslant`,
      true,
    );
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("md-math-error");
    expect(svg).not.toContain("data-mjx-error");
  });

  it("scopes local macro definitions to \\begingroup and \\endgroup", async () => {
    const inside = await renderMath(
      String.raw`\begingroup \def\localmacro{x^2} \localmacro \endgroup`,
      false,
    );
    const outside = await renderMath(String.raw`\localmacro`, false);
    expect(inside).toContain('data-mml-node="msup"');
    // noundefined renders an unknown control sequence as an mtext node in red
    expect(outside).toContain('data-mml-node="mtext"');
    expect(outside).toContain("\\localmacro");
  });

  it("renders chemistry and unit fractions", async () => {
    const svg = await renderMath(String.raw`\ce{H2O} + \nicefrac{1}{2}`, false);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("data-mjx-error");
  });
});
