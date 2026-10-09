(function () {
  'use strict';

  const DEFAULT_CLOSERS = ['Claudio Nicolini', 'Walter Alegre', 'Carlos Tu', 'Mauro Gaitan', 'Patricia Conti'];
  const DISC_KEYS = ['D', 'I', 'S', 'C'];
  const DISC_DATA = {
    D: {
      name: 'Dominancia', color: '#ff5a70',
      motivation: ['Desafíos claros y metas altas', 'Competencia interna y rankings', 'Recompensas que reflejen estatus'],
      incentives: ['Bono extra al top del ranking', 'Premio al mejor cierre', 'Experiencias VIP'],
      tip: 'Planteá objetivos concretos, autonomía y una forma clara de medir el resultado.',
      behaviors: [
        ['Autoritarismo', 'Impone ideas sin considerar la opinión de los demás.', 'Empatía', 'Reservar un momento de cada reunión para escuchar al equipo antes de decidir.', 'Practicar escucha activa y confirmar lo que entendió antes de responder.'],
        ['Impaciencia', 'Dificultad para lidiar con procesos o personas que necesitan más tiempo.', 'Paciencia', 'Preguntar por avances y obstáculos antes de presionar por resultados.', 'Esperar cinco minutos antes de actuar en momentos de ansiedad o prisa.'],
        ['Competitividad excesiva', 'Prioriza ganar incluso cuando perjudica al equipo.', 'Colaborativismo', 'Crear metas conjuntas y destacar los logros colectivos.', 'Practicar actividades grupales donde el éxito dependa de todos.'],
        ['Agresividad verbal', 'Un tono áspero puede intimidar y desmotivar.', 'Comunicación respetuosa', 'Reemplazar críticas directas por preguntas que estimulen el aprendizaje.', 'Grabar y revisar el propio tono al hablar sobre un tema incómodo.'],
        ['Falta de empatía', 'Le cuesta considerar necesidades emocionales ajenas.', 'Empatía', 'Mantener conversaciones individuales para conocer desafíos y motivaciones.', 'Explorar historias contadas desde perspectivas emocionales diferentes.'],
        ['Decisiones impulsivas', 'Actúa sin evaluar consecuencias o consultar.', 'Planificación estratégica', 'Escribir pros y contras y pedir feedback antes de decisiones relevantes.', 'Esperar 24 horas antes de tomar decisiones personales importantes.'],
        ['Resistencia a la crítica', 'Reacciona de manera defensiva ante el feedback.', 'Apertura al feedback', 'Escuchar sin interrumpir, hacer preguntas y agradecer la devolución.', 'Pedir una mejora concreta a alguien cercano y escuchar sin defenderse.'],
        ['Intolerancia con errores', 'Tiene poca paciencia con fallas propias o ajenas.', 'Aceptación de errores', 'Convertir cada error en una breve revisión de aprendizajes.', 'Registrar errores pasados y la lección obtenida de cada uno.']
      ]
    },
    I: {
      name: 'Influencia', color: '#ffbd45',
      motivation: ['Reconocimiento público', 'Premios grupales', 'Ambientes positivos y dinámicos'],
      incentives: ['Reconocimiento frente al equipo', 'Salidas compartidas', 'Espacios para liderar o presentar'],
      tip: 'El reconocimiento visible y una experiencia compartida suelen ser más motivadores que un esquema rígido.',
      behaviors: [
        ['Hablar demasiado', 'Puede monopolizar conversaciones.', 'Escucha activa', 'Limitar el tiempo de exposición y pedir opiniones de forma directa.', 'Escuchar dos minutos sin interrumpir antes de responder.'],
        ['Falta de organización', 'No prioriza tareas y puede generar retrasos.', 'Planificación eficaz', 'Usar una lista diaria con prioridades y bloques de tiempo.', 'Planificar el día siguiente durante quince minutos cada noche.'],
        ['Promesas no cumplidas', 'Asume compromisos que no puede sostener.', 'Compromiso realista', 'Revisar agenda y capacidad antes de aceptar una responsabilidad.', 'Anotar cada compromiso y revisar su avance.'],
        ['Falta de enfoque', 'Se distrae entre actividades sin terminarlas.', 'Enfoque en prioridades', 'Elegir tres tareas prioritarias y terminarlas antes de sumar otras.', 'Reservar un bloque diario para una única actividad.'],
        ['Impulsividad', 'Decide guiado por la emoción del momento.', 'Reflexión antes de actuar', 'Tomar cinco minutos para evaluar ventajas y riesgos.', 'Esperar 24 horas antes de compras o decisiones importantes.'],
        ['Evitar feedback negativo', 'Evita conversaciones difíciles por temor a desagradar.', 'Comunicación asertiva', 'Dar feedback con un punto positivo, una mejora y un próximo paso.', 'Practicar devoluciones pequeñas y específicas con personas cercanas.'],
        ['Falta de persistencia', 'Abandona tareas difíciles o poco estimulantes.', 'Perseverancia', 'Dividir tareas largas y reconocer cada avance.', 'Definir una recompensa pequeña al completar una tarea evitada.']
      ]
    },
    S: {
      name: 'Estabilidad', color: '#41d59a',
      motivation: ['Estabilidad y confianza del líder', 'Reconocimiento por constancia', 'Bienestar personal y familiar'],
      incentives: ['Día libre o descanso adicional', 'Reconocimiento privado', 'Bono por continuidad'],
      tip: 'Funcionan mejor los reconocimientos tranquilos, previsibles y significativos que la competencia agresiva.',
      behaviors: [
        ['Resistencia al cambio', 'Prefiere la zona conocida y evita procesos nuevos.', 'Adaptabilidad', 'Participar en un proyecto que requiera probar un enfoque diferente.', 'Probar una actividad nueva por semana.'],
        ['Lentitud para decidir', 'Demora incluso decisiones menores o urgentes.', 'Proactividad en decisiones', 'Definir plazos cortos para resolver decisiones operativas.', 'Resolver decisiones cotidianas en menos de dos minutos.'],
        ['Evitar conflictos', 'Posterga conversaciones para conservar la armonía.', 'Resolución de conflictos', 'Preparar una conversación difícil con foco en soluciones.', 'Hablar de forma directa y respetuosa sobre una incomodidad reciente.'],
        ['Baja iniciativa', 'Espera instrucciones antes de actuar.', 'Proactividad', 'Detectar y resolver una tarea útil sin que se lo soliciten.', 'Organizar una actividad sin esperar la iniciativa de otra persona.'],
        ['Falta de ambición', 'Se conforma y evita nuevos desafíos.', 'Ambición positiva', 'Definir una meta profesional a seis meses y el primer hito.', 'Escribir objetivos personales y ejecutar el primer paso.'],
        ['Desmotivación ante cambios', 'Los cambios bruscos reducen su energía.', 'Resiliencia ante el cambio', 'Participar activamente en una transición y proponer una mejora.', 'Anotar tres beneficios posibles de cada cambio importante.']
      ]
    },
    C: {
      name: 'Conformidad', color: '#4f8cff',
      motivation: ['Precisión y cumplimiento', 'Calidad y mejora continua', 'Reglas claras y justas'],
      incentives: ['Premio por calidad', 'Cursos o certificaciones', 'Bono por sostener estándares'],
      tip: 'La claridad, la consistencia y la justicia del sistema pesan tanto como el incentivo.',
      behaviors: [
        ['Perfeccionismo extremo', 'Dedica demasiado tiempo al detalle y retrasa entregas.', 'Excelencia práctica', 'Definir un tiempo máximo de revisión y entregar al finalizarlo.', 'Aceptar que terminado a tiempo puede ser mejor que perfecto tarde.'],
        ['Resistencia a los riesgos', 'Evita acciones sin garantía de éxito.', 'Riesgos calculados', 'Probar un enfoque controlado con un resultado medible.', 'Incorporar una experiencia nueva que antes evitaba.'],
        ['Crítica excesiva', 'Evalúa duramente cuando no se cumplen sus estándares.', 'Feedback constructivo', 'Equilibrar reconocimiento, mejora concreta y siguiente paso.', 'Reconocer primero algo bien hecho antes de sugerir un cambio.'],
        ['Procrastinación por perfección', 'Posterga por miedo a no alcanzar un estándar ideal.', 'Agilidad en la ejecución', 'Dividir la tarea y completar al menos un paso por día.', 'Usar un cronograma breve y respetar la fecha de cierre.'],
        ['Miedo a equivocarse', 'Evita decidir por temor al error.', 'Valentía para equivocarse', 'Decidir con la información disponible y documentar el aprendizaje.', 'Probar algo nuevo sin exigir un resultado perfecto.'],
        ['Renuencia a delegar', 'Retiene tareas por temor a una ejecución imperfecta.', 'Confianza en el equipo', 'Delegar una tarea con criterios de éxito claros.', 'Pedir ayuda en una tarea que normalmente hace solo.'],
        ['Exceso de control', 'Supervisa todo y genera sobrecarga.', 'Delegación estratégica', 'Acordar el resultado esperado y revisar solamente los hitos.', 'Permitir que otra persona lidere una actividad compartida.']
      ]
    }
  };

  const state = { records: [], currentKey: '', currentTab: 'datos', storageReady: false, dirty: false };
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function slug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  }

  function defaultPerformance(name) {
    return {
      nombre: name, cargo: 'Closer', lider: '', fechaInicio: '',
      f1: '', f2: '', f3: '', d1: '', d2: '', d3: '', t1: '', t2: '', t3: '',
      disc: { D: 0, I: 0, S: 0, C: 0 }, comps: []
    };
  }

  function defaultRecord(name) {
    return { closerKey: slug(name), closerName: name, performance: defaultPerformance(name), plan: [], persisted: false };
  }

  function normalizeRecord(input) {
    const name = String(input?.closerName || input?.performance?.nombre || '').trim();
    const base = defaultRecord(name);
    return {
      ...base,
      ...input,
      closerKey: input?.closerKey || slug(name),
      closerName: name,
      performance: {
        ...base.performance,
        ...(input?.performance || {}),
        nombre: input?.performance?.nombre || name,
        disc: { ...base.performance.disc, ...(input?.performance?.disc || {}) },
        comps: Array.isArray(input?.performance?.comps) ? input.performance.comps : []
      },
      plan: Array.isArray(input?.plan) ? input.plan : [],
      persisted: Boolean(input?.id || input?.updatedAt)
    };
  }

  function mergeWithDefaultClosers(records) {
    const normalized = (records || []).map(normalizeRecord);
    const existingKeys = new Set(normalized.map((record) => record.closerKey));
    DEFAULT_CLOSERS.forEach((name) => {
      const key = slug(name);
      if (!existingKeys.has(key)) normalized.push(defaultRecord(name));
    });
    return normalized;
  }

  function currentRecord() {
    return state.records.find((record) => record.closerKey === state.currentKey) || state.records[0] || null;
  }

  function setStatus(message, kind) {
    const element = $('pdiStatus');
    element.textContent = message || '';
    element.className = `pdi-status${kind ? ` is-${kind}` : ''}`;
  }

  function markDirty() {
    state.dirty = true;
    setStatus('Tenés cambios sin guardar en Supabase.', 'warning');
  }

  function renderCloserSelect() {
    const select = $('pdiCloserSelect');
    select.innerHTML = state.records.map((record) => (
      `<option value="${escapeHtml(record.closerKey)}"${record.closerKey === state.currentKey ? ' selected' : ''}>${escapeHtml(record.closerName)}</option>`
    )).join('');
  }

  function fillBasicFields() {
    const record = currentRecord();
    if (!record) return;
    const performance = record.performance;
    const fields = {
      pdiNombre: performance.nombre || record.closerName,
      pdiCargo: performance.cargo,
      pdiLider: performance.lider,
      pdiFechaInicio: performance.fechaInicio,
      pdiF1: performance.f1, pdiF2: performance.f2, pdiF3: performance.f3,
      pdiD1: performance.d1, pdiD2: performance.d2, pdiD3: performance.d3,
      pdiT1: performance.t1, pdiT2: performance.t2, pdiT3: performance.t3
    };
    Object.entries(fields).forEach(([id, value]) => { $(id).value = value || ''; });
  }

  function syncBasicFields() {
    const record = currentRecord();
    if (!record) return;
    const map = {
      pdiNombre: 'nombre', pdiCargo: 'cargo', pdiLider: 'lider', pdiFechaInicio: 'fechaInicio',
      pdiF1: 'f1', pdiF2: 'f2', pdiF3: 'f3', pdiD1: 'd1', pdiD2: 'd2', pdiD3: 'd3',
      pdiT1: 't1', pdiT2: 't2', pdiT3: 't3'
    };
    Object.entries(map).forEach(([id, key]) => { record.performance[key] = $(id).value; });
    if (record.performance.nombre.trim()) record.closerName = record.performance.nombre.trim();
  }

  function showTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('[data-pdi-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.pdiTab === tab);
    });
    document.querySelectorAll('[data-pdi-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.pdiPanel !== tab;
    });
    if (tab === 'disc') renderDisc();
    if (tab === 'performance') renderPerformance();
    if (tab === 'plan') renderPlan();
    if (tab === 'gestion') renderManagement();
  }

  function renderDisc() {
    const record = currentRecord();
    if (!record) return;
    const disc = record.performance.disc;
    $('pdiDiscCloser').textContent = record.performance.nombre || record.closerName;
    $('pdiDiscInputs').innerHTML = DISC_KEYS.map((key) => {
      const item = DISC_DATA[key];
      const value = Math.max(0, Math.min(100, Number(disc[key]) || 0));
      return `<label class="pdi-disc-input-card" style="--disc-color:${item.color}"><strong>${key}</strong><span>${item.name}</span><input type="number" min="0" max="100" value="${value}" data-disc-key="${key}" aria-label="${item.name}" /></label>`;
    }).join('');
    document.querySelectorAll('[data-disc-key]').forEach((input) => {
      input.addEventListener('input', () => {
        record.performance.disc[input.dataset.discKey] = Math.max(0, Math.min(100, Number(input.value) || 0));
        markDirty();
        renderDiscVisuals();
        renderDiscSuggestions();
      });
    });
    renderDiscVisuals();
    renderDiscSuggestions();
  }

  function renderDiscVisuals() {
    const disc = currentRecord()?.performance?.disc || {};
    $('pdiDiscChart').innerHTML = DISC_KEYS.map((key) => {
      const value = Math.max(0, Math.min(100, Number(disc[key]) || 0));
      const item = DISC_DATA[key];
      return `<div class="pdi-disc-bar" style="--disc-color:${item.color}"><i style="height:${value}%">${value ? `${value}%` : ''}</i><span>${key} · ${item.name}</span></div>`;
    }).join('');
    const sorted = DISC_KEYS.map((key) => ({ key, value: Number(disc[key]) || 0 })).sort((a, b) => b.value - a.value);
    if (!sorted[0]?.value) {
      $('pdiDiscDominant').innerHTML = 'Ingresá los porcentajes para calcular el perfil dominante.';
      return;
    }
    const dominant = sorted.filter((item) => item.value > 0 && item.value >= sorted[0].value - 10);
    $('pdiDiscDominant').innerHTML = `Perfil dominante: ${dominant.map(({ key, value }) => `<b style="--disc-color:${DISC_DATA[key].color}">${key} · ${DISC_DATA[key].name} ${value}%</b>`).join('')}`;
  }

  function addedBehaviorKeys() {
    return (currentRecord()?.performance?.comps || []).filter((item) => item.discKey).map((item) => `${item.discKey}_${item.discIdx}`);
  }

  function renderDiscSuggestions() {
    const record = currentRecord();
    if (!record) return;
    const sorted = DISC_KEYS.map((key) => ({ key, value: Number(record.performance.disc[key]) || 0 }))
      .filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    if (!sorted.length) {
      $('pdiDiscSuggestions').innerHTML = '<div class="pdi-card pdi-empty">Ingresá los porcentajes DISC para ver sugerencias y planes de acción.</div>';
      return;
    }
    const added = addedBehaviorKeys();
    $('pdiDiscSuggestions').innerHTML = sorted.map(({ key, value }) => {
      const item = DISC_DATA[key];
      const behaviorRows = item.behaviors.map((behavior, index) => {
        const behaviorKey = `${key}_${index}`;
        const isAdded = added.includes(behaviorKey);
        return `<div class="pdi-behavior"><div><strong>${escapeHtml(behavior[0])} → ${escapeHtml(behavior[2])}</strong><small>${escapeHtml(behavior[1])}</small></div><button type="button" data-add-behavior="${behaviorKey}" class="${isAdded ? 'is-added' : ''}" ${isAdded ? 'disabled' : ''}>${isAdded ? '✓ Agregado' : '+ Agregar al PDI'}</button></div>`;
      }).join('');
      return `<article class="pdi-suggestion-card" style="--disc-color:${item.color}"><div class="pdi-suggestion-head"><div><h3 style="color:${item.color}">${key} · ${item.name} (${value}%)</h3><p>${escapeHtml(item.tip)}</p></div></div><div class="pdi-incentive-grid"><div><b>Qué lo motiva</b>${item.motivation.map((text) => `<small>→ ${escapeHtml(text)}</small>`).join('')}</div><div><b>Incentivos sugeridos</b>${item.incentives.map((text) => `<small>• ${escapeHtml(text)}</small>`).join('')}</div></div><div class="pdi-behavior-list">${behaviorRows}</div></article>`;
    }).join('');
    document.querySelectorAll('[data-add-behavior]').forEach((button) => {
      button.addEventListener('click', () => addBehavior(button.dataset.addBehavior));
    });
  }

  function addBehavior(key) {
    const [discKey, rawIndex] = key.split('_');
    const index = Number(rawIndex);
    const behavior = DISC_DATA[discKey]?.behaviors[index];
    const record = currentRecord();
    if (!record || !behavior || addedBehaviorKeys().includes(key)) return;
    record.performance.comps.push({ nombre: behavior[2], discKey, discIdx: index, s1: '', e1: '', s2: '', e2: '', s3: '', e3: '' });
    record.plan.push({ competencia: behavior[2], comportamiento: behavior[0], tipo: 'Profesional', accion: behavior[3], semana: 'Semana 1', fecha: '', estado: 'Pendiente', obs: '', discKey: key });
    record.plan.push({ competencia: behavior[2], comportamiento: behavior[0], tipo: 'Personal', accion: behavior[4], semana: 'Semana 1', fecha: '', estado: 'Pendiente', obs: '', discKey: key });
    markDirty();
    renderDiscSuggestions();
  }

  function scoreOptions(value) {
    return ['', '1', '2', '3', '4'].map((option) => `<option value="${option}"${String(value || '') === option ? ' selected' : ''}>${option || '—'}</option>`).join('');
  }

  function renderPerformance() {
    const record = currentRecord();
    if (!record) return;
    $('pdiPerformanceBody').innerHTML = record.performance.comps.map((item, index) => (
      `<tr data-comp-index="${index}"><td class="pdi-number-cell">${index + 1}</td><td><input data-comp-field="nombre" value="${escapeHtml(item.nombre)}" placeholder="Competencia" /></td><td class="pdi-score-cell"><select class="pdi-score-select score-${escapeHtml(item.s1)}" data-comp-field="s1">${scoreOptions(item.s1)}</select></td><td><textarea data-comp-field="e1">${escapeHtml(item.e1)}</textarea></td><td class="pdi-score-cell"><select class="pdi-score-select score-${escapeHtml(item.s2)}" data-comp-field="s2">${scoreOptions(item.s2)}</select></td><td><textarea data-comp-field="e2">${escapeHtml(item.e2)}</textarea></td><td class="pdi-score-cell"><select class="pdi-score-select score-${escapeHtml(item.s3)}" data-comp-field="s3">${scoreOptions(item.s3)}</select></td><td><textarea data-comp-field="e3">${escapeHtml(item.e3)}</textarea></td><td class="pdi-actions-cell"><button class="pdi-delete" type="button" data-delete-comp="${index}" aria-label="Eliminar competencia">×</button></td></tr>`
    )).join('');
    document.querySelectorAll('[data-comp-index]').forEach((row) => {
      row.querySelectorAll('[data-comp-field]').forEach((field) => {
        const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventName, () => {
          const item = record.performance.comps[Number(row.dataset.compIndex)];
          item[field.dataset.compField] = field.value;
          if (field.classList.contains('pdi-score-select')) field.className = `pdi-score-select score-${field.value}`;
          markDirty();
          recalcPerformance();
        });
      });
    });
    document.querySelectorAll('[data-delete-comp]').forEach((button) => {
      button.addEventListener('click', () => deleteCompetency(Number(button.dataset.deleteComp)));
    });
    recalcPerformance();
  }

  function recalcPerformance() {
    const comps = currentRecord()?.performance?.comps || [];
    const totals = [1, 2, 3].map((cycle) => comps.reduce((sum, item) => sum + (Number(item[`s${cycle}`]) || 0), 0));
    const max = comps.length * 4;
    [1, 2, 3].forEach((cycle, index) => {
      $(`pdiTotal${cycle}`).textContent = comps.length ? totals[index] : '—';
      $(`pdiPct${cycle}`).textContent = max ? `${(totals[index] / max * 100).toFixed(2)}%` : '—';
      $(`pdiMax${cycle}`).textContent = max || '—';
    });
  }

  function deleteCompetency(index) {
    const record = currentRecord();
    const item = record?.performance?.comps?.[index];
    if (!item || !window.confirm('¿Eliminar esta competencia?')) return;
    if (item.discKey) record.plan = record.plan.filter((task) => task.discKey !== `${item.discKey}_${item.discIdx}`);
    record.performance.comps.splice(index, 1);
    markDirty();
    renderPerformance();
  }

  function renderPlan() {
    const record = currentRecord();
    if (!record) return;
    const done = record.plan.filter((task) => task.estado === 'Completado').length;
    $('pdiPlanStats').innerHTML = `Total: <b>${record.plan.length}</b> · Completadas: <b>${done}</b> · Pendientes: <b>${record.plan.length - done}</b>`;
    $('pdiPlanBody').innerHTML = record.plan.map((task, index) => (
      `<tr data-plan-index="${index}"><td><textarea data-plan-field="competencia">${escapeHtml(task.competencia)}</textarea></td><td><select data-plan-field="tipo"><option${task.tipo === 'Profesional' ? ' selected' : ''}>Profesional</option><option${task.tipo === 'Personal' ? ' selected' : ''}>Personal</option><option${task.tipo === 'General' ? ' selected' : ''}>General</option></select></td><td><textarea data-plan-field="accion">${escapeHtml(task.accion)}</textarea></td><td><input data-plan-field="semana" value="${escapeHtml(task.semana)}" placeholder="Semana 1" /></td><td><input data-plan-field="fecha" type="date" value="${escapeHtml(task.fecha)}" /></td><td><select data-plan-field="estado"><option${task.estado === 'Pendiente' ? ' selected' : ''}>Pendiente</option><option${task.estado === 'Completado' ? ' selected' : ''}>Completado</option></select></td><td><textarea data-plan-field="obs">${escapeHtml(task.obs)}</textarea></td><td class="pdi-actions-cell"><button class="pdi-delete" type="button" data-delete-task="${index}" aria-label="Eliminar tarea">×</button></td></tr>`
    )).join('');
    document.querySelectorAll('[data-plan-index]').forEach((row) => {
      row.querySelectorAll('[data-plan-field]').forEach((field) => {
        const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventName, () => {
          record.plan[Number(row.dataset.planIndex)][field.dataset.planField] = field.value;
          markDirty();
          if (field.dataset.planField === 'estado') renderPlan();
        });
      });
    });
    document.querySelectorAll('[data-delete-task]').forEach((button) => {
      button.addEventListener('click', () => {
        record.plan.splice(Number(button.dataset.deleteTask), 1);
        markDirty();
        renderPlan();
      });
    });
  }

  function renderManagement() {
    $('pdiCloserList').innerHTML = state.records.map((record) => (
      `<span class="pdi-closer-tag">${escapeHtml(record.closerName)}<button type="button" data-remove-closer="${escapeHtml(record.closerKey)}" aria-label="Eliminar ${escapeHtml(record.closerName)}">×</button></span>`
    )).join('');
    document.querySelectorAll('[data-remove-closer]').forEach((button) => {
      button.addEventListener('click', () => removeCloser(button.dataset.removeCloser));
    });
  }

  function renderCurrent() {
    renderCloserSelect();
    fillBasicFields();
    if (state.currentTab === 'disc') renderDisc();
    if (state.currentTab === 'performance') renderPerformance();
    if (state.currentTab === 'plan') renderPlan();
    if (state.currentTab === 'gestion') renderManagement();
  }

  async function saveCurrent() {
    const record = currentRecord();
    if (!record) return;
    syncBasicFields();
    if (!record.performance.nombre.trim()) {
      setStatus('Indicá el nombre del closer antes de guardar.', 'error');
      return;
    }
    const button = $('pdiSaveButton');
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      const response = await window.http.postJson('/api/metricas/pdi', {
        closerKey: record.closerKey,
        closerName: record.performance.nombre.trim(),
        performance: record.performance,
        plan: record.plan
      });
      const saved = normalizeRecord(response.record);
      saved.persisted = true;
      const index = state.records.findIndex((item) => item.closerKey === record.closerKey);
      state.records[index] = saved;
      state.currentKey = saved.closerKey;
      state.storageReady = true;
      state.dirty = false;
      renderCurrent();
      setStatus(`PDI de ${saved.closerName} guardado en Supabase.`, 'success');
    } catch (error) {
      setStatus(error.message || 'No se pudo guardar el PDI.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Guardar en Supabase';
    }
  }

  function addCloser() {
    const input = $('pdiNewCloser');
    const name = input.value.trim();
    const key = slug(name);
    if (!name || !key) return;
    if (state.records.some((record) => record.closerKey === key)) {
      setStatus('Ese closer ya está registrado.', 'error');
      return;
    }
    syncBasicFields();
    state.records.push(defaultRecord(name));
    state.currentKey = key;
    state.dirty = true;
    input.value = '';
    renderCurrent();
    setStatus(`Closer agregado. Guardá el PDI de ${name} para persistirlo en Supabase.`, 'warning');
  }

  async function removeCloser(key) {
    const record = state.records.find((item) => item.closerKey === key);
    if (!record || state.records.length === 1) {
      setStatus('El módulo debe conservar al menos un closer.', 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar a ${record.closerName} y todos sus datos del PDI?`)) return;
    try {
      if (record.persisted) await window.http.deleteJson(`/api/metricas/pdi/${encodeURIComponent(key)}`);
      state.records = state.records.filter((item) => item.closerKey !== key);
      if (state.currentKey === key) state.currentKey = state.records[0].closerKey;
      renderCurrent();
      setStatus(`${record.closerName} fue eliminado${record.persisted ? ' de Supabase' : ''}.`, 'success');
    } catch (error) {
      setStatus(error.message || 'No se pudo eliminar el closer.', 'error');
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-pdi-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.pdiTab)));
    $('pdiManageButton').addEventListener('click', () => showTab('gestion'));
    $('pdiSaveButton').addEventListener('click', saveCurrent);
    $('pdiAddCloser').addEventListener('click', addCloser);
    $('pdiNewCloser').addEventListener('keydown', (event) => { if (event.key === 'Enter') addCloser(); });
    $('pdiCloserSelect').addEventListener('change', (event) => {
      syncBasicFields();
      state.currentKey = event.target.value;
      state.dirty = false;
      renderCurrent();
      setStatus(state.storageReady ? 'Datos cargados desde Supabase.' : 'Vista local lista. Falta aplicar la migración de Supabase.', state.storageReady ? '' : 'warning');
    });
    ['pdiNombre', 'pdiCargo', 'pdiLider', 'pdiFechaInicio', 'pdiF1', 'pdiF2', 'pdiF3', 'pdiD1', 'pdiD2', 'pdiD3', 'pdiT1', 'pdiT2', 'pdiT3'].forEach((id) => {
      $(id).addEventListener('input', () => { syncBasicFields(); markDirty(); });
    });
    $('pdiAddCompetency').addEventListener('click', () => {
      currentRecord().performance.comps.push({ nombre: '', s1: '', e1: '', s2: '', e2: '', s3: '', e3: '' });
      markDirty();
      renderPerformance();
    });
    $('pdiAddTask').addEventListener('click', () => {
      currentRecord().plan.push({ competencia: '', tipo: 'General', accion: '', semana: 'Semana 1', fecha: '', estado: 'Pendiente', obs: '' });
      markDirty();
      renderPlan();
    });
    window.addEventListener('beforeunload', (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  async function bootstrap() {
    bindEvents();
    try {
      const response = await window.http.getJson('/api/metricas/pdi');
      state.storageReady = response.storageReady === true;
      state.records = mergeWithDefaultClosers(response.records || []);
      state.currentKey = state.records[0].closerKey;
      renderCurrent();
      setStatus(
        state.storageReady ? 'PDI listo. Los cambios se guardan directamente en Supabase.' : 'Vista local lista. Falta aplicar la migración para habilitar el guardado en Supabase.',
        state.storageReady ? 'success' : 'warning'
      );
    } catch (error) {
      state.records = DEFAULT_CLOSERS.map(defaultRecord);
      state.currentKey = state.records[0].closerKey;
      renderCurrent();
      setStatus(error.message || 'No se pudo cargar la información de PDI.', 'error');
    }
  }

  bootstrap();
})();
