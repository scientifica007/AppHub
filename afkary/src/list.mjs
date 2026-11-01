import {CATEGORIES,categoryName,deriveIndex,normalizeArabic,relatedIdeas} from './core.mjs';
import {orderIdeas,firstSignificantLetter} from './order.mjs';
import {openDatabase,readAll,sha256} from './store.mjs';
import {initTheme} from './theme.mjs';
import {formatSavedAt,timestampDescription} from './time.mjs';
const $=id=>document.getElementById(id);
const state={items:[],bad:new Set(),sort:'newest',category:'all',query:''};
function el(tag,cls='',value=null){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==null)e.textContent=String(value);return e;}
function filtered(){const q=normalizeArabic(state.query.trim());return orderIdeas(state.items.filter(i=>(state.category==='all'||i.category===state.category)&&(!q||normalizeArabic([i.raw,i.title,i.note,categoryName(i.category),...i.tags].join(' ')).includes(q))),state.sort);}
function showDetail(idea){
 $('modal-title').textContent=idea.title;$('modal-date').textContent=formatSavedAt(idea.createdAt)+' · '+categoryName(idea.category);
 $('modal-date').title=timestampDescription(idea.createdAt);
 $('modal-raw').textContent=idea.raw;$('modal-raw').dir='auto';
 $('modal-tags').replaceChildren(...idea.tags.map(t=>el('span','tag',t)));
 const host=$('modal-links');host.replaceChildren();const related=relatedIdeas(idea,state.items);
 if(!related.length)host.append(el('span','muted','لا توجد روابط لفظية كافية بعد.'));
 for(const {item} of related){const b=el('button','modal-related',item.title);b.type='button';b.addEventListener('click',()=>showDetail(item));host.append(b);}
 $('open-in-workspace').href='./index.html?idea='+encodeURIComponent(idea.id)+'#library-title';
 if(!$('idea-dialog').open)$('idea-dialog').showModal();
}
function render(){
 const items=filtered(),host=$('vertical-list');host.replaceChildren();
 $('gallery-count').textContent=items.length+' من '+state.items.length+' فكرة';
 if(!items.length){const empty=el('div','gallery-empty');empty.append(el('h3','','لا توجد أفكار مطابقة'),el('p','','غيّر التصفية أو أضف فكرة من مساحة الالتقاط.'));host.append(empty);return;}
 let prev=null;const grouped=state.sort==='category'||state.sort.startsWith('alphabetical');
 for(const [n,idea] of items.entries()){
  const group=state.sort==='category'?categoryName(idea.category):firstSignificantLetter(idea.title);
  if(grouped&&prev!==group){host.append(el('h3','vertical-group',group));prev=group;}
  const row=el('article','vertical-idea');row.setAttribute('role','listitem');
  const meta=el('div','vertical-idea-meta'),stamp=el('time','vertical-date',formatSavedAt(idea.createdAt));
  stamp.dateTime=idea.createdAt;stamp.title=timestampDescription(idea.createdAt);
  meta.append(el('span','vertical-index',String(n+1).padStart(2,'0')),stamp);row.append(meta,el('h3','vertical-title',idea.title));
  const raw=el('pre','vertical-raw',idea.raw);raw.dir='auto';row.append(raw);
  const foot=el('div','vertical-idea-foot');foot.append(el('span','gallery-category',categoryName(idea.category)));
  if(idea.favorite)foot.append(el('span','favorite-mark','★ مميّزة'));
  if(state.bad.has(idea.id))foot.append(el('span','integrity-warning','تحذير: البصمة غير مطابقة'));
  const details=el('button','button secondary small','عرض الروابط والتفاصيل');details.type='button';details.addEventListener('click',()=>showDetail(idea));foot.append(details);row.append(foot);host.append(row);
 }
}
function bind(){
 $('gallery-sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
 $('gallery-filter').addEventListener('change',e=>{state.category=e.target.value;render();});
 $('gallery-search').addEventListener('input',e=>{state.query=e.target.value;render();});
 $('close-dialog').addEventListener('click',()=>$('idea-dialog').close());
 $('idea-dialog').addEventListener('click',e=>{if(e.target===$('idea-dialog'))$('idea-dialog').close();});
 for(const c of [...CATEGORIES,{id:'other',name:'أفكار متنوعة'}])$('gallery-filter').append(Object.assign(el('option','',c.name),{value:c.id}));
}
async function start(){initTheme();bind();try{
 const db=await openDatabase(),snap=await readAll(db),meta=new Map(snap.annotations.map(a=>[a.id,a]));
 state.items=snap.entries.map(e=>deriveIndex(e,meta.get(e.id)));
 for(const e of snap.entries)if(await sha256(e.raw)!==e.checksum)state.bad.add(e.id);
 render();
 }catch(e){$('gallery-count').textContent='تعذّر تحميل الأفكار';$('vertical-list').replaceChildren(el('p','integrity-banner',e.message));}
}
start();
