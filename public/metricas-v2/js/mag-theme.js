(function initMagTheme() {
  const body = document.body;
  if (!body || !body.classList.contains('mag-view')) return;

  function render(theme) {
    const isDark = theme === 'dark';
    body.classList.toggle('mag-theme-dark', isDark);
    body.dataset.magTheme = theme;
  }

  function resolveGlobalTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  render(resolveGlobalTheme());
  window.addEventListener('metricas:themechange', (event) => {
    render(event.detail?.theme === 'dark' ? 'dark' : 'light');
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== 'metricas-theme') return;
    render(event.newValue === 'dark' ? 'dark' : 'light');
  });
})();
