import type { UpdateStatus } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { createSignal } from "solid-js";

const [updateStatus, setUpdateStatus] = createSignal<UpdateStatus>({ kind: "idle" });
void desktop.invoke("updater:get-status").then(setUpdateStatus);
desktop.on("updater:status", setUpdateStatus);

export { updateStatus };
