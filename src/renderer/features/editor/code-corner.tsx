import { LanguageDescription, syntaxTree } from "@codemirror/language";
import { type EditorView, WidgetType } from "@codemirror/view";
import { debounce } from "@solid-primitives/scheduled";
import { Check, Copy } from "lucide-solid";
import { createMemo, createSignal, For, Show, type Component } from "solid-js";
import { render } from "solid-js/web";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { css } from "@/styled-system/css";
import { fencedText } from "./block-text";
import { codeLanguages } from "./code-languages";

const COPIED_MS = 1500;

const languagePicker = css({
  fieldSizing: "content",
  maxWidth: "32",
  minWidth: 0,
  marginInline: "-1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  appearance: "none",
  borderRadius: "sm",
  borderWidth: 0,
  backgroundColor: "transparent",
  paddingInline: "1",
  paddingBlock: "0.5",
  cursor: "pointer",
  layerStyle: "interactive",
  _hover: { backgroundColor: "accent", color: "foreground" },
  _focusVisible: { outlineStyle: "none", boxShadow: "focus" },
});
const corner = css({
  position: "absolute",
  zIndex: 1,
  top: "var(--md-code-corner-gap)",
  insetInlineEnd: "2",
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  fontFamily: "sans",
  fontSize: "xs",
  lineHeight: "1",
  color: "tertiary",
  userSelect: "none",
});
const copy = css({
  display: "grid",
  width: "var(--md-code-corner-size)",
  height: "var(--md-code-corner-size)",
  placeItems: "center",
  borderRadius: "sm",
  borderWidth: 0,
  backgroundColor: "transparent",
  padding: 0,
  opacity: 0.6,
  cursor: "pointer",
  transitionProperty: "opacity, color, background-color",
  transitionDuration: "ui",
  transitionTimingFunction: "outExpo",
  _hover: { backgroundColor: "accent", color: "foreground", opacity: 1 },
  "&[data-copied]": { opacity: 1, color: "success" },
  "& svg": { width: "3.5", height: "3.5" },
  _print: { display: "none" },
});

/**
 * The part of a fence line that names the language: everything after the opening backticks. A pick
 * replaces it, so a fence without a language gets one and one that has a language keeps the
 * spacing it was written with.
 */
export interface FenceInfo {
  /** The info string as written, empty when the fence names no language. */
  readonly language: string;
  /** The range of the first word of the info string, or of the point it would start at. */
  readonly from: number;
  readonly to: number;
  /** The whole tail after the opening mark, so Plain text can take its attributes away too. */
  readonly tailFrom: number;
  readonly tailTo: number;
}

interface LanguageChoice {
  /** What the info string is set to; empty for plain text, which takes it away. */
  readonly tag: string;
  readonly name: string;
}

/** The word that names `language` in a fence, whose info string ends at the first space. */
function fenceTag(language: LanguageDescription): string | undefined {
  return [language.name, ...language.alias].find((name) => !/\s/.test(name));
}

/**
 * The language a fence names, read the way the Markdown parser reads it: the first word of the
 * info string, matched against the names and aliases of the known grammars.
 */
function namedLanguage(language: string): LanguageDescription | null {
  return LanguageDescription.matchLanguageName(
    codeLanguages,
    language.match(/\S*/)?.[0] ?? "",
    true,
  );
}

/** The languages a fence can name, by the name they are known under. */
const LANGUAGE_CHOICES: readonly LanguageChoice[] = codeLanguages
  .flatMap((language) => {
    const tag = fenceTag(language);
    return tag === undefined ? [] : [{ tag, name: language.name }];
  })
  .toSorted((a, b) => a.name.localeCompare(b.name));

/** Reads the code of the block whose corner sits at `container`, only when the copy button is pressed. */
function readBlockCode(view: EditorView, container: HTMLElement): string {
  const pos = view.posAtDOM(container);
  for (
    let node: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(
      view.state,
    ).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "CodeBlock") {
      return view.state.sliceDoc(node.from, node.to).replace(/^(?: {4}|\t)/gm, "");
    }
    if (node.name === "FencedCode") {
      return fencedText(view.state, node);
    }
  }
  return "";
}

const CodeCorner: Component<{
  view: EditorView;
  container: HTMLElement;
  fence: FenceInfo | undefined;
}> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const resetCopied = debounce(() => setCopied(false), COPIED_MS);

  const language = createMemo(() => namedLanguage(props.fence?.language ?? ""));

  // A language the list knows shows the name it is listed under; one it does not, such as a block
  // the app renders itself (mermaid), shows the word the fence has
  const current = () => {
    const fence = props.fence;
    if (!fence) return "";
    const named = language();
    return named ? (fenceTag(named) ?? fence.language) : fence.language;
  };

  const choices = (): readonly LanguageChoice[] => {
    const fence = props.fence;
    const plain = { tag: "", name: t().editor.codeLanguagePlain };
    // The language of the document is kept as a choice, so opening the picker cannot lose it
    if (fence && fence.language !== "" && language() === null) {
      return [plain, ...LANGUAGE_CHOICES, { tag: fence.language, name: fence.language }];
    }
    return [plain, ...LANGUAGE_CHOICES];
  };

  const pick = (tag: string) => {
    const fence = props.fence;
    if (!fence) return;
    // The fence line is hidden, so the change is the only way the language is edited. A language
    // replaces only its word, leaving attributes such as title=x after it; Plain text drops the
    // whole info string.
    const change =
      tag === ""
        ? { from: fence.tailFrom, to: fence.tailTo, insert: "" }
        : fence.language === ""
          ? { from: fence.tailFrom, to: fence.tailTo, insert: ` ${tag}` }
          : { from: fence.from, to: fence.to, insert: tag };
    props.view.dispatch({
      changes: change,
      userEvent: "input.format",
    });
    // The element the pick came from went away with the widget it was in; the text has the caret
    props.view.focus();
  };

  return (
    <>
      <Show when={props.fence}>
        <select
          // Interface rather than document, sized in rem so the block's smaller em does not shrink it
          class={languagePicker}
          aria-label={t().editor.codeLanguage}
          title={t().editor.codeLanguage}
          value={current()}
          onChange={(event) => pick(event.currentTarget.value)}
        >
          <For each={choices()}>
            {(choice) => <option value={choice.tag}>{choice.name}</option>}
          </For>
        </select>
      </Show>
      <button
        type="button"
        class={copy}
        title={t().common.copy}
        aria-label={t().common.copy}
        data-copied={copied() ? "" : undefined}
        // Keeps the editor's selection; the button is not a place to put the cursor
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const code = readBlockCode(props.view, props.container);
          void desktop.invoke("clipboard:write-text", code).then(() => {
            setCopied(true);
            resetCopied();
          });
        }}
      >
        <Show when={copied()} fallback={<Copy />}>
          <Check />
        </Show>
      </button>
    </>
  );
};

const disposers = new WeakMap<HTMLElement, () => void>();

/** Whether two corners stand for the same pick at the same place in the document. */
function sameFence(a: FenceInfo | undefined, b: FenceInfo | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.language === b.language &&
    a.from === b.from &&
    a.to === b.to &&
    a.tailFrom === b.tailFrom &&
    a.tailTo === b.tailTo
  );
}

/**
 * The top corner of a code block: the language the fence names, as a picker while the fence line is
 * hidden, and a button that copies the code without the fences.
 */
export class CodeCornerWidget extends WidgetType {
  constructor(readonly fence: FenceInfo | undefined) {
    super();
  }

  override eq(other: CodeCornerWidget): boolean {
    return sameFence(other.fence, this.fence);
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("span");
    // Above the code lines it overlaps while the fence line is shrunk; interface rather than
    // document, so it is sized in rem and does not shrink with the block's em
    container.className = corner;
    disposers.set(
      container,
      render(() => <CodeCorner view={view} container={container} fence={this.fence} />, container),
    );
    return container;
  }

  override destroy(dom: HTMLElement): void {
    disposers.get(dom)?.();
  }

  override ignoreEvent(): boolean {
    return true;
  }
}
