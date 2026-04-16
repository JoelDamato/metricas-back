let csmChart = null;

function formatInteger(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDecimal(value, digits = 1) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function formatDays(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin base';
  return `${formatDecimal(value, 1)} d`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin base';
  return `${formatDecimal(value, 1)}%`;
}

function formatCountWithPercent(count, base) {
  if (!Number(base)) return formatInteger(count);
  return `${formatInteger(count)} (${formatPercent((Number(count || 0) / Number(base || 0)) * 100)})`;
}

function safeDiv(a, b) {
  if (!Number(b)) return 0;
  return Number(a || 0) / Number(b || 0);
}

function average(values) {
  const valid = (values || []).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  return (end.getTime() - start.getTime()) / 86400000;
}

function hasText(value) {
  return String(value || '').trim() !== '';
}

function asTruthy(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'si', 'sí', 'yes', 'y', 'x'].includes(normalized);
}

function parseMetricNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text
    .toLowerCase()
    .replace(/d[ií]as?/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');

  if (!normalized || ['-', '.', '-.'].includes(normalized)) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDayMetric(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseUnderSevenMetric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === '1') return true;
  if (normalized === '0') return false;
  if (['si', 'sí', 'true', 'yes', 'y', 'x'].includes(normalized)) return true;
  if (['no', 'false', 'n'].includes(normalized)) return false;

  const numeric = parseMetricNumber(value);
  if (numeric === null) return null;
  return numeric <= 7;
}

function normalizeModel(value) {
  const text = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (text.includes('reventa')) return 'Reventa';
  if (text.includes('gastro')) return 'Gastronomicos';
  if (text.includes('fabric')) return 'Fabricantes';
  if (text.includes('serv')) return 'Servicios';
  return 'Etc';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMetricRow({ key, label, value, base, note, dateLabel, fieldsLabel, logic }) {
  return {
    key,
    label,
    value,
    base,
    note,
    info: {
      title: label,
      dateLabel,
      fieldsLabel,
      logic
    }
  };
}

function showMetricInfo(info) {
  if (!info) return;

  const existing = document.getElementById('csmMetricPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'csmMetricPopup';
  popup.className = 'kpi-popup metric-info-popup';
  popup.innerHTML = `
    <div class="kpi-popup-card metric-info-card">
      <h3>${escapeHtml(info.title)}</h3>
      <p><strong>Vista que usa:</strong> ${escapeHtml(info.viewLabel || '"csm"')}</p>
      <p><strong>Fecha que usa:</strong> ${escapeHtml(info.dateLabel)}</p>
      <p><strong>Campos principales:</strong> ${escapeHtml(info.fieldsLabel)}</p>
      <p><strong>Lógica:</strong> ${escapeHtml(info.logic)}</p>
      <button id="csmMetricPopupClose" type="button">Cerrar</button>
    </div>
  `;

  document.body.appendChild(popup);

  const close = () => popup.remove();
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  document.getElementById('csmMetricPopupClose').addEventListener('click', close);
}

function attachMetricInfo(root, infoMap) {
  root.querySelectorAll('[data-info-key]').forEach((node) => {
    const open = () => showMetricInfo(infoMap[node.dataset.infoKey]);
    node.addEventListener('click', open);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function getFirstResultDate(moduleDates) {
  return moduleDates.slice(1).find(Boolean) || null;
}

function getDiagnosisDate(moduleDates, onboardingDate) {
  return moduleDates[0] || onboardingDate || null;
}

function getLatestDate(...dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return null;
  return valid.sort((a, b) => a.getTime() - b.getTime())[valid.length - 1];
}

function enrichRows(rows) {
  return (rows || []).map((row) => {
    const moduleDates = Array.from({ length: 10 }, (_, index) => parseDate(row[`modulo_${index + 1}`]));
    const onboardingDate = parseDate(row.f_onboarding);
    const accessDate = parseDate(row.f_acceso);
    const firstResultDirectDate = parseDate(row.f_primer_resultado);
    const successDate = parseDate(row.caso_de_exito);
    const abandonDate = parseDate(row.f_abandono);
    const finalDate = parseDate(row.fecha_final);
    const renewalCompletedDate = parseDate(row.fecha_final_renovacion);
    const advanceDate = parseDate(row.ultima_fecha_de_avance);
    const responseDate = parseDate(row.ultima_respuesta);
    const firstResultDerivedDate = getFirstResultDate(moduleDates);
    const firstResultDate = firstResultDirectDate || firstResultDerivedDate;
    const diagnosisDate = getDiagnosisDate(moduleDates, onboardingDate);
    const payToOnboardingDirect = normalizeDayMetric(parseMetricNumber(row.pago_a_onbo));
    const payToOnboardingDerived = normalizeDayMetric(daysBetween(accessDate, onboardingDate));
    const payToOnboardingMetric = payToOnboardingDirect ?? payToOnboardingDerived;
    const payToDiagnosisDirect = normalizeDayMetric(parseMetricNumber(row.pago_a_diagnostico));
    const payToDiagnosisDerived = normalizeDayMetric(daysBetween(accessDate, diagnosisDate));
    const payToDiagnosisMetric = payToDiagnosisDirect ?? payToDiagnosisDerived;
    const diagnosisUnder7Direct = parseUnderSevenMetric(row.diagnostico_7dias);
    const diagnosisUnder7Flag = diagnosisUnder7Direct ?? (payToDiagnosisMetric !== null ? payToDiagnosisMetric <= 7 : null);
    const npsValues = Array.from({ length: 10 }, (_, index) => {
      const value = Number(row[`nps_${index + 1}`]);
      return Number.isFinite(value) ? value : null;
    });

    return {
      ...row,
      modelBucket: normalizeModel(row.modelo_negocio),
      accessDate,
      onboardingDate,
      diagnosisDate,
      payToOnboardingDirect,
      payToOnboardingDerived,
      payToOnboardingMetric,
      payToOnboardingUsesFallback: payToOnboardingDirect === null && payToOnboardingDerived !== null,
      payToDiagnosisDirect,
      payToDiagnosisDerived,
      payToDiagnosisMetric,
      payToDiagnosisUsesFallback: payToDiagnosisDirect === null && payToDiagnosisDerived !== null,
      diagnosisUnder7Direct,
      diagnosisUnder7Flag,
      diagnosisUnder7UsesFallback: diagnosisUnder7Direct === null && payToDiagnosisMetric !== null,
      successDate,
      abandonDate,
      finalDate,
      renewalCompletedDate,
      advanceDate,
      responseDate,
      firstResultDate,
      firstResultDirectDate,
      firstResultDerivedDate,
      firstResultUsesFallback: !firstResultDirectDate && !!firstResultDerivedDate,
      moduleDates,
      npsValues,
      isActive: row.activos === true,
      hasInsatisfaction: hasText(row.insatisfecho),
      hasRefundRequest: hasText(row.solicito_devolucion),
      hasFarewell: hasText(row.despedida),
      isRenewable15: asTruthy(row.proximo_renovar_15d),
      isRenewable30: asTruthy(row.proximo_renovar_30d),
      engagementDate: getLatestDate(advanceDate, responseDate),
      programStartDate: onboardingDate || accessDate || null
    };
  });
}

function collectDayDiffs(rows, getStart, getEnd) {
  return (rows || [])
    .map((row) => daysBetween(getStart(row), getEnd(row)))
    .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
}

function renderKpiCards(metrics, kpiKeys, infoMap) {
  const wrap = document.getElementById('kpiContainer');
  const selected = metrics.filter((metric) => kpiKeys.includes(metric.key));

  wrap.innerHTML = selected.map((metric) => `
    <article class="card metric-card" data-info-key="${escapeHtml(metric.key)}" role="button" tabindex="0">
      <h4>${escapeHtml(metric.label)}</h4>
      <p>${escapeHtml(metric.value)}</p>
    </article>
  `).join('');

  attachMetricInfo(wrap, infoMap);
}

function renderMetricsTable(metrics, infoMap) {
  const container = document.getElementById('tableContainer');
  container.innerHTML = `
    <div class="table-wrap csm-table-wrap">
      <table class="csm-table">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Valor</th>
            <th>Base</th>
            <th>Lectura</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.map((metric) => `
            <tr>
              <td><button type="button" class="metric-info-trigger metric-label" data-info-key="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button></td>
              <td>${escapeHtml(metric.value)}</td>
              <td>${escapeHtml(metric.base)}</td>
              <td>${escapeHtml(metric.note)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  attachMetricInfo(container, infoMap);
}

function renderSections(sections) {
  const container = document.getElementById('detailContainer');
  container.innerHTML = (sections || []).map((section) => `
    <section class="table-wrap csm-detail-panel">
      <div class="csm-detail-head">
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.description || '')}</p>
      </div>
      <table class="csm-table csm-detail-table">
        <thead>
          <tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${section.rows.length ? section.rows.map((row) => `
            <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
          `).join('') : '<tr><td colspan="' + section.columns.length + '">Sin base suficiente.</td></tr>'}
        </tbody>
      </table>
    </section>
  `).join('');
}

function renderChart(config) {
  const canvas = document.getElementById('csmChart');
  if (!canvas || typeof Chart === 'undefined' || !config) return;

  document.getElementById('chartTitle').textContent = config.title;
  document.getElementById('chartDescription').textContent = config.description;

  if (csmChart) csmChart.destroy();

  csmChart = new Chart(canvas, {
    type: config.type || 'bar',
    data: {
      labels: config.labels,
      datasets: config.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: config.datasets.length > 1
        }
      }
    }
  });
}

function buildTimePage(rows) {
  const payToOnboarding = rows
    .map((row) => row.payToOnboardingMetric)
    .filter((value) => value !== null && Number.isFinite(value));
  const payToDiagnosis = rows
    .map((row) => row.payToDiagnosisMetric)
    .filter((value) => value !== null && Number.isFinite(value));
  const onboardingToFirstResult = collectDayDiffs(rows, (row) => row.onboardingDate, (row) => row.firstResultDate);
  const onboardingToSuccess = collectDayDiffs(rows, (row) => row.onboardingDate, (row) => row.successDate);
  const directPayToOnboardingCount = rows.filter((row) => row.payToOnboardingDirect !== null).length;
  const fallbackPayToOnboardingCount = rows.filter((row) => row.payToOnboardingUsesFallback).length;
  const directPayToDiagnosisCount = rows.filter((row) => row.payToDiagnosisDirect !== null).length;
  const fallbackPayToDiagnosisCount = rows.filter((row) => row.payToDiagnosisUsesFallback).length;
  const directDiagnosisUnder7Count = rows.filter((row) => row.diagnosisUnder7Direct !== null).length;
  const fallbackDiagnosisUnder7Count = rows.filter((row) => row.diagnosisUnder7UsesFallback).length;
  const directFirstResultCount = rows.filter((row) => row.firstResultDirectDate).length;
  const fallbackFirstResultCount = rows.filter((row) => row.firstResultUsesFallback).length;

  const unitStats = Array.from({ length: 10 }, (_, index) => {
    const diffs = rows
      .map((row) => {
        const current = row.moduleDates[index];
        const previous = index === 0 ? row.onboardingDate : row.moduleDates[index - 1];
        return daysBetween(previous, current);
      })
      .filter((value) => value !== null && Number.isFinite(value) && value >= 0);

    const completed = rows.filter((row) => row.moduleDates[index]).length;
    return {
      unit: `Unidad ${index + 1}`,
      avgDays: average(diffs),
      completed
    };
  });

  const diagnosticUnder7 = rows.filter((row) => row.diagnosisUnder7Flag === true).length;
  const diagnosticUnder7Base = rows.filter((row) => row.diagnosisUnder7Flag !== null).length;
  const averageUnit = average(unitStats.map((row) => row.avgDays).filter((value) => value !== null));

  const metrics = [
    buildMetricRow({
      key: 'pay_to_onboarding',
      label: 'Tiempo promedio desde pago a ver onboarding',
      value: formatDays(average(payToOnboarding)),
      base: `${formatInteger(payToOnboarding.length)} clientes con base calculable (${formatInteger(directPayToOnboardingCount)} desde "pago_a_onbo"${fallbackPayToOnboardingCount ? `, ${formatInteger(fallbackPayToOnboardingCount)} fallback` : ''})`,
      note: 'Prioriza el campo calculado y usa respaldo por fechas si todavía falta.',
      dateLabel: 'Campo calculado "pago_a_onbo" (fallback "f_acceso" -> "f_onboarding")',
      fieldsLabel: '"pago_a_onbo" (fallback "f_acceso", "f_onboarding")',
      logic: 'Promedia "pago_a_onbo" cuando ya llegó calculado desde Notion. Si ese campo todavía está vacío, cae al cálculo por diferencia entre "f_acceso" y "f_onboarding".'
    }),
    buildMetricRow({
      key: 'pay_to_diagnosis',
      label: 'Tiempo promedio desde pago a sesión diagnóstico',
      value: formatDays(average(payToDiagnosis)),
      base: `${formatInteger(payToDiagnosis.length)} clientes con base calculable (${formatInteger(directPayToDiagnosisCount)} desde "pago_a_diagnostico"${fallbackPayToDiagnosisCount ? `, ${formatInteger(fallbackPayToDiagnosisCount)} fallback` : ''})`,
      note: 'Prioriza el campo específico de diagnóstico y conserva respaldo temporal.',
      dateLabel: 'Campo calculado "pago_a_diagnostico" (fallback "f_acceso" -> "modulo_1"/"f_onboarding")',
      fieldsLabel: '"pago_a_diagnostico" (fallback "f_acceso", "modulo_1", "f_onboarding")',
      logic: 'Promedia "pago_a_diagnostico" cuando el valor llega desde Notion. Si aún no está cargado, usa el cálculo por diferencia entre "f_acceso" y la fecha de diagnóstico operativa del panel.'
    }),
    buildMetricRow({
      key: 'diagnosis_under_7',
      label: 'Cantidad de sesiones diagnóstico menor a 7 días',
      value: formatInteger(diagnosticUnder7),
      base: `${formatInteger(diagnosticUnder7Base)} clientes con base calculable (${formatInteger(directDiagnosisUnder7Count)} desde "diagnostico_7dias"${fallbackDiagnosisUnder7Count ? `, ${formatInteger(fallbackDiagnosisUnder7Count)} fallback` : ''})`,
      note: 'Cuenta los casos que entran dentro de la ventana de 7 días.',
      dateLabel: 'Campo calculado "diagnostico_7dias" (fallback sobre "pago_a_diagnostico")',
      fieldsLabel: '"diagnostico_7dias" (fallback "pago_a_diagnostico")',
      logic: 'Cuenta como positivo el campo "diagnostico_7dias" cuando llega calculado desde Notion. Si falta, usa el tiempo a diagnóstico resuelto por el panel y marca positivo cuando es menor o igual a 7 días.'
    }),
    buildMetricRow({
      key: 'onboarding_to_first_result',
      label: 'Tiempo promedio a primer resultado',
      value: formatDays(average(onboardingToFirstResult)),
      base: `${formatInteger(onboardingToFirstResult.length)} clientes con onboarding y primer resultado (${formatInteger(directFirstResultCount)} desde "f_primer_resultado"${fallbackFirstResultCount ? `, ${formatInteger(fallbackFirstResultCount)} fallback` : ''})`,
      note: 'Prioriza la fecha específica de primer resultado y mantiene respaldo operativo.',
      dateLabel: '"f_onboarding" -> "f_primer_resultado" (fallback primera fecha entre "modulo_2" y "modulo_10")',
      fieldsLabel: '"f_onboarding", "f_primer_resultado" (fallback "modulo_2" a "modulo_10")',
      logic: 'Calcula el promedio de días entre "f_onboarding" y "f_primer_resultado". Si ese campo todavía no está cargado, usa como respaldo la primera fecha completada desde "modulo_2" en adelante.'
    }),
    buildMetricRow({
      key: 'onboarding_to_success',
      label: 'Tiempo promedio a caso de éxito',
      value: formatDays(average(onboardingToSuccess)),
      base: `${formatInteger(onboardingToSuccess.length)} clientes con onboarding y caso de éxito`,
      note: 'Solo entra la base con fecha cargada de éxito.',
      dateLabel: '"f_onboarding" -> "caso_de_exito"',
      fieldsLabel: '"f_onboarding", "caso_de_exito"',
      logic: 'Promedio de días entre el onboarding y la fecha registrada en "caso_de_exito".'
    }),
    buildMetricRow({
      key: 'unit_average_time',
      label: 'Tiempo promedio en cada unidad',
      value: formatDays(averageUnit),
      base: `${formatInteger(unitStats.filter((row) => row.avgDays !== null).length)} unidades con base calculable`,
      note: 'El detalle por unidad está en la tabla inferior.',
      dateLabel: '"f_onboarding" y "modulo_1" a "modulo_10"',
      fieldsLabel: '"f_onboarding", "modulo_1" a "modulo_10"',
      logic: 'Para cada unidad calculo el tiempo respecto del hito anterior. Unidad 1 usa "f_onboarding" -> "modulo_1"; luego voy comparando módulo contra módulo.'
    })
  ];

  const sections = [
    {
      title: 'Detalle por Unidad',
      description: 'Promedio de días entre hitos consecutivos y cantidad de clientes que llegaron a cada unidad.',
      columns: ['Unidad', 'Promedio dias', 'Clientes', '% sobre total'],
      rows: unitStats.map((row) => [
        row.unit,
        formatDays(row.avgDays),
        formatInteger(row.completed),
        formatPercent(safeDiv(row.completed * 100, rows.length))
      ])
    }
  ];

  return {
    metrics,
    kpiKeys: ['pay_to_onboarding', 'pay_to_diagnosis', 'diagnosis_under_7', 'onboarding_to_first_result'],
    chart: {
      title: 'Tiempo Promedio por Unidad',
      description: 'Promedio de días entre el hito anterior y la unidad registrada.',
      labels: unitStats.map((row) => row.unit.replace('Unidad ', 'U')),
      datasets: [
        {
          label: 'Dias promedio',
          data: unitStats.map((row) => Number(row.avgDays || 0)),
          backgroundColor: 'rgba(20, 101, 192, 0.72)',
          borderColor: 'rgba(20, 101, 192, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

function buildSituationPage(rows) {
  const today = new Date();
  const engagedRows = rows.filter((row) => {
    if (!row.isActive || !row.engagementDate) return false;
    const days = daysBetween(row.engagementDate, today);
    return days !== null && days >= 0 && days <= 30;
  });
  const abandonDiffs = collectDayDiffs(rows, (row) => row.programStartDate, (row) => row.abandonDate);
  const successRows = rows.filter((row) => row.successDate);
  const firstResultRows = rows.filter((row) => row.firstResultDate);
  const nightmareRows = rows.filter((row) => row.hasInsatisfaction || row.hasRefundRequest);
  const insatisfactionRows = rows.filter((row) => row.hasInsatisfaction);
  const refundRows = rows.filter((row) => row.hasRefundRequest);
  const refundCompletedRows = rows.filter((row) => row.hasRefundRequest && (!row.isActive || row.hasFarewell));
  const activeRows = rows.filter((row) => row.isActive);

  const npsUnitStats = Array.from({ length: 10 }, (_, index) => {
    const values = rows.map((row) => row.npsValues[index]).filter((value) => value !== null);
    return {
      unit: `Unidad ${index + 1}`,
      average: average(values),
      answers: values.length
    };
  });

  const allNpsValues = rows.flatMap((row) => row.npsValues.filter((value) => value !== null));
  const recommendationCount = allNpsValues.filter((value) => Number(value) >= 9).length;

  const modelBuckets = ['Reventa', 'Gastronomicos', 'Fabricantes', 'Servicios', 'Etc'].map((bucket) => {
    const subset = rows.filter((row) => row.modelBucket === bucket);
    const subsetSuccess = subset.filter((row) => row.successDate);
    const subsetAbandon = subset.filter((row) => row.abandonDate);
    const subsetInsatisfaction = subset.filter((row) => row.hasInsatisfaction);
    const subsetFirstResultDiffs = collectDayDiffs(subset, (row) => row.onboardingDate, (row) => row.firstResultDate);
    const subsetNpsValues = subset.flatMap((row) => row.npsValues.filter((value) => value !== null));
    const subsetRenewals = subset.filter((row) => row.renewalCompletedDate);

    return [
      bucket,
      formatInteger(subset.length),
      formatPercent(safeDiv(subsetAbandon.length * 100, subset.length)),
      formatInteger(subsetSuccess.length),
      formatPercent(safeDiv(subsetSuccess.length * 100, subset.length)),
      formatDays(average(subsetFirstResultDiffs)),
      formatInteger(subsetInsatisfaction.length),
      subsetNpsValues.length ? formatDecimal(average(subsetNpsValues), 1) : 'Sin base',
      formatInteger(subsetRenewals.length)
    ];
  });

  const metrics = [
    buildMetricRow({
      key: 'total_clients',
      label: 'Clientes totales que pasaron por el programa',
      value: formatInteger(rows.length),
      base: `${formatInteger(rows.length)} filas actuales en "csm"`,
      note: 'Incluye activos e inactivos.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"id", "nombre"',
      logic: 'Cuenta todas las filas vigentes de la tabla "csm" como universo del programa.'
    }),
    buildMetricRow({
      key: 'active_support',
      label: 'Cantidad de clientes activos con soporte',
      value: formatCountWithPercent(activeRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Toma la foto actual de clientes marcados como activos.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"activos"',
      logic: 'Cuenta filas con "activos"=true.'
    }),
    buildMetricRow({
      key: 'abandonments',
      label: 'Cantidad de abandonos',
      value: formatCountWithPercent(rows.filter((row) => row.abandonDate).length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Solo entra quien tiene fecha de abandono cargada.',
      dateLabel: '"f_abandono"',
      fieldsLabel: '"f_abandono"',
      logic: 'Cuenta clientes con una fecha válida en "f_abandono".'
    }),
    buildMetricRow({
      key: 'avg_days_to_abandon',
      label: 'Dias promedio hasta abandono',
      value: formatDays(average(abandonDiffs)),
      base: `${formatInteger(abandonDiffs.length)} clientes con inicio y abandono`,
      note: 'El inicio toma primero onboarding y, si falta, acceso.',
      dateLabel: '"f_onboarding" / "f_acceso" -> "f_abandono"',
      fieldsLabel: '"f_onboarding", "f_acceso", "f_abandono"',
      logic: 'Promedio de días desde el inicio operativo del programa hasta la fecha de abandono.'
    }),
    buildMetricRow({
      key: 'engagement',
      label: 'Clientes con engagement',
      value: formatCountWithPercent(engagedRows.length, activeRows.length),
      base: `${formatInteger(activeRows.length)} clientes activos`,
      note: 'Considero engagement si hubo avance o respuesta en los últimos 30 días.',
      dateLabel: 'Ultimos 30 dias sobre "ultima_fecha_de_avance" / "ultima_respuesta"',
      fieldsLabel: '"activos", "ultima_fecha_de_avance", "ultima_respuesta"',
      logic: 'Cuenta clientes activos con una fecha reciente de avance o respuesta dentro de los últimos 30 días.'
    }),
    buildMetricRow({
      key: 'success_cases',
      label: 'Casos de exito',
      value: formatCountWithPercent(successRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Usa la fecha del caso de éxito cargada en la tabla.',
      dateLabel: '"caso_de_exito"',
      fieldsLabel: '"caso_de_exito"',
      logic: 'Cuenta clientes con fecha no nula en "caso_de_exito".'
    }),
    buildMetricRow({
      key: 'nightmare_clients',
      label: 'Clientes pesadilla',
      value: formatCountWithPercent(nightmareRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Lo uso como proxy negativo mientras definimos una regla final.',
      dateLabel: 'Snapshot actual y marcas negativas',
      fieldsLabel: '"insatisfecho", "solicito_devolucion"',
      logic: 'Por ahora considero pesadilla a todo cliente con alguna marca negativa en "insatisfecho" o "solicito_devolucion".'
    }),
    buildMetricRow({
      key: 'first_result_clients',
      label: 'Clientes con primer resultado',
      value: formatCountWithPercent(firstResultRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'El primer resultado se deriva de la primera unidad posterior al onboarding.',
      dateLabel: 'Primera fecha entre "modulo_2" y "modulo_10"',
      fieldsLabel: '"modulo_2" a "modulo_10"',
      logic: 'Cuenta clientes con al menos una fecha válida desde "modulo_2" en adelante.'
    }),
    buildMetricRow({
      key: 'insatisfied_clients',
      label: 'Clientes insatisfechos',
      value: formatCountWithPercent(insatisfactionRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Usa la marca cargada hoy en la tabla.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"insatisfecho"',
      logic: 'Cuenta filas con contenido en "insatisfecho".'
    }),
    buildMetricRow({
      key: 'refund_requests',
      label: 'Solicitudes de devoluciones',
      value: formatCountWithPercent(refundRows.length, rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Se apoya en el marcador actual de solicitud.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"solicito_devolucion"',
      logic: 'Cuenta filas con contenido en "solicito_devolucion".'
    }),
    buildMetricRow({
      key: 'refunds_completed',
      label: 'Devoluciones efectuadas',
      value: formatCountWithPercent(refundCompletedRows.length, refundRows.length),
      base: `${formatInteger(refundRows.length)} solicitudes detectadas`,
      note: 'Uso un proxy: solicitud de devolución y cliente ya inactivo o con despedida.',
      dateLabel: 'Snapshot actual + cierre del caso',
      fieldsLabel: '"solicito_devolucion", "activos", "despedida"',
      logic: 'Hasta contar con un campo específico de devolución efectuada, tomo como proxy las solicitudes cuyo cliente ya no está activo o tiene "despedida".'
    }),
    buildMetricRow({
      key: 'nps_by_unit',
      label: 'NPS promedio de cada unidad',
      value: 'Ver detalle por unidad',
      base: `${formatInteger(allNpsValues.length)} respuestas NPS`,
      note: 'La tabla inferior muestra unidad por unidad.',
      dateLabel: '"nps_1" a "nps_10"',
      fieldsLabel: '"nps_1" a "nps_10"',
      logic: 'Promedio simple por cada columna NPS, usando solo respuestas no nulas.'
    }),
    buildMetricRow({
      key: 'recommendations_pct',
      label: '% recomendaciones',
      value: formatPercent(safeDiv(recommendationCount * 100, allNpsValues.length)),
      base: `${formatInteger(allNpsValues.length)} respuestas NPS`,
      note: 'Tomo recomendación como respuesta NPS mayor o igual a 9.',
      dateLabel: '"nps_1" a "nps_10"',
      fieldsLabel: '"nps_1" a "nps_10"',
      logic: 'Calcula el porcentaje de respuestas NPS con valor mayor o igual a 9 sobre el total de respuestas cargadas.'
    })
  ];

  const sections = [
    {
      title: 'NPS Promedio por Unidad',
      description: 'Promedio y cantidad de respuestas disponibles en cada unidad.',
      columns: ['Unidad', 'Promedio NPS', 'Respuestas'],
      rows: npsUnitStats.map((row) => [
        row.unit,
        row.average === null ? 'Sin base' : formatDecimal(row.average, 1),
        formatInteger(row.answers)
      ])
    },
    {
      title: 'Modelos de Negocio',
      description: 'Desglose por segmento normalizado a partir de "modelo_negocio".',
      columns: ['Modelo', 'Cantidad programa', '% abandonos', 'Cantidad exito', '% caso exito', 'Tiempo a primer resultado', 'Insatisfechos', 'NPS', 'Renovaciones'],
      rows: modelBuckets
    }
  ];

  return {
    metrics,
    kpiKeys: ['total_clients', 'active_support', 'engagement', 'success_cases'],
    chart: {
      title: 'Foto Actual del Programa',
      description: 'Conteos clave para leer salud, avance y alertas del programa.',
      labels: ['Activos', 'Engagement', 'Primer resultado', 'Exito', 'Abandonos', 'Pesadilla', 'Insatisfechos'],
      datasets: [
        {
          label: 'Clientes',
          data: [
            activeRows.length,
            engagedRows.length,
            firstResultRows.length,
            successRows.length,
            rows.filter((row) => row.abandonDate).length,
            nightmareRows.length,
            insatisfactionRows.length
          ],
          backgroundColor: [
            'rgba(29, 78, 216, 0.72)',
            'rgba(37, 99, 235, 0.72)',
            'rgba(14, 165, 233, 0.72)',
            'rgba(16, 185, 129, 0.72)',
            'rgba(245, 158, 11, 0.72)',
            'rgba(239, 68, 68, 0.72)',
            'rgba(190, 24, 93, 0.72)'
          ],
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

function buildRenewalsPage(rows) {
  const renewable30Rows = rows.filter((row) => row.isRenewable30);
  const renewable15Rows = rows.filter((row) => row.isRenewable15);
  const renewedRows = rows.filter((row) => row.renewalCompletedDate);
  const renewalBase = renewable15Rows.length || renewable30Rows.length;
  const renewalRate = safeDiv(renewedRows.length * 100, renewalBase);
  const projectedRenewals = (renewalRate / 100) * renewable30Rows.length;

  const monthBuckets = new Map();
  rows.forEach((row) => {
    if (!row.finalDate) return;
    const monthKey = `${row.finalDate.getUTCFullYear()}-${String(row.finalDate.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthBuckets.has(monthKey)) {
      monthBuckets.set(monthKey, {
        label: row.finalDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
        renewable30: 0,
        renewable15: 0,
        renewed: 0
      });
    }
    const bucket = monthBuckets.get(monthKey);
    if (row.isRenewable30) bucket.renewable30 += 1;
    if (row.isRenewable15) bucket.renewable15 += 1;
    if (row.renewalCompletedDate) bucket.renewed += 1;
  });

  const sortedMonths = [...monthBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  const operationalMetrics = [
    buildMetricRow({
      key: 'renewable_30d',
      label: 'Clientes proximos a entrar a etapa de renovacion 30 dias',
      value: formatInteger(renewable30Rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Lee el flag operativo de ventana 30D.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"proximo_renovar_30d"',
      logic: 'Cuenta filas donde "proximo_renovar_30d" viene marcado como verdadero, normalmente con valor "1".'
    }),
    buildMetricRow({
      key: 'renewable_15d',
      label: 'Clientes en etapa de renovacion 15 dias',
      value: formatInteger(renewable15Rows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Lee el flag operativo de ventana 15D.',
      dateLabel: 'Snapshot actual de "csm"',
      fieldsLabel: '"proximo_renovar_15d"',
      logic: 'Cuenta filas donde "proximo_renovar_15d" viene marcado como verdadero, normalmente con valor "1".'
    }),
    buildMetricRow({
      key: 'renewals_completed',
      label: 'Cantidad de renovaciones',
      value: formatInteger(renewedRows.length),
      base: `${formatInteger(rows.length)} clientes totales`,
      note: 'Cuenta renovaciones cerradas con fecha registrada.',
      dateLabel: '"fecha_final_renovacion"',
      fieldsLabel: '"fecha_final_renovacion"',
      logic: 'Cuenta clientes con fecha válida en "fecha_final_renovacion".'
    }),
    buildMetricRow({
      key: 'renewal_rate',
      label: '% renovaciones sobre renovables',
      value: formatPercent(renewalRate),
      base: `${formatInteger(renewalBase)} clientes en base renovable`,
      note: 'Uso primero la base 15D; si está vacía, tomo la 30D.',
      dateLabel: 'Snapshot actual y cierre de renovación',
      fieldsLabel: '"proximo_renovar_15d", "proximo_renovar_30d", "fecha_final_renovacion"',
      logic: 'Calculo renovaciones concretadas sobre la base renovable más cercana a cierre: primero "proximo_renovar_15d" y, si no hay base, "proximo_renovar_30d".'
    }),
    buildMetricRow({
      key: 'renewal_projection',
      label: 'Proyeccion de renovaciones a 30 dias',
      value: formatInteger(Math.round(projectedRenewals)),
      base: `${formatInteger(renewable30Rows.length)} clientes en 30D`,
      note: 'Aplico la tasa de renovación actual sobre la ventana 30D.',
      dateLabel: 'Snapshot actual de renovables',
      fieldsLabel: '"proximo_renovar_30d", "proximo_renovar_15d", "fecha_final_renovacion"',
      logic: 'Multiplico la tasa actual de renovación por la cantidad de clientes marcados en "proximo_renovar_30d".'
    })
  ];

  const definitionMetrics = [
    buildMetricRow({
      key: 'renewal_facturacion',
      label: 'Facturacion de renovaciones',
      value: 'En definicion',
      base: 'Sin campo monetario directo en "csm"',
      note: 'La base operativa ya existe, falta cerrar el mapping monetario final.',
      dateLabel: 'Pendiente de definicion monetaria',
      fieldsLabel: '"proximo_renovar_15d", "proximo_renovar_30d", "fecha_final", "fecha_final_renovacion"',
      logic: 'La tabla "csm" hoy permite identificar el universo renovable, pero no trae un monto explícito de facturación de renovación para consolidar este KPI con precisión.'
    }),
    buildMetricRow({
      key: 'renewal_cash',
      label: 'Cash collected de renovaciones',
      value: 'En definicion',
      base: 'Sin campo monetario directo en "csm"',
      note: 'La ventana operativa está; el cash todavía no está materializado en esta tabla.',
      dateLabel: 'Pendiente de definicion monetaria',
      fieldsLabel: '"proximo_renovar_15d", "proximo_renovar_30d", "fecha_final_renovacion"',
      logic: 'Puedo identificar clientes renovables y renovados, pero hoy no hay un campo de cash cobrado de renovación dentro de "csm".'
    }),
    buildMetricRow({
      key: 'renewal_pending',
      label: 'Pagos pendientes de renovaciones',
      value: 'En definicion',
      base: 'Sin campo monetario directo en "csm"',
      note: 'Se puede construir cuando definamos el estado pendiente o el cruce monetario.',
      dateLabel: 'Pendiente de definicion monetaria',
      fieldsLabel: '"proximo_renovar_15d", "proximo_renovar_30d", "fecha_final"',
      logic: 'La parte operativa de quién debe renovar ya está, pero no existe todavía una marca monetaria de saldo pendiente dentro de "csm".'
    })
  ];

  const metrics = [...operationalMetrics, ...definitionMetrics];

  const sections = [
    {
      title: 'Indicadores Monetarios Pendientes',
      description: 'Quedan separados porque "csm" todavía no trae montos directos para consolidarlos.',
      columns: ['Indicador', 'Estado', 'Base actual', 'Qué falta'],
      rows: definitionMetrics.map((metric) => [
        metric.label,
        metric.value,
        metric.base,
        metric.note
      ])
    },
    {
      title: 'Calendario Operativo de Renovaciones',
      description: 'Distribución por mes final del programa, usando "fecha_final" como eje.',
      columns: ['Mes', 'Base 30D', 'Base 15D', 'Renovadas'],
      rows: sortedMonths.map(([, bucket]) => [
        bucket.label,
        formatInteger(bucket.renewable30),
        formatInteger(bucket.renewable15),
        formatInteger(bucket.renewed)
      ])
    }
  ];

  return {
    metrics,
    tableMetrics: operationalMetrics,
    kpiKeys: ['renewable_30d', 'renewable_15d', 'renewals_completed', 'renewal_rate'],
    chart: {
      title: 'Embudo de Renovación',
      description: 'Lectura rápida de la base renovable, cierres y proyección operativa.',
      labels: ['30 dias', '15 dias', 'Renovadas', 'Proyeccion 30D'],
      datasets: [
        {
          label: 'Clientes',
          data: [renewable30Rows.length, renewable15Rows.length, renewedRows.length, Math.round(projectedRenewals)],
          backgroundColor: [
            'rgba(37, 99, 235, 0.72)',
            'rgba(59, 130, 246, 0.72)',
            'rgba(16, 185, 129, 0.72)',
            'rgba(245, 158, 11, 0.72)'
          ],
          borderRadius: 8
        }
      ]
    },
    sections
  };
}

const PAGE_BUILDERS = {
  tiempo: buildTimePage,
  situacion: buildSituationPage,
  renovaciones: buildRenewalsPage
};

async function initCsmPage() {
  const pageKey = document.body.dataset.csmPage;
  const builder = PAGE_BUILDERS[pageKey];
  const status = document.getElementById('status');

  if (!builder) return;

  status.textContent = 'Cargando metricas de CSM...';

  try {
    const response = await window.metricasApi.fetchAllRows('csm', { limit: 1000 });
    const rows = enrichRows(response.rows || []);
    const page = builder(rows);
    const infoMap = Object.fromEntries(page.metrics.map((metric) => [metric.key, metric.info]));

    renderKpiCards(page.metrics, page.kpiKeys, infoMap);
    renderChart(page.chart);
    renderMetricsTable(page.tableMetrics || page.metrics, infoMap);
    renderSections(page.sections);

    status.textContent = `Base actual: ${formatInteger(rows.length)} registros de "csm". El panel prioriza campos directos de Notion y usa fallback operativo cuando todavía falta completar alguno.`;
  } catch (error) {
    document.getElementById('kpiContainer').innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '<div class="table-wrap csm-table-wrap"><div class="report-empty">No se pudieron cargar las metricas de CSM.</div></div>';
    document.getElementById('detailContainer').innerHTML = '';
    status.textContent = error.message || 'No se pudieron cargar las metricas de CSM.';
  }
}

initCsmPage();
