import { categoryName } from './core.mjs';

const collator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

/** Sorts a new array without mutating stored ideas; deterministic tie-breaking. */
export function orderIdeas(items, by = 'newest') {
  const copy = [...items];
  const dateDesc = (a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  switch (by) {
    case 'oldest': return copy.sort((a,b)=>-dateDesc(a,b));
    case 'alphabetical': return copy.sort((a,b)=>collator.compare(a.title,b.title) || dateDesc(a,b));
    case 'alphabetical-desc': return copy.sort((a,b)=>collator.compare(b.title,a.title) || dateDesc(a,b));
    case 'category': return copy.sort((a,b)=>collator.compare(categoryName(a.category),categoryName(b.category)) || collator.compare(a.title,b.title) || dateDesc(a,b));
    default: return copy.sort(dateDesc);
  }
}
