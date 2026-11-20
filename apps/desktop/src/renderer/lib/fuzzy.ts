/** One run of characters a query matched, as offsets into the text it was matched against. */
export interface MatchRange {
  from: number;
  to: number;
}

interface LoweredChar {
  /** The character as it is compared, which is what makes matching ignore case. */
  char: string;
  start: number;
  /** Where the character ends in the text, past the code units its lowercase form takes. */
  end: number;
}

/**
 * The characters of a text in the order a query is matched against them, with the place each
 * takes in the text. Lowering one character at a time keeps those places, which a match reports
 * so a row can show what it matched; lowering the whole text at once would move them.
 */
function* loweredChars(text: string): Generator<LoweredChar> {
  let offset = 0;
  for (const source of text) {
    const end = offset + source.length;
    for (const char of source.toLowerCase()) yield { char, start: offset, end };
    offset = end;
  }
}

/**
 * Where in the text the characters of a query were found, in that order and ignoring case, the way
 * "tsb" finds "Toggle Sidebars"; undefined when they are not all there. Characters found next to
 * each other make one range. A query with nothing in it matches any text.
 */
export function matchRanges(text: string, query: string): MatchRange[] | undefined {
  const wanted = Array.from(query.toLowerCase());
  const ranges: MatchRange[] = [];
  let at = 0;
  for (const { char, start, end } of loweredChars(text)) {
    if (at === wanted.length) break;
    if (char !== wanted[at]) continue;
    at += 1;
    const last = ranges.at(-1);
    if (last !== undefined && last.to === start) last.to = end;
    else ranges.push({ from: start, to: end });
  }
  return at === wanted.length ? ranges : undefined;
}
