/**
 * A file `public/` holds, which the build copies beside the page rather than bundling.
 *
 * Solid reads a literal `src` on a JSX element as an import of a file beside the component, and
 * this one is not beside it: the path goes through a constant so the compiler leaves it alone.
 */
export const PUBLIC_LOGO = "./logo.svg";
