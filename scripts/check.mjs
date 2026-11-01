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
for(const extra of ['afkary/src/speech-buffer.mjs','afkary/docs/SPEECH_DICTATION_UX_042.md']) await access(new URL(extra,root));
const voice=await readFile(new URL('afkary/src/speech.mjs',root),'utf8');
if(voice.length<8500 || !voice.includes('recognition.interimResults=false') || !voice.includes('input.insertAdjacentElement'))throw new Error('Afkary dictation module incomplete.');
for(const font of ['regular','medium','bold'])await access(new URL(`assets/fonts/${font}.ttf`,root));
await access(new URL('assets/fonts/OFL.txt',root));

const archiveModule=await readFile(new URL('afkary/src/archive.mjs',root),'utf8');
const archivePage=await readFile(new URL('afkary/archive.html',root),'utf8');
if(archiveModule.length < 7000) throw new Error('Afkary archive module appears truncated. Refusing to deploy.');
for (const marker of [
  "from './store.mjs'", 'async function refresh()', 'function showIdea(idea)',
  'function render()', 'function bind()', 'restoreIdea', 'deletePermanently', 'start();'
]) {
  if (!archiveModule.includes(marker)) throw new Error('Afkary archive is missing: ' + marker);
}
if (!archivePage.includes('src="./src/archive.mjs"') || !archivePage.includes('id="view-grid"')) {
  throw new Error('Afkary unified archive page is incomplete.');
}
const speechModule=await readFile(new URL('afkary/src/speech.mjs',root),'utf8');
const ledgerModule=await readFile(new URL('afkary/src/speech-ledger.mjs',root),'utf8');
const afkaryHome=await readFile(new URL('afkary/index.html',root),'utf8');
if(speechModule.length<8500||ledgerModule.length<1600||!speechModule.includes("from './speech-buffer.mjs'")||!speechModule.includes('recognition.interimResults=false'))throw Error('Afkary reviewed speech assets incomplete; refusing AppHub deployment');
if(!afkaryHome.includes('src/app.mjs?v=0.4.2')||!afkaryHome.includes('id="dictate-button"'))throw Error('Afkary entrypoint inconsistent with speech release');
console.log(`AppHub checks passed: ${catalog.categories.length} categories, ${catalog.apps.length} published apps; local assets and Arabic pages valid.`);
