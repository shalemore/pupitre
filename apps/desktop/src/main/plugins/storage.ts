import { join } from "node:path";
import { isRecord } from "@pupitre/utils";
import { readJsonFile, writeJsonFile } from "../json-file";

const STORAGE_FILE = "storage.json";
/** A plugin keeps a little state, not a database. */
const MAX_BYTES = 1024 * 1024;

function read(folder: string): Record<string, unknown> {
  const value = readJsonFile(join(folder, STORAGE_FILE));
  return isRecord(value) ? value : {};
}

function write(folder: string, value: Record<string, unknown>): void {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error("The value cannot be stored as JSON");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    throw new Error("The plugin storage is full");
  }
  writeJsonFile(join(folder, STORAGE_FILE), value);
}

export function getValue(folder: string, key: string): unknown {
  return read(folder)[key];
}

export function setValue(folder: string, key: string, value: unknown): void {
  write(folder, { ...read(folder), [key]: value });
}

export function deleteValue(folder: string, key: string): void {
  const values = read(folder);
  delete values[key];
  write(folder, values);
}
