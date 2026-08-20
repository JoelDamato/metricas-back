(function initCentralPageInfo() {
  const CSM_PANEL_INFO = {
    tiempo: {
      title: 'CSM · Por Tiempo',
      viewLabel: '"csm"',
      dateLabel: 'Cada sesión usa su fecha real: "f_diagnostico", "f_costos_1", "f_costos_2", "f_eerr_economico", "f_eerr_financiero" y "f_cashflow".',
      fieldsLabel: '"f_pago_con_acceso", "f_acceso", "f_onboarding", "f_diagnostico", "f_costos_1", "f_costos_2", "f_eerr_economico", "f_eerr_financiero", "f_cashflow" y "modulo_1" a "modulo_10".',
      logic: [
        'Los diagnósticos del mes se cuentan por "f_diagnostico", sin depender del mes en que ingresó el cliente.',
        'Hasta 7 días y después de 7 días se calculan entre "f_pago_con_acceso" (o "f_acceso" como respaldo) y "f_diagnostico". Los pendientes se muestran aparte como cohorte de ingresos.',
        'Costos 1, Costos 2, Económica, Financiera y Cashflow se cuentan por la fecha real de cada sesión.',
        'Los tiempos entre sesiones usan hitos consecutivos con ambas fechas válidas y muestran su cobertura para no confundir falta de carga con un resultado real.'
      ]
    },
    situacion: {
      title: 'CSM · Por Situación',
      viewLabel: '"csm"',
      dateLabel: 'Mixta: snapshot actual del cliente más fechas de hitos como "f_acceso", "f_abandono", "caso_de_exito" y "fecha_final".',
      fieldsLabel: '"acceso", "ghlid", "f_pago_con_acceso", "f_abandono", "caso_de_exito", "insatisfecho", "solicito_devolucion", "nps_1" a "nps_10", "modelo_negocio" y fechas de sesiones.',
      logic: [
        'El total principal deduplica personas por GHL y deja visibles las filas duplicadas o sin GHL para auditoría.',
        'Un cliente está activo únicamente cuando "acceso" vale "Acceso"; "Sin acceso" se muestra como inactivo y los vacíos quedan separados como falta de dato.',
        'Los nuevos ingresos usan "f_pago_con_acceso" y muestran cantidad única, filas, variación mensual y el estado actual de cada cohorte.',
        'Clientes por año y por rubro también trabajan con clientes únicos. Los conteos de sesiones usan la fecha específica de cada hito.'
      ]
    },
    renovaciones: {
      title: 'CSM · Renovaciones',
      viewLabel: '"csm"',
      dateLabel: 'Principalmente "proximo_renovar_15d", "proximo_renovar_30d", "fecha_final" y "fecha_final_renovacion".',
      fieldsLabel: '"proximo_renovar_15d", "proximo_renovar_30d", "fecha_final", "fecha_final_renovacion", "activos", "productos_adquiridos", "ultimo_producto_adquirido".',
      logic: [
        'Este panel va a ordenar el universo renovable y separar clientes en ventana de 30 días y de 15 días antes de la renovación.',
        'Hoy la tabla "csm" ya trae banderas calculadas para esas ventanas en "proximo_renovar_15d" y "proximo_renovar_30d". En los datos actuales esas banderas están guardadas como texto, normalmente "1" o "0".',
        'La fecha de referencia para validar o rearmar esos universos está en "fecha_final" y, cuando exista un cierre explícito de renovación, en "fecha_final_renovacion".',
        'Los montos de facturación, cash collected, pagos pendientes y cantidad final de renovaciones se pueden apoyar en estos flags y en las fechas finales; cuando me pases la definición exacta de cada indicador lo cierro con la lógica definitiva.'
      ]
    }
  };

  function showMetricInfo(info) {
    if (!info) return;

    const existing = document.getElementById('centralMetricPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'centralMetricPopup';
    popup.className = 'kpi-popup metric-info-popup';
    popup.innerHTML = `
      <div class="kpi-popup-card metric-info-card">
        <h3>${info.title}</h3>
        <p><strong>Vista que usa:</strong> ${info.viewLabel || '"csm"'}</p>
        <p><strong>Fecha que usa:</strong> ${info.dateLabel}</p>
        <p><strong>Campos principales:</strong> ${info.fieldsLabel}</p>
        <p><strong>Lógica:</strong></p>
        <ul>${info.logic.map((item) => `<li>${item}</li>`).join('')}</ul>
        <button id="centralMetricPopupClose" type="button">Cerrar</button>
      </div>
    `;

    document.body.appendChild(popup);

    const close = () => popup.remove();
    popup.addEventListener('click', (event) => {
      if (event.target === popup) close();
    });
    document.getElementById('centralMetricPopupClose').addEventListener('click', close);
  }

  document.querySelectorAll('[data-csm-panel]').forEach((card) => {
    const open = () => showMetricInfo(CSM_PANEL_INFO[card.dataset.csmPanel]);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
})();
