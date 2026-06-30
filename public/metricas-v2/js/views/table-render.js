const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function isIsoDateLike(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function formatCellValue(column, value) {
  if (value === null || value === undefined) return '';

  if (
    ['created_at', 'updated_at', 'last_edited_time', 'fecha_creada', 'created_time'].includes(column)
    && isIsoDateLike(String(value))
  ) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: ARGENTINA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function orderColumns(columns, options = {}) {
  const next = [...columns];
  if (options.resourceName === 'webhook_logs') {
    next.sort((left, right) => {
      if (left === 'created_at') return -1;
      if (right === 'created_at') return 1;
      return 0;
    });
  }
  return next;
}

function createTableHeaders(columns) {
  return `<tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr>`;
}

function createTableRows(columns, rows) {
  return rows
    .map((row) => `<tr>${columns.map((c) => `<td>${formatCellValue(c, row[c])}</td>`).join('')}</tr>`)
    .join('');
}

function renderTable(containerId, rows, options = {}) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  if (!rows?.length) {
    wrap.innerHTML = '<p>Sin datos para mostrar.</p>';
    return;
  }

  const columns = orderColumns(Object.keys(rows[0]), options);
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
