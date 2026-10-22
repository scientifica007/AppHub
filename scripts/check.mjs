import { readFile, access } from 'node:fs/promises';
import { validateCatalog } from '../assets/catalog.js';
const root=new URL('../',import.meta.url);
const catalog=validateCatalog(JSON.parse(await readFile(new URL('data/apps.json',root),'utf8')));
for(const page of ['index.html','admin.html']) {
  const html=await readFile(new URL(page,root),'utf8');
  if(!html.includes('lang="ar" dir="rtl"')) throw new Error(`${page}: Arabic RTL metadata missing.`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length) throw new Error(`${page}: Duplicate HTML IDs.`);
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)) await access(new URL(m[1],root));
}
for(const font of ['regular','medium','bold'])await access(new URL(`assets/fonts/${font}.ttf`,root));
await access(new URL('assets/fonts/OFL.txt',root));
console.log(`AppHub checks passed: ${catalog.categories.length} categories, ${catalog.apps.length} published apps; local assets and Arabic pages valid.`);
