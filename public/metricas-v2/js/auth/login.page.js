const DEFAULT_HOME_PATH = '/metricas/dashboard.html';
const MARKETING_HOME_PATH = '/metricas/views/marketing.html';

function resolveHomePath(response) {
  return response?.user?.permissions?.onlyMarketingAccess === true
    ? MARKETING_HOME_PATH
    : DEFAULT_HOME_PATH;
}

async function checkSession() {
  try {
    const response = await window.http.getJson('/api/metricas/auth/session');
    window.location.href = resolveHomePath(response);
  } catch (error) {
    // sin sesión, seguimos
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const status = document.getElementById('authStatus');
  status.textContent = 'Ingresando...';

  try {
    const response = await window.http.postJson('/api/metricas/auth/login', {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
    window.location.href = resolveHomePath(response);
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
checkSession();
