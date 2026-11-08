/** The last segment of a path, whatever separator it uses. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
