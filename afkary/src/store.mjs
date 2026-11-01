/** Afkary local persistence v2. Original entries are append-only; edits are new revisions. */
import { CATEGORIES, validateRaw, validateArchive } from './core.mjs';
const DB_NAME='afkary-v1';
const DB_VERSION=2;
const STORES=['entries','annotations','revisions','comments','collections','trash'];
const ID_RE=/^[a-zA-Z0-9-]{1,128}$/;
export function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('هذا المتصفح لا يدعم IndexedDB.'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const store of STORES)if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'});
    };
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(request.error||new Error('فشل فتح قاعدة البيانات.'));
    request.onblocked=()=>reject(new Error('أغلق الألسنة الأخرى التي تستخدم أفكاري لإكمال تحديث قاعدة البيانات.'));
  });
}
function completion(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('أُلغي الحفظ.'));tx.onerror=()=>reject(tx.error||new Error('خطأ في التخزين.'));});}
function read(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function sha256(text){
  if(!globalThis.crypto?.subtle)throw new Error('التحقق من البصمات يتطلب HTTPS أو localhost.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function createIdea(db,raw){
  validateRaw(raw);
  const entry={id:crypto.randomUUID(),raw,createdAt:new Date().toISOString(),checksum:await sha256(raw)};
  const tx=db.transaction('entries','readwrite'),done=completion(tx);tx.objectStore('entries').add(entry);await done;return entry;
}
export async function readAll(db){
  const tx=db.transaction(STORES,'readonly'),done=completion(tx);
  const arrays=await Promise.all(STORES.map(store=>read(tx.objectStore(store).getAll())));await done;
  return Object.fromEntries(STORES.map((name,i)=>[name,arrays[i]]));
}
async function ensureActive(db,id){const snapshot=await readAll(db);if(!snapshot.entries.some(e=>e.id===id)||snapshot.trash.some(t=>t.id===id))throw new Error('الفكرة غير موجودة أو في سلة المهملات.');return snapshot;}
const isValidCategory=x=>x===''||x==='other'||CATEGORIES.some(c=>c.id===x);
export async function saveAnnotation(db,id,changes){
  const snapshot=await ensureActive(db,id);
  const old=snapshot.annotations.find(x=>x.id===id)||{id,categoryOverride:'',customCategoryId:'',folderId:'',note:'',favorite:false};
  const next={...old,...changes,id};
  if(typeof next.note!=='string'||next.note.length>20000||typeof next.favorite!=='boolean'||!isValidCategory(next.categoryOverride)||typeof next.customCategoryId!=='string'||typeof next.folderId!=='string')throw new Error('بيانات تصنيف الفكرة غير صالحة.');
  for(const [field,type] of [['customCategoryId','category'],['folderId','folder']])if(next[field]&&!snapshot.collections.some(c=>c.id===next[field]&&c.type===type))throw new Error('المجلد أو التصنيف غير موجود.');
  const tx=db.transaction('annotations','readwrite'),done=completion(tx);tx.objectStore('annotations').put(next);await done;return next;
}
export async function createCollection(db,type,name){
  if(!['category','folder'].includes(type))throw new Error('نوع التنظيم غير صالح.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>70)throw new Error('اسم التصنيف أو المجلد مطلوب (70 حرفًا كحد أقصى).');
  const value=name.trim();
  const all=await readAll(db);
  if(all.collections.some(c=>c.type===type&&c.name.trim().toLocaleLowerCase('ar')===value.toLocaleLowerCase('ar')))throw new Error('هذا الاسم مستخدم بالفعل.');
  const item={id:crypto.randomUUID(),type,name:value,createdAt:new Date().toISOString()};
  const tx=db.transaction('collections','readwrite'),done=completion(tx);tx.objectStore('collections').add(item);await done;return item;
}
export async function addComment(db,ideaId,text){
  if(typeof text!=='string'||!text.trim()||text.length>20000)throw new Error('اكتب تعليقًا لا يتجاوز 20,000 حرف.');
  await ensureActive(db,ideaId);
  const comment={id:crypto.randomUUID(),ideaId,text,createdAt:new Date().toISOString()};
  const tx=db.transaction('comments','readwrite'),done=completion(tx);tx.objectStore('comments').add(comment);await done;return comment;
}
export async function addRevision(db,ideaId,raw){
  validateRaw(raw);const snapshot=await ensureActive(db,ideaId);
  const original=snapshot.entries.find(e=>e.id===ideaId);
  const versions=snapshot.revisions.filter(v=>v.ideaId===ideaId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const latest=versions.at(-1)||original;
  if(raw===latest.raw)throw new Error('لم يتغير النص؛ لا حاجة إلى إنشاء مراجعة.');
  const item={id:crypto.randomUUID(),ideaId,raw,checksum:await sha256(raw),previousChecksum:latest.checksum,createdAt:new Date().toISOString(),number:versions.length+1};
  const tx=db.transaction('revisions','readwrite'),done=completion(tx);tx.objectStore('revisions').add(item);await done;return item;
}
export async function moveToTrash(db,id){
  await ensureActive(db,id);
  const tombstone={id,deletedAt:new Date().toISOString()};
  const tx=db.transaction('trash','readwrite'),done=completion(tx);tx.objectStore('trash').add(tombstone);await done;return tombstone;
}
export async function restoreIdea(db,id){
  const tx=db.transaction('trash','readwrite'),done=completion(tx);
  const present=await read(tx.objectStore('trash').get(id));
  if(!present)throw new Error('الفكرة غير موجودة في سلة المهملات.');
  tx.objectStore('trash').delete(id);await done;
}
export async function deletePermanently(db,id){
  const snapshot=await readAll(db);
  if(!snapshot.trash.some(t=>t.id===id))throw new Error('انقل الفكرة إلى السلة أولًا.');
  const tx=db.transaction(STORES,'readwrite'),done=completion(tx);
  tx.objectStore('entries').delete(id);tx.objectStore('annotations').delete(id);tx.objectStore('trash').delete(id);
  for(const c of snapshot.comments)if(c.ideaId===id)tx.objectStore('comments').delete(c.id);
  for(const v of snapshot.revisions)if(v.ideaId===id)tx.objectStore('revisions').delete(v.id);
  await done;
}
function validateExtra(data){
  // Legacy archives are validated without changing their meaning.
  validateArchive({...data,schemaVersion:1});
  const seenEntries=new Set(data.entries.map(x=>x.id));
  const specs={
    revisions:r=>seenEntries.has(r.ideaId)&&typeof r.raw==='string'&&Boolean(validateRaw(r.raw))&&/^[a-f0-9]{64}$/.test(r.checksum)&&/^[a-f0-9]{64}$/.test(r.previousChecksum)&&Number.isInteger(r.number)&&r.number>0,
    comments:r=>seenEntries.has(r.ideaId)&&typeof r.text==='string'&&r.text.trim()!==''&&r.text.length<=20000,
    collections:r=>['category','folder'].includes(r.type)&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=70,
    trash:r=>seenEntries.has(r.id)&&Number.isFinite(Date.parse(r.deletedAt))
  };
  for(const [field,rule] of Object.entries(specs)){
    if(!Array.isArray(data[field])||data[field].length>30000)throw new Error('سجلات النسخة الاحتياطية الموسعة غير صالحة.');
    const ids=new Set();
    for(const r of data[field]){
      if(!r||!ID_RE.test(r.id)||ids.has(r.id)||!rule(r)||(field!=='trash'&&!Number.isFinite(Date.parse(r.createdAt))))throw new Error(`سجل غير صالح أو مكرر في ${field}.`);
      ids.add(r.id);
    }
  }
  for(const m of data.annotations){
    if(m.customCategoryId && !data.collections.some(c=>c.id===m.customCategoryId&&c.type==='category'))throw new Error('تصنيف مفقود في النسخة.');
    if(m.folderId && !data.collections.some(c=>c.id===m.folderId&&c.type==='folder'))throw new Error('مجلد مفقود في النسخة.');
  }
  for(const e of data.entries){
    const versions=data.revisions.filter(r=>r.ideaId===e.id).sort((a,b)=>a.number-b.number);
    let prev=e.checksum;
    versions.forEach((r,i)=>{if(r.number!==i+1||r.previousChecksum!==prev)throw new Error('تسلسل مراجعات النص غير سليم.');prev=r.checksum;});
  }
  return data;
}
export async function exportArchive(db){
  const data=await readAll(db);
  return {format:'afkary-backup',schemaVersion:2,exportedAt:new Date().toISOString(),...data};
}
export async function importArchive(db,data){
  if(!data||data.format!=='afkary-backup'||![1,2].includes(data.schemaVersion))throw new Error('نسخة احتياطية غير مدعومة.');
  const archive=data.schemaVersion===1?validateArchive(data):validateExtra(data);
  for(const e of archive.entries)if(await sha256(e.raw)!==e.checksum)throw new Error('بصمة فكرة أصلية غير مطابقة. لم يُستورد شيء.');
  for(const r of archive.revisions||[])if(await sha256(r.raw)!==r.checksum)throw new Error('بصمة مراجعة غير مطابقة. لم يُستورد شيء.');
  const current=await readAll(db),oldById=new Map(current.entries.map(e=>[e.id,e]));
  for(const e of archive.entries){const old=oldById.get(e.id);if(old&&(old.raw!==e.raw||old.checksum!==e.checksum||old.createdAt!==e.createdAt))throw new Error('تعارض في أصل فكرة محفوظة. أُلغي الاستيراد.');}
  const newEntries=archive.entries.filter(e=>!oldById.has(e.id));
  const ids=new Set(newEntries.map(e=>e.id));
  // Skip old ideas entirely: never change current revisions, deleted status, or annotations.
  const additions={entries:newEntries,annotations:archive.annotations.filter(r=>ids.has(r.id)),revisions:(archive.revisions||[]).filter(r=>ids.has(r.ideaId)),comments:(archive.comments||[]).filter(r=>ids.has(r.ideaId)),trash:(archive.trash||[]).filter(r=>ids.has(r.id)),collections:[]};
  const presentCollections=new Map(current.collections.map(c=>[c.id,c]));
  for(const c of archive.collections||[]){const existing=presentCollections.get(c.id);if(existing && (existing.name!==c.name||existing.type!==c.type))throw new Error('تعارض في تصنيف شخصي. أُلغي الاستيراد.');if(!existing)additions.collections.push(c);}
  const tx=db.transaction(STORES,'readwrite'),done=completion(tx);
  for(const [store,rows] of Object.entries(additions))for(const row of rows)tx.objectStore(store).add(row);
  await done;
  return {added:newEntries.length,skipped:archive.entries.length-newEntries.length};
}
