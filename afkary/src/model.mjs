import {deriveIndex,normalizeArabic} from './core.mjs';
/** Never overwrites entry.raw. Latest revision is only a read-time projection. */
export function projectIdeas(snapshot,{deleted=false}={}){
 const annotations=new Map(snapshot.annotations.map(x=>[x.id,x]));
 const discarded=new Set(snapshot.trash.map(x=>x.id));
 const versions=new Map();
 for(const rev of snapshot.revisions){const list=versions.get(rev.ideaId)||[];list.push(rev);versions.set(rev.ideaId,list);}
 return snapshot.entries.filter(e=>discarded.has(e.id)===deleted).map(e=>{
  const history=(versions.get(e.id)||[]).sort((a,b)=>a.number-b.number);
  const latest=history.at(-1);
  const meta=annotations.get(e.id)||{};
  const view=deriveIndex({...e,raw:latest?.raw??e.raw},meta);
  return {...view,originalRaw:e.raw,originalChecksum:e.checksum,originalCreatedAt:e.createdAt,
    revisionCount:history.length,revisions:history,latestChecksum:latest?.checksum??e.checksum,
    editedAt:latest?.createdAt??null,customCategoryId:meta.customCategoryId||'',folderId:meta.folderId||'',
    comments:snapshot.comments.filter(c=>c.ideaId===e.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),
    deletedAt:snapshot.trash.find(t=>t.id===e.id)?.deletedAt||null};
 });
}
export function personalCategoryName(item,collections){
 return collections.find(c=>c.id===item.customCategoryId&&c.type==='category')?.name||'';
}
export function folderName(item,collections){return collections.find(c=>c.id===item.folderId&&c.type==='folder')?.name||'';}
export function ideaMatches(idea,{query='',category='all',folder='all',customCategory='all',favorite=false}={},collections=[]){
 if(category!=='all'&&idea.category!==category)return false;
 if(folder!=='all'&&idea.folderId!==folder)return false;
 if(customCategory!=='all'&&idea.customCategoryId!==customCategory)return false;
 if(favorite&&!idea.favorite)return false;
 const q=normalizeArabic(query.trim());
 return !q||normalizeArabic([idea.raw,idea.originalRaw,idea.title,idea.note,...idea.tags,personalCategoryName(idea,collections),folderName(idea,collections)].join(' ')).includes(q);
}
