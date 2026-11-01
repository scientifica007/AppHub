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
for(const asset of ['afkary/index.html','afkary/list.html','afkary/favicon.svg','afkary/styles.css','afkary/src/app.mjs','afkary/src/list.mjs','afkary/src/time.mjs','afkary/src/workspace.mjs','afkary/src/core.mjs','afkary/src/store.mjs']) await access(new URL(asset,root));
for(const font of ['regular','medium','bold'])await access(new URL(`assets/fonts/${font}.ttf`,root));
await access(new URL('assets/fonts/OFL.txt',root));

const galleryModule=await readFile(new URL('afkary/src/gallery.mjs',root),'utf8');
const galleryPage=await readFile(new URL('afkary/gallery.html',root),'utf8');
if (galleryModule.length < 4500) throw new Error('Afkary gallery module is truncated. Refusing to deploy AppHub.');
for (const marker of [
  "from './core.mjs'", "from './order.mjs'", "from './store.mjs'",
  "from './theme.mjs'", "from './time.mjs'",
  'function render()', 'function showDetail(id)', 'function bind()',
  'async function start()', 'initTheme();bind();', 'start();'
]) {
  if (!galleryModule.includes(marker)) throw new Error('Afkary gallery is missing required code: ' + marker);
}
if (!/src="\.\/src\/gallery\.mjs(?:\?[^"]*)?"/.test(galleryPage)) {
  throw new Error('Afkary gallery page does not load its verified module.');
}
console.log(`AppHub checks passed: ${catalog.categories.length} categories, ${catalog.apps.length} published apps; local assets and Arabic pages valid.`);
