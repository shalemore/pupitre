import { FORMAT_ACTIONS, type FormatAction } from "@shared/format";
import { linkTooltipAPI } from "@milkdown/kit/component/link-tooltip";
import { type Editor, editorViewCtx } from "@milkdown/kit/core";
import {
  createCodeBlockCommand,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { keymap } from "@milkdown/kit/prose/keymap";
import type { Plugin } from "@milkdown/kit/prose/state";
import { callCommand } from "@milkdown/kit/utils";

function headingLevel(action: FormatAction): number | undefined {
  const match = /^heading([1-6])$/.exec(action);
  return match ? Number(match[1]) : undefined;
}

/** Opens Crepe's link editor for the selected text; with nothing selected there is no link text. */
function editLink(editor: Editor): boolean {
  return editor.action((ctx) => {
    const { from, to, empty } = ctx.get(editorViewCtx).state.selection;
    if (empty) return false;
    ctx.get(linkTooltipAPI.key).addLink(from, to);
    return true;
  });
}

/** Applies a format to the selection; returns false when it does not apply there. */
export function runFormatAction(editor: Editor, action: FormatAction): boolean {
  const level = headingLevel(action);
  if (level !== undefined) return editor.action(callCommand(wrapInHeadingCommand.key, level));
  switch (action) {
    case "bold":
      return editor.action(callCommand(toggleStrongCommand.key));
    case "italic":
      return editor.action(callCommand(toggleEmphasisCommand.key));
    case "strikethrough":
      return editor.action(callCommand(toggleStrikethroughCommand.key));
    case "inlineCode":
      return editor.action(callCommand(toggleInlineCodeCommand.key));
    case "link":
      return editLink(editor);
    case "paragraph":
      return editor.action(callCommand(turnIntoTextCommand.key));
    case "quote":
      return editor.action(callCommand(wrapInBlockquoteCommand.key));
    case "orderedList":
      return editor.action(callCommand(wrapInOrderedListCommand.key));
    case "bulletList":
      return editor.action(callCommand(wrapInBulletListCommand.key));
    case "codeBlock":
      return editor.action(callCommand(createCodeBlockCommand.key));
    case "mathBlock":
      // Crepe renders code blocks in the LaTeX language as display math
      return editor.action(callCommand(createCodeBlockCommand.key, "LaTeX"));
    case "table":
      return editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 }));
    case "divider":
      return editor.action(callCommand(insertHrCommand.key));
    default:
      return false;
  }
}

/** Converts an Electron accelerator to a ProseMirror key name: "CmdOrCtrl+Shift+K" → "Mod-Shift-k". */
function toKeyName(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => (part === "CmdOrCtrl" ? "Mod" : part.length === 1 ? part.toLowerCase() : part))
    .join("-");
}

/** The Typora-style formatting shortcuts, taken from the shared FORMAT_ACTIONS list. */
export function formatKeymap(editor: () => Editor): Plugin {
  return keymap(
    Object.fromEntries(
      FORMAT_ACTIONS.flatMap(({ id, shortcut }) =>
        shortcut === undefined ? [] : [[toKeyName(shortcut), () => runFormatAction(editor(), id)]],
      ),
    ),
  );
}
