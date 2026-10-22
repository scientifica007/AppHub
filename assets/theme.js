(() => {
  let theme = 'dark';
  try {
    const saved = JSON.parse(localStorage.getItem('apphub:theme'));
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
})();
