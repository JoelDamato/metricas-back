function getResourceFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('name');
}

async function loadViewRows() {
  const resource = getResourceFromUrl();
  const title = document.getElementById('title');
  const status = document.getElementById('status');

  if (!resource) {
    status.textContent = 'Falta el nombre de la vista en la URL (?name=...)';
    return;
  }

  title.textContent = `Vista: ${resource}`;

  const limit = Number(document.getElementById('limit').value || 100);
  const orderBy = document.getElementById('orderBy').value.trim();

  status.textContent = `Cargando datos de ${resource}...`;

  try {
    const response = await window.metricasApi.fetchRows(resource, {
      limit,
      orderBy,
      orderDir: 'desc'
    });

    window.tableRender.renderTable('tableContainer', response.rows);
    status.textContent = `Filas cargadas: ${response.count}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById('reload').addEventListener('click', loadViewRows);
loadViewRows();
