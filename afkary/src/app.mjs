import { CATEGORIES, categoryName, deriveIndex, relatedIdeas, searchIdeas, suggestDirections } from './core.mjs';
import { openDatabase, createIdea, readAll, saveAnnotation, exportArchive, importArchive, sha256 } from './store.mjs';
import { initTheme } from './theme.mjs';
import { formatSavedAt, timestampDescription } from './time.mjs';
import { initWorkspace } from './workspace.mjs';

const $ = id => document.getElementById(id);
const state = { db: null, entries: [], annotations: [], items: [], selectedId: null, view: 'all', category: 'all', query: '', invalidIds: new Set() };
const element = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};
const append = (parent, ...children) => { parent.append(...children); return parent; };
const titleFormat = formatSavedAt;
let toastTimer;
function message(value, isError=false) {
  const node=$('toast'); node.textContent=value; node.classList.toggle('error',isError); node.classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('visible'),4500);
}
async function refresh() {
  const snapshot=await readAll(state.db);
  state.entries=snapshot.entries;
  state.annotations=snapshot.annotations;
  const meta=new Map(snapshot.annotations.map(a=>[a.id,a]));
  state.items=snapshot.entries.map(e=>deriveIndex(e,meta.get(e.id)));
  state.invalidIds=new Set();
  for (const e of snapshot.entries) if (await sha256(e.raw) !== e.checksum) state.invalidIds.add(e.id);
  if (state.invalidIds.size) message('تحذير: بصمة محتوى واحدة على الأقل لا تطابق أصلها المحفوظ.',true);
  render();
}
function relatedCount() {
  const pairs=new Set();
  for(const item of state.items) for(const {item:other} of relatedIdeas(item,state.items,50)) pairs.add([item.id,other.id].sort().join('|'));
  return pairs.size;
}
function setView(view) {state.view=view; state.category='all'; render();}
function categoryFilter(id) {state.category=id;state.view='all';render();}
function renderTopics() {
  const nav=$('topic-nav');nav.replaceChildren();
  for(const c of [...CATEGORIES,{...{id:'other',name:'أفكار متنوعة'}}]) {
    const count=state.items.filter(i=>i.category===c.id).length;
    if (!count) continue;
    const button=element('button',`topic-link ${state.category===c.id?'active':''}`);
    button.type='button';button.append(element('span','topic-bullet','◦'),element('span','',c.name),element('span','topic-count',count));
    button.addEventListener('click',()=>categoryFilter(c.id));nav.append(button);
  }
  if (!nav.children.length) nav.append(element('p','topic-empty','تظهر الموضوعات بعد حفظ الأفكار.'));
}
function render() {
  $('stat-total').textContent=state.items.length;
  $('nav-all-count').textContent=state.items.length;
  $('stat-topics').textContent=new Set(state.items.map(i=>i.category)).size;
  $('stat-links').textContent=relatedCount();
  renderTopics();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',state.view===b.dataset.view && state.category==='all'));
  const labels={all:'كل الأفكار',favorites:'الأفكار المميّزة',connected:'أفكار مترابطة'};
  $('list-heading').textContent=state.category==='all' ? labels[state.view] : categoryName(state.category);
  let shown=searchIdeas(state.items,{query:state.query,category:state.category,view:state.view});
  if(state.view==='connected') shown=shown.filter(item=>relatedIdeas(item,state.items).length>0);
  $('result-count').textContent=`${shown.length} فكرة`;
  if (!shown.some(i=>i.id===state.selectedId)) state.selectedId=shown[0]?.id ?? null;
  renderList(shown);
  renderDetail();
}
function renderList(items) {
  const list=$('ideas-list');list.replaceChildren();
  if (!items.length) {
    const empty=element('div','empty-list');
    empty.append(element('span','empty-list-icon','✳'),element('h3','',state.items.length?'لا توجد نتائج مطابقة':'الأرشيف فارغ حاليًا'),element('p','',state.items.length?'جرّب كلمة أخرى أو أزل إحدى التصفـيات.':'ابدأ بتسجيل أول فكرة في مساحة الالتقاط أعلاه.'));
    list.append(empty);return;
  }
  for(const idea of items) {
    const button=element('button',`idea-card ${state.selectedId===idea.id?'selected':''}`);button.type='button';button.setAttribute('aria-pressed',String(state.selectedId===idea.id));
    button.title=timestampDescription(idea.createdAt);
    append(button,element('span','idea-card-date',titleFormat(idea.createdAt)),element('strong','idea-card-title',idea.title),element('span','idea-card-preview',idea.preview));
    const foot=element('div','idea-card-foot');foot.append(element('span','category-pill',categoryName(idea.category)));
    if(idea.favorite) foot.append(element('span','favorite-mark','★'));
    if(state.invalidIds.has(idea.id)) foot.append(element('span','integrity-warning','بصمة غير مطابقة'));
    button.append(foot);
    button.addEventListener('click',()=>{state.selectedId=idea.id;renderList(items);renderDetail();});
    list.append(button);
  }
}
function renderDetail() {
  const host=$('idea-detail');host.replaceChildren();
  const idea=state.items.find(x=>x.id===state.selectedId);
  if(!idea){const empty=element('div','empty-detail');empty.append(element('div','empty-symbol','✳'),element('h3','','صفحة بيضاء للأفكار القادمة'),element('p','','اختر فكرةً من الأرشيف أو اكتب فكرة جديدة في الأعلى.'));host.append(empty);return;}
  const top=element('div','detail-top');
  const marker=element('div','eyebrow','IDEA / الأصل المحفوظ');
  const starred=element('button','star-button',idea.favorite?'★ مميّزة':'☆ تمييز');starred.type='button';starred.setAttribute('aria-label','تغيير حالة تمييز الفكرة');
  starred.addEventListener('click',()=>changeAnnotation(idea,{favorite:!idea.favorite}));
  top.append(marker,starred);host.append(top);
  host.append(element('h3','detail-title',idea.title));
  host.append(element('p','detail-date',`تاريخ ووقت الالتقاط: ${titleFormat(idea.createdAt)} · محفوظة دون تعديل`));
  const rawBox=element('section','raw-box');
  append(rawBox,element('div','block-heading','النص الأصلي كما كُتب'),element('pre','raw-text',idea.raw));
  rawBox.append(element('div','immutable-caption','◈ نسخة أصلية للقراءة فقط — دون تصحيح أو إعادة صياغة'));
  host.append(rawBox);
  if(state.invalidIds.has(idea.id)) host.append(element('p','integrity-banner','تنبيه: بصمة سلامة النص لا تطابق النسخة المحفوظة. صدّر نسخة احتياطية وافحص البيانات.'));
  const analysis=element('section','analysis-block');analysis.append(element('div','block-heading','التنظيم الآلي · طبقة مستقلة'));
  const catRow=element('div','category-row');const label=element('label','field-label','المجال المقترح');label.htmlFor='category-override';
  const select=element('select','category-select');select.id='category-override';
  for(const category of [{id:'auto',name:`تلقائي: ${categoryName(idea.inferredCategory)}`},...CATEGORIES,{id:'other',name:'أفكار متنوعة'}]) {
    const opt=element('option','',category.name);opt.value=category.id==='auto'?'':category.id;select.append(opt);
  }
  const override=state.annotations.find(x=>x.id===idea.id)?.categoryOverride ?? '';
  select.value=override;
  select.addEventListener('change',()=>changeAnnotation(idea,{categoryOverride:select.value}));
  catRow.append(label,select);analysis.append(catRow);
  const tags=element('div','tag-row');
  if(idea.tags.length) for(const tag of idea.tags) tags.append(element('span','tag',`# ${tag}`));
  else tags.append(element('span','muted','لم تُكتشف كلمات مفتاحية كافية بعد.'));
  analysis.append(tags);
  analysis.append(element('p','analysis-note','تصنيف أولي قائم على قواعد وكلمات مفتاحية محلية؛ قابل للتصحيح، ولا يستعمل نموذج ذكاء اصطناعي خارجيًا.'));
  host.append(analysis);
  const directions=element('section','directions');directions.append(element('div','block-heading','آفاق وأسئلة لتطوير الفكرة'));
  for(const [idx,direction] of suggestDirections(idea).entries()) {
    const block=element('div','direction');block.append(element('span','direction-number',`0${idx+1}`));
    const txt=element('div','direction-content');txt.append(element('strong','',direction.title),element('p','',direction.body));block.append(txt);directions.append(block);
  }
  host.append(directions);
  const linked=relatedIdeas(idea,state.items);
  const links=element('section','related-block');links.append(element('div','block-heading',`أفكار قريبة ${linked.length?'· '+linked.length:''}`));
  if(!linked.length) links.append(element('p','muted','لم تظهر روابط نصية كافية بعد. تتضح الصلات كلما أضفت أفكارًا.'));
  else for(const relation of linked) {
    const button=element('button','related-link');button.type='button';button.append(element('span','',relation.item.title),element('span','related-arrow','↗'));
    button.addEventListener('click',()=>{state.view='all';state.category='all';state.query='';$('search').value='';state.selectedId=relation.item.id;render();});
    links.append(button);
  }
  host.append(links);
  const notes=element('section','notes-block');notes.append(element('div','block-heading','ملاحظاتي على الفكرة · منفصلة عن الأصل'));
  const noteLabel=element('label','sr-only','ملاحظات منفصلة على الفكرة');noteLabel.htmlFor='idea-note';
  const textarea=element('textarea','notes-input');textarea.id='idea-note';textarea.rows=3;textarea.maxLength=20000;textarea.placeholder='اكتب ملاحظاتك أو قراراتك اللاحقة هنا. لن تتغير الفكرة الأصلية.';textarea.value=idea.note;
  const save=element('button','button secondary small','احفظ الملاحظات');save.type='button';save.addEventListener('click',()=>changeAnnotation(idea,{note:textarea.value}));
  notes.append(noteLabel,textarea,save);host.append(notes);
}
async function changeAnnotation(idea,changes) {
  try { await saveAnnotation(state.db,idea.id,changes);await refresh();state.selectedId=idea.id;render();message('حُفظت البيانات المشتقة دون تعديل النص الأصلي.'); }
  catch(e){message(e.message||'تعذّر الحفظ.',true);}
}
async function saveNewIdea() {
  const button=$('save-button');const raw=$('idea-input').value;
  button.disabled=true;
  try {
    const entry=await createIdea(state.db,raw);
    state.selectedId=entry.id;state.view='all';state.category='all';state.query='';$('search').value='';
    await refresh();$('idea-input').value='';updateCharCount();message('حُفظت الفكرة الأصلية بنجاح.');
  }catch(e){message(e.message||'تعذّر الحفظ. لم يُمس النص المدخل.',true);}finally{button.disabled=false;}
}
function updateCharCount() { $('char-count').textContent=`${$('idea-input').value.length.toLocaleString('ar-DZ')} حرف`; }
async function handleExport() {
  try {
    const data=await exportArchive(state.db);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download=`afkary-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    message('نُزّلت نسخة احتياطية من الأفكار والملاحظات. احتفظ بها في مكان آمن.');
  }catch(e){message(e.message||'فشل تصدير النسخة الاحتياطية.',true);}
}
async function handleImport(file) {
  if(!file) return;
  try {
    if(file.size > 100*1024*1024) throw new Error('الملف كبير جدًا (الحد 100 ميغابايت).');
    const parsed=JSON.parse(await file.text());
    const result=await importArchive(state.db,parsed);
    await refresh();message(`اكتمل الاستيراد: ${result.added} فكرة جديدة، ${result.skipped} موجودة سلفًا.`);
  }catch(e){message(e.message||'فشل الاستيراد. لم تتغير السجلات الموجودة.',true);}
  finally{$('import-file').value='';}
}
function bindEvents() {
  $('idea-input').addEventListener('input',updateCharCount);
  $('save-button').addEventListener('click',saveNewIdea);
  $('search').addEventListener('input',event=>{state.query=event.target.value;render();});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  $('export-button').addEventListener('click',handleExport);
  $('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',event=>handleImport(event.target.files?.[0]));
  document.addEventListener('keydown',event=>{
    if ((event.ctrlKey||event.metaKey) && event.key==='Enter' && document.activeElement===$('idea-input')) {event.preventDefault();saveNewIdea();}
  });
}
async function start() {
  initTheme();
  initWorkspace();
  bindEvents();
  try {
    state.db=await openDatabase();
    await refresh();
    const requested = new URLSearchParams(location.search).get('idea');
    if (requested && state.items.some(x => x.id===requested)) { state.view='all';state.category='all';state.selectedId=requested;render(); }
  }catch(e){
    for(const id of ['save-button','export-button','import-button']) $(id).disabled=true;
    message(`تعذر تشغيل التخزين المحلي: ${e.message}`,true);
    $('idea-detail').replaceChildren(element('p','integrity-banner',`لا يمكن حفظ الأفكار في هذا المتصفح: ${e.message}. استخدم متصفحًا يدعم IndexedDB في سياق HTTPS.`));
  }
}
start();
