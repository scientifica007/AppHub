/** Speech-only, ephemeral text helpers. No access to IndexedDB or saved ideas. */
const tokens = text => String(text ?? '').trim().split(/\s+/u).filter(Boolean);
const canonical = value => String(value).normalize('NFKC').toLocaleLowerCase('ar')
  .replace(/[\u064b-\u065f\u0670\u0640]/gu, '').replace(/[أإآٱ]/gu, 'ا')
  .replace(/ى/gu, 'ي').replace(/[^\p{L}\p{N}]/gu, '');

/** Suppress replay of 2+ adjacent words on recognition restarts.
 * One-word repetition is intentionally retained to avoid deleting genuine dictation.
 */
export function withoutReplay(existing, incoming, minimum = 2) {
  const a = tokens(existing), b = tokens(incoming);
  for (let overlap = Math.min(a.length, b.length, 35); overlap >= minimum; overlap--) {
    if (a.slice(-overlap).every((word, i) => canonical(word) && canonical(word) === canonical(b[i]))) {
      return b.slice(overlap).join(' ');
    }
  }
  return String(incoming ?? '').trim();
}

export function appendRecognized(existing, incoming, { restart = false } = {}) {
  const addition = String(incoming ?? '').trim();
  if (!addition) return String(existing ?? '');
  const previous = String(existing ?? '');
  const novel = withoutReplay(previous, addition, restart ? 2 : 3);
  if (!novel) return previous;
  return previous + (!previous || /\s$/u.test(previous) ? '' : ' ') + novel;
}