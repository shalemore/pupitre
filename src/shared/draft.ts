import { z } from "zod";
import { LINE_ENDINGS, TEXT_ENCODINGS } from "./desktop-api";

/**
 * A draft comes back from a file a crash may have cut short, so a host reads one only when it is
 * whole. The schema sits apart from the contract that declares the type: the preload script
 * bundles everything the contract pulls at runtime, and it cannot load zod.
 */
export const draftSchema = z.strictObject({
  path: z.string().optional(),
  folder: z.string().optional(),
  baseUrl: z.string().optional(),
  markdown: z.string(),
  savedMarkdown: z.string(),
  lineEnding: z.enum(LINE_ENDINGS),
  encoding: z.enum(TEXT_ENCODINGS),
  isSample: z.boolean(),
});
