import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { type EditorView, WidgetType } from "@codemirror/view";
import { Check, Copy } from "lucide-solid";
import { createMemo, createSignal, For, onCleanup, Show, type Component } from "solid-js";
import { render } from "solid-js/web";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";

const COPIED_MS = 1500;

/**
 * The part of a fence line that names the language: everything after the opening backticks. A pick
 * replaces it, so a fence without a language gets one and one that has a language keeps the
 * spacing it was written with.
 */
export interface FenceInfo {
  /** The info string as written, empty when the fence names no language. */
  readonly language: string;
  readonly from: number;
  readonly to: number;
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
  return LanguageDescription.matchLanguageName(languages, language.match(/\S*/)?.[0] ?? "", true);
}

/**
 * The languages a fence can name, by the name they are known under. A grammar whose names all
 * hold a space — MariaDB SQL, MS SQL, Closure Stylesheets, RPM Changes, RPM Spec, Tiki wiki,
 * Web IDL and Angular Template — is left out: an info string ends at the first space, so no fence
 * can name it.
 */
const LANGUAGE_CHOICES: readonly LanguageChoice[] = languages
  .flatMap((language) => {
    const tag = fenceTag(language);
    return tag === undefined ? [] : [{ tag, name: language.name }];
  })
  .toSorted((a, b) => a.name.localeCompare(b.name));

const CodeCorner: Component<{
  view: EditorView;
  code: string;
  fence: FenceInfo | undefined;
}> = (props) => {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

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
    // The fence line is hidden, so the change is the only way the language is edited
    props.view.dispatch({
      changes: { from: fence.from, to: fence.to, insert: tag === "" ? "" : ` ${tag}` },
      userEvent: "input.format",
    });
    // The element the pick came from went away with the widget it was in; the text has the caret
    props.view.focus();
  };

  return (
    <>
      <Show when={props.fence}>
        <select
          class="md-code-language"
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
        class="md-code-copy"
        title={t().common.copy}
        aria-label={t().common.copy}
        data-copied={copied() ? "" : undefined}
        // Keeps the editor's selection; the button is not a place to put the cursor
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          void desktop.invoke("clipboard:write-text", props.code).then(() => {
            setCopied(true);
            clearTimeout(timer);
            timer = setTimeout(() => setCopied(false), COPIED_MS);
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
  return a.language === b.language && a.from === b.from && a.to === b.to;
}

/**
 * The top corner of a code block: the language the fence names, as a picker while the fence line is
 * hidden, and a button that copies the code without the fences.
 */
export class CodeCornerWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly fence: FenceInfo | undefined,
  ) {
    super();
  }

  override eq(other: CodeCornerWidget): boolean {
    return other.code === this.code && sameFence(other.fence, this.fence);
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("span");
    container.className = "md-code-corner";
    disposers.set(
      container,
      render(() => <CodeCorner view={view} code={this.code} fence={this.fence} />, container),
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
