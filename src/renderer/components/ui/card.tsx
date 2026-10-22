import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card"
      class={cn(
        "rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-card transition-all",
        local.class,
      )}
      {...rest}
    />
  );
}

export function CardHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div data-slot="card-header" class={cn("flex flex-col gap-1 pb-3", local.class)} {...rest} />
  );
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <h3
      data-slot="card-title"
      class={cn("text-sm font-medium leading-none tracking-tight text-foreground", local.class)}
      {...rest}
    />
  );
}

export function CardDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p
      data-slot="card-description"
      class={cn("text-xs text-muted-foreground leading-normal", local.class)}
      {...rest}
    />
  );
}

export function CardContent(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div data-slot="card-content" class={cn("text-xs", local.class)} {...rest} />;
}

export function CardFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-footer"
      class={cn("flex items-center pt-3 border-t border-border/50", local.class)}
      {...rest}
    />
  );
}
