import { describe, expect, it } from "vitest";
import { parseManifest, pluginManifestSchema } from "./manifest";

const minimal = { id: "hello", name: "Hello", version: "1.0.0" };

describe("pluginManifestSchema", () => {
  it("fills the optional lists a manifest may leave out", () => {
    expect(parseManifest(minimal)).toEqual({ ...minimal, permissions: [] });
  });

  it("keeps the modules and permissions a manifest declares", () => {
    const manifest = {
      ...minimal,
      main: "main.js",
      styles: "plugin.css",
      surfaces: { background: "background.js", pointer: "pointer.js" },
      permissions: ["document:read", "ui:pointer"],
    };

    expect(parseManifest(manifest)).toEqual(manifest);
  });

  it("rejects an id that cannot name a folder", () => {
    for (const id of ["Hello", "hello_world", "../escape", "-hello", "hello-"]) {
      expect(() => parseManifest({ ...minimal, id })).toThrow(
        "must be lowercase letters, digits, dots or hyphens",
      );
    }
  });

  it("rejects a version that is not semantic", () => {
    for (const version of ["1", "1.0", "v1.0.0", "1.0.0.0"]) {
      expect(() => parseManifest({ ...minimal, version })).toThrow("must be a semantic version");
    }
  });

  it("rejects a permission the host does not know", () => {
    expect(() =>
      pluginManifestSchema.parse({ ...minimal, permissions: ["document:delete"] }),
    ).toThrow(/Invalid option/);
  });
});
