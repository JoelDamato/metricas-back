(function initDiagnosticTheme() {
  const STORAGE_KEY = 'diagnostico-theme';

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function readTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return 'dark';
    }
  }

  function syncButtons(theme) {
    document.querySelectorAll('[data-diagnostic-theme-option]').forEach((button) => {
      const isSelected = button.dataset.diagnosticThemeOption === theme;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function applyTheme(value, persist) {
    const theme = normalizeTheme(value);
    document.documentElement.dataset.diagnosticTheme = theme;
    document.documentElement.style.colorScheme = theme;
    syncButtons(theme);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (_error) {
        // El tema igual se aplica durante esta visita si el navegador bloquea el almacenamiento.
      }
    }

    return theme;
  }

  applyTheme(readTheme(), false);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-diagnostic-theme-option]');
    if (!button) return;
    applyTheme(button.dataset.diagnosticThemeOption, true);
  });

  document.addEventListener('DOMContentLoaded', () => syncButtons(readTheme()));
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) applyTheme(event.newValue, false);
  });

  window.diagnosticTheme = { apply: (theme) => applyTheme(theme, true), get: readTheme };
})();
