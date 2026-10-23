import { WidgetType } from "@codemirror/view";
import { Check, Copy } from "lucide-solid";
import { createSignal, onCleanup, Show, type Component } from "solid-js";
import { render } from "solid-js/web";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";

const COPIED_MS = 1500;

const CodeCorner: Component<{ code: string; language: string | undefined }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  return (
    <>
      <Show when={props.language}>
        <span>{props.language}</span>
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

/**
 * The top corner of a code block: its language, while the fence line is hidden, and a button that
 * copies the code without the fences.
 */
export class CodeCornerWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly language: string | undefined,
  ) {
    super();
  }

  override eq(other: CodeCornerWidget): boolean {
    return other.code === this.code && other.language === this.language;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "md-code-corner";
    disposers.set(
      container,
      render(() => <CodeCorner code={this.code} language={this.language} />, container),
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
