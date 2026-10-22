import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCatalog,filterApps,safeURL,escapeHTML,normalize} from '../assets/catalog.js';
const source=JSON.parse(await readFile(new URL('../data/apps.json',import.meta.url),'utf8'));
function fixture() {return {schemaVersion:1,categories:['education','productivity','games'].map(id=>({id,name:id,description:'test',icon:'grid',color:'green'})),apps:[
  {id:'first',title:'أَدَاة التعلّم',description:'للتعليم والتدريب',category:'education',url:'https://example.com/learn',status:'available',icon:'book',color:'green',featured:false,visible:true,tags:['دروس'],addedAt:'2026-10-20',order:2},
  {id:'second',title:'العمل',description:'مهام المكتب',category:'productivity',url:'https://example.com/work',status:'beta',icon:'layers',color:'blue',featured:true,visible:true,tags:['تنظيم'],addedAt:'2026-10-18',order:0},
  {id:'third',title:'تجربة',description:'لاحقًا',category:'games',url:'',status:'coming-soon',icon:'game',color:'purple',featured:false,visible:false,tags:[],addedAt:'2026-10-22',order:1}
]};}
test('production catalog is valid and independent of demonstration data',()=>{validateCatalog(source);assert.equal(source.schemaVersion,1);});
test('available and beta entries require an http(s) URL; upcoming entries can omit it',()=>{const c=fixture();validateCatalog(c);c.apps[0].url='';assert.throws(()=>validateCatalog(c),/رابط/);c.apps[0].status='coming-soon';validateCatalog(c);});
test('rejects executable URLs, embedded credentials and relative links',()=>{for(const u of ['javascript:alert(1)','data:text/html,x','//example.com','/relative','https://user:pass@example.com','file:///tmp/test'])assert.equal(safeURL(u),'');assert.equal(safeURL('https://example.com/a?q=1'),'https://example.com/a?q=1');});
test('untrusted titles and descriptions are escaped for HTML',()=>{assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');});
test('optional preview images preserve old catalogs and reject unsafe or malformed sources',()=>{
  const c=fixture();validateCatalog(c);
  for(const value of ['', 'https://example.com/preview.webp']){c.apps[0].previewImage=value;validateCatalog(c);}
  for(const value of ['javascript:alert(1)','data:image/svg+xml,x','https://user:secret@example.com/x.png',{},17]){c.apps[0].previewImage=value;assert.throws(()=>validateCatalog(c),/صورة المعاينة/);}
});
test('category and app identifiers must be unique and safe',()=>{let c=fixture();c.apps[1].id=c.apps[0].id;assert.throws(()=>validateCatalog(c),/مكرر/);c=fixture();c.categories[1].id=c.categories[0].id;assert.throws(()=>validateCatalog(c),/مكرر/);c=fixture();c.apps[0].id='x" onclick="alert(1)';assert.throws(()=>validateCatalog(c),/المعرّف/);});
test('rejects unknown categories and unsafe color or icon values',()=>{for(const [key,value] of [['category','nonexistent'],['color','x" onclick="x'],['icon','<svg>'],['status','other']]){const c=fixture();c.apps[0][key]=value;assert.throws(()=>validateCatalog(c));}});
test('rejects invalid calendar dates, text booleans and invalid order',()=>{for(const [key,value] of [['addedAt','2026-02-31'],['addedAt','22/10/2026'],['visible','false'],['featured',1],['order',-1],['order',1.5]]){const c=fixture();c.apps[0][key]=value;assert.throws(()=>validateCatalog(c));}});
test('rejects malformed imported arrays and oversized tags',()=>{assert.throws(()=>validateCatalog({schemaVersion:1,categories:[],apps:null}));assert.throws(()=>validateCatalog(null));let c=fixture();c.apps[0].tags=Array(11).fill('tag');assert.throws(()=>validateCatalog(c));c=fixture();c.categories[0]=null;assert.throws(()=>validateCatalog(c));});
test('Arabic search ignores diacritics, tatweel and alef variants',()=>{assert.equal(normalize('إِبْدَاعـ'),'ابداع');const found=filterApps(fixture().apps,{q:'اداة تعلم'});assert.deepEqual(found.map(x=>x.id),['first']);});
test('combines category, status, favorite and query filters without revealing hidden apps',()=>{const a=fixture().apps;assert.deepEqual(filterApps(a,{category:'education',status:'available',q:'دروس',favorites:new Set(['first','third'])}).map(x=>x.id),['first']);assert.equal(filterApps(a,{favorites:new Set(['third'])}).length,0);assert.equal(filterApps(a,{q:'غير موجود'}).length,0);});
test('sorts curated and recent apps without mutating source data',()=>{const a=fixture().apps;assert.deepEqual(filterApps(a).map(x=>x.id),['second','first']);assert.deepEqual(filterApps(a,{sort:'newest'}).map(x=>x.id),['first','second']);assert.deepEqual(a.map(x=>x.id),['first','second','third']);});
