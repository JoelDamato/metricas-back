function renderCards(resources) {
  const container = document.getElementById('viewsContainer');

  if (!resources.length) {
    container.innerHTML = '<p>No se encontraron vistas para mostrar.</p>';
    return;
  }

  container.innerHTML = resources
    .map((resource) => {
      const url = `/metricas/views/view.html?name=${encodeURIComponent(resource)}`;
      return `
        <a class="card" href="${url}">
          <h3>${resource}</h3>
          <p>Abrir vista en tabla dinámica.</p>
        </a>
      `;
    })
    .join('');
}

async function loadViews() {
  const status = document.getElementById('status');
  status.textContent = 'Cargando vistas de Supabase...';

  try {
    const data = await window.metricasApi.fetchViews();
    renderCards(data.resources || []);
    status.textContent = `Vistas encontradas: ${data.count || 0}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

loadViews();
