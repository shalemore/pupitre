import { cn } from "cn";
import { X } from "lucide-solid";
import { createEffect, type JSX, onCleanup, Show, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: JSX.Element;
}

export function Dialog(props: DialogProps) {
  createEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onOpenChange?.(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.open}>
      <Portal>{props.children}</Portal>
    </Show>
  );
}

export interface DialogOverlayProps extends JSX.HTMLAttributes<HTMLDivElement> {
  onClick?: (e: MouseEvent) => void;
}

export function DialogOverlay(props: DialogOverlayProps) {
  const [local, rest] = splitProps(props, ["class", "onClick"]);
  return (
    <div
      data-slot="dialog-overlay"
      onClick={local.onClick}
      class={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-(--duration-ui) ease-(--ease-emphasized)",
        local.class,
      )}
      {...rest}
    />
  );
}

export interface DialogContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function DialogContent(props: DialogContentProps) {
  const [local, rest] = splitProps(props, ["class", "children", "onClose", "showCloseButton"]);

  return (
    <div
      data-slot="dialog-content"
      role="dialog"
      aria-modal="true"
      class={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border/80 bg-surface-2 p-6 text-foreground shadow-float outline-none animate-in fade-in-0 zoom-in-95 duration-(--duration-ui) ease-(--ease-emphasized)",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <Show when={local.showCloseButton ?? true}>
        <button
          type="button"
          data-slot="dialog-close"
          onClick={local.onClose}
          aria-label="Close"
          class="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X class="size-4" />
        </button>
      </Show>
    </div>
  );
}

export function DialogHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dialog-header"
      class={cn("flex flex-col gap-1.5 text-start", local.class)}
      {...rest}
    />
  );
}

export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <h2
      data-slot="dialog-title"
      class={cn("text-base font-semibold leading-none tracking-tight text-foreground", local.class)}
      {...rest}
    />
  );
}

export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p
      data-slot="dialog-description"
      class={cn("text-xs text-muted-foreground leading-normal", local.class)}
      {...rest}
    />
  );
}

export function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dialog-footer"
      class={cn("flex items-center justify-end gap-2 pt-2", local.class)}
      {...rest}
    />
  );
}
