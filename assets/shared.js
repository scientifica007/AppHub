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
  function syncTheme() { const dark = document.documentElement.dataset.theme === 'dark'; btn.innerHTML = icon(dark ? 'sun' : 'moon'); btn.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'); }
  syncTheme();
  btn.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; if (!storage.set('apphub:theme', next)) toast('تعذّر حفظ المظهر في هذا المتصفح.'); syncTheme(); });
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
  document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('click', e => { if(e.target === dialog && !dialog.classList.contains('editor-dialog')) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } }); });
}
