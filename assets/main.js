import { icon } from './icons.js';
import { loadCatalog, validateCatalog, filterApps, escapeHTML as esc, safeURL, STATUS, storage, DRAFT_KEY, formatDate } from './catalog.js';
import { setupUI, toast } from './shared.js';
import { DEMO_APPS } from './demo.js';
setupUI();
const $ = id => document.getElementById(id);
let catalog, mode = 'public', favorites = new Set(), view = storage.get('apphub:view', 'grid');
const state = { q:'', category:'all', status:'all', sort:'curated', favoriteOnly:false };
const params = new URLSearchParams(location.search);
function readParams() {
  const p = new URLSearchParams(location.search);
  state.q = (p.get('q') || '').slice(0,200);
  state.category = catalog?.categories.some(c=>c.id === p.get('category')) ? p.get('category') : 'all';
  state.status = Object.hasOwn(STATUS, p.get('status')) ? p.get('status') : 'all';
  state.sort = ['curated','newest','name'].includes(p.get('sort')) ? p.get('sort') : 'curated';
  state.favoriteOnly = p.get('favorites') === '1';
  $('search').value = state.q; $('status-filter').value = state.status; $('sort').value = state.sort;
}
function syncURL() {
  const p = new URLSearchParams();
  if(mode === 'demo') p.set('demo','1'); if(mode === 'preview') p.set('preview','1');
  if(state.q) p.set('q',state.q); if(state.category !== 'all') p.set('category',state.category); if(state.status !== 'all') p.set('status',state.status); if(state.sort !== 'curated') p.set('sort',state.sort); if(state.favoriteOnly) p.set('favorites','1');
  history.replaceState(null,'',`${location.pathname}${p.size ? '?'+p : ''}${location.hash}`);
}
function apps() { return mode === 'demo' ? DEMO_APPS.filter(a=>catalog.categories.some(c=>c.id===a.category)) : catalog.apps; }
function favoriteKey() { return mode === 'demo' ? 'apphub:demo-favorites' : 'apphub:favorites'; }
function readFavorites() { const saved = storage.get(favoriteKey(), []); favorites = new Set(Array.isArray(saved) ? saved.filter(x=>typeof x === 'string') : []); }
function setMode(next) {
  mode = next; state.q=''; state.category='all'; state.status='all'; state.favoriteOnly=false;
  $('search').value=''; $('status-filter').value='all'; readFavorites(); render(); syncURL();
}
function categoryName(id) { return catalog.categories.find(c=>c.id === id)?.name || ''; }
function renderCategories() {
  const list = apps().filter(a=>a.visible);
  $('category-grid').innerHTML = catalog.categories.map(c=>`<button type="button" class="category-card color-${c.color} ${state.category === c.id ? 'is-active' : ''}" data-category="${c.id}" aria-pressed="${state.category === c.id}"><span class="category-icon">${icon(c.icon)}</span><span class="category-copy"><strong>${esc(c.name)}</strong><span>${esc(c.description)}</span></span><span class="category-arrow">${icon('arrow')}</span><span class="category-count">${mode === 'demo' ? 'النماذج' : 'التطبيقات'}: ${list.filter(a=>a.category === c.id).length}</span></button>`).join('');
  $('filter-chips').innerHTML = [{id:'all',name:'الكل'}, ...catalog.categories].map(c=>`<button type="button" class="chip ${state.category === c.id ? 'active' : ''}" data-category="${c.id}" aria-pressed="${state.category === c.id}">${esc(c.name)}${c.id === 'all' ? `<span>${list.length}</span>` : ''}</button>`).join('');
}
function card(app) {
  const favorite = favorites.has(app.id);
  const action = app.demo ? `<button class="card-open" data-details="${app.id}" type="button">معاينة النموذج ${icon('eye')}</button>` : app.status === 'coming-soon' ? `<span class="card-coming">${icon('clock')} قريبًا</span>` : `<a class="card-open" href="${esc(safeURL(app.url))}" target="_blank" rel="noopener noreferrer">افتح التطبيق ${icon('external')}<span class="sr-only"> — ${esc(app.title)}، علامة تبويب جديدة</span></a>`;
  return `<article class="app-card color-${app.color}"><div class="card-art"><div class="card-art-lines"></div><span class="app-icon">${icon(app.icon)}</span>${app.featured ? `<span class="featured-badge">${icon('sparkle')} مميّز</span>` : ''}<button type="button" class="favorite-button ${favorite?'saved':''}" data-favorite="${app.id}" aria-pressed="${favorite}" aria-label="${favorite?'إزالة':'إضافة'} ${esc(app.title)} ${favorite?'من':'إلى'} المفضلة">${icon('star')}</button>${app.demo ? '<span class="demo-label">نموذج توضيحي</span>' : ''}</div><div class="card-body"><div class="card-meta"><span>${esc(categoryName(app.category))}</span><span class="status-badge status-${app.status}"><span></span>${STATUS[app.status]}</span></div><h3><button type="button" data-details="${app.id}">${esc(app.title)}</button></h3><p>${esc(app.description)}</p><div class="tags">${app.tags.slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="card-footer">${action}<button type="button" class="details-button" data-details="${app.id}" aria-label="تفاصيل ${esc(app.title)}">التفاصيل ${icon('arrow')}</button></div></div></article>`;
}
function render() {
  renderCategories();
  const list = apps().filter(a=>a.visible);
  const found = filterApps(apps(), {...state, favorites:state.favoriteOnly ? favorites : null});
  $('favorites-count').textContent = list.filter(a=>favorites.has(a.id)).length;
  $('favorites-nav').classList.toggle('active', state.favoriteOnly);
  $('favorites-nav').setAttribute('aria-pressed', String(state.favoriteOnly));
  $('browse-nav').classList.toggle('active', !state.favoriteOnly);
  $('catalog-title').innerHTML = state.favoriteOnly ? 'مساحتك المفضلة<span class="title-dot">.</span>' : 'اكتشف تطبيقك القادم<span class="title-dot">.</span>';
  $('catalog-subtitle').textContent = state.favoriteOnly ? 'التطبيقات التي حفظتها في هذا المتصفح.' : 'تصفّح المجموعة، أو ابحث عمّا تحتاجه.';
  $('mode-banner').hidden = mode === 'public';
  $('mode-banner').innerHTML = mode === 'demo' ? `${icon('info')}<div><strong>أنت تستعرض أمثلة توضيحية.</strong> هذه بطاقات لتجربة التصميم والبحث؛ ليست تطبيقات منشورة.</div><button type="button" id="exit-mode">العودة للفهرس الحقيقي ${icon('close')}</button>` : `${icon('eye')}<div><strong>معاينة مسودتك المحلية.</strong> هذه التعديلات لم تُنشر للزوار بعد.</div><a href="./admin.html">العودة إلى المحرر ${icon('arrow')}</a>`;
  $('hero-demo').innerHTML = `${icon('eye')} ${mode === 'demo' ? 'العودة للفهرس الحقيقي' : mode === 'preview' ? 'العودة للفهرس المنشور' : 'شاهد شكل الفهرس'}`;
  $('results-count').textContent = `النتائج: ${found.length}${found.length !== list.length ? ` من ${list.length}` : ''}${mode === 'demo' ? ' · نماذج توضيحية' : ''}`;
  $('apps-grid').classList.toggle('list-view',view === 'list');
  $('apps-grid').innerHTML = found.map(card).join('');
  $('apps-grid').setAttribute('aria-busy','false');
  $('empty-state').hidden = found.length > 0;
  if(!found.length) {
    if(!list.length && !state.q && state.category === 'all' && state.status === 'all' && !state.favoriteOnly) {
      $('empty-state').innerHTML = `<div class="empty-illustration">${icon('grid')}<span>+</span></div><span class="overline">هنا تبدأ المجموعة</span><h3>مساحة جاهزة لأول تطبيق.</h3><p>لم تُضف تطبيقات إلى الفهرس بعد.<br>ستجد هنا أدوات وتجارب جديدة مع كل إضافة.</p><div class="empty-actions"><a class="button primary" href="./admin.html">${icon('plus')} أضف أول تطبيق</a><button type="button" class="button secondary" id="empty-demo">جرّب أمثلة العرض ${icon('arrow')}</button></div>`;
    } else {
      $('empty-state').innerHTML = `<div class="empty-small">${icon(state.favoriteOnly?'star':'search')}</div><h3>${state.favoriteOnly ? 'لا توجد تطبيقات مفضلة هنا بعد.' : 'لم نعثر على نتيجة مطابقة.'}</h3><p>${state.favoriteOnly ? 'اضغط على النجمة في بطاقة أي تطبيق لحفظه في هذه المساحة.' : 'جرّب كلمة أخرى أو أزل بعض الفلاتر لتوسيع البحث.'}</p><button type="button" class="button secondary" id="clear-filters">عرض جميع التطبيقات ${icon('arrow')}</button>`;
    }
  }
  ['grid','list'].forEach(v=>{ $(`${v}-view`).classList.toggle('selected',view===v); $(`${v}-view`).setAttribute('aria-pressed',String(view===v)); });
}
function openDetails(id) {
  const app = apps().find(a=>a.id===id && a.visible); if(!app) return;
  $('dialog-content').innerHTML = `<div class="dialog-art color-${app.color}"><span class="app-icon">${icon(app.icon)}</span></div><div class="dialog-main"><span class="overline">${esc(categoryName(app.category))}</span><h2 id="dialog-title">${esc(app.title)}</h2><span class="status-badge status-${app.status}"><span></span>${STATUS[app.status]}</span><p class="dialog-description">${esc(app.description)}</p><div class="tags">${app.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="dialog-date">تاريخ الإضافة: <bdi>${formatDate(app.addedAt)}</bdi></div>${app.demo ? '<p class="notice">نموذج توضيحي لتجربة عرض التطبيق. لا يوجد رابط تشغيل لهذا المثال.</p>' : app.status === 'coming-soon' ? '<p class="notice">هذا التطبيق قيد التحضير. سيُتاح رابط التشغيل عند إطلاقه.</p>' : `<a class="button primary" href="${esc(safeURL(app.url))}" target="_blank" rel="noopener noreferrer">افتح التطبيق ${icon('external')}<span class="sr-only">في علامة تبويب جديدة</span></a>`}</div>`;
  $('app-dialog').showModal();
}
document.addEventListener('click', e => {
  const category = e.target.closest('[data-category]');
  if(category && catalog) { state.category=category.dataset.category; render(); syncURL(); if(category.classList.contains('category-card')) $('catalog').scrollIntoView({behavior:'smooth'}); }
  const favorite = e.target.closest('[data-favorite]');
  if(favorite) { const id=favorite.dataset.favorite; const saved = favorites.has(id); saved ? favorites.delete(id) : favorites.add(id); if(!storage.set(favoriteKey(),[...favorites])) toast('حُفظ التغيير لهذه الجلسة فقط؛ تخزين المتصفح غير متاح.'); else toast(saved ? 'أُزيل التطبيق من المفضلة.' : 'أُضيف التطبيق إلى المفضلة.'); render(); const replacement=document.querySelector(`[data-favorite="${id}"]`); (replacement || $('favorites-nav')).focus({preventScroll:true}); }
  const details = e.target.closest('[data-details]'); if(details) openDetails(details.dataset.details);
  if(e.target.closest('#exit-mode')) setMode('public');
  if(e.target.closest('#empty-demo')) setMode('demo');
  if(e.target.closest('#clear-filters')) { state.q=''; state.category='all'; state.status='all'; state.favoriteOnly=false; $('search').value=''; $('status-filter').value='all'; render(); syncURL(); }
});
$('hero-demo').addEventListener('click',()=>{ if(!catalog) return; if(mode === 'preview'){location.href='./#catalog';return;} setMode(mode === 'demo' ? 'public' : 'demo'); $('catalog').scrollIntoView({behavior:'smooth'}); });
$('search').addEventListener('input',e=>{if(!catalog)return;state.q=e.target.value;render();syncURL();});
$('status-filter').addEventListener('change',e=>{if(!catalog)return;state.status=e.target.value;render();syncURL();});
$('sort').addEventListener('change',e=>{if(!catalog)return;state.sort=e.target.value;render();syncURL();});
$('favorites-nav').addEventListener('click',()=>{if(!catalog)return;state.favoriteOnly=!state.favoriteOnly;render();syncURL();$('catalog').scrollIntoView({behavior:'smooth'});});
$('browse-nav').addEventListener('click',()=>{if(!catalog)return;state.favoriteOnly=false;render();syncURL();});
['grid','list'].forEach(v=>$(`${v}-view`).addEventListener('click',()=>{view=v;storage.set('apphub:view',v);if(catalog)render();}));
document.querySelector('.dialog-close').addEventListener('click',()=>$('app-dialog').close());
document.addEventListener('keydown',e=>{if(e.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('app-dialog').open && !e.ctrlKey && !e.metaKey){e.preventDefault();$('search').focus();}});
window.addEventListener('popstate',()=>{if(catalog){const p=new URLSearchParams(location.search); const next=p.get('demo')==='1'?'demo':p.get('preview')==='1'?'preview':'public'; if(next!==mode){location.reload();return;} readParams();render();}});
try {
  if(params.get('preview') === '1') { const draft=storage.get(DRAFT_KEY); if(!draft) throw new Error('لا توجد مسودة محلية لمعاينتها. افتح محرر الفهرس واحفظ تطبيقًا أولًا.'); catalog=validateCatalog(draft.catalog); mode='preview'; }
  else { catalog=await loadCatalog(); if(params.get('demo')==='1') mode='demo'; }
  readParams(); readFavorites(); render();
} catch(error) {
  $('load-error').hidden=false;
  $('load-error').innerHTML=`${icon('info')}<h3>تعذّر عرض الفهرس</h3><p>${esc(error.message)}</p><a class="button secondary" href="./">إعادة المحاولة</a><a class="text-button" href="./admin.html">افتح محرر الفهرس</a>`;
  $('category-grid').textContent='المجالات غير متاحة حاليًا.'; $('results-count').textContent=''; $('apps-grid').setAttribute('aria-busy','false');
}
