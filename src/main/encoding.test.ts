import { BrowserWindow, dialog } from "electron";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { LINE_ENDINGS } from "@shared/desktop-api";
import {
  declaredEncoding,
  decodeDocument,
  decodeWith,
  encodeDocument,
  LossyEncodingError,
  lineEndingOf,
  mostlyUnreadable,
  normalizeText,
  undeclaredUtf16,
  withLineEnding,
} from "./encoding";

vi.mock("electron", () => ({
  BrowserWindow: vi.fn<() => object>(),
  dialog: { showMessageBox: vi.fn<typeof import("electron").dialog.showMessageBox>() },
}));
vi.mock("./i18n", async () => {
  const { getDictionary } = await import("@shared/i18n");
  return { t: () => getDictionary("en-US") };
});

/** Presses the button of the encoding question at `index`; 0 is GB18030. */
function answerEncodingQuestion(index: number) {
  return vi
    .mocked(dialog.showMessageBox)
    .mockResolvedValue({ response: index, checkboxChecked: false });
}

/** Opens a file the way the app does, then saves the text it shows unchanged. */
async function openAndSave(bytes: Buffer): Promise<Buffer> {
  const decoded = await decodeDocument(bytes, "test.md", new BrowserWindow());
  if (decoded === undefined) throw new Error("The encoding question was cancelled");
  const content = normalizeText(decoded.text);
  return encodeDocument(withLineEnding(content, lineEndingOf(decoded.text)), decoded.encoding);
}

/**
 * Lines of any text a document holds. Control characters, a leading BOM character and the
 * replacement character are left out: a file made of them is not text, and the app asks about it
 * or refuses it instead of opening it.
 */
const documentLine = fc
  .string({ unit: "grapheme", maxLength: 40 })
  .map((line) => line.replaceAll(/[\p{Cc}﻿�]/gu, ""));
const documentText = fc.array(documentLine, { maxLength: 12 }).map((lines) => lines.join("\n"));

describe("encoding detection", () => {
  it("reads the encoding a BOM declares", () => {
    expect(declaredEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe("utf-8-bom");
    expect(declaredEncoding(Buffer.from([0xff, 0xfe, 0x61, 0x00]))).toBe("utf-16le");
    expect(declaredEncoding(Buffer.from([0xfe, 0xff, 0x00, 0x61]))).toBe("utf-16be");
    expect(declaredEncoding(Buffer.from("plain"))).toBeUndefined();
  });

  it("recognizes UTF-16 without a BOM by its zero bytes", () => {
    const text = "A Markdown document without a byte order mark.";
    expect(undeclaredUtf16(Buffer.from(text, "utf16le"))).toBe("utf-16le");
    expect(undeclaredUtf16(Buffer.from(text, "utf16le").swap16())).toBe("utf-16be");
    expect(undeclaredUtf16(Buffer.from(text, "utf8"))).toBeUndefined();
  });

  it("counts control characters and replacement characters as unreadable", () => {
    expect(mostlyUnreadable("# Title\n\nSome text\twith a tab.")).toBe(false);
    expect(mostlyUnreadable("\u0001\u0002abc�")).toBe(true);
  });

  it("refuses binary content", async () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0x00, 0xd8, 0x00, 0x10, 0x00]);
    await expect(decodeDocument(binary, "image.md", new BrowserWindow())).rejects.toThrow(
      "Not a text file",
    );
  });

  it("asks which legacy encoding a file is in and reads it with the answer", async () => {
    const ask = answerEncodingQuestion(0);
    const bytes = encodeDocument("中文文档，用 GB18030 保存。", "gb18030");
    const decoded = await decodeDocument(bytes, "legacy.md", new BrowserWindow());
    expect(ask).toHaveBeenCalledOnce();
    expect(decoded).toEqual({ text: "中文文档，用 GB18030 保存。", encoding: "gb18030" });
  });

  it("opens nothing when the question is cancelled", async () => {
    answerEncodingQuestion(99);
    const bytes = encodeDocument("中文文档，用 GB18030 保存。", "gb18030");
    expect(await decodeDocument(bytes, "legacy.md", new BrowserWindow())).toBeUndefined();
  });
});

describe("saving", () => {
  it("refuses to drop characters the encoding cannot store", () => {
    expect(() => encodeDocument("emoji 😀", "shift_jis")).toThrow(LossyEncodingError);
    expect(() => encodeDocument("emoji 😀", "utf-8")).not.toThrow();
  });

  it("keeps the line ending the file had", () => {
    expect(lineEndingOf("a\r\nb")).toBe("crlf");
    expect(lineEndingOf("a\nb")).toBe("lf");
    expect(withLineEnding(normalizeText("a\r\nb\r\n"), "crlf")).toBe("a\r\nb\r\n");
  });
});

describe("open and save round trip", () => {
  it("writes back the bytes of an unchanged Unicode file", async () => {
    const encodings = fc.constantFrom("utf-8", "utf-8-bom", "utf-16le", "utf-16be" as const);
    await fc.assert(
      fc.asyncProperty(
        documentText,
        fc.constantFrom(...LINE_ENDINGS),
        encodings,
        async (text, lineEnding, encoding) => {
          const bytes = encodeDocument(withLineEnding(text, lineEnding), encoding);
          expect(await openAndSave(bytes)).toEqual(bytes);
        },
      ),
    );
  });

  it("writes back the bytes of an unchanged legacy file", () => {
    const characters = [..."abc XYZ 012.,#*-_\n中文漢字文档，。日本語のかなカナ한국어"];
    const text = fc.string({ unit: fc.constantFrom(...characters), maxLength: 60 });
    const encodings = fc.constantFrom("gb18030", "big5", "shift_jis" as const);
    fc.assert(
      fc.property(text, encodings, (value, encoding) => {
        let bytes: Buffer;
        try {
          bytes = encodeDocument(value, encoding);
        } catch (error) {
          // Not every character above exists in every one of these encodings
          if (error instanceof LossyEncodingError) return;
          throw error;
        }
        expect(encodeDocument(decodeWith(bytes, encoding), encoding)).toEqual(bytes);
      }),
    );
  });
});
