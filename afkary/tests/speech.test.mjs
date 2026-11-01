import test from 'node:test';
import assert from 'node:assert/strict';
import {appendRecognized,withoutReplay} from '../src/speech-buffer.mjs';
import {SpeechLedger} from '../src/speech-ledger.mjs';
import {readFile} from 'node:fs/promises';
const f=(s,isFinal)=>Object.assign([{transcript:s}],{isFinal});
test('final result replay is suppressed within a session',()=>{
 assert.equal(appendRecognized('مرحبا بكم في التطبيق','مرحبا بكم في التطبيق'),'مرحبا بكم في التطبيق');
});
test('restart removes two-word replay and retains new words',()=>{
 assert.equal(appendRecognized('مرحبا بكم في التطبيق','في التطبيق الآن',{restart:true}),'مرحبا بكم في التطبيق الآن');
});
test('intentional one-word repetitions are preserved',()=>{
 assert.equal(withoutReplay('نعم','نعم'),'نعم');
 assert.equal(appendRecognized('نعم','نعم',{restart:true}),'نعم نعم');
});
test('Arabic orthographic variants do not repeat the same phrase',()=>{
 assert.equal(appendRecognized('هذا إختبار للإملاء الصوتي','للاملاء الصوتي مفيد',{restart:true}),'هذا إختبار للإملاء الصوتي مفيد');
});
test('empty updates do not change the draft',()=>{
 assert.equal(appendRecognized('نص سابق',''),'نص سابق');
});
test('old ledger remains importable and does not mutate stored ideas',()=>{
 const l=new SpeechLedger('قديم');l.nextSession();l.ingest([f('جملة طويلة من الكلام',true)]);l.finalize();
 assert.equal(l.text(),'قديم جملة طويلة من الكلام');
});
test('recognition is final-only, session-index deduplicated and explicitly inserted',async()=>{
 const s=await readFile(new URL('../src/speech.mjs',import.meta.url),'utf8');
 assert.match(s,/recognition\.interimResults=false/);
 assert.match(s,/seenFinal\.has\(i\)/);
 assert.match(s,/input\.insertAdjacentElement\('afterend',wrap\)/);
 assert.match(s,/input\.value=combineWithIdea\(input\.value,text\)/);
 assert.match(s,/emptyStops>=6/);
 assert.match(s,/لا يوفّر المتصفح/);
 assert.doesNotMatch(s,/localStorage\.setItem|indexedDB\.open|fetch\(/);
});
test('three archive layouts and three focus actions remain available',async()=>{
 const root=new URL('../',import.meta.url);
 const [html,css,archive]=await Promise.all(['index.html','styles.css','src/archive.mjs'].map(p=>readFile(new URL(p,root),'utf8')));
 assert.match(html,/id="dictate-button"/);
 assert.match(css,/body\.focus-mode \.composer-footer\{display:flex;flex-direction:row/);
 assert.match(archive,/state\.layout==='vertical'/);
 assert.match(archive,/layout-\$\{state\.layout\}/);
});
