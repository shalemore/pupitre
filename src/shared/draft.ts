import { z } from "zod";
import type { DraftSession } from "./desktop-api";
import { LINE_ENDINGS, TEXT_ENCODINGS } from "./desktop-api";

/**
 * A draft comes back from a file a crash may have cut short, so a host reads one only when it is
 * whole. The schema sits apart from the contract that declares the type: the preload script
 * bundles everything the contract pulls at runtime, and it cannot load zod.
 */
const draftSchema = z.strictObject({
  path: z.string().optional(),
  folder: z.string().optional(),
  baseUrl: z.string().optional(),
  markdown: z.string(),
  savedMarkdown: z.string(),
  lineEnding: z.enum(LINE_ENDINGS),
  encoding: z.enum(TEXT_ENCODINGS),
  isSample: z.boolean(),
});

const draftSessionSchema = z.strictObject({
  tabs: z.array(draftSchema),
  active: z.int().nonnegative(),
});

/**
 * The drafts a host kept, read the way it wrote them. A draft of a single-document version of the
 * app is one tab, so a crash before an update still comes back; anything else that does not read as
 * a whole session is null, and the host drops it rather than failing to restore it at every start.
 */
export function readDraftSession(value: unknown): DraftSession | null {
  const session = draftSessionSchema.safeParse(value);
  if (session.success) {
    const { tabs, active } = session.data;
    if (tabs.length === 0) return null;
    // The index is only useful while it points at a tab the session holds
    return { tabs, active: Math.min(active, tabs.length - 1) };
  }
  const single = draftSchema.safeParse(value);
  return single.success ? { tabs: [single.data], active: 0 } : null;
}
