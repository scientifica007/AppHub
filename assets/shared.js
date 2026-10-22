import { icon, hydrateIcons } from './icons.js';
import { storage } from './catalog.js';
let timer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(timer); timer = setTimeout(() => el.classList.remove('visible'), 3800);
}
export function setupUI() {
  hydrateIcons();
  const btn = document.getElementById('theme-toggle');
  function syncTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (btn) { btn.innerHTML = icon(dark ? 'sun' : 'moon'); btn.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'); }
    document.querySelectorAll('[data-theme-choice]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.themeChoice === (dark ? 'dark' : 'light'))));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#15181d' : '#f2f3f5';
  }
  function setTheme(next) { document.documentElement.dataset.theme = next; if (!storage.set('apphub:theme', next)) toast('تعذّر حفظ المظهر في هذا المتصفح.'); syncTheme(); }
  syncTheme();
  btn?.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('[data-theme-choice]').forEach(choice => choice.addEventListener('click', () => setTheme(choice.dataset.themeChoice)));
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
  document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('click', e => { if(e.target === dialog && !dialog.classList.contains('editor-dialog')) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } }); });
}
