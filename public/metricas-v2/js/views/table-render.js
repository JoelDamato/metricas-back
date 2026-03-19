function createTableHeaders(columns) {
  return `<tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr>`;
}

function createTableRows(columns, rows) {
  return rows
    .map((row) => `<tr>${columns.map((c) => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`)
    .join('');
}

function renderTable(containerId, rows) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  if (!rows?.length) {
    wrap.innerHTML = '<p>Sin datos para mostrar.</p>';
    return;
  }

  const columns = Object.keys(rows[0]);
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>${createTableHeaders(columns)}</thead>
        <tbody>${createTableRows(columns, rows)}</tbody>
      </table>
    </div>
  `;
}

window.tableRender = { renderTable };
