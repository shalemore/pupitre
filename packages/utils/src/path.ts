import { decodeUriPart } from "./uri";

/** The path of a file URL, with Windows drive letters and UNC hosts read the way the file system has them. */
export function pathFromFileUrl(url: URL): string {
  const host = decodeUriPart(url.host);
  const path = decodeUriPart(url.pathname).replace(/^\/(?=[A-Za-z]:)/, "");
  return host === "" ? path : `//${host}${path}`;
}
