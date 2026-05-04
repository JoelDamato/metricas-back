const RESOURCE = 'agenda_detalle_por_origen_closer';

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

const ORIGIN_WHITELIST = ['VSL', 'ORG', 'CLASES', 'APSET'];
const CLOSER_ALIAS_MAP = {
  'pablo butera': 'Pablo Butera',
  'pablo butera vie': 'Pablo Butera',
  'nahuel iasci': 'Nahuel Iasci'
};

const AGENDA_CLOSER_KPI_INFO = {
  total_agendados: {
    title: 'Total Agendados',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Lee "total_agendados" de "agenda_detalle_por_origen_closer". La base mensual sale del mes de "fecha_agenda" y queda segmentada por "origen" y "closer".'
  },
  total_ventas: {
    title: 'Total Ventas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Cuenta comprobantes de "Venta" con producto válido y no Club. Las ventas se alinean por "fecha_de_agendamiento", agrupadas por "origen" y "closer".'
  },
  tasa_cierre: {
    title: 'Tasa Cierre',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: 'Mixta: "fecha_agenda" y "fecha_de_agendamiento"',
    logic: 'Se calcula como ("total_ventas" / "total_agendados") * 100 para el closer/origen seleccionado.'
  },
  facturacion_total_mes: {
    title: 'Facturación Total',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"f_venta"',
    logic: 'Suma "facturacion_total_mes" por "origen", "closer" y mes de "f_venta".'
  },
  cash_collected_real_mes: {
    title: 'Cash Real Total',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"f_acreditacion"',
    logic: 'Suma "cash_collected_real_mes" por "origen" y "closer", agrupado por mes de "f_acreditacion" con corte hasta hoy Argentina.'
  },
  aov_dia_1: {
    title: 'AOV día 1',
    viewLabel: 'Endpoint "marketing/aov-dia-1" sobre "comprobantes"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Calcula el promedio de "cash_collected" por venta del día 1 filtrando por año, origen y closer.'
  }
};

const AGENDA_CLOSER_ROW_INFO = {
  agendados: {
    title: 'Agendados',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_agendados" de "agenda_detalle_por_origen_closer", consolidado por mes, origen y closer.'
  },
  aplicables: {
    title: 'Aplicables',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_aplica" ya consolidado para el closer/origen seleccionado.'
  },
  respuesta: {
    title: 'Respuesta',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_respondio" ya consolidado en la vista mensual por closer y origen.'
  },
  confirmados: {
    title: 'Confirmados',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_confirmo" ya consolidado en la vista mensual por closer y origen.'
  },
  canceladas: {
    title: 'Canceladas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_cancelado" ya consolidado por closer y origen.'
  },
  noAsistidas: {
    title: 'No asistidas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_no_asistidas" ya consolidado en la vista base mensual.'
  },
  pendientes: {
    title: 'Pendientes',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_pendientes" ya consolidado en la vista base mensual.'
  },
  efectuadas: {
    title: 'Efectuadas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "total_efectuadas" ya consolidado por closer y origen.'
  },
  ventas: {
    title: 'Ventas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "total_ventas". La vista lo arma desde comprobantes agrupados por mes de "fecha_de_agendamiento", origen y closer.'
  },
  paidUpfront: {
    title: 'Paid Upfront',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: 'Campo mensual ya calculado en la vista base',
    logic: 'Muestra "total_paid_upfront" consolidado dentro de "agenda_detalle_por_origen_closer".'
  },
  ccne: {
    title: 'CCNE',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "ccne" ya calculado en la vista base mensual del closer/origen.'
  },
  ccneEfectuadas: {
    title: 'CCNE Efectuadas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "ccne_efectuadas" ya consolidado por closer y origen.'
  },
  ccneVendidas: {
    title: 'CCNE Vendidas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "ccne_vendidas" ya consolidado por closer y origen.'
  },
  cce: {
    title: 'CCE',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce" ya calculado en la vista base mensual del closer/origen.'
  },
  cceLlamada: {
    title: 'CCE llamada',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce_llamada" segmentado por closer y origen sobre el mes de "fecha_agenda".'
  },
  cceLlamadaEfectuadas: {
    title: 'CCE llamada Efectuadas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce_llamada_efectuadas", tomando solo éxitos por llamada con "llamada_meg"=\'Efectuada\'.'
  },
  cceLlamadaVendidas: {
    title: 'CCE llamada Vendidas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "cce_llamada_vendidas", contando ventas asociadas a leads con éxito por llamada.'
  },
  cceWhatsapp: {
    title: 'CCE WhatsApp',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce_whatsapp" segmentado por closer y origen sobre el mes de "fecha_agenda".'
  },
  cceWhatsappEfectuadas: {
    title: 'CCE WhatsApp Efectuadas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce_whatsapp_efectuadas", tomando solo éxitos por WhatsApp con "llamada_meg"=\'Efectuada\'.'
  },
  cceWhatsappVendidas: {
    title: 'CCE WhatsApp Vendidas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "cce_whatsapp_vendidas", contando ventas asociadas a leads con éxito por WhatsApp.'
  },
  cceEfectuadas: {
    title: 'CCE Efectuadas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Muestra "cce_efectuadas" consolidado para el closer/origen seleccionado.'
  },
  cceVendidas: {
    title: 'CCE Vendidas',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "cce_vendidas" consolidado para el closer/origen seleccionado.'
  },
  factTotalMes: {
    title: 'Facturación Total Mes',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"f_venta"',
    logic: 'Muestra "facturacion_total_mes" agrupado por mes de "f_venta", origen y closer.'
  },
  factAgenda: {
    title: 'Facturación por agenda',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_de_agendamiento"',
    logic: 'Muestra "facturacion_f_agenda", ubicando la facturación en el mes de "fecha_de_agendamiento".'
  },
  ccRealMes: {
    title: 'Cash Collected Real Mes',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"f_acreditacion"',
    logic: 'Muestra "cash_collected_real_mes". La vista suma cash por mes de "f_acreditacion" y aplica corte hasta hoy Argentina.'
  },
  ccOtrosMeses: {
    title: 'Cash Collected Otros Meses',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: 'Mixta: "f_acreditacion" comparada contra "fecha_de_agendamiento"',
    logic: 'Muestra "cash_collected_otros_meses". Toma cash acreditado cuyo mes de agenda es nulo o distinto al mes acreditado.'
  },
  ccAgendasMes: {
    title: 'Cash Collected Agendas Mes',
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: 'Mixta: "f_acreditacion" igual al mes de "fecha_de_agendamiento"',
    logic: 'Muestra "cash_collected_agendas_mes". Toma cash acreditado solo cuando el mes de agenda coincide con el mes acreditado.'
  }
};

const SUM_FIELDS = [
  'total_agendados',
  'total_aplica',
  'total_respondio',
  'total_confirmo',
  'total_cancelado',
  'total_no_asistidas',
  'total_pendientes',
  'total_efectuadas',
  'total_ventas',
  'total_paid_upfront',
  'ccne',
  'ccne_efectuadas',
  'ccne_vendidas',
  'cce',
  'cce_llamada',
  'cce_llamada_efectuadas',
  'cce_llamada_vendidas',
  'cce_whatsapp',
  'cce_whatsapp_efectuadas',
  'cce_whatsapp_vendidas',
  'cce_efectuadas',
  'cce_vendidas',
  'facturacion_total_mes',
  'facturacion_f_agenda',
  'cash_collected_real_mes',
  'cash_collected_otros_meses',
  'cash_collected_agendas_mes'
];

let estrategiaField = null;

function showMetricInfo(info) {
  if (!info) return;

  const existing = document.getElementById('metricInfoPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'metricInfoPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card metric-info-card">
      <h3>${info.title}</h3>
      <p><strong>Vista que usa:</strong> ${info.viewLabel || '"agenda_detalle_por_origen_closer"'}</p>
      <p><strong>Fecha que usa:</strong> ${info.dateLabel}</p>
      <p><strong>Lógica:</strong> ${info.logic}</p>
      <button id="metricInfoPopupClose" type="button">Cerrar</button>
    </div>
  `;

  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('metricInfoPopupClose').addEventListener('click', close);
}

function getAgendaCloserMetricInfo(metricKey, label) {
  if (metricKey === 'aovDia1') return AGENDA_CLOSER_KPI_INFO.aov_dia_1;
  if (AGENDA_CLOSER_ROW_INFO[metricKey]) return AGENDA_CLOSER_ROW_INFO[metricKey];
  if (metricKey === 'agendados') return AGENDA_CLOSER_KPI_INFO.total_agendados;
  if (metricKey === 'ventas') return AGENDA_CLOSER_KPI_INFO.total_ventas;
  if (metricKey === 'tasaCierre') return AGENDA_CLOSER_KPI_INFO.tasa_cierre;
  if (metricKey === 'factTotalMes') return AGENDA_CLOSER_KPI_INFO.facturacion_total_mes;
  if (metricKey === 'ccRealMes') return AGENDA_CLOSER_KPI_INFO.cash_collected_real_mes;

  if (metricKey.startsWith('pct')) {
    const formulas = {
      pctAplicables: '"aplicables" / "agendados" * 100',
      pctRespuesta: '"respuesta" / "aplicables" * 100',
      pctConfirmados: '"confirmados" / "respuesta" * 100',
      pctCanceladas: '"canceladas" / "aplicables" * 100',
      pctNoAsistidas: '"noAsistidas" / "aplicables" * 100',
      pctEfectuadas: '"efectuadas" / "aplicables" * 100',
      pctVendidas: '"ventas" / "efectuadas" * 100',
      pctPaidUpfront: '"paidUpfront" / "factTotalMes" * 100',
      pctCcne: '"ccne" / "aplicables" * 100',
      pctCcneEfectuadas: '"ccneEfectuadas" / "efectuadas" * 100',
      pctCcneVendidas: '"ccneVendidas" / "ventas" * 100',
      pctCceLlamada: '"cceLlamada" / "aplicables" * 100',
      pctCceLlamadaEfectuadas: '"cceLlamadaEfectuadas" / "efectuadas" * 100',
      pctCceLlamadaVendidas: '"cceLlamadaVendidas" / "ventas" * 100',
      pctCceWhatsapp: '"cceWhatsapp" / "aplicables" * 100',
      pctCceWhatsappEfectuadas: '"cceWhatsappEfectuadas" / "efectuadas" * 100',
      pctCceWhatsappVendidas: '"cceWhatsappVendidas" / "ventas" * 100',
      pctCce: '"cce" / "aplicables" * 100',
      pctCceEfectuadas: '"cceEfectuadas" / "efectuadas" * 100',
      pctCceVendidas: '"cceVendidas" / "ventas" * 100'
    };

    return {
      title: label,
      viewLabel: 'Cálculo frontend sobre "agenda_detalle_por_origen_closer"',
      dateLabel: '"fecha_agenda"',
      logic: `Se calcula en frontend como ${formulas[metricKey] || 'porcentaje entre contadores de la misma fila'}. Los contadores base salen de "agenda_detalle_por_origen_closer".`
    };
  }

  if (metricKey === 'aov') {
    return {
      title: 'AOV',
      viewLabel: 'Cálculo frontend sobre "agenda_detalle_por_origen_closer"',
      dateLabel: 'Mixta: "f_venta" y "fecha_de_agendamiento"',
      logic: 'Se calcula como "facturacion_total_mes" dividido "total_ventas".'
    };
  }

  return {
    title: label,
    viewLabel: '"agenda_detalle_por_origen_closer"',
    dateLabel: '"fecha_agenda"',
    logic: 'Se calcula en la vista "agenda_detalle_por_origen_closer" usando la base de "fecha_agenda" y el segmento de "origen" + "closer".'
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 20
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function safeDiv(a, b) {
  if (!b) return 0;
  return Number(a || 0) / Number(b || 0);
}

function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function setOptions(selectId, options, selectedValue, includeAll = false) {
  const select = document.getElementById(selectId);
  const allOption = includeAll ? '<option value="">Todos</option>' : '';

  select.innerHTML = allOption + options
    .map((option) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      return `<option value="${value}">${label}</option>`;
    })
    .join('');

  if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
    select.value = String(selectedValue);
  }
}

function disableEstrategiaFilter() {
  const select = document.getElementById('estrategia');
  select.innerHTML = '<option value="">No disponible en esta vista</option>';
  select.disabled = true;
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((v) => v !== null && v !== undefined && v !== ''))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function detectEstrategiaField(rows) {
  const candidates = ['estrategia_a', 'estrategia', 'strategy'];
  return candidates.find((field) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, field))) || null;
}

function getFilters() {
  return {
    anio: document.getElementById('anio').value,
    origen: document.getElementById('origen').value,
    estrategia: document.getElementById('estrategia').value,
    closer: document.getElementById('closer').value
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function canonicalizeCloserName(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  return CLOSER_ALIAS_MAP[normalizeText(text)] || text;
}

function normalizeCloserRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    closer: canonicalizeCloserName(row.closer),
    total_agendados: Number(row.total_agendados ?? row.total_leads ?? 0),
    facturacion_total_mes: Number(row.facturacion_total_mes ?? row.facturacion_total ?? 0),
    cash_collected_real_mes: Number(row.cash_collected_real_mes ?? row.cash_collected_total ?? 0),
    facturacion_f_agenda: Number(row.facturacion_f_agenda ?? 0),
    cash_collected_otros_meses: Number(row.cash_collected_otros_meses ?? 0),
    cash_collected_agendas_mes: Number(row.cash_collected_agendas_mes ?? 0),
    cce_llamada: Number(row.cce_llamada ?? 0),
    cce_llamada_efectuadas: Number(row.cce_llamada_efectuadas ?? 0),
    cce_llamada_vendidas: Number(row.cce_llamada_vendidas ?? 0),
    cce_whatsapp: Number(row.cce_whatsapp ?? 0),
    cce_whatsapp_efectuadas: Number(row.cce_whatsapp_efectuadas ?? 0),
    cce_whatsapp_vendidas: Number(row.cce_whatsapp_vendidas ?? 0)
  }));
}

function applyLocalFilters(rows, filters) {
  return (rows || []).filter((row) => {
    if (filters.origen && normalizeText(row.origen) !== normalizeText(filters.origen)) return false;
    if (filters.closer && normalizeText(row.closer) !== normalizeText(filters.closer)) return false;
    if (filters.estrategia && estrategiaField) {
      if (normalizeText(row[estrategiaField]) !== normalizeText(filters.estrategia)) return false;
    }
    return true;
  });
}

function sanitizeRowsForYear(rows, year) {
  return (rows || []).filter((row) => {
    const y = Number(row.anio);
    const m = Number(row.mes);
    return y === year && Number.isInteger(m) && m >= 1 && m <= 12;
  });
}

function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { from: start, to: end };
}

function getYearRange(year) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`
  };
}

function combineAovDia1Responses(responses) {
  const totals = (responses || []).reduce((acc, response) => {
    acc.ventasDia1 += Number(response?.ventasDia1 || 0);
    acc.facturacionDia1 += Number(response?.facturacionDia1 || 0);
    acc.cashCollectedDia1 += Number(response?.cashCollectedDia1 || 0);
    return acc;
  }, {
    ventasDia1: 0,
    facturacionDia1: 0,
    cashCollectedDia1: 0
  });

  return {
    ...totals,
    aovDia1: totals.ventasDia1 > 0 ? totals.cashCollectedDia1 / totals.ventasDia1 : 0
  };
}

async function fetchAovDia1ForFilters(range, filters) {
  const baseOptions = {
    from: range.from,
    to: range.to,
    estrategia: filters.estrategia || undefined,
    closer: filters.closer || undefined
  };

  if (!filters.origen) {
    return window.metricasApi.fetchMarketingAovDia1(baseOptions);
  }

  return window.metricasApi.fetchMarketingAovDia1({
    ...baseOptions,
    origen: filters.origen
  });
}

function emptyAccumulator() {
  const acc = {};
  SUM_FIELDS.forEach((field) => {
    acc[field] = 0;
  });
  return acc;
}

function aggregateByMonth(rows) {
  const byMonth = new Map();
  const totals = emptyAccumulator();

  rows.forEach((row) => {
    const month = Number(row.mes);
    if (!Number.isInteger(month) || month < 1 || month > 12) return;

    if (!byMonth.has(month)) {
      byMonth.set(month, emptyAccumulator());
    }

    const monthAcc = byMonth.get(month);
    SUM_FIELDS.forEach((field) => {
      const value = Number(row[field] || 0);
      monthAcc[field] += value;
      totals[field] += value;
    });
  });

  return { byMonth, totals };
}

function metricRowsFor(acc) {
  const ag = acc.total_agendados;
  const apl = acc.total_aplica;
  const resp = acc.total_respondio;
  const conf = acc.total_confirmo;
  const canc = acc.total_cancelado;
  const noAs = acc.total_no_asistidas;
  const ef = acc.total_efectuadas;
  const ven = acc.total_ventas;
  const paid = acc.total_paid_upfront;
  const fact = acc.facturacion_total_mes;
  const ccne = acc.ccne;
  const cce = acc.cce;

  return {
    agendados: ag,
    aplicables: apl,
    pctAplicables: safeDiv(apl * 100, ag),
    respuesta: resp,
    pctRespuesta: safeDiv(resp * 100, apl),
    confirmados: conf,
    pctConfirmados: safeDiv(conf * 100, resp),
    canceladas: canc,
    pctCanceladas: safeDiv(canc * 100, apl),
    noAsistidas: noAs,
    pctNoAsistidas: safeDiv(noAs * 100, apl),
    pendientes: acc.total_pendientes,
    efectuadas: ef,
    pctEfectuadas: safeDiv(ef * 100, apl),
    ventas: ven,
    pctVendidas: safeDiv(ven * 100, ef),
    paidUpfront: paid,
    pctPaidUpfront: safeDiv(paid * 100, fact),
    aov: safeDiv(fact, ven),
    tasaCierre: safeDiv(ven * 100, ag),
    ccne,
    pctCcne: safeDiv(ccne * 100, apl),
    ccneEfectuadas: acc.ccne_efectuadas,
    pctCcneEfectuadas: safeDiv(acc.ccne_efectuadas * 100, ef),
    ccneVendidas: acc.ccne_vendidas,
    pctCcneVendidas: safeDiv(acc.ccne_vendidas * 100, ven),
    cce,
    pctCce: safeDiv(cce * 100, apl),
    cceLlamada: acc.cce_llamada,
    pctCceLlamada: safeDiv(acc.cce_llamada * 100, apl),
    cceLlamadaEfectuadas: acc.cce_llamada_efectuadas,
    pctCceLlamadaEfectuadas: safeDiv(acc.cce_llamada_efectuadas * 100, ef),
    cceLlamadaVendidas: acc.cce_llamada_vendidas,
    pctCceLlamadaVendidas: safeDiv(acc.cce_llamada_vendidas * 100, ven),
    cceWhatsapp: acc.cce_whatsapp,
    pctCceWhatsapp: safeDiv(acc.cce_whatsapp * 100, apl),
    cceWhatsappEfectuadas: acc.cce_whatsapp_efectuadas,
    pctCceWhatsappEfectuadas: safeDiv(acc.cce_whatsapp_efectuadas * 100, ef),
    cceWhatsappVendidas: acc.cce_whatsapp_vendidas,
    pctCceWhatsappVendidas: safeDiv(acc.cce_whatsapp_vendidas * 100, ven),
    cceEfectuadas: acc.cce_efectuadas,
    pctCceEfectuadas: safeDiv(acc.cce_efectuadas * 100, ef),
    cceVendidas: acc.cce_vendidas,
    pctCceVendidas: safeDiv(acc.cce_vendidas * 100, ven),
    factTotalMes: acc.facturacion_total_mes,
    factAgenda: acc.facturacion_f_agenda,
    ccRealMes: acc.cash_collected_real_mes,
    ccOtrosMeses: acc.cash_collected_otros_meses,
    ccAgendasMes: acc.cash_collected_agendas_mes
  };
}

function buildExecutionMetricGroups(metrics) {
  const keySet = new Set(metrics.map((metric) => metric.key));
  const pick = (key) => metrics.find((metric) => metric.key === key);
  const groups = [
    ['ccne', 'pctCcne', 'ccneEfectuadas', 'pctCcneEfectuadas', 'ccneVendidas', 'pctCcneVendidas'],
    ['cceLlamada', 'pctCceLlamada', 'cceLlamadaEfectuadas', 'pctCceLlamadaEfectuadas', 'cceLlamadaVendidas', 'pctCceLlamadaVendidas'],
    ['cceWhatsapp', 'pctCceWhatsapp', 'cceWhatsappEfectuadas', 'pctCceWhatsappEfectuadas', 'cceWhatsappVendidas', 'pctCceWhatsappVendidas']
  ];

  return groups
    .map((group, index) => {
      const rows = group.map((key) => pick(key)).filter(Boolean);
      if (!rows.length) return [];
      if (index === 0) return rows;
      return [{ type: 'separator', key: `separator-${index}` }, ...rows];
    })
    .flat()
    .filter((metric) => metric.type === 'separator' || keySet.has(metric.key));
}

function buildMatrixTable(rows, filters, aovDia1Data = {}) {
  const container = document.getElementById('tableContainer');
  const currentMonth = new Date().getMonth() + 1;

  if (!rows.length) {
    container.innerHTML = '<p>No hay datos para el filtro seleccionado.</p>';
    return;
  }

  const { byMonth, totals } = aggregateByMonth(rows);
  const months = MONTHS.map((month) => month.value);
  const totalMetrics = metricRowsFor(totals);
  totalMetrics.aovDia1 = Number(aovDia1Data.total || 0);

  const monthMetricsMap = new Map();
  months.forEach((month) => {
    const monthMetrics = metricRowsFor(byMonth.get(month) || emptyAccumulator());
    monthMetrics.aovDia1 = Number(aovDia1Data.byMonth?.[month] || 0);
    monthMetricsMap.set(month, monthMetrics);
  });

  const metricDefinitions = [
    { key: 'agendados', label: 'Agendados', format: 'number' },
    { key: 'aplicables', label: 'Aplicables', format: 'number' },
    { key: 'pctAplicables', label: '% Aplicables', format: 'percent' },
    { key: 'respuesta', label: 'Respuesta', format: 'number' },
    { key: 'pctRespuesta', label: '% Respuesta', format: 'percent' },
    { key: 'confirmados', label: 'Confirmados', format: 'number' },
    { key: 'pctConfirmados', label: '% Confirmados', format: 'percent' },
    { key: 'canceladas', label: 'Canceladas', format: 'number' },
    { key: 'pctCanceladas', label: '% Canceladas', format: 'percent' },
    { key: 'noAsistidas', label: 'No asistidas', format: 'number' },
    { key: 'pctNoAsistidas', label: '% No asistidas', format: 'percent' },
    { key: 'pendientes', label: 'Pendientes', format: 'number' },
    { key: 'efectuadas', label: 'Efectuadas', format: 'number' },
    { key: 'pctEfectuadas', label: '% Efectuadas', format: 'percent' },
    { key: 'ventas', label: 'Ventas', format: 'number' },
    { key: 'pctVendidas', label: '% Vendidas', format: 'percent' },
    { key: 'paidUpfront', label: 'Paid Upfront', format: 'currency' },
    { key: 'pctPaidUpfront', label: '% Paid Upfront', format: 'percent' },
    { key: 'aovDia1', label: 'AOV día 1', format: 'currency' },
    { key: 'tasaCierre', label: 'Tasa de Cierre', format: 'percent' },
    { key: 'ccne', label: 'CCNE', format: 'number' },
    { key: 'pctCcne', label: '% CCNE', format: 'percent' },
    { key: 'ccneEfectuadas', label: 'CCNE Efectuadas', format: 'number' },
    { key: 'pctCcneEfectuadas', label: '% CCNE Efectuadas', format: 'percent' },
    { key: 'ccneVendidas', label: 'CCNE Vendidas', format: 'number' },
    { key: 'pctCcneVendidas', label: '% CCNE Vendidas', format: 'percent' },
    { key: 'cceLlamada', label: 'CCE llamada', format: 'number' },
    { key: 'pctCceLlamada', label: '% CCE llamada', format: 'percent' },
    { key: 'cceLlamadaEfectuadas', label: 'CCE llamada Efectuadas', format: 'number' },
    { key: 'pctCceLlamadaEfectuadas', label: '% CCE llamada Efectuadas', format: 'percent' },
    { key: 'cceLlamadaVendidas', label: 'CCE llamada Vendidas', format: 'number' },
    { key: 'pctCceLlamadaVendidas', label: '% CCE llamada Vendidas', format: 'percent' },
    { key: 'cceWhatsapp', label: 'CCE WhatsApp', format: 'number' },
    { key: 'pctCceWhatsapp', label: '% CCE WhatsApp', format: 'percent' },
    { key: 'cceWhatsappEfectuadas', label: 'CCE WhatsApp Efectuadas', format: 'number' },
    { key: 'pctCceWhatsappEfectuadas', label: '% CCE WhatsApp Efectuadas', format: 'percent' },
    { key: 'cceWhatsappVendidas', label: 'CCE WhatsApp Vendidas', format: 'number' },
    { key: 'pctCceWhatsappVendidas', label: '% CCE WhatsApp Vendidas', format: 'percent' },
    { key: 'factTotalMes', label: 'Facturación Total Mes', format: 'currency' },
    { key: 'factAgenda', label: 'Facturación por agenda', format: 'currency' },
    { key: 'ccRealMes', label: 'Cash Collected Real Mes', format: 'currency' },
    { key: 'ccOtrosMeses', label: 'Cash Collected Otros Meses', format: 'currency' },
    { key: 'ccAgendasMes', label: 'Cash Collected Agendas Mes', format: 'currency' }
  ];

  const formatValue = (value, type) => {
    if (type === 'currency') return formatCurrency(value);
    if (type === 'percent') return formatPercent(value);
    return formatNumber(value);
  };

  const headerMonths = months
    .map((month) => `<th class="${month === currentMonth ? 'month-current' : ''}">${month}</th>`)
    .join('');

  const renderMetricTable = (metrics, title, subtitle, tone = 'default') => {
    const bodyRows = metrics
      .map((metric) => {
        if (metric.type === 'separator') {
          return `
            <tr class="agenda-separator-row">
              <td colspan="${months.length + 2}">
                <div class="agenda-separator-bar" aria-hidden="true"></div>
              </td>
            </tr>
          `;
        }

        const monthCells = months
          .map((month) => {
            const monthMetrics = monthMetricsMap.get(month);
            return `<td class="${month === currentMonth ? 'month-current' : ''}">${formatValue(monthMetrics[metric.key], metric.format)}</td>`;
          })
          .join('');

        return `
          <tr>
            <td><button type="button" class="metric-info-trigger metric-label" data-metric-key="${metric.key}"><strong>${metric.label}</strong></button></td>
            ${monthCells}
            <td><strong>${formatValue(totalMetrics[metric.key], metric.format)}</strong></td>
          </tr>
        `;
      })
      .join('');

    return `
      <section class="agenda-table-panel agenda-table-panel--${tone}">
        <div class="agenda-table-header">
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                ${headerMonths}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
              <tr>
                <td><strong>Totales del período</strong></td>
                <td colspan="${months.length + 1}">
                  Año ${filters.anio}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  };

  const firstBreakIndex = metricDefinitions.findIndex((metric) => metric.key === 'tasaCierre');
  const secondBreakIndex = metricDefinitions.findIndex((metric) => metric.key === 'factTotalMes');

  const firstTableMetrics = firstBreakIndex === -1 ? metricDefinitions : metricDefinitions.slice(0, firstBreakIndex + 1);
  const secondTableMetricsBase = firstBreakIndex === -1
    ? []
    : secondBreakIndex === -1
      ? metricDefinitions.slice(firstBreakIndex + 1)
      : metricDefinitions.slice(firstBreakIndex + 1, secondBreakIndex);
  const secondTableMetrics = buildExecutionMetricGroups(secondTableMetricsBase);
  const thirdTableMetrics = secondBreakIndex === -1 ? [] : metricDefinitions.slice(secondBreakIndex);

  container.innerHTML = [
    renderMetricTable(
      firstTableMetrics,
      'Embudo de agendas',
      'Desde agendados hasta la tasa de cierre, con lectura mensual y total anual.',
      'flow'
    ),
    secondTableMetrics.length
      ? renderMetricTable(
          secondTableMetrics,
          'Call Confirm y ejecución',
          'Seguimiento separado de CCNE, CCE llamada y CCE WhatsApp sobre la misma cohorte mensual de agendas.',
          'execution'
        )
      : '',
    thirdTableMetrics.length
      ? renderMetricTable(
          thirdTableMetrics,
          'Facturación y cash',
          'Bloque separado para comparar facturación por venta, facturación por agenda y cash collected.',
          'finance'
        )
      : ''
  ].join('');

  container.querySelectorAll('.metric-label').forEach((button) => {
    button.addEventListener('click', () => {
      const metric = metricDefinitions.find((item) => item.key === button.dataset.metricKey);
      showMetricInfo(getAgendaCloserMetricInfo(button.dataset.metricKey, metric?.label || button.dataset.metricKey));
    });
  });
}

function buildKpis(rows) {
  const wrap = document.getElementById('kpiContainer');

  if (!rows.length) {
    wrap.innerHTML = '';
    return;
  }

  const { totals } = aggregateByMonth(rows);
  const metrics = metricRowsFor(totals);

  wrap.innerHTML = `
    <article class="card metric-card" data-kpi-key="total_agendados" role="button" tabindex="0"><h4>Total Agendados</h4><p>${formatNumber(totals.total_agendados)}</p></article>
    <article class="card metric-card" data-kpi-key="total_ventas" role="button" tabindex="0"><h4>Total Ventas</h4><p>${formatNumber(totals.total_ventas)}</p></article>
    <article class="card metric-card" data-kpi-key="tasa_cierre" role="button" tabindex="0"><h4>Tasa Cierre</h4><p>${formatPercent(metrics.tasaCierre)}</p></article>
    <article class="card metric-card" data-kpi-key="facturacion_total_mes" role="button" tabindex="0"><h4>Facturación Total</h4><p>${formatCurrency(totals.facturacion_total_mes)}</p></article>
    <article class="card metric-card" data-kpi-key="cash_collected_real_mes" role="button" tabindex="0"><h4>Cash Real Total</h4><p>${formatCurrency(totals.cash_collected_real_mes)}</p></article>
  `;

  wrap.querySelectorAll('[data-kpi-key]').forEach((node) => {
    const open = () => showMetricInfo(AGENDA_CLOSER_KPI_INFO[node.dataset.kpiKey]);
    node.addEventListener('click', open);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

async function initFilters() {
  const status = document.getElementById('status');
  status.textContent = 'Cargando opciones de filtros...';

  const response = await window.metricasApi.fetchRows(RESOURCE, {
    limit: 2000,
    orderBy: 'anio',
    orderDir: 'desc'
  });

  const rows = normalizeCloserRows(response.rows || []);
  const current = getCurrentPeriod();
  const years = uniqueValues(rows, 'anio')
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year >= 2000)
    .sort((a, b) => b - a);
  const origenes = uniqueValues(rows, 'origen').filter((origin) => ORIGIN_WHITELIST.includes(origin));
  const closers = uniqueValues(rows, 'closer');

  estrategiaField = detectEstrategiaField(rows);

  const defaultYear = years.includes(current.year) ? current.year : years[0];
  setOptions('anio', years, defaultYear);
  setOptions('origen', origenes, '', true);
  setOptions('closer', closers, '', true);

  if (estrategiaField) {
    const estrategias = uniqueValues(rows, estrategiaField);
    setOptions('estrategia', estrategias, '', true);
    document.getElementById('estrategia').disabled = false;
  } else {
    disableEstrategiaFilter();
  }
}

async function loadAgendaCloser() {
  const status = document.getElementById('status');
  const filters = getFilters();
  status.textContent = `Cargando ${RESOURCE}...`;

  try {
    const selectedYear = Number(filters.anio);
    if (!Number.isInteger(selectedYear) || selectedYear < 2000) {
      status.textContent = 'Seleccioná un año válido.';
      return;
    }

    const query = {
      limit: 2000,
      orderBy: 'mes',
      orderDir: 'asc',
      eq_anio: selectedYear
    };

    if (filters.origen) query.eq_origen = filters.origen;
    if (filters.estrategia && estrategiaField) {
      query[`eq_${estrategiaField}`] = filters.estrategia;
    }

    const yearRange = getYearRange(selectedYear);
    const aovRequests = MONTHS.map((month) => fetchAovDia1ForFilters(getMonthRange(selectedYear, month.value), filters));

    const [response, totalAovDia1Response, ...monthAovResponses] = await Promise.all([
      window.metricasApi.fetchRows(RESOURCE, query),
      fetchAovDia1ForFilters(yearRange, filters),
      ...aovRequests
    ]);

    const rows = applyLocalFilters(
      sanitizeRowsForYear(normalizeCloserRows(response.rows || []), selectedYear),
      filters
    );

    const aovDia1Data = {
      total: Number(totalAovDia1Response?.aovDia1 || 0),
      byMonth: MONTHS.reduce((acc, month, index) => {
        acc[month.value] = Number(monthAovResponses[index]?.aovDia1 || 0);
        return acc;
      }, {})
    };

    buildKpis(rows);
    buildMatrixTable(rows, filters, aovDia1Data);
    status.textContent = `Filas: ${rows.length} | año ${selectedYear}${filters.origen ? ` | origen ${filters.origen}` : ' | origen Todos'}${filters.closer ? ` | closer ${filters.closer}` : ' | closer Todos'}${filters.estrategia ? ` | estrategia ${filters.estrategia}` : ''}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

async function initPage() {
  await initFilters();
  await loadAgendaCloser();
}

document.getElementById('reload').addEventListener('click', loadAgendaCloser);
initPage();
