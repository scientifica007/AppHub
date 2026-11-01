import { validateRaw, validateArchive } from './core.mjs';
const DB_NAME = 'afkary-v1';
const DB_VERSION = 1;

export function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('هذا المتصفح لا يتيح قاعدة التخزين المحلية IndexedDB.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('annotations')) db.createObjectStore('annotations', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذر فتح قاعدة البيانات.'));
    request.onblocked = () => reject(new Error('أغلق الألسنة الأخرى التي تستخدم أفكاري ثم حاول مجددًا.'));
  });
}
function wait(request) { return new Promise((resolve,reject) => { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
function completion(tx) {return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error || new Error('تم إلغاء الحفظ.'));tx.onerror=()=>reject(tx.error || new Error('حدث خطأ في التخزين.'));});}
export async function sha256(text) {
  if (!globalThis.crypto?.subtle) throw new Error('فحص سلامة البيانات يتطلب اتصال HTTPS أو localhost.');
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function createIdea(db, raw) {
  validateRaw(raw);
  const entry = { id: crypto.randomUUID(), raw, createdAt: new Date().toISOString(), checksum: await sha256(raw) };
  const tx = db.transaction('entries', 'readwrite');
  const done = completion(tx);
  tx.objectStore('entries').add(entry); // add, never put: canonical record cannot be overwritten
  await done;
  return entry;
}
export async function readAll(db) {
  const tx=db.transaction(['entries','annotations'],'readonly');
  const done=completion(tx);
  const [entries, annotations]=await Promise.all([wait(tx.objectStore('entries').getAll()),wait(tx.objectStore('annotations').getAll())]);
  await done;
  return { entries, annotations };
}
export async function saveAnnotation(db, id, changes) {
  const {entries,annotations} = await readAll(db);
  if (!entries.some(x=>x.id === id)) throw new Error('الفكرة الأصلية غير موجودة.');
  const old = annotations.find(x=>x.id === id) || {id,categoryOverride:'',note:'',favorite:false};
  const next = {...old,...changes,id};
  if (typeof next.note !== 'string' || next.note.length > 20000 || typeof next.favorite !== 'boolean' || typeof next.categoryOverride !== 'string' || !['','other','technology','education','research','business','creative','life'].includes(next.categoryOverride)) throw new Error('بيانات التعليق غير صالحة.');
  const tx=db.transaction('annotations','readwrite');
  const done=completion(tx);
  tx.objectStore('annotations').put(next);
  await done;
  return next;
}
export async function exportArchive(db) {
  const {entries,annotations}=await readAll(db);
  return { format:'afkary-backup', schemaVersion:1, exportedAt:new Date().toISOString(), entries, annotations };
}
export async function importArchive(db, data) {
  const archive = validateArchive(data);
  for (const entry of archive.entries) {
    if (await sha256(entry.raw) !== entry.checksum) throw new Error('فشل التحقق من بصمة فكرة مستوردة. لم يُستورد شيء.');
  }
  const current = await readAll(db);
  const oldById=new Map(current.entries.map(e=>[e.id,e]));
  for (const entry of archive.entries) {
    const old=oldById.get(entry.id);
    if (old && (old.raw !== entry.raw || old.checksum !== entry.checksum || old.createdAt !== entry.createdAt)) throw new Error('تعارض في هوية فكرة محفوظة. أُلغي الاستيراد لحماية الأصل.');
  }
  const toAdd=archive.entries.filter(e=>!oldById.has(e.id));
  const addedIds=new Set(toAdd.map(e=>e.id));
  const tx=db.transaction(['entries','annotations'],'readwrite');
  const done=completion(tx);
  for (const entry of toAdd) tx.objectStore('entries').add(entry);
  for (const annotation of archive.annotations) if (addedIds.has(annotation.id)) tx.objectStore('annotations').add(annotation);
  await done;
  return { added:toAdd.length, skipped:archive.entries.length-toAdd.length };
}
