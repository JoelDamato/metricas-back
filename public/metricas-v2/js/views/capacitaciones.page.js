(() => {
  const classes = [
    {id:1,materials:[],materialSummary:'Grabación y actividades de la clase',title:'Las bases de un profesional de ventas',video:'1S-P5zsDVw5jSFMvwBNJRovKrpKDQ8cuX',teaser:'Mentalidad profesional, reglas del equipo y una forma de vender que empieza por ayudar.',summary:'Capacitación intensiva sobre ventas y desarrollo profesional, con normas de trabajo y evaluación de habilidades.',topics:[
      ['Inicio del programa y requisitos','Presentación del programa de capacitación y exigencias de imagen corporativa. Normas estrictas de puntualidad y condiciones técnicas.'],
      ['Asignación de tareas y penalizaciones','Clase grabada asignada y prohibición del uso de inteligencia artificial en las actividades. Sistema de penalizaciones y premios.'],
      ['Debate de ventas y cierre','Debate participativo sobre qué significa vender, rechazo de prácticas agresivas y expectativas de asistencia y desempeño.']
    ],decisions:[
      ['Puntualidad','Estar preparados entre 5 y 10 minutos antes de cada reunión. No se permiten llegadas tarde.'],
      ['Capacitación a largo plazo','Proceso de selección y formación prolongado, enfocado en conocer el producto.'],
      ['Trabajo propio','Se prohíbe el uso de inteligencia artificial en las actividades asignadas, bajo pena de exclusión automática.'],
      ['Strikes y checkpoints','Strikes por mala conducta y checkpoints canjeables por dinero.'],
      ['Cámaras encendidas','Obligatorias durante todas las reuniones y llamadas.']
    ],tasks:[
      ['El grupo · Tomar apuntes','Anotar en un cuaderno durante cada clase y usar las notas para preparar el examen final.'],
      ['El grupo · Reflexión personal','Determinar si comprarían sus propios servicios por USD 4.000. Escribir las razones y qué mejorarían para aumentar su valor profesional.'],
      ['El grupo · Subir apuntes','Registrar los puntos clave de la clase de 4 horas y subir el archivo de anotaciones a la carpeta compartida antes del viernes.'],
      ['El grupo · Enviar contacto','Incluir WhatsApp y correo electrónico en el documento enviado para obtener acceso a los materiales de trabajo.'],
      ['El grupo · Analizar testimonios','Elegir 3 testimonios del listado y justificar por escrito por qué son los más convincentes, antes del viernes.']
    ]},
    {id:2,materials:['disc'],materialSummary:'Grabación, actividades y test DISC',title:'Mentalidad, guion y seguimiento',video:'18cpgRUXZyXTc92SOsZOw5TTysV3CH4kA',teaser:'Estructurá tus llamadas, conocé a quién ayudás y construí relaciones que continúen después del primer contacto.',summary:'Revisión sobre ventas y mentalidad, con estrategias de cierre y asignación de tareas.',topics:[
      ['Mentalidad y guiones de ventas','La importancia de la mentalidad adecuada y de un guion de ventas estructurado para mejorar los cierres.'],
      ['Tipos de seguimiento y clientes','Tipos de seguimiento para mantener relaciones a largo plazo con los clientes.'],
      ['Tareas y cronograma','Plazos para la investigación de marca y el envío de tests de personalidad.']
    ],tasks:[
      ['Leonardo Alaniz · Enviar guion de ventas','Incluir preguntas de microcompromiso, urgencia y escasez identificadas en llamadas cerradas exitosamente.'],
      ['Leonardo Alaniz · Compartir presentación','Compartir la presentación comercial para memorizarla y aplicarla en las llamadas con clientes.'],
      ['El grupo · Investigar la marca','Investigar qué vende la marca, a quién ayuda y qué perfiles son aptos para sus programas. Analizar los productos antes de las 18:00 del día siguiente.'],
      ['El grupo · Asistir a clase','Asistir a la clase de Matías el jueves a las 14:00, hora Argentina. Observar las consultas de los clientes y los temas tratados.'],
      ['Leonardo · Enviar materiales','Distribuir el formulario de perfil, el documento del avatar y la información sobre strikes y checkpoints.'],
      ['El grupo · Realizar el test','Completar el formulario de perfil comportamental entregado.'],
      ['El grupo · Enviar resultados','Reportar el resultado del test de perfil a Leonardo a través de WhatsApp.'],
      ['El grupo · Subir notas','Cargar los apuntes de las actividades en el documento compartido de Drive.']
    ]},
    {id:3,materials:['presentation','calls','script'],materialSummary:'Presentación, listado de llamadas y guion MEG',title:'Ética, diagnóstico y cierre',video:'1NDaiofMJ-Eakh_SR5W7_JUufMqSsbA2d',teaser:'Conectá con el producto, estudiá llamadas reales y practicá el proceso comercial completo.',summary:'Capacitación comercial y alineación ética, con herramientas y estrategias de ventas.',topics:[
      ['Capacitación y ética comercial','Identificación ética con el producto y una cultura organizacional clara. Enfoque en ayudar a las personas ante situaciones de crisis.'],
      ['Estrategias y guiones de ventas','Herramientas comerciales y guiones, con la indicación de pedir el cierre un mínimo de 3 veces. Estudio obligatorio de manuales y llamadas para mejorar resultados.'],
      ['Selección y entrega final','Selección de participantes, requisitos de equipamiento y plazo de entrega para acceder al programa de ganancia.']
    ],tasks:[
      ['El grupo · Definir propósito','Redactar con precisión los motivos personales detrás del trabajo y el objetivo principal buscado, para usarlos como guía diaria.'],
      ['El grupo · Analizar ventas','Estudiar el guion y la presentación oficial. Revisar minuciosamente llamadas que cerraron y llamadas que no se concretaron.'],
      ['El grupo · Analizar llamadas','Identificar todas las objeciones mencionadas por los clientes potenciales y las desactivadas por el closer.'],
      ['El grupo · Estudiar materiales','Repasar diariamente el guion, el perfil del comprador y la presentación para memorizar los conceptos clave.'],
      ['El grupo · Identificar pecados capitales','Identificar los siete pecados capitales de los dueños de negocios durante la revisión de llamadas.'],
      ['El grupo · Entregar tarea','Finalizar las actividades y el análisis de llamadas antes del miércoles a las 16:00, hora Argentina.']
    ]}
  ];
  const resources = [
    {id:'presentation',title:'Presentación comercial',description:'La presentación del programa, disponible en Canva.',url:'https://canva.link/vbmgr3l60jsdnc6',icon:'▧',external:true},
    {id:'calls',title:'Listado de llamadas',description:'Llamadas para estudiar cierres, objeciones y seguimientos.',url:'https://docs.google.com/spreadsheets/d/185jM0s0OKJdEgxMr9NCGfqKWRgJsuHOsym6jNdaypvg/edit?usp=sharing',icon:'▶',external:true},
    {id:'script',title:'Guion, auditoría y manual MEG',description:'Guion operativo, checklist de llamadas y manual completo.',url:'/views/guion-meg.html',icon:'≡'},
    {id:'disc',title:'Test de perfil DISC',description:'Completá el test y compartí tu resultado con Leonardo por WhatsApp, como indica la actividad de esta clase.',url:'/entrenamiento/disc/',icon:'◇',external:true}
  ];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const classUrl = id => '/views/entrenamiento.html?clase='+id;
  const resourcesMarkup = lesson => `<div class="material-grid">${lesson.materials.map(id => resources.find(r => r.id === id)).map(r=>`<a class="material-card" href="${r.url}"${r.external?' target="_blank" rel="noopener noreferrer"':''}><span class="material-icon" aria-hidden="true">${r.icon}</span><div><strong>${r.title}</strong><p>${r.description}</p></div><span class="material-arrow" aria-hidden="true">${r.external?'↗':'→'}</span></a>`).join('')}</div>`;
  const listMarkup = items => `<ul>${items.map(([title,text])=>`<li><strong>${esc(title)}.</strong> ${esc(text)}</li>`).join('')}</ul>`;
  const selected = new URLSearchParams(location.search).get('clase');
  const lesson = classes.find(c=>String(c.id)===selected);
  const content = document.getElementById('campusContent');
  if (selected && !lesson) {
    content.innerHTML='<div class="campus-hero"><div><h1>Esta clase no está disponible</h1><p class="campus-intro">Elegí una de las clases de la capacitación.</p><a class="campus-back" href="/views/entrenamiento.html">← Ver todas las clases</a></div></div>';
  } else if (lesson) {
    document.title=`Clase ${lesson.id} · ${lesson.title} | Central MR`;
    content.innerHTML=`<a class="campus-back" href="/views/entrenamiento.html">← Todas las capacitaciones</a><header class="lesson-heading"><p class="campus-eyebrow">Capacitación comercial · Clase ${String(lesson.id).padStart(2,'0')}</p><h1>${lesson.title}</h1><p class="campus-intro">${lesson.summary}</p></header>
    <div class="lesson-layout"><div><iframe class="lesson-video" src="https://drive.google.com/file/d/${lesson.video}/preview" title="Video de la clase ${lesson.id}: ${lesson.title}" allow="fullscreen; autoplay" allowfullscreen></iframe><div class="lesson-video-note"><p>Si el video solicita acceso, abrilo en Drive con tu cuenta autorizada.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/${lesson.video}/view?usp=sharing" target="_blank" rel="noopener noreferrer">Abrir video en Drive ↗</a></div>
    ${lesson.materials.length ? `<section id="materiales" class="lesson-panel lesson-materials" aria-labelledby="lessonMaterialsTitle"><h2 id="lessonMaterialsTitle">Materiales de la clase ${lesson.id}</h2><p class="lesson-materials-intro">${lesson.id === 3 ? 'Usá estos tres materiales para estudiar el guion y la presentación, y analizar las llamadas de esta clase.' : 'Completá el test de perfil indicado en las actividades de esta clase.'}</p>${resourcesMarkup(lesson)}</section>` : ''}
    <section class="lesson-panel"><h2>Qué vas a trabajar</h2>${lesson.topics.map(([title,text])=>`<div class="lesson-topic"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join('')}</section>
    ${lesson.decisions?`<section class="lesson-panel"><h2>Acuerdos del programa</h2>${listMarkup(lesson.decisions)}</section>`:''}
    <section class="lesson-panel"><h2>Actividades y próximos pasos</h2>${listMarkup(lesson.tasks)}<p class="lesson-deadline">Los días y horarios corresponden a las indicaciones de la grabación. Confirmá con Leonardo las fechas de tu grupo.</p></section>
    <nav class="lesson-next" aria-label="Navegación entre clases">${lesson.id>1?`<a class="campus-button secondary" href="${classUrl(lesson.id-1)}">← Clase ${lesson.id-1}</a>`:'<span></span>'}${lesson.id<classes.length?`<a class="campus-button" href="${classUrl(lesson.id+1)}">Siguiente · Clase ${lesson.id+1} →</a>`:'<a class="campus-button" href="/views/entrenamiento.html">Volver a capacitaciones</a>'}</nav></div>
    <aside class="lesson-aside"><div class="lesson-index"><h2>Contenido del programa</h2>${classes.map(c=>`<a href="${classUrl(c.id)}"${c.id===lesson.id?' aria-current="page"':''}><small>CLASE ${c.id}</small>${c.title}</a>`).join('')}</div></aside></div>`;
  } else {
    content.innerHTML=`<section class="campus-hero"><div><p class="campus-eyebrow">Formación para todo el equipo</p><h1>Capacitaciones</h1><p class="campus-intro">Cada clase reúne su grabación, sus actividades y los materiales que le corresponden. Empezá por la primera y seguí el recorrido.</p></div><div class="campus-stats"><div><strong>03</strong><span>Clases grabadas</span></div></div></section>
    <section id="clases" aria-labelledby="classesTitle"><div class="campus-section-title"><h2 id="classesTitle">Tu recorrido de formación</h2><p>Entrá a cada clase para ver sus materiales y actividades.</p></div><div class="class-grid">${classes.map(c=>`<a class="class-card" href="${classUrl(c.id)}"><div class="class-art"><span class="class-label">Clase ${String(c.id).padStart(2,'0')}</span><span class="class-number" aria-hidden="true">0${c.id}</span><span class="class-play" aria-hidden="true">▶</span></div><div class="class-body"><h3>${c.title}</h3><p>${c.teaser}</p><p class="class-material-summary"><strong>Dentro de esta clase</strong>${c.materialSummary}</p><span class="class-cta">Entrar a la clase <span aria-hidden="true">→</span></span></div></a>`).join('')}</div></section>
`;
    if (['#materiales', '#clases'].includes(location.hash)) document.getElementById('clases').scrollIntoView();
  }
  window.http.getJson('/api/metricas/auth/session').then(({user})=>{document.getElementById('discResults').hidden=user?.permissions?.canReviewDisc!==true;}).catch(()=>{});
})();
