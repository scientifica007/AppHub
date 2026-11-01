/** A purely visual preference, persisted only in this browser. Never touches idea records. */
export const THEMES = Object.freeze([
  { id: 'charcoal', title: 'فحمي', subtitle: 'هدوء وتركيز' },
  { id: 'paper', title: 'ورقي', subtitle: 'قراءة على خلفية دافئة' },
  { id: 'twilight', title: 'شفق', subtitle: 'آفاق صحراوية متدرجة' },
  { id: 'cosmos', title: 'سماء ليلية', subtitle: 'نجوم وجبال بعيدة' },
  { id: 'oasis', title: 'واحة', subtitle: 'جبال وبحيرة وعمق بصري' }
]);
export const THEME_KEY = 'afkary:theme:v1';
export function validTheme(value) { return THEMES.some(x => x.id === value) ? value : 'charcoal'; }
export function readTheme(storage = localStorage) {
  try { return validTheme(storage.getItem(THEME_KEY)); } catch { return 'charcoal'; }
}
export function setTheme(value, storage = localStorage) {
  const theme = validTheme(value);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'paper' ? '#f4f0e6' : '#101319';
  try { storage.setItem(THEME_KEY, theme); } catch { /* no storage permission */ }
  return theme;
}
export function initTheme() {
  setTheme(readTheme());
  const toggle = document.getElementById('theme-toggle');
  const tray = document.getElementById('theme-picker');
  if (!toggle || !tray) return;
  const update = () => {
    for (const b of tray.querySelectorAll('[data-theme-pick]')) {
      const selected = document.documentElement.dataset.theme === b.dataset.themePick;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    }
  };
  update();
  toggle.addEventListener('click', () => {
    tray.hidden = !tray.hidden;
    toggle.setAttribute('aria-expanded', String(!tray.hidden));
  });
  tray.querySelectorAll('[data-theme-pick]').forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.themePick); update(); tray.hidden = true; toggle.setAttribute('aria-expanded','false');
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !tray.hidden) { tray.hidden = true; toggle.setAttribute('aria-expanded','false');toggle.focus(); }
  });
  document.addEventListener('click', e => {
    if (!tray.hidden && !tray.contains(e.target) && !toggle.contains(e.target)) { tray.hidden=true; toggle.setAttribute('aria-expanded','false'); }
  });
}
