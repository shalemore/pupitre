import { stat } from "node:fs/promises";

/** Whether anything is at `path`; any failure, a permission one included, counts as absent. */
export async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}
