(function initCentralPageInfo() {
  const CSM_PANEL_INFO = {
    tiempo: {
      title: 'CSM · Por Tiempo',
      viewLabel: '"csm"',
      dateLabel: 'Prioriza campos calculados directos y, si faltan, cae a fechas base como "f_acceso", "f_onboarding", "f_primer_resultado", "caso_de_exito" y "modulo_1" a "modulo_10".',
      fieldsLabel: '"pago_a_onbo", "pago_a_diagnostico", "diagnostico_7dias", "f_acceso", "f_onboarding", "f_primer_resultado", "caso_de_exito", "modulo_1" a "modulo_10", "ultima_fecha_de_avance".',
      logic: [
        'Este panel concentra tiempos entre hitos del programa. Cuando la tabla "csm" ya trae el indicador calculado, ese valor tiene prioridad; si todavía está vacío, el panel cae a la diferencia entre fechas base.',
        'Para "Tiempo promedio desde pago a ver onboarding" prioriza "pago_a_onbo" y, si falta, calcula la diferencia entre "f_acceso" y "f_onboarding".',
        'Para "Tiempo promedio desde pago a sesión diagnóstico" prioriza "pago_a_diagnostico". Si falta, toma "f_acceso" y la compara contra la fecha operativa de diagnóstico, que sale de "modulo_1" y, si no existe, de "f_onboarding".',
        'Para "Cantidad de sesiones diagnóstico menor a 7 días" prioriza el flag "diagnostico_7dias". Si todavía no llegó desde Notion, usa el tiempo a diagnóstico resuelto por el panel y marca positivo cuando es menor o igual a 7.',
        'Para "Tiempo promedio a primer resultado" usa "f_primer_resultado" y calcula el promedio contra "f_onboarding". Si esa fecha todavía no está cargada, usa como respaldo la primera fecha completada entre "modulo_2" y "modulo_10".',
        'Para "Tiempo promedio a caso de éxito" toma la diferencia entre "f_onboarding" y "caso_de_exito". Para "Tiempo promedio en cada unidad" mide el tramo entre un hito y el siguiente: onboarding a "modulo_1", luego "modulo_1" a "modulo_2" y así sucesivamente.'
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
