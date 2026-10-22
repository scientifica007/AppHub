import { icon } from './icons.js';
import { loadCatalog, validateCatalog, filterApps, escapeHTML as esc, safeURL, STATUS, storage, DRAFT_KEY, formatDate } from './catalog.js';
import { setupUI, toast } from './shared.js';
import { DEMO_APPS } from './demo.js';
import { previewMarkup } from './previews.js';

setupUI();
const $ = id => document.getElementById(id);
let catalog, mode = 'public', favorites = new Set();
let view = storage.get('apphub:view', 'grid') === 'list' ? 'list' : 'grid';
const state = { q:'', category:'all', status:'all', sort:'curated', favoriteOnly:false, explore:true };
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(max-width: 900px)');
let drawerOpen = false;

function setDrawer(open, returnFocus = false) {
  drawerOpen = Boolean(open && mobile.matches);
  $('workspace-sidebar').classList.toggle('is-open', drawerOpen);
  $('workspace-sidebar').inert = mobile.matches && !drawerOpen;
  $('workspace-main').inert = drawerOpen;
  document.querySelector('.mobile-header').inert = drawerOpen;
  $('sidebar-overlay').hidden = !drawerOpen;
  $('menu-toggle').setAttribute('aria-expanded', String(drawerOpen));
  document.body.classList.toggle('drawer-open', drawerOpen);
  if (drawerOpen) {
    $('workspace-sidebar').setAttribute('role', 'dialog');
    $('workspace-sidebar').setAttribute('aria-modal', 'true');
    $('sidebar-close').focus();
  } else {
    $('workspace-sidebar').removeAttribute('role');
    $('workspace-sidebar').removeAttribute('aria-modal');
    if (returnFocus && mobile.matches) $('menu-toggle').focus();
  }
}
$('menu-toggle').addEventListener('click', () => setDrawer(true));
$('sidebar-close').addEventListener('click', () => setDrawer(false, true));
$('sidebar-overlay').addEventListener('click', () => setDrawer(false, true));
$('filter-toggle').addEventListener('click', () => {
  const open = $('filter-panel').hidden;
  $('filter-panel').hidden = !open;
  $('filter-toggle').setAttribute('aria-expanded', String(open));
});
mobile.addEventListener('change', () => setDrawer(false));
setDrawer(false);

function readParams() {
  const p = new URLSearchParams(location.search);
  state.q = (p.get('q') || '').slice(0, 200);
  state.category = catalog.categories.some(c => c.id === p.get('category')) ? p.get('category') : 'all';
  state.status = Object.hasOwn(STATUS, p.get('status')) ? p.get('status') : 'all';
  state.sort = ['curated', 'newest', 'name'].includes(p.get('sort')) ? p.get('sort') : 'curated';
  state.favoriteOnly = p.get('favorites') === '1';
  state.explore = p.get('section') !== 'all';
  $('search').value = state.q;
  $('status-filter').value = state.status;
  $('sort').value = state.sort;
}
function syncURL() {
  const p = new URLSearchParams();
  if (mode === 'demo') p.set('demo', '1');
  if (mode === 'preview') p.set('preview', '1');
  if (state.q) p.set('q', state.q);
  if (state.category !== 'all') p.set('category', state.category);
  if (state.status !== 'all') p.set('status', state.status);
  if (state.sort !== 'curated') p.set('sort', state.sort);
  if (state.favoriteOnly) p.set('favorites', '1');
  if (!state.explore && !state.favoriteOnly) p.set('section', 'all');
  history.replaceState(null, '', `${location.pathname}${p.size ? '?' + p : ''}${location.hash}`);
}
function apps() { return mode === 'demo' ? DEMO_APPS.filter(a => catalog.categories.some(c => c.id === a.category)) : catalog.apps; }
function favoriteKey() { return mode === 'demo' ? 'apphub:demo-favorites' : 'apphub:favorites'; }
function readFavorites() {
  const saved = storage.get(favoriteKey(), []);
  favorites = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []);
}
function clearFilters() {
  Object.assign(state, { q:'', category:'all', status:'all', favoriteOnly:false });
  $('search').value = '';
  $('status-filter').value = 'all';
}
function setMode(next) {
  mode = next;
  clearFilters();
  state.explore = true;
  readFavorites();
  render();
  syncURL();
  setDrawer(false, true);
}
function categoryName(id) { return catalog.categories.find(c => c.id === id)?.name || ''; }
const discoveryText = {
  education:'أريد أن أتعلّم شيئًا جديدًا',
  productivity:'أريد أن أنظّم مهامي اليومية',
  tools:'أحتاج إلى أداة مفيدة',
  games:'وقت لتجربة ممتعة'
};
function renderCategories() {
  const visible = apps().filter(a => a.visible);
  $('sidebar-categories').innerHTML = catalog.categories.map(c => `<button type="button" class="sidebar-link ${state.category === c.id ? 'active' : ''}" data-category="${c.id}" data-sidebar-category="${c.id}" aria-pressed="${state.category === c.id}">${icon(c.icon)}<span>${esc(c.name)}</span></button>`).join('');
  $('category-grid').innerHTML = catalog.categories.map(c => `<button type="button" class="discovery-link ${state.category === c.id ? 'active' : ''}" data-category="${c.id}" aria-pressed="${state.category === c.id}">${icon(c.icon)}<span>${esc(discoveryText[c.id] || c.name)}</span>${icon('arrow')}</button>`).join('');
  $('filter-chips').innerHTML = [{ id:'all', name:'الكل' }, ...catalog.categories].map(c => `<button type="button" class="chip ${state.category === c.id ? 'active' : ''}" data-category="${c.id}" aria-pressed="${state.category === c.id}">${esc(c.name)}${c.id === 'all' ? `<span>${visible.length}</span>` : ''}</button>`).join('');
}
function favoriteButton(app) {
  const saved = favorites.has(app.id);
  return `<button type="button" class="tile-favorite ${saved ? 'saved' : ''}" data-favorite="${app.id}" aria-pressed="${saved}" aria-label="${saved ? 'إزالة' : 'إضافة'} ${esc(app.title)} ${saved ? 'من' : 'إلى'} المفضلة">${icon('heart')}</button>`;
}
function appAction(app) {
  if (app.demo) return `<button class="tile-launch" data-details="${app.id}" type="button">معاينة النموذج ${icon('eye')}</button>`;
  if (app.status === 'coming-soon') return `<span class="tile-coming">${icon('clock')} متاح قريبًا</span>`;
  return `<a class="tile-launch" href="${esc(safeURL(app.url))}" target="_blank" rel="noopener noreferrer">فتح التطبيق ${icon('external')}<span class="sr-only"> — ${esc(app.title)}، في علامة تبويب جديدة</span></a>`;
}
function card(app, featured = false) {
  return `<article class="app-tile color-${app.color} ${featured ? 'is-featured' : ''}">${previewMarkup(app)}<div class="tile-content"><div class="tile-meta"><span class="tile-category">${icon(app.icon)}${esc(categoryName(app.category))}</span>${featured ? `<span class="tile-featured-label">${icon('sparkle')} تحت الضوء</span>` : `<span class="status-badge status-${app.status}"><span></span>${STATUS[app.status]}</span>`}</div><h3><button type="button" data-details="${app.id}">${esc(app.title)}</button></h3><p class="tile-description">${esc(app.description)}</p><div class="tile-tags">${app.tags.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div><div class="tile-actions">${appAction(app)}<div>${favoriteButton(app)}<button class="tile-details" type="button" data-details="${app.id}" aria-label="تفاصيل ${esc(app.title)}">${icon('info')}</button></div></div></div></article>`;
}
function renderEmpty(visible) {
  const initial = !visible.length && !state.q && state.category === 'all' && state.status === 'all' && !state.favoriteOnly;
  $('empty-state').classList.toggle('first-app', initial);
  if (initial) {
    $('empty-state').innerHTML = `<div class="empty-copy"><span class="empty-kicker">مساحتك التالية تبدأ هنا</span><h3>كل تطبيق تضيفه،<br><span>يفتح احتمالًا جديدًا.</span></h3><p>الفهرس جاهز لاستقبال تطبيقاتك.<br>أضف أول تطبيق، أو استكشف طريقة العرض بالأمثلة.</p><div class="empty-workspace-actions"><a class="button primary" href="./admin.html">${icon('plus')} إضافة أول تطبيق</a><button type="button" class="button secondary" id="empty-demo">جرّب أمثلة العرض ${icon('arrow')}</button></div></div><div class="empty-preview">${previewMarkup({ id:'workspace-example', title:'شكل عرض التطبيقات', icon:'atom', demo:true })}<span class="empty-preview-caption">هكذا تتحول الفكرة إلى بطاقة في مساحتك.</span></div>`;
  } else {
    $('empty-state').innerHTML = `<div class="empty-search-icon">${icon(state.favoriteOnly ? 'heart' : 'search')}</div><h3>${state.favoriteOnly ? 'مساحة لأدواتك المفضلة.' : 'لم نعثر على نتيجة مطابقة.'}</h3><p>${state.favoriteOnly ? 'اضغط على القلب في بطاقة أي تطبيق لحفظه هنا في هذا المتصفح.' : 'جرّب كلمة أخرى أو غيّر المجال وحالة التطبيق.'}</p><button type="button" class="button secondary" id="clear-filters">عرض جميع التطبيقات ${icon('arrow')}</button>`;
  }
}
function render() {
  renderCategories();
  const visible = apps().filter(a => a.visible);
  const found = filterApps(apps(), { ...state, favorites:state.favoriteOnly ? favorites : null });
  const discover = state.explore && !state.favoriteOnly && state.category === 'all';
  for (const [id, active] of [['browse-nav', discover], ['all-apps-nav', !state.explore && !state.favoriteOnly && state.category === 'all'], ['favorites-nav', state.favoriteOnly]]) {
    $(id).classList.toggle('active', active);
    $(id).setAttribute('aria-pressed', String(active));
  }
  $('favorites-count').textContent = visible.filter(a => favorites.has(a.id)).length;
  $('catalog-title').textContent = state.favoriteOnly ? 'مساحتك المفضّلة' : state.category !== 'all' ? categoryName(state.category) : state.explore ? 'مساحة الاكتشاف' : 'كل التطبيقات';
  $('catalog-subtitle').textContent = state.favoriteOnly ? 'تطبيقاتك المحفوظة، قريبة منك دائمًا.' : state.category !== 'all' ? catalog.categories.find(c => c.id === state.category)?.description : 'تطبيقات تستحق أن تجد مكانًا في يومك.';
  $('collection-label').textContent = mode === 'demo' ? 'نماذج للعرض' : mode === 'preview' ? 'مسودة محلية' : 'الفهرس المنشور';
  $('mode-banner').hidden = mode === 'public';
  $('mode-banner').innerHTML = mode === 'demo'
    ? `${icon('info')}<div><strong>أمثلة لتجربة مساحة العمل.</strong> هذه نماذج توضيحية وليست تطبيقات منشورة.</div><button type="button" id="exit-mode">الفهرس الحقيقي ${icon('close')}</button>`
    : `${icon('eye')}<div><strong>معاينة مسودتك المحلية.</strong> هذه التعديلات لم تُنشر للزوار بعد.</div><a href="./admin.html">العودة إلى المحرر ${icon('arrow')}</a>`;
  $('hero-demo').innerHTML = `${icon('eye')}<span>${mode === 'demo' ? 'الفهرس الحقيقي' : mode === 'preview' ? 'الفهرس المنشور' : 'جرّب أمثلة العرض'}</span>`;
  $('results-count').textContent = `النتائج: ${found.length}${found.length !== visible.length ? ` من ${visible.length}` : ''}`;
  const featured = discover && !state.q && state.status === 'all' && state.sort === 'curated' && view === 'grid' ? found.find(app => app.featured) : null;
  $('apps-grid').classList.toggle('list-view', view === 'list');
  $('apps-grid').innerHTML = found.map(app => card(app, app === featured)).join('');
  $('apps-grid').setAttribute('aria-busy', 'false');
  $('empty-state').hidden = found.length > 0;
  if (!found.length) renderEmpty(visible);
  for (const v of ['grid', 'list']) {
    $(`${v}-view`).classList.toggle('selected', view === v);
    $(`${v}-view`).setAttribute('aria-pressed', String(view === v));
  }
}
function openDetails(id) {
  const app = apps().find(a => a.id === id && a.visible);
  if (!app) return;
  $('dialog-content').innerHTML = `${previewMarkup(app)}<div class="dialog-main"><span class="overline">${esc(categoryName(app.category))}</span><h2 id="dialog-title">${esc(app.title)}</h2><span class="status-badge status-${app.status}"><span></span>${STATUS[app.status]}</span><p class="dialog-description">${esc(app.description)}</p><div class="tags">${app.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div><div class="dialog-date">تاريخ الإضافة: <bdi>${formatDate(app.addedAt)}</bdi></div>${app.demo ? '<p class="notice">نموذج توضيحي لتجربة التصميم. لا يوجد رابط تشغيل لهذا المثال.</p>' : app.status === 'coming-soon' ? '<p class="notice">هذا التطبيق قيد التحضير. سيُتاح رابط التشغيل عند إطلاقه.</p>' : `<a class="button primary" href="${esc(safeURL(app.url))}" target="_blank" rel="noopener noreferrer">فتح التطبيق ${icon('external')}<span class="sr-only">في علامة تبويب جديدة</span></a>`}</div>`;
  $('app-dialog').showModal();
}
document.addEventListener('click', e => {
  const category = e.target.closest('[data-category]');
  if (category && catalog) {
    const sidebarId = category.dataset.sidebarCategory;
    state.category = category.dataset.category;
    render(); syncURL(); setDrawer(false, true);
    if (!mobile.matches && sidebarId) document.querySelector(`[data-sidebar-category="${sidebarId}"]`)?.focus({ preventScroll:true });
    $('catalog').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  const favorite = e.target.closest('[data-favorite]');
  if (favorite && catalog) {
    const id = favorite.dataset.favorite, saved = favorites.has(id);
    saved ? favorites.delete(id) : favorites.add(id);
    if (!storage.set(favoriteKey(), [...favorites])) toast('حُفظ التغيير لهذه الجلسة فقط؛ تخزين المتصفح غير متاح.');
    else toast(saved ? 'أُزيل التطبيق من المفضلة.' : 'أُضيف التطبيق إلى المفضلة.');
    render();
    (document.querySelector(`[data-favorite="${id}"]`) || $('favorites-nav')).focus({ preventScroll:true });
  }
  const details = e.target.closest('[data-details]');
  if (details && catalog) openDetails(details.dataset.details);
  if (e.target.closest('#exit-mode')) setMode('public');
  if (e.target.closest('#empty-demo')) setMode('demo');
  if (e.target.closest('#clear-filters') && catalog) { clearFilters(); state.explore = false; render(); syncURL(); }
});
$('hero-demo').addEventListener('click', () => {
  if (!catalog) return;
  if (mode === 'preview') { location.href = './'; return; }
  setMode(mode === 'demo' ? 'public' : 'demo');
});
$('search').addEventListener('input', e => { if (!catalog) return; state.q = e.target.value; render(); syncURL(); });
$('status-filter').addEventListener('change', e => { if (!catalog) return; state.status = e.target.value; render(); syncURL(); });
$('sort').addEventListener('change', e => { if (!catalog) return; state.sort = e.target.value; render(); syncURL(); });
$('favorites-nav').addEventListener('click', () => { if (!catalog) return; state.favoriteOnly = !state.favoriteOnly; render(); syncURL(); setDrawer(false, true); });
for (const [id, explore] of [['browse-nav', true], ['all-apps-nav', false]]) {
  $(id).addEventListener('click', () => { if (!catalog) return; clearFilters(); state.explore = explore; render(); syncURL(); setDrawer(false, true); });
}
for (const v of ['grid', 'list']) $(`${v}-view`).addEventListener('click', () => { view = v; storage.set('apphub:view', v); if (catalog) render(); });
document.querySelector('.dialog-close').addEventListener('click', () => $('app-dialog').close());
document.addEventListener('error', e => {
  if (e.target.matches?.('img[data-preview-image]')) {
    const preview = e.target.closest('.app-preview');
    preview.classList.add('image-failed');
    preview.querySelector('.preview-label').textContent = 'رسم توضيحي · تعذّر تحميل الصورة';
  }
}, true);
document.addEventListener('keydown', e => {
  if (drawerOpen) {
    if (e.key === 'Escape') { e.preventDefault(); setDrawer(false, true); }
    if (e.key === 'Tab') {
      const focusable = [...$('workspace-sidebar').querySelectorAll('a[href], button:not(:disabled)')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (!$('app-dialog').open && ((e.key === '/' && !input && !e.ctrlKey && !e.metaKey) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)))) {
    e.preventDefault(); $('search').focus();
  }
});
window.addEventListener('popstate', () => {
  if (!catalog) return;
  const p = new URLSearchParams(location.search);
  const next = p.get('demo') === '1' ? 'demo' : p.get('preview') === '1' ? 'preview' : 'public';
  if (next !== mode) { location.reload(); return; }
  readParams(); render();
});
try {
  if (params.get('preview') === '1') {
    const draft = storage.get(DRAFT_KEY);
    if (!draft) throw new Error('لا توجد مسودة محلية لمعاينتها. افتح محرر الفهرس واحفظ تطبيقًا أولًا.');
    catalog = validateCatalog(draft.catalog); mode = 'preview';
  } else {
    catalog = await loadCatalog();
    if (params.get('demo') === '1') mode = 'demo';
  }
  readParams(); readFavorites(); render();
} catch (error) {
  $('load-error').hidden = false;
  $('load-error').innerHTML = `${icon('info')}<h3>تعذّر عرض الفهرس</h3><p>${esc(error.message)}</p><a class="button secondary" href="./">إعادة المحاولة</a><a class="text-button" href="./admin.html">افتح محرر الفهرس</a>`;
  $('sidebar-categories').textContent = 'المجالات غير متاحة حاليًا.';
  $('results-count').textContent = '';
  $('apps-grid').setAttribute('aria-busy', 'false');
}
