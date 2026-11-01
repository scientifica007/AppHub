import { categoryName, normalizeArabic } from './core.mjs';

const collator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true, ignorePunctuation: true });

export function firstSignificantLetter(text) {
  return (normalizeArabic(text).match(/[\p{L}\p{N}]/u)?.[0] ?? '#').toLocaleUpperCase('ar');
}
function alphabetical(a,b) {
  return collator.compare(firstSignificantLetter(a.title),firstSignificantLetter(b.title)) || collator.compare(a.title,b.title);
}

/** Sorts a new array without mutating stored ideas; deterministic tie-breaking. */
export function orderIdeas(items, by = 'newest') {
  const copy = [...items];
  const dateDesc = (a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  switch (by) {
    case 'oldest': return copy.sort((a,b)=>-dateDesc(a,b));
    case 'alphabetical': return copy.sort((a,b)=>alphabetical(a,b) || dateDesc(a,b));
    case 'alphabetical-desc': return copy.sort((a,b)=>alphabetical(b,a) || dateDesc(a,b));
    case 'category': return copy.sort((a,b)=>collator.compare(categoryName(a.category),categoryName(b.category)) || alphabetical(a,b) || dateDesc(a,b));
    default: return copy.sort(dateDesc);
  }
}
