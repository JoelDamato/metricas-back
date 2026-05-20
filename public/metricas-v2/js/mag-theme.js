(function initMagTheme() {
  const storageKey = 'metricas-mag-theme';
  const body = document.body;
  if (!body || !body.classList.contains('mag-view')) return;
  const isEmbedMode = body.classList.contains('metricas-embed') || window.self !== window.top;

  function render(theme) {
    const isDark = theme === 'dark';
    body.classList.toggle('mag-theme-dark', isDark);
    body.dataset.magTheme = theme;
  }

  function setTheme(theme) {
    localStorage.setItem(storageKey, theme);
    render(theme);
  }

  const initialTheme = localStorage.getItem(storageKey) || 'light';
  render(initialTheme);

  if (isEmbedMode) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mag-theme-switch';
  button.setAttribute('aria-pressed', String(body.classList.contains('mag-theme-dark')));
  button.innerHTML = `
    <span class="mag-theme-switch-icon">${body.classList.contains('mag-theme-dark') ? '☾' : '☀'}</span>
    <span>${body.classList.contains('mag-theme-dark') ? 'Modo oscuro' : 'Modo claro'}</span>
  `;

  button.addEventListener('click', () => {
    const nextTheme = body.classList.contains('mag-theme-dark') ? 'light' : 'dark';
    setTheme(nextTheme);
    button.setAttribute('aria-pressed', String(body.classList.contains('mag-theme-dark')));
    button.innerHTML = `
      <span class="mag-theme-switch-icon">${body.classList.contains('mag-theme-dark') ? '☾' : '☀'}</span>
      <span>${body.classList.contains('mag-theme-dark') ? 'Modo oscuro' : 'Modo claro'}</span>
    `;
  });

  document.body.appendChild(button);
})();
