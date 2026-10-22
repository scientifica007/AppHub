(() => {
  try { const theme = JSON.parse(localStorage.getItem('apphub:theme')); if (theme === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}
})();
