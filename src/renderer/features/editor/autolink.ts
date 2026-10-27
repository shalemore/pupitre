import type { InlineContext, MarkdownConfig } from "@lezer/markdown";

/**
 * GFM autolinks a bare URL up to the next whitespace. Chinese writes without spaces, so a URL
 * followed by prose takes the prose with it — `https://example.com/，下一句` becomes one URL that
 * opens a broken address. This parser runs before GFM's and ends a URL at the punctuation that
 * closes a Chinese sentence or phrase, leaving every other URL to GFM.
 *
 * The punctuation can also sit inside a path, but reading it as prose is what the writer meant in
 * nearly every case; a URL that needs one can be written as a link or between angle brackets.
 */
const URL_START = /(?:https?:\/\/|www\.)/y;
const CJK_PUNCTUATION = /[，。、；：！？…—（）【】「」『』《》〈〉〔〕｛｝［］]/;
const URL = /^(?:https?:\/\/|www\.)[\w-]+(?:\.[\w-]+)+(?::\d+)?(?:\/[^\s<]*)?$/;
const HOST = /^(?:https?:\/\/|www\.)[\w-]+(?:\.[\w-]+)+(?::\d+)?/;
/** Trailing punctuation GFM strips from a bare URL, such as the full stop that ends the sentence. */
const SENTENCE_PUNCTUATION = /[?!.,:*_~]/;
/** What GFM keeps of a URL inside an open link label, where brackets end the address. */
const OUTSIDE_BRACKETS = /([^[\]]|\[[^\]]*\])*/;

function closingCount(text: string, end: number): number {
  let open = 0;
  let close = 0;
  for (let pos = 0; pos < end; pos++) {
    if (text[pos] === "(") open++;
    else if (text[pos] === ")") close++;
  }
  return close - open;
}

/** `candidate` without the sentence punctuation GFM drops, which still ends the URL before it. */
function trimSentencePunctuation(candidate: string): string {
  let end = candidate.length;
  for (;;) {
    const last = candidate[end - 1];
    if (last === undefined) break;
    if (SENTENCE_PUNCTUATION.test(last) || (last === ")" && closingCount(candidate, end) > 0)) {
      end--;
    } else {
      break;
    }
  }
  return candidate.slice(0, end);
}

/** The URL that ends at the first Chinese punctuation in `context`, or undefined when none does. */
function urlBeforeCjkPunctuation(context: InlineContext, pos: number): number | undefined {
  const rest = context.slice(pos, context.end);
  URL_START.lastIndex = 0;
  const start = URL_START.exec(rest);
  if (!start) return undefined;
  const punctuation = CJK_PUNCTUATION.exec(rest.slice(start[0].length));
  if (!punctuation) return undefined;
  const candidate = trimSentencePunctuation(rest.slice(0, start[0].length + punctuation.index));
  if (!URL.test(candidate)) return undefined;
  if (HOST.exec(candidate)?.[0].includes("_") === true) return undefined;
  // Inside an open link label the address ends at a bracket, as GFM's own autolink does
  const bounded = context.hasOpenLink ? (OUTSIDE_BRACKETS.exec(candidate)?.[0] ?? "") : candidate;
  return URL.test(bounded) ? pos + bounded.length : undefined;
}

export const cjkAutolink: MarkdownConfig = {
  parseInline: [
    {
      name: "CjkAutolink",
      before: "Autolink",
      parse(context, _next, pos) {
        // A URL starts at a word boundary, so the `www.` of `awww.example.com` stays text
        if (/\w/.test(context.slice(pos - 1, pos))) return -1;
        const end = urlBeforeCjkPunctuation(context, pos);
        if (end === undefined) return -1;
        context.addElement(context.elt("URL", pos, end));
        return end;
      },
    },
  ],
};
