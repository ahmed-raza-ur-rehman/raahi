/**
 * "Did you mean": typo tolerance for searches that find nothing.
 *
 * People type fast, on phones, in a second language ("scholrship", "germny", "enginering"). When a search comes back
 * empty, each word that appears nowhere in the live listings is compared with the words that do, and replaced by the
 * closest one — but only when that is a small, unambiguous edit. The corrected search is run, and the page says
 * plainly what was changed, so nobody is silently shown something they did not ask for.
 *
 * Pure functions: the store supplies the vocabulary.
 */

export interface Correction {
  from: string;
  to: string;
}

/** Lower-cased words of three or more letters/digits. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

export function buildVocabulary(texts: Iterable<string>): Map<string, number> {
  const vocabulary = new Map<string, number>();
  for (const text of texts) {
    for (const word of wordsOf(text)) vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1);
  }
  return vocabulary;
}

/** Optimal-string-alignment distance: insert, delete, substitute, or swap two neighbouring letters — one edit each. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Words of 4 or fewer letters are too ambiguous to fix; longer words may be off by one or two letters. */
function allowedEdits(length: number): number {
  if (length <= 4) return length === 4 ? 1 : 0;
  return length <= 7 ? 1 : 2;
}

/** Is `word` in the vocabulary, or the beginning of something in it ("engin" → "engineering")? */
export function isKnown(word: string, vocabulary: Map<string, number>): boolean {
  if (vocabulary.has(word)) return true;
  if (word.length < 3) return false;
  for (const known of vocabulary.keys()) if (known.startsWith(word)) return true;
  return false;
}

/**
 * The closest vocabulary word within the allowed edits, or undefined when the word is already known or nothing is
 * close enough. A two-edit fix additionally needs the same first letter (people rarely mistype the first one).
 */
export function correctWord(word: string, vocabulary: Map<string, number>): string | undefined {
  const lower = word.toLowerCase();
  const limit = allowedEdits(lower.length);
  if (limit === 0 || isKnown(lower, vocabulary)) return undefined;

  let best: { word: string; distance: number; count: number } | undefined;
  for (const [candidate, count] of vocabulary) {
    if (Math.abs(candidate.length - lower.length) > limit) continue;
    const distance = editDistance(lower, candidate);
    if (distance === 0 || distance > limit) continue;
    if (distance === 2 && candidate[0] !== lower[0]) continue;
    if (!best || distance < best.distance || (distance === best.distance && count > best.count)) best = { word: candidate, distance, count };
  }
  return best?.word;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace each unknown word of `raw` by its correction. Undefined when nothing needed (or could be) fixed. */
export function correctQuery(raw: string, terms: string[], vocabulary: Map<string, number>): { q: string; changes: Correction[] } | undefined {
  let q = raw;
  const changes: Correction[] = [];
  for (const term of new Set(terms.map((value) => value.toLowerCase()))) {
    const fix = correctWord(term, vocabulary);
    if (!fix) continue;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term)}(?=$|[^\\p{L}\\p{N}])`, "giu");
    if (!pattern.test(q)) continue;
    q = q.replace(pattern, (_, lead: string) => `${lead}${fix}`);
    changes.push({ from: term, to: fix });
  }
  return changes.length > 0 ? { q, changes } : undefined;
}
