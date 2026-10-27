import { isUtf8 } from "node:buffer";
import { type BrowserWindow, dialog } from "electron";
import iconv from "iconv-lite";
import type { LineEnding, TextEncoding } from "@shared/desktop-api";
import { t } from "./i18n";

/**
 * The encodings a file that declares none can be saved in, in the order the question lists them.
 * UTF-16 is among them because text that is mostly CJK leaves no zero bytes to recognize it by.
 */
const ASKED_ENCODINGS = [
  "gb18030",
  "big5",
  "shift_jis",
  "windows-1252",
  "utf-16le",
  "utf-16be",
] as const;
type AskedEncoding = (typeof ASKED_ENCODINGS)[number];

const ENCODING_LABELS: Readonly<Record<AskedEncoding, string>> = {
  gb18030: "GB18030",
  big5: "Big5",
  shift_jis: "Shift JIS",
  "windows-1252": "Windows-1252",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
};

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

/** How much of a decoded file may be unreadable before it is read as text in that encoding. */
const MAX_UNREADABLE_SHARE = 0.1;

/** The encoding a file announces in its first bytes. */
export function declaredEncoding(buffer: Buffer): TextEncoding | undefined {
  if (buffer.subarray(0, 3).equals(UTF8_BOM)) return "utf-8-bom";
  if (buffer.subarray(0, 2).equals(UTF16LE_BOM)) return "utf-16le";
  if (buffer.subarray(0, 2).equals(UTF16BE_BOM)) return "utf-16be";
  return undefined;
}

/**
 * UTF-16 without a BOM is rare, but its zero bytes give it away: the high byte of a character below
 * U+0100 is zero, so the zeros sit mostly on one side of every pair. CJK text has few such bytes,
 * so a file like that is asked about instead.
 *
 * The folder search reads a file with it as well, so that an offset it reports is one in the text
 * the editor opens.
 */
export function undeclaredUtf16(buffer: Buffer): TextEncoding | undefined {
  const sample = buffer.subarray(0, 4096);
  const pairs = Math.floor(sample.length / 2);
  if (pairs < 8) return undefined;
  let even = 0;
  let odd = 0;
  sample.forEach((byte, index) => {
    if (byte !== 0) return;
    if (index % 2 === 0) even++;
    else odd++;
  });
  const mostly = (dominant: number, other: number) => dominant > pairs / 8 && dominant > other * 4;
  if (mostly(odd, even)) return "utf-16le";
  if (mostly(even, odd)) return "utf-16be";
  return undefined;
}

/**
 * Characters no document holds: control characters other than the tab and the line breaks, and the
 * replacement character a byte that is not UTF-8 becomes. A regular expression finds them over a
 * large file without the JavaScript loop `mostlyUnreadable` used to run per character.
 */
// Control characters are exactly what a file that is not text decodes to
// eslint-disable-next-line no-control-regex
const UNREADABLE_CHARACTERS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f�]/g;

/** How many characters of a decoded file are unreadable ones; stops at the share that settles it. */
function unreadableCharacters(text: string): number {
  const settled = Math.floor(text.length * MAX_UNREADABLE_SHARE) + 1;
  let count = 0;
  const matches = text.matchAll(UNREADABLE_CHARACTERS);
  for (let result = matches.next(); !result.done; result = matches.next()) {
    count++;
    if (count >= settled) break;
  }
  return count;
}

/**
 * Whether a file decoded as `text` is more likely text in another encoding, or not text at all:
 * UTF-16 text in a script whose characters have no zero high byte is valid UTF-8, which turns its
 * low bytes into control characters and its text into mojibake.
 */
export function mostlyUnreadable(text: string): boolean {
  return unreadableCharacters(text) > text.length * MAX_UNREADABLE_SHARE;
}

function iconvName(encoding: TextEncoding): string {
  if (encoding === "utf-16le") return "utf16-le";
  if (encoding === "utf-16be") return "utf16-be";
  // The UTF-8 BOM is added by hand, so both UTF-8 flavours encode the same way
  return encoding === "utf-8-bom" ? "utf-8" : encoding;
}

function withoutBom(buffer: Buffer, encoding: TextEncoding): Buffer {
  const declared = declaredEncoding(buffer);
  if (declared !== encoding) return buffer;
  return buffer.subarray(encoding === "utf-8-bom" ? 3 : 2);
}

/** Thrown when the text has characters that the encoding of the file cannot store. */
export class LossyEncodingError extends Error {
  constructor(encoding: TextEncoding) {
    super(t().dialogs.encodingCannotStore(encoding.toUpperCase()));
    this.name = "LossyEncodingError";
  }
}

/**
 * Strips the BOM of a file (its encoding keeps it on save) and normalizes line endings to LF; the
 * original line ending is restored on save. This is the text the editor and the folder search both
 * see, so an offset found by one is an offset in the other.
 */
export function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
}

/** The line ending a save restores for a file that was read as `raw`. */
export function lineEndingOf(raw: string): LineEnding {
  return raw.includes("\r\n") ? "crlf" : "lf";
}

/** The editor's text with the line ending of its file put back. */
export function withLineEnding(text: string, lineEnding: LineEnding): string {
  return lineEnding === "crlf" ? text.replaceAll("\n", "\r\n") : text;
}

/** Decodes a file whose encoding is known. */
export function decodeWith(buffer: Buffer, encoding: TextEncoding): string {
  return iconv.decode(withoutBom(buffer, encoding), iconvName(encoding));
}

/** Encodes the text the way the file was written, keeping its encoding and its BOM. */
export function encodeDocument(text: string, encoding: TextEncoding): Buffer {
  const body = iconv.encode(text, iconvName(encoding));
  // iconv turns what an encoding cannot store into "?", so the text has to survive the round trip
  if (
    encoding !== "utf-8" &&
    encoding !== "utf-8-bom" &&
    iconv.decode(body, iconvName(encoding)) !== text
  ) {
    throw new LossyEncodingError(encoding);
  }
  if (encoding === "utf-8-bom") return Buffer.concat([UTF8_BOM, body]);
  if (encoding === "utf-16le") return Buffer.concat([UTF16LE_BOM, body]);
  if (encoding === "utf-16be") return Buffer.concat([UTF16BE_BOM, body]);
  return body;
}

/** Asks which encoding a file that is neither UTF-8 nor recognizable UTF-16 is saved in. */
async function askEncoding(
  window: BrowserWindow,
  path: string,
): Promise<AskedEncoding | undefined> {
  const labels = t().dialogs;
  const { response } = await dialog.showMessageBox(window, {
    type: "question",
    message: labels.encodingMessage,
    detail: path,
    buttons: [...ASKED_ENCODINGS.map((encoding) => ENCODING_LABELS[encoding]), labels.cancel],
    defaultId: 0,
    cancelId: ASKED_ENCODINGS.length,
    noLink: true,
  });
  return ASKED_ENCODINGS[response];
}

export interface DecodedDocument {
  text: string;
  encoding: TextEncoding;
}

/** The two byte orders a file without a BOM can be UTF-16 in. */
const UTF16_ORDERS = ["utf-16le", "utf-16be"] as const;

/**
 * Whether a file with zero bytes in it reads as text in one of those byte orders: text in a script
 * whose characters have no zero high byte still has zeros in its line breaks and spaces, while
 * bytes that are not text decode to characters no document holds or to lone surrogates, which
 * iconv passes through as they are.
 */
function readsAsUtf16(buffer: Buffer): boolean {
  return UTF16_ORDERS.some((encoding) => {
    const text = decodeWith(buffer, encoding);
    return !mostlyUnreadable(text) && text.isWellFormed();
  });
}

/**
 * Reads a file for the editor. What declares an encoding or is recognizable UTF-16 is used as it
 * is, since guessing a legacy encoding would silently garble the text. Text that is valid UTF-8 but
 * decodes to characters no document holds is not UTF-8 either, and is asked about: UTF-16 text in
 * a script without zero high bytes passes the UTF-8 check, and reading it as UTF-8 would write the
 * mojibake back on the first save. Binary content is refused instead of being shown as garbage.
 */
export async function decodeDocument(
  buffer: Buffer,
  path: string,
  window: BrowserWindow,
): Promise<DecodedDocument | undefined> {
  const declared = declaredEncoding(buffer) ?? undeclaredUtf16(buffer);
  if (declared !== undefined) return { text: decodeWith(buffer, declared), encoding: declared };
  if (isUtf8(buffer)) {
    const text = buffer.toString("utf8");
    if (!mostlyUnreadable(text)) return { text, encoding: "utf-8" };
  }
  // A UTF-16 document in such a script has the zero bytes of its line breaks and spaces, so a file
  // that reads as one is asked about; only what reads as neither is refused
  if (buffer.includes(0) && !readsAsUtf16(buffer)) throw new Error("Not a text file");
  const chosen = await askEncoding(window, path);
  if (chosen === undefined) return undefined;
  return { text: decodeWith(buffer, chosen), encoding: chosen };
}
