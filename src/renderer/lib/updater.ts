import type { UpdateStatus } from "@shared/desktop-api";
import { createSignal } from "solid-js";
import { desktop } from "@/lib/desktop";

const [updateStatus, setUpdateStatus] = createSignal<UpdateStatus>({ kind: "idle" });
void desktop.invoke("updater:get-status").then(setUpdateStatus);
desktop.on("updater:status", setUpdateStatus);

export { updateStatus };
