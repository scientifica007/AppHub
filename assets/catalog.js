import { iconNames } from './icons.js';

export const COLORS = { green: 'أخضر', blue: 'أزرق', orange: 'برتقالي', purple: 'بنفسجي', rose: 'وردي', sand: 'رملي' };
export const STATUS = { available: 'متاح الآن', beta: 'نسخة تجريبية', 'coming-soon': 'قريبًا' };
export const DRAFT_KEY = 'apphub:catalog-draft:v1';
export const ICON_LABELS = { grid:'تطبيق', book:'كتاب', layers:'طبقات', tools:'أدوات', game:'لعبة', atom:'ذرّة', file:'وثيقة', chart:'مخطط', globe:'موقع', code:'برمجة', sparkle:'إبداع', folder:'مجلد', clock:'وقت' };
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function safeURL(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
}
export function normalize(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('ar').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
}
export function validateCatalog(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('الفهرس يجب أن يكون كائن JSON.');
  if (data.schemaVersion !== 1) errors.push('إصدار الفهرس غير مدعوم: schemaVersion يجب أن يساوي 1.');
  if (!Array.isArray(data.categories) || !Array.isArray(data.apps)) throw new Error('يجب أن يحتوي الفهرس على قائمتي categories وapps.');
  if (data.categories.length > 100 || data.apps.length > 5000) errors.push('تجاوز الفهرس الحد المسموح (100 مجال و5000 تطبيق).');
  const ids = new Set(), appIds = new Set();
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const idOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
  data.categories.forEach((c, i) => {
    const tag = `المجال ${i + 1}`;
    if (!c || typeof c !== 'object') { errors.push(`${tag}: بيانات غير صالحة.`); return; }
    if (!idOK(c.id) || ids.has(c.id)) errors.push(`${tag}: المعرّف غير صالح أو مكرر.`);
    ids.add(c.id);
    if (!text(c.name, 80)) errors.push(`${tag}: الاسم مطلوب وبحد أقصى 80 حرفًا.`);
    if (typeof c.description !== 'string' || c.description.length > 200) errors.push(`${tag}: الوصف غير صالح.`);
    if (!Object.hasOwn(COLORS, c.color) || !iconNames.includes(c.icon)) errors.push(`${tag}: اللون أو الأيقونة غير مدعوم.`);
  });
  data.apps.forEach((app, i) => {
    const tag = `التطبيق ${i + 1}`;
    if (!app || typeof app !== 'object') { errors.push(`${tag}: بيانات غير صالحة.`); return; }
    if (!idOK(app.id) || appIds.has(app.id)) errors.push(`${tag}: المعرّف غير صالح أو مكرر.`);
    appIds.add(app.id);
    if (!text(app.title, 80) || !text(app.description, 800)) errors.push(`${tag}: الاسم (80 حرفًا) والوصف (800 حرف) مطلوبان.`);
    if (!ids.has(app.category)) errors.push(`${tag}: المجال غير موجود.`);
    if (!Object.hasOwn(STATUS, app.status)) errors.push(`${tag}: الحالة غير مدعومة.`);
    if (typeof app.url !== 'string' || (app.url && (!safeURL(app.url) || app.url.length > 2000)) || (!app.url && app.status !== 'coming-soon')) errors.push(`${tag}: أدخل رابط http أو https؛ يُسمح بتركه فارغًا للتطبيق القادم فقط.`);
    if (app.previewImage !== undefined && (typeof app.previewImage !== 'string' || app.previewImage.length > 2000 || (app.previewImage && !safeURL(app.previewImage)))) errors.push(`${tag}: صورة المعاينة يجب أن تكون رابط http أو https صالحًا، أو حقلًا فارغًا.`);
    if (!Object.hasOwn(COLORS, app.color) || !iconNames.includes(app.icon)) errors.push(`${tag}: اللون أو الأيقونة غير مدعوم.`);
    if (typeof app.featured !== 'boolean' || typeof app.visible !== 'boolean') errors.push(`${tag}: featured وvisible يجب أن يكونا true أو false.`);
    if (!Array.isArray(app.tags) || app.tags.length > 10 || app.tags.some(t => !text(t, 35))) errors.push(`${tag}: الوسوم يجب أن تكون قائمة لا تتجاوز 10 وسوم قصيرة.`);
    if (typeof app.addedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(app.addedAt) || !Number.isFinite(Date.parse(app.addedAt)) || new Date(app.addedAt).toISOString().slice(0,10) !== app.addedAt) errors.push(`${tag}: التاريخ غير صالح؛ استخدم YYYY-MM-DD.`);
    if (!Number.isInteger(app.order) || app.order < 0 || app.order > 999999) errors.push(`${tag}: الترتيب يجب أن يكون عددًا صحيحًا من 0 إلى 999999.`);
  });
  if (errors.length) throw new Error(errors.join('\n'));
  return data;
}
export async function loadCatalog() {
  const response = await fetch(new URL('../data/apps.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error('تعذّر تحميل الفهرس. تحقق من اتصال الإنترنت ثم حاول مجددًا.');
  return validateCatalog(await response.json());
}
export function filterApps(apps, { q='', category='all', status='all', favorites=null, sort='curated' } = {}) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const found = apps.filter(app => app.visible && (category === 'all' || app.category === category) && (status === 'all' || app.status === status) && (!favorites || favorites.has(app.id)) && words.every(w => normalize([app.title, app.description, ...app.tags].join(' ')).includes(w)));
  return found.sort((a,b) => sort === 'name' ? a.title.localeCompare(b.title,'ar') : sort === 'newest' ? b.addedAt.localeCompare(a.addedAt) || a.order-b.order : Number(b.featured)-Number(a.featured) || a.order-b.order || b.addedAt.localeCompare(a.addedAt));
}
export const storage = {
  get(key, fallback = null) { try { const v=localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }
};
export function formatDate(date) { return date ? date.split('-').reverse().join('/') : ''; }
export function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
