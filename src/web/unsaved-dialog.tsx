import { onMount, type Component } from "solid-js";
import { render } from "solid-js/web";
import type { UnsavedChoice } from "@shared/desktop-api";
import { Button } from "@/components/ui/button";

interface UnsavedDialogLabels {
  message: string;
  detail: string;
  save: string;
  dontSave: string;
  cancel: string;
}

interface UnsavedDialogProps extends UnsavedDialogLabels {
  onChoose: (choice: UnsavedChoice) => void;
}

const UnsavedDialog: Component<UnsavedDialogProps> = (props) => {
  let dialog: HTMLDialogElement | undefined;

  const choose = (choice: UnsavedChoice) => {
    dialog?.close();
    props.onChoose(choice);
  };

  onMount(() => dialog?.showModal());

  return (
    <dialog
      ref={(element) => (dialog = element)}
      class="floating-panel m-auto w-[min(24rem,calc(100vw-2rem))] p-6 text-sm text-foreground backdrop:bg-black/30"
      aria-labelledby="pupitre-unsaved-message"
      onCancel={(event) => {
        event.preventDefault();
        choose("cancel");
      }}
    >
      <p id="pupitre-unsaved-message" class="font-medium">
        {props.message}
      </p>
      <p class="mt-2 text-xs text-muted-foreground">{props.detail}</p>
      <div class="mt-6 flex justify-end gap-2">
        <Button autofocus onClick={() => choose("save")}>
          {props.save}
        </Button>
        <Button variant="ghost" onClick={() => choose("discard")}>
          {props.dontSave}
        </Button>
        <Button variant="ghost" onClick={() => choose("cancel")}>
          {props.cancel}
        </Button>
      </div>
    </dialog>
  );
};

/** Shows the unsaved-changes question the web demo's host asks, and resolves with the answer. */
export function showUnsavedDialog(labels: UnsavedDialogLabels): Promise<UnsavedChoice> {
  const container = document.createElement("div");
  document.body.append(container);
  const { promise, resolve } = Promise.withResolvers<UnsavedChoice>();
  let dispose: (() => void) | undefined;
  const finish = (choice: UnsavedChoice) => {
    dispose?.();
    container.remove();
    resolve(choice);
  };
  dispose = render(() => <UnsavedDialog {...labels} onChoose={finish} />, container);
  return promise;
}
