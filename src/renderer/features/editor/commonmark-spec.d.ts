// The CommonMark specification's examples, which ship without type declarations
declare module "commonmark-spec" {
  export interface SpecExample {
    markdown: string;
    html: string;
    section: string;
    number: number;
  }

  export const tests: readonly SpecExample[];
}
