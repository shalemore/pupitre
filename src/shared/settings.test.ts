import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  isModified,
  isWorkspaceKey,
  patchSettingsFile,
  resolveSettings,
  SETTING_KEYS,
  settingsSchema,
  withoutSetting,
} from "./settings";

describe("resolveSettings", () => {
  it("gives the defaults for a file that holds nothing usable", () => {
    expect(resolveSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings("not an object")).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps the valid entries when another one is invalid", () => {
    const settings = resolveSettings({ fontSize: 20, theme: 42, lineHeight: 99 });
    expect(settings.fontSize).toBe(20);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it("always reads a whole, valid set of settings, whatever the file holds", () => {
    const entry = fc.oneof(
      fc.constantFrom(...SETTING_KEYS),
      fc.string(),
      fc.constantFrom("__proto__", "constructor"),
    );
    fc.assert(
      fc.property(fc.dictionary(entry, fc.jsonValue()), (file) => {
        const settings = resolveSettings(file);
        expect(Object.keys(settings).toSorted()).toEqual([...SETTING_KEYS].toSorted());
        expect(settingsSchema.safeParse(settings).success).toBe(true);
      }),
    );
  });
});

describe("patchSettingsFile", () => {
  it("writes only what differs from the value without an entry", () => {
    const file = patchSettingsFile({}, { fontSize: 18, autoSave: false }, DEFAULT_SETTINGS);
    expect(file).toEqual({ fontSize: 18 });
  });

  it("removes an entry set back to the value without one", () => {
    const file = patchSettingsFile(
      { fontSize: 18 },
      { fontSize: DEFAULT_SETTINGS.fontSize },
      DEFAULT_SETTINGS,
    );
    expect(file).toEqual({});
  });

  it("keeps entries it does not know, and keys the patch leaves out", () => {
    const file = patchSettingsFile({ future: true, zoom: 150 }, { fontSize: 20 }, DEFAULT_SETTINGS);
    expect(file).toEqual({ future: true, zoom: 150, fontSize: 20 });
  });

  it("leaves out keys that do not belong in the file", () => {
    const file = patchSettingsFile(
      {},
      { startup: "last-file", fontSize: 20 },
      DEFAULT_SETTINGS,
      isWorkspaceKey,
    );
    expect(file).toEqual({ fontSize: 20 });
  });

  it("reads back as the settings it was patched with", () => {
    const patch = fc.record(
      {
        fontSize: fc.integer({ min: 10, max: 32 }),
        autoSave: fc.boolean(),
        theme: fc.string({ minLength: 1 }),
        bulletMarker: fc.constantFrom("-", "*", "+" as const),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(patch, (changes) => {
        const settings = resolveSettings(patchSettingsFile({}, changes, DEFAULT_SETTINGS));
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, ...changes });
      }),
    );
  });
});

describe("helpers", () => {
  it("keeps app settings out of a folder", () => {
    expect(isWorkspaceKey("startup")).toBe(false);
    expect(isWorkspaceKey("autoCheckUpdates")).toBe(false);
    expect(isWorkspaceKey("sourceMode")).toBe(false);
    expect(isWorkspaceKey("tabs")).toBe(false);
    expect(isWorkspaceKey("hideSingleTab")).toBe(false);
    expect(isWorkspaceKey("fontSize")).toBe(true);
  });

  it("removes one setting from a file", () => {
    expect(withoutSetting({ fontSize: 18, zoom: 120 }, "fontSize")).toEqual({ zoom: 120 });
  });

  it("tells a changed setting from a default one", () => {
    expect(isModified(DEFAULT_SETTINGS, "fontSize")).toBe(false);
    expect(isModified({ ...DEFAULT_SETTINGS, fontSize: 20 }, "fontSize")).toBe(true);
  });
});
