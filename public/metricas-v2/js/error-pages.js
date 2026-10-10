(() => {
  const button = document.getElementById('switchAccount');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    const status = document.getElementById('errorMessage');
    status.textContent = '';
    try {
      const response = await fetch('/api/metricas/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw Error('No se pudo cambiar de cuenta. Reintentá.');
      window.location.assign('/login.html');
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
})();
