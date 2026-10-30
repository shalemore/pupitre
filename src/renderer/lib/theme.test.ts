import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, LOCALE_CODES } from "@shared/i18n";
import themeSchema from "../../../agents/skills/theming-pupitre/theme.schema.json";
import {
  activeThemeCss,
  applyTheme,
  localizedText,
  readColorScheme,
  themeDisplayName,
  themeMetaSchema,
  type LocalizedText,
  type ThemeInfo,
} from "./theme";

describe("activeThemeCss", () => {
  it("reads the applied theme from the document, not from the module that applied it", async () => {
    applyTheme("plakat");
    const applied = activeThemeCss();
    expect(applied).toContain("@layer document-theme");
    // A hot update can leave two instances of the module behind; the export code may be given the
    // one that never applied a theme
    vi.resetModules();
    const other = await import("./theme");
    expect(other.activeThemeCss()).toBe(applied);
  });
});

describe("readColorScheme", () => {
  it("ignores a declaration written inside a comment", () => {
    const css = `
      /*
       * A theme declares its schemes on :root, for example color-scheme: dark, and overrides the
       * dark values in @media (prefers-color-scheme: dark).
       */
      :root {
        color-scheme: light;
      }
    `;
    expect(readColorScheme(css)).toEqual(["light"]);
  });

  it("reads a light-only declaration", () => {
    expect(readColorScheme(":root {\n  color-scheme: light;\n}")).toEqual(["light"]);
  });

  it("reads a dark-only declaration", () => {
    expect(readColorScheme(":root {\n  color-scheme: dark;\n}")).toEqual(["dark"]);
  });

  it("reads both schemes from light dark", () => {
    expect(readColorScheme(":root {\n  color-scheme: light dark;\n}")).toEqual(["light", "dark"]);
  });

  it("treats a theme without a declaration as light only", () => {
    expect(readColorScheme(":root {\n  --ui-brand: red;\n}")).toEqual(["light"]);
    expect(
      readColorScheme(
        "@media (prefers-color-scheme: dark) {\n  :root {\n    --ui-brand: blue;\n  }\n}",
      ),
    ).toEqual(["light"]);
  });

  it("does not depend on the order of the declarations in the block", () => {
    expect(readColorScheme(":root {\n  --ui-brand: red;\n  color-scheme: dark;\n}")).toEqual([
      "dark",
    ]);
  });

  it("keeps the schemes in the order they are declared", () => {
    expect(readColorScheme(":root {\n  color-scheme: dark light;\n}")).toEqual(["dark", "light"]);
  });
});

function theme(names: LocalizedText): ThemeInfo {
  return {
    id: "folder",
    name: "folder",
    source: "builtin",
    names,
    descriptions: undefined,
    schemes: ["light"],
  };
}

describe("themeDisplayName", () => {
  it("uses a single string for every language", () => {
    expect(themeDisplayName(theme("GitHub"), "en-US")).toBe("GitHub");
    expect(themeDisplayName(theme("GitHub"), "zh-CN")).toBe("GitHub");
  });

  it("uses the name of the exact language", () => {
    const names = { [DEFAULT_LOCALE]: "Academic", "zh-CN": "学术" };
    expect(themeDisplayName(theme(names), "zh-CN")).toBe("学术");
  });

  it("falls back to the default locale when the language is missing", () => {
    const names = { [DEFAULT_LOCALE]: "Academic", "zh-CN": "学术" };
    expect(themeDisplayName(theme(names), "ja-JP")).toBe("Academic");
  });

  it("uses the first name when the default locale is missing too", () => {
    expect(themeDisplayName(theme({ "zh-CN": "学术" }), "ja-JP")).toBe("学术");
  });

  it("uses the folder name when the theme gives no name", () => {
    expect(themeDisplayName(theme({}), "en-US")).toBe("folder");
  });
});

describe("localizedText", () => {
  it("uses the same fallback for a description", () => {
    const descriptions = { [DEFAULT_LOCALE]: "A writing desk", "zh-CN": "书桌" };
    expect(localizedText(descriptions, "zh-CN")).toBe("书桌");
    expect(localizedText(descriptions, "ja-JP")).toBe("A writing desk");
    expect(localizedText({ "zh-CN": "书桌" }, "ja-JP")).toBe("书桌");
    expect(localizedText(undefined, "en-US")).toBeUndefined();
  });
});

const LOCALE_CODES_SET: ReadonlySet<string> = new Set(LOCALE_CODES);

/** The built-in themes must name every locale; an external theme may leave some out. */
function missingOrExtra(text: LocalizedText): { missing: string[]; extra: string[] } {
  if (typeof text === "string") return { missing: [], extra: [] };
  const keys = Object.keys(text);
  return {
    missing: LOCALE_CODES.filter((code) => !keys.includes(code)),
    extra: keys.filter((code) => !LOCALE_CODES_SET.has(code)),
  };
}

function checkEveryLocale(path: string, field: string, text: LocalizedText | undefined): void {
  if (text === undefined) throw new Error(`${path}: no ${field}`);
  const { missing, extra } = missingOrExtra(text);
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${path}: ${field} missing ${missing.join(", ") || "none"}; extra ${
        extra.join(", ") || "none"
      }`,
    );
  }
}

describe("built-in theme metadata", () => {
  const metas = import.meta.glob<unknown>("../themes/*/theme.json", {
    import: "default",
    eager: true,
  });

  it("names and describes every locale in every built-in theme", () => {
    expect(Object.keys(metas)).not.toHaveLength(0);
    for (const [path, meta] of Object.entries(metas)) {
      const result = themeMetaSchema.safeParse(meta);
      if (!result.success) {
        throw new Error(`${path}: ${result.error.message}`);
      }
      checkEveryLocale(path, "name", result.data.name);
      checkEveryLocale(path, "description", result.data.description);
    }
  });
});

describe("theme manifest schema", () => {
  it("describes the same fields the loader accepts", () => {
    const described = Object.keys(themeSchema.properties).filter((key) => key !== "$schema");
    expect(described.toSorted()).toEqual(Object.keys(themeMetaSchema.shape).toSorted());
    expect(themeSchema.required).toEqual(["name"]);
  });

  it("offers the same locale codes the app knows", () => {
    const keyed = themeSchema.$defs.localizedText.oneOf[1];
    if (keyed === undefined || !("propertyNames" in keyed)) {
      throw new Error("the schema lost its keyed form");
    }
    expect([...keyed.propertyNames.enum].toSorted()).toEqual([...LOCALE_CODES].toSorted());
  });
});
