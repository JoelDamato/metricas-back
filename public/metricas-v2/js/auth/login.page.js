async function checkSession() {
  try {
    await window.http.getJson('/api/metricas/auth/session');
    window.location.href = '/metricas/dashboard.html';
  } catch (error) {
    // sin sesión, seguimos
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const status = document.getElementById('authStatus');
  status.textContent = 'Ingresando...';

  try {
    await window.http.postJson('/api/metricas/auth/login', {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
    window.location.href = '/metricas/dashboard.html';
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
checkSession();
