import { CATEGORIES, categoryName, deriveIndex, normalizeArabic, relatedIdeas } from './core.mjs';
import { orderIdeas, firstSignificantLetter } from './order.mjs';
import { openDatabase, readAll, sha256 } from './store.mjs';
import { initTheme } from './theme.mjs';
import { formatSavedAt } from './time.mjs';

const $ = id => document.getElementById(id);
const state = { items: [], invalidIds: new Set(), sort: 'newest', category: 'all', query: '', selectedId: null };
const dateLabel = formatSavedAt;
function el(tag, cls, value) {
  const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e;
}
function filtered() {
  const q=normalizeArabic(state.query.trim());
  return orderIdeas(state.items.filter(idea => (state.category==='all' || idea.category===state.category) && (!q || normalizeArabic(`${idea.raw} ${idea.title} ${idea.note} ${categoryName(idea.category)} ${idea.tags.join(' ')}`).includes(q))),state.sort);
}
function buttonFor(idea, index) {
  const card=el('button','gallery-card');card.type='button';card.dataset.ideaId=idea.id;
  const head=el('div','gallery-card-top');head.append(el('span','gallery-number',String(index+1).padStart(2,'0')),el('span','gallery-date',dateLabel(idea.createdAt)));
  card.append(head,el('span','gallery-category',categoryName(idea.category)),el('strong','gallery-title',idea.title));
  const raw=el('p','gallery-raw',idea.raw);raw.dir='auto';card.append(raw);
  const foot=el('div','gallery-card-bottom');foot.append(el('span','',idea.favorite?'★ مميّزة':'الأصل محفوظ دون تعديل'),el('span','', 'عرض التفاصيل ←'));
  if(state.invalidIds.has(idea.id)) foot.prepend(el('span','integrity-warning','بصمة غير مطابقة'));
  card.append(foot);
  card.addEventListener('click',()=>showDetail(idea.id));
  return card;
}
function render() {
  const list=filtered(), host=$('gallery-track');host.replaceChildren();
  $('gallery-count').textContent=`${list.length} من ${state.items.length} فكرة`;
  if(!list.length){ const empty=el('div','gallery-empty');empty.append(el('h2','','لا توجد أفكار مطابقة'),el('p','','غيّر الفلتر أو أضف فكرة من مساحة الالتقاط.'));host.append(empty);return; }
  let prevGroup=null;
  const grouped = state.sort==='category' || state.sort.startsWith('alphabetical');
  for(const [i,idea] of list.entries()){
    const group = state.sort==='category' ? categoryName(idea.category) : firstSignificantLetter(idea.title);
    if(grouped && group!==prevGroup){host.append(el('div','gallery-divider',group));prevGroup=group;}
    host.append(buttonFor(idea,i));
  }
}
function showDetail(id) {
  const idea=state.items.find(x=>x.id===id);if(!idea)return;
  state.selectedId=id;
  $('modal-title').textContent=idea.title;
  $('modal-date').textContent=`${dateLabel(idea.createdAt)} · ${categoryName(idea.category)}`;
  const raw=$('modal-raw');raw.textContent=idea.raw;raw.dir='auto';
  $('modal-tags').replaceChildren(...idea.tags.map(t=>el('span','tag',t)));
  const links=$('modal-links');links.replaceChildren();
  const found=relatedIdeas(idea,state.items);
  if(!found.length)links.append(el('span','muted','لا توجد روابط لفظية كافية بعد.'));
  for(const x of found){const b=el('button','modal-related',x.item.title);b.type='button';b.addEventListener('click',()=>showDetail(x.item.id));links.append(b);}
  $('open-in-workspace').href=`./index.html?idea=${encodeURIComponent(idea.id)}#library-title`;
  const dialog=$('idea-dialog');if(!dialog.open)dialog.showModal();
}
function bind() {
  $('gallery-sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
  $('gallery-filter').addEventListener('change',e=>{state.category=e.target.value;render();});
  $('gallery-search').addEventListener('input',e=>{state.query=e.target.value;render();});
  $('gallery-prev').addEventListener('click',()=>$('gallery-track').scrollBy({left:380,behavior:'smooth'}));
  $('gallery-next').addEventListener('click',()=>$('gallery-track').scrollBy({left:-380,behavior:'smooth'}));
  $('gallery-track').addEventListener('keydown',e=>{if(e.target.closest('.gallery-card') && ['ArrowLeft','ArrowRight'].includes(e.key)){ e.preventDefault();const cards=[...$('gallery-track').querySelectorAll('.gallery-card')],at=cards.indexOf(e.target),next=cards[at+(e.key==='ArrowLeft'?1:-1)];next?.focus();next?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}});
  $('close-dialog').addEventListener('click',()=>$('idea-dialog').close());
  $('idea-dialog').addEventListener('click',e=>{if(e.target===$('idea-dialog'))$('idea-dialog').close();});
  for(const c of [...CATEGORIES,{id:'other',name:'أفكار متنوعة'}])$('gallery-filter').append(Object.assign(el('option','',c.name),{value:c.id}));
}
async function start() {
  initTheme();bind();
  try {
    const db=await openDatabase(),snapshot=await readAll(db),meta=new Map(snapshot.annotations.map(x=>[x.id,x]));
    state.items=snapshot.entries.map(e=>deriveIndex(e,meta.get(e.id)));
    for (const x of snapshot.entries)if(await sha256(x.raw)!==x.checksum)state.invalidIds.add(x.id);
    render();
  }catch(e){$('gallery-count').textContent='تعذّر تحميل الأفكار';$('gallery-track').replaceChildren(el('p','integrity-banner',`تعذّر فتح قاعدة البيانات المحلية: ${e.message}`));}
}
start();
