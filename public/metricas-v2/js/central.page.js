(function initCentralPageInfo() {
  const CSM_PANEL_INFO = {
    tiempo: {
      title: 'CSM · Por Tiempo',
      viewLabel: '"csm"',
      dateLabel: 'Principalmente "f_acceso", "f_onboarding", "caso_de_exito", "fecha_final", "modulo_1" a "modulo_10" y sus campos "*_format".',
      fieldsLabel: '"pago_a_onbo", "diagnostico_7dias", "f_acceso", "f_onboarding", "caso_de_exito", "fecha_final", "modulo_1" a "modulo_10", "modulo_1_format" a "modulo_10_format", "ultima_fecha_de_avance".',
      logic: [
        'Este panel va a concentrar métricas de demora entre hitos del programa. La base más directa ya está en "csm", y varias métricas vienen precalculadas.',
        'Para "Tiempo promedio desde pago a ver onboarding" la base prevista es el campo calculado "pago_a_onbo". Si más adelante querés recalcularlo desde cero, la referencia natural sería la diferencia entre "f_acceso" y "f_onboarding".',
        'Para "Tiempo promedio desde pago a sesión diagnóstico" y "Cantidad de sesiones diagnóstico menor a 7 días" hoy la referencia más directa es "diagnostico_7dias", que ya guarda el resultado calculado en la tabla.',
        'Para "Tiempo promedio a primer resultado", "Tiempo promedio a caso de éxito" y "Tiempo promedio en cada unidad" la base está en las fechas o marcas de avance de "modulo_1" a "modulo_10", junto con "caso_de_exito", "f_onboarding" y "ultima_fecha_de_avance".'
      ]
    },
    situacion: {
      title: 'CSM · Por Situación',
      viewLabel: '"csm"',
      dateLabel: 'Mixta: snapshot actual del cliente más fechas de hitos como "f_acceso", "f_abandono", "caso_de_exito" y "fecha_final".',
      fieldsLabel: '"activos", "f_abandono", "caso_de_exito", "insatisfecho", "solicito_devolucion", "nps_1" a "nps_10", "modelo_negocio", "f_acceso", "f_onboarding", "fecha_final", "actividad", "progreso_curso", "ultima_respuesta".',
      logic: [
        'Este panel apunta a explicar en qué situación está cada cliente y qué porcentaje representa sobre la base total o sobre los activos, según la métrica.',
        'Las métricas más directas ya salen de campos concretos de "csm": clientes activos con soporte desde "activos", abandonos desde "f_abandono", casos de éxito desde "caso_de_exito", insatisfechos desde "insatisfecho" y solicitudes de devolución desde "solicito_devolucion".',
        'Las métricas porcentuales se pueden calcular sobre el total de filas de "csm" o sobre el subconjunto con "activos"=true, dependiendo de la definición final que me pases para cada una.',
        'Para "NPS promedio de cada unidad" la base ya está materializada en "nps_1" a "nps_10". Para el corte por "modelo de negocio" también ya existe el campo "modelo_negocio", con valores como "Reventa", "Fabricante", "Gastronómico" y variantes de servicios.'
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
