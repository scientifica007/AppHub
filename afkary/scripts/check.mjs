import { readFile,access } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
for(const p of ['index.html','archive.html','gallery.html','list.html','styles.css','src/app.mjs','src/store.mjs','src/model.mjs','src/archive.mjs','src/speech.mjs','src/speech-ledger.mjs','src/speech-buffer.mjs'])await access(new URL(p,root));
const code=await readFile(new URL('src/archive.mjs',root),'utf8');
if(code.length<7000||!code.includes('async function refresh()')||!code.includes('function showIdea(idea)'))throw Error('Archive module incomplete: release blocked');
const recognition=await readFile(new URL('src/speech.mjs',root),'utf8');
if(recognition.length<8500 || !recognition.includes('recognition.interimResults=false') || !recognition.includes('input.insertAdjacentElement')) throw Error('Speech dictation module is incomplete; release blocked');
console.log('Afkary release assets validated.');
