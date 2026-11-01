import { CATEGORIES, categoryName } from './core.mjs';
import { orderIdeas, firstSignificantLetter } from './order.mjs';
import { openDatabase,readAll,sha256,moveToTrash,restoreIdea,deletePermanently,addComment,addRevision } from './store.mjs';
import { projectIdeas,ideaMatches,personalCategoryName,folderName } from './model.mjs';
import { initTheme } from './theme.mjs';
import { formatSavedAt } from './time.mjs';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const LAYOUTS=['horizontal','vertical','grid'];
const state={db:null,items:[],trashed:[],collections:[],invalidIds:new Set(),layout:LAYOUTS.includes(params.get('view'))?params.get('view'):'horizontal',scope:params.get('view')==='trash'?'trash':'active',sort:'newest',category:'all',customCategory:'all',folder:'all',query:''};
const el=(tag,cls='',value=null)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==null)n.textContent=String(value);return n;};
function toast(text){$('archive-toast').textContent=text;$('archive-toast').classList.add('visible');setTimeout(()=>$('archive-toast').classList.remove('visible'),4000);}
function updateFilters(){
 for(const [id,type] of [['archive-custom','category'],['archive-folder','folder']]){
  const sel=$(id),chosen=sel.value;while(sel.options.length>1)sel.remove(1);
  for(const c of state.collections.filter(x=>x.type===type).sort((a,b)=>a.name.localeCompare(b.name,'ar'))){const opt=el('option','',c.name);opt.value=c.id;sel.add(opt);}
  if([...sel.options].some(o=>o.value===chosen))sel.value=chosen;
 }
}
async function refresh(){
 const snapshot=await readAll(state.db);
 state.items=projectIdeas(snapshot);state.trashed=projectIdeas(snapshot,{deleted:true});state.collections=snapshot.collections;
 state.invalidIds.clear();
 for(const e of snapshot.entries)if(await sha256(e.raw)!==e.checksum)state.invalidIds.add(e.id);
 for(const r of snapshot.revisions)if(await sha256(r.raw)!==r.checksum)state.invalidIds.add(r.ideaId);
 updateFilters();render();
}
function filtered(){
 const group=state.scope==='trash'?state.trashed:state.items;
 return orderIdeas(group.filter(x=>ideaMatches(x,{query:state.query,category:state.category,folder:state.folder,customCategory:state.customCategory},state.collections)),state.sort);
}
function showIdea(idea){
 $('archive-modal-title').textContent=idea.title;
 $('archive-modal-date').textContent=`أُنشئت: ${formatSavedAt(idea.createdAt)}${idea.editedAt?` · عُدّلت: ${formatSavedAt(idea.editedAt)}`:''} · ${categoryName(idea.category)}`;
 $('archive-modal-raw').textContent=idea.raw;
 $('archive-modal-tags').replaceChildren(...[...idea.tags,personalCategoryName(idea,state.collections),folderName(idea,state.collections)].filter(Boolean).map(x=>el('span','tag',x)));
 $('archive-modal-original').textContent=idea.revisionCount?`المراجعات: ${idea.revisionCount} · النص الأصلي محفوظ ولا يُستبدل.`:'النص الأصلي محفوظ دون تعديل.';
 $('archive-open-editor').hidden=state.scope==='trash';$('archive-open-editor').href=`./index.html?idea=${encodeURIComponent(idea.id)}#library-title`;
 const actions=$('archive-dialog-actions');actions.replaceChildren();
 if(state.invalidIds.has(idea.id)){actions.append(el('p','integrity-banner','تحذير: بصمة النص غير مطابقة. لا تنفّذ حذفًا نهائيًا دون نسخة احتياطية.'));}
 if(state.scope==='trash'){
  const restore=el('button','button primary','استعادة الفكرة');restore.type='button';restore.addEventListener('click',async()=>{try{await restoreIdea(state.db,idea.id);$('archive-dialog').close();await refresh();toast('استُعيدت الفكرة بكامل مراجعاتها وتعليقاتها.');}catch(e){toast(e.message);}});
  const destroy=el('button','button secondary danger-action','حذف نهائي');destroy.type='button';destroy.addEventListener('click',async()=>{
    const answer=globalThis.prompt('تحذير: حذف نهائي لا يمكن التراجع عنه. اكتب «حذف نهائي» للموافقة.');
    if(answer!=='حذف نهائي')return;
    if(!globalThis.confirm('تأكيد أخير: سيُحذف النص الأصلي والمراجعات والتعليقات نهائيًا من هذا المتصفح. هل تتابع؟'))return;
    try{await deletePermanently(state.db,idea.id);$('archive-dialog').close();await refresh();toast('حُذفت الفكرة نهائيًا من التخزين المحلي.');}catch(e){toast(e.message);}
  });actions.append(restore,destroy);
 }else{
  const trash=el('button','button secondary danger-action','نقل إلى سلة المهملات');trash.type='button';trash.addEventListener('click',async()=>{
   if(!globalThis.confirm('هل تنقل الفكرة إلى سلة المهملات؟ يمكنك استعادتها لاحقًا.'))return;
   try{await moveToTrash(state.db,idea.id);$('archive-dialog').close();await refresh();toast('نُقلت الفكرة إلى السلة.');}catch(e){toast(e.message);}
  });actions.append(trash);
 }
 if(state.scope==='active'){
   const all=el('section','archive-comments');all.append(el('h3','','التعقيبات والمراجعات'));
   for(const c of idea.comments){const item=el('div','comment-item');item.append(el('time','muted',formatSavedAt(c.createdAt)),el('p','',c.text));all.append(item);}
   const comment=el('textarea','notes-input');comment.rows=2;comment.maxLength=20000;comment.placeholder='اكتب تعليقًا أو تعقيبًا على الفكرة…';
   const add=el('button','button secondary small','حفظ التعقيب');add.type='button';
   add.addEventListener('click',async()=>{try{await addComment(state.db,idea.id,comment.value);await refresh();showIdea(state.items.find(x=>x.id===idea.id));toast('حُفظ التعقيب منفصلًا.');}catch(e){toast(e.message);}});
   all.append(comment,add);
   const edit=el('details','edit-disclosure');edit.append(el('summary','','تحرير نسخة معدلة مع الاحتفاظ بالأصل'));
   const textarea=el('textarea','notes-input');textarea.rows=5;textarea.maxLength=100000;textarea.value=idea.raw;
   const save=el('button','button secondary small','حفظ مراجعة جديدة');save.type='button';
   save.addEventListener('click',async()=>{
     if(!globalThis.confirm('تأكيد إنشاء مراجعة جديدة؟ سيبقى النص الأصلي وكل المراجعات السابقة محفوظًا.'))return;
     try{await addRevision(state.db,idea.id,textarea.value);await refresh();showIdea(state.items.find(x=>x.id===idea.id));toast('حُفظت المراجعة الجديدة، والأصل محفوظ.');}catch(e){toast(e.message);}
   });
   edit.append(el('p','muted','لن يتغير النص الأصلي، بل ستُنشأ مراجعة مستقلة.'),textarea,save);all.append(edit);
   if(idea.revisionCount){const history=el('details','original-history');history.append(el('summary','','عرض النسخة الأصلية والمراجعات السابقة'),el('pre','modal-raw',idea.originalRaw));for(const version of idea.revisions){const previous=el('details','history-revision');previous.append(el('summary','',`المراجعة ${version.number} · ${formatSavedAt(version.createdAt)}`),el('pre','modal-raw',version.raw));history.append(previous);}all.append(history);}
   actions.append(all);
 }
 if(!$('archive-dialog').open)$('archive-dialog').showModal();
}
function makeCard(idea,index){
 const isVertical=state.layout==='vertical',card=el(isVertical?'article':'button',isVertical?'vertical-idea archive-card':'gallery-card archive-card');
 if(!isVertical)card.type='button';card.tabIndex=0;card.dataset.ideaId=idea.id;
 const heading=el('div',isVertical?'vertical-idea-meta':'gallery-card-top');heading.append(el('span','gallery-number',String(index+1).padStart(2,'0')));
 const date=el('time','gallery-date',formatSavedAt(idea.createdAt));date.dateTime=idea.createdAt;heading.append(date);card.append(heading);
 card.append(el('span','gallery-category',personalCategoryName(idea,state.collections)||categoryName(idea.category)),el(isVertical?'h3':'strong',isVertical?'vertical-title':'gallery-title',idea.title));
 const raw=el(isVertical?'pre':'p',isVertical?'vertical-raw':'gallery-raw',idea.raw);raw.dir='auto';card.append(raw);
 const foot=el('div',isVertical?'vertical-idea-foot':'gallery-card-bottom');
 const personal=[folderName(idea,state.collections),idea.favorite?'★ مميّزة':'',idea.revisionCount?`${idea.revisionCount} مراجعة`:''].filter(Boolean).join(' · ');
 foot.append(el('span','',personal||'الأصل محفوظ'));
 if(state.invalidIds.has(idea.id))foot.append(el('span','integrity-warning','بصمة غير مطابقة'));
 if(state.scope==='trash')foot.append(el('span','',`في السلة منذ ${formatSavedAt(idea.deletedAt)}`));
 card.append(foot);
 if(isVertical){const btn=el('button','button secondary small','فتح التفاصيل');btn.type='button';btn.addEventListener('click',()=>showIdea(idea));card.append(btn);}
 else card.addEventListener('click',()=>showIdea(idea));
 card.addEventListener('keydown',e=>{if(e.key==='Enter'&&isVertical&&e.target===card)showIdea(idea);});
 return card;
}
function render(){
 const data=filtered(),host=$('archive-results');host.replaceChildren();host.className=`archive-results layout-${state.layout}`;
 $('archive-count').textContent=`${data.length} من ${state.scope==='trash'?state.trashed.length:state.items.length} فكرة`;
 $('trash-count').textContent=state.trashed.length;
 $('archive-results-title').textContent=state.scope==='trash'?'سلة المهملات':'أرشيف الأفكار';
 $('archive-help').textContent=state.scope==='trash'?'الأفكار في السلة قابلة للاستعادة، والحذف النهائي يتطلب تأكيدين.':'اختر إحدى طرق العرض؛ الفرز والتصفية لا يغيّران الأفكار المحفوظة.';
 $('archive-arrows').hidden=state.layout!=='horizontal';
 document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===state.layout)));
 document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===state.scope)));
 if(!data.length){const blank=el('div','gallery-empty');blank.append(el('h3','','لا توجد أفكار هنا'),el('p','','يمكنك تغيير التصفية أو الرجوع إلى مساحة الالتقاط.'));host.append(blank);return;}
 let prev=null;
 for(const [i,idea] of data.entries()){
  const group=state.sort==='category'?categoryName(idea.category):firstSignificantLetter(idea.title);
  if((state.sort==='category'||state.sort.startsWith('alphabetical'))&&group!==prev){host.append(el('div','archive-group-label',group));prev=group;}
  host.append(makeCard(idea,i));
 }
}
function bind(){
 for(const b of document.querySelectorAll('[data-layout]'))b.addEventListener('click',()=>{state.layout=b.dataset.layout;history.replaceState(null,'',`?view=${state.scope==='trash'?'trash':state.layout}`);render();});
 for(const b of document.querySelectorAll('[data-scope]'))b.addEventListener('click',()=>{state.scope=b.dataset.scope;history.replaceState(null,'',`?view=${state.scope==='trash'?'trash':state.layout}`);render();});
 for(const [id,key] of [['archive-sort','sort'],['archive-category','category'],['archive-custom','customCategory'],['archive-folder','folder'],['archive-search','query']])$(id).addEventListener(id==='archive-search'?'input':'change',e=>{state[key]=e.target.value;render();});
 $('archive-prev').addEventListener('click',()=>$('archive-results').scrollBy({left:370,behavior:'smooth'}));
 $('archive-next').addEventListener('click',()=>$('archive-results').scrollBy({left:-370,behavior:'smooth'}));
 $('archive-close').addEventListener('click',()=>$('archive-dialog').close());
 $('archive-dialog').addEventListener('click',e=>{if(e.target===$('archive-dialog'))$('archive-dialog').close();});
 for(const c of CATEGORIES.concat({id:'other',name:'أفكار متنوعة'})){const opt=el('option','',c.name);opt.value=c.id;$('archive-category').append(opt);}
}
async function start(){initTheme();bind();try{state.db=await openDatabase();await refresh();}catch(e){$('archive-count').textContent='فشل تحميل الأرشيف';$('archive-results').append(el('p','integrity-banner',e.message));}}
start();
