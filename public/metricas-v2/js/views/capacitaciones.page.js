(() => {
  const classes = [
    {id:1,materials:['contact'],materialSummary:'Grabación, actividades y registro de tus datos',title:'Las bases de un profesional de ventas',video:'1S-P5zsDVw5jSFMvwBNJRovKrpKDQ8cuX',teaser:'Mentalidad profesional, reglas del equipo y una forma de vender que empieza por ayudar.',summary:'Capacitación intensiva sobre ventas y desarrollo profesional, con normas de trabajo y evaluación de habilidades.',topics:[
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
      ['El grupo · Enviar contacto','Completá tu número de WhatsApp y correo electrónico en la planilla para obtener acceso a los materiales de trabajo.','contact'],
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
      ['El grupo · Realizar el test','Completá el test DISC desde el siguiente enlace.','disc'],
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
    ]},
    {id:4,materials:[],materialSummary:'Diagnóstico de rentabilidad · 26 minutos + clase complementaria de Matías',title:'Cómo hacer una auditoría',videoUrl:'https://fathom.video/share/VSK73Lyx8WKYutxmuiHzwY63jqFd-avb',teaser:'Carlos explica cómo utilizar la herramienta de diagnóstico de rentabilidad.',summary:'Empezá por la capacitación de Carlos y profundizá con la clase complementaria de Matías Randazzo.',topics:[],tasks:[]}
  ];
  const resources = [
    {id:'contact',title:'Dejar mis datos',description:'Completá tu WhatsApp y correo electrónico en la planilla de la clase 1 para obtener acceso a los materiales de trabajo.',url:'https://docs.google.com/spreadsheets/d/1862opbnr8OS9efcGyBLXni2c9DGHUR0uS8nHLMcueTM/edit?usp=sharing',icon:'✎',external:true},
    {id:'presentation',title:'Presentación comercial',description:'La presentación del programa, disponible en Canva.',url:'https://canva.link/vbmgr3l60jsdnc6',icon:'▧',external:true},
    {id:'calls',title:'Listado de llamadas',description:'Llamadas para estudiar cierres, objeciones y seguimientos.',url:'https://docs.google.com/spreadsheets/d/185jM0s0OKJdEgxMr9NCGfqKWRgJsuHOsym6jNdaypvg/edit?usp=sharing',icon:'▶',external:true},
    {id:'script',title:'Guion, auditoría y manual MEG',description:'Guion operativo, checklist de llamadas y manual completo.',url:'/views/guion-meg.html',icon:'≡'},
    {id:'disc',title:'Hacer test DISC',description:'Abrí el test de perfil comportamental. Al enviarlo, queda registrado para la revisión de Leo y Mati.',url:'/entrenamiento/disc/',icon:'◇',external:true}
  ];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const classUrl = id => '/views/entrenamiento.html?clase='+id;
  const resourcesMarkup = lesson => `<div class="material-grid">${lesson.materials.map(id => resources.find(r => r.id === id)).map(r=>`<a class="material-card" href="${r.url}"${r.external?' target="_blank" rel="noopener noreferrer"':''}><span class="material-icon" aria-hidden="true">${r.icon}</span><div><strong>${r.title}</strong><p>${r.description}</p></div><span class="material-arrow" aria-hidden="true">${r.external?'↗':'→'}</span></a>`).join('')}</div>`;
  const listMarkup = items => `<ul>${items.map(([title,text,resourceId])=>{
    const resource = resources.find(r => r.id === resourceId);
    return `<li><strong>${esc(title)}.</strong> ${esc(text)}${resource ? `<div class="lesson-task-link"><a class="campus-button secondary" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${esc(resource.title)} ↗</a></div>` : ''}</li>`;
  }).join('')}</ul>`;
  const selected = new URLSearchParams(location.search).get('clase');
  const lesson = classes.find(c=>String(c.id)===selected);
  const content = document.getElementById('campusContent');
  if (new URLSearchParams(location.search).get('tab') === 'reclutamiento') {
    document.title = 'Reclutamiento | Centro de entrenamiento';
    document.querySelectorAll('.campus-nav a').forEach(a => a.removeAttribute('aria-current'));
    document.getElementById('recruitmentTab').setAttribute('aria-current', 'page');
    content.innerHTML = `<section class="campus-hero"><div><p class="campus-eyebrow">Formación de closers · Reclutamiento</p><h1>Herramientas para tus llamadas comerciales</h1><p class="campus-intro">Aprendé a preparar propuestas y utilizar el diagnóstico de rentabilidad con estas capacitaciones prácticas.</p></div><div class="campus-stats"><div><strong>02</strong><span>Capacitaciones</span></div></div></section>
    <section class="materials-section" aria-labelledby="recruitmentProposalsTitle">
      <div class="campus-section-title"><h2 id="recruitmentProposalsTitle">Capacitación de Closers | Herramienta de propuestas comerciales</h2></div>
      <div class="lesson-panel lesson-recording"><p class="campus-eyebrow">22 minutos</p><p>En esta capacitación aprenderás a utilizar la herramienta de generación de propuestas comerciales para presentar profesionalmente las condiciones de inversión y financiación de los programas.</p><a class="campus-button" href="https://fathom.video/share/b1Gr1j9NRYbQ_QxfyfNGQ3xsMHk5st12" target="_blank" rel="noopener noreferrer">Ver capacitación en Fathom ↗</a><p class="lesson-deadline">Descarga de la herramienta: próximamente.</p></div>
      <details class="lesson-panel launch-setter-guide"><summary>Ver contenidos, momentos importantes y recomendaciones</summary>
        <h3>¿Qué vas a aprender?</h3><ul>
          <li>Crear propuestas económicas personalizadas.</li><li>Configurar precios, monedas, tipo de cambio e IVA.</li><li>Aplicar descuentos por pago único.</li><li>Establecer fechas de vencimiento y cuentas regresivas.</li><li>Calcular señas y reservas de cupo.</li><li>Configurar cuotas, fechas de vencimiento y saldos pendientes.</li><li>Descargar propuestas en HTML y enviarlas por WhatsApp.</li><li>Utilizar los accesos rápidos de Windows y Mac.</li>
        </ul><h3>Momentos importantes del video</h3><ul>
          <li><strong>Min. 0–7:</strong> explicación de la herramienta y sus modalidades de pago.</li><li><strong>Min. 7–14:</strong> envío de propuestas, funcionamiento y atajos de teclado.</li><li><strong>Min. 14–20:</strong> simulacro práctico de generación de una propuesta con pago inicial y cuotas.</li><li><strong>Min. 20–22:</strong> aclaraciones sobre financiación, funcionalidades y versiones disponibles.</li>
        </ul><p class="lesson-deadline"><strong>Importante:</strong> La herramienta permite personalizar múltiples condiciones, pero siempre deberán respetarse los precios, descuentos y límites de financiación vigentes y autorizados por la dirección comercial.</p><p><strong>Recomendación:</strong> Descargá la herramienta y su manual antes de comenzar. Reproducí los ejemplos mientras ves la capacitación para familiarizarte con su funcionamiento.</p>
      </details>
    </section>
    <section class="materials-section" aria-labelledby="recruitmentProfitTitle">
      <div class="campus-section-title"><h2 id="recruitmentProfitTitle">Capacitación de Closers | Herramienta de diagnóstico de rentabilidad</h2></div>
      <div class="lesson-panel lesson-recording"><p class="campus-eyebrow">26 minutos · Carlos</p><p>En esta capacitación, Carlos explica cómo utilizar una herramienta de diagnóstico económico durante una llamada comercial para identificar problemas de rentabilidad, analizar el punto de equilibrio y detectar oportunidades de mejora en el negocio del prospecto.</p><a class="campus-button" href="https://fathom.video/share/VSK73Lyx8WKYutxmuiHzwY63jqFd-avb" target="_blank" rel="noopener noreferrer">Ver capacitación en Fathom ↗</a><p class="lesson-deadline">Descarga de la herramienta: próximamente.</p></div>
      <details class="lesson-panel launch-setter-guide"><summary>Ver contenidos, paso a paso y momentos importantes</summary>
        <h3>¿Qué vas a aprender?</h3><ul>
          <li><strong>Preparación de la reunión:</strong> qué datos solicitar al prospecto antes de la llamada.</li>
          <li><strong>Uso de la herramienta:</strong> cómo ingresar facturación, marcación y costos fijos para realizar un diagnóstico preliminar.</li>
          <li><strong>Markup y margen de contribución:</strong> cómo diferenciarlos e interpretar correctamente los resultados.</li>
          <li><strong>Punto de equilibrio:</strong> cómo calcular y explicar cuánto necesita facturar un negocio para cubrir sus costos.</li>
          <li><strong>Análisis de rentabilidad:</strong> cómo identificar pérdidas, baja utilidad y oportunidades de optimización.</li>
          <li><strong>Preguntas comerciales:</strong> cómo profundizar cuando el prospecto presenta buenos o malos resultados.</li>
          <li><strong>Manejo de objeciones:</strong> qué hacer cuando el cliente no coincide con los números.</li>
          <li><strong>Criterios de aplicación:</strong> en qué negocios conviene utilizar el diagnóstico y cuándo es preferible evitarlo.</li>
        </ul><h3>Paso a paso para utilizar el diagnóstico</h3><ol>
          <li><strong>Evaluá si corresponde utilizarlo.</strong> Priorizá prospectos de alto nivel y negocios cuyos costos variables y fijos puedan identificarse con claridad.</li>
          <li><strong>Solicitá los datos antes de la llamada.</strong> Pedí facturación mensual sin IVA, marcación promedio y costos fijos mensuales.</li>
          <li><strong>Cargá los valores en la herramienta.</strong> Utilizá los datos proporcionados por el prospecto, aclarando que se trata de una estimación inicial.</li>
          <li><strong>Analizá los resultados.</strong> Revisá el margen de contribución, los costos fijos, la rentabilidad estimada y el punto de equilibrio.</li>
          <li><strong>Explicá qué significan los números.</strong> Mostrá cómo se relacionan las ventas, los costos y el resultado económico del negocio.</li>
          <li><strong>Profundizá con preguntas.</strong> Investigá si el prospecto reconoce esos resultados, qué dificultades enfrenta y qué desea mejorar.</li>
          <li><strong>Conectá el diagnóstico con sus objetivos.</strong> Identificá posibles oportunidades de mejora y evaluá si el programa puede ayudarlo.</li>
        </ol><h3>Momentos importantes del video</h3><ul>
          <li><strong>Min. 0–4:</strong> presentación de la herramienta y datos necesarios.</li><li><strong>Min. 4–8:</strong> explicación de markup y margen de contribución.</li><li><strong>Min. 8–16:</strong> simulación de rentabilidad y punto de equilibrio.</li><li><strong>Min. 16–20:</strong> manejo de resultados favorables y desacuerdos del prospecto.</li><li><strong>Min. 20–26:</strong> análisis de costos adicionales y negocios donde conviene o no utilizar la herramienta.</li>
        </ul><h3>Recomendación</h3><p>Antes de aplicar esta herramienta con un prospecto real, practicá con distintos escenarios y asegurate de comprender cada indicador.</p><p class="lesson-deadline"><strong>Importante:</strong> El diagnóstico es preliminar y no sustituye un análisis financiero completo. Si no conocés cómo se calculan los costos del negocio, no improvises resultados.</p><p><strong>El objetivo no es demostrarle al prospecto que su negocio está mal, sino ayudarlo a comprender sus números e identificar oportunidades reales de mejora.</strong></p>
      </details>
    </section>`;
  } else if (new URLSearchParams(location.search).get('tab') === 'lanzamiento') {
    document.title = 'Lanzamiento | Centro de entrenamiento';
    document.querySelectorAll('.campus-nav a').forEach(a => a.removeAttribute('aria-current'));
    document.getElementById('launchTab').setAttribute('aria-current','page');
    content.innerHTML = `<section class="campus-hero"><div><p class="campus-eyebrow">Equipo comercial · Lanzamiento</p><h1>Prepará tu lanzamiento</h1><p class="campus-intro">Mirá las clases de lanzamiento y completá las actividades de cada encuentro.</p></div><div class="campus-stats"><div><strong>07</strong><span>Clases de lanzamiento</span></div></div></section>
    <div class="lesson-layout"><section aria-labelledby="launchClassTitle"><a class="class-card" href="https://fathom.video/share/x2mDCbc-F9kRt-UWs2_AjNrECKigSTL9" target="_blank" rel="noopener noreferrer"><div class="class-art"><span class="class-label">Clase de lanzamiento</span><span class="class-number" aria-hidden="true">01</span><span class="class-play" aria-hidden="true">▶</span></div><div class="class-body"><h3 id="launchClassTitle">Clase de lanzamiento</h3><p>La grabación para esta etapa de la capacitación de closers junior.</p><span class="class-cta">Ver clase en Fathom <span aria-hidden="true">↗</span></span></div></a></section>
    <aside class="lesson-aside"><section class="lesson-panel"><p class="campus-eyebrow">Después de la clase</p><h2>Actividades</h2><p>Consultá las consignas y realizá las actividades indicadas por Leo.</p><div class="lesson-task-link"><a class="campus-button" href="https://docs.google.com/document/d/1iOsZjyBgJoC8qY1GoTSjNFS6qo9W9DdCPq1psDUxuD8/edit?usp=sharing" target="_blank" rel="noopener noreferrer">Abrir actividades ↗</a></div></section></aside></div>`;
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchFollowupTitle">
      <div class="campus-section-title"><h2 id="launchFollowupTitle">Clase 02 · Seguimiento y alter ego comercial</h2></div>
      <iframe class="lesson-video" src="https://drive.google.com/file/d/1qX8EQSmFGY3RXzP3GQ_XH14KiJoRX1YJ/preview" title="Clase de lanzamiento: seguimiento y alter ego comercial" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      <div class="lesson-video-note"><p>Si el video no se reproduce, abrilo directamente en Drive.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/1qX8EQSmFGY3RXzP3GQ_XH14KiJoRX1YJ/view?usp=sharing" target="_blank" rel="noopener noreferrer">Ver clase en Drive ↗</a></div>
      <section class="lesson-panel"><h3>Puntos tratados</h3><ul>
        <li><strong>Lanzamiento:</strong> inicio de campañas y llegada de leads.</li>
        <li><strong>WhatsApp y CRM:</strong> clasificación de prospectos (caliente, tibio y frío) y actualización manual en GoHighLevel.</li>
        <li><strong>Comunicación:</strong> priorizar audios y videos para generar mayor conexión.</li>
        <li><strong>Seguimiento:</strong> contactar a los leads idealmente dentro de los primeros 15 minutos.</li>
        <li><strong>Grupos de WhatsApp:</strong> envío del historial y solicitud para que los prospectos agenden al asesor.</li>
        <li><strong>Alter ego comercial:</strong> creación de un personaje que transmita seguridad, autoridad y confianza.</li>
      </ul></section>
      <section class="lesson-panel"><h3>Actividades asignadas</h3><ol>
        <li>Crear las tres etiquetas en WhatsApp Business.</li>
        <li>Practicar los audios comerciales entre 5 y 6 veces antes de enviarlos.</li>
        <li>Crear o perfeccionar el alter ego: nombre, imagen, atributos y propósito.</li>
        <li>Definir un ritual de activación y desactivación del personaje.</li>
        <li>Compartir en el grupo el nombre y la imagen del alter ego.</li>
        <li>Presentarse en la próxima capacitación con el personaje activado.</li>
        <li>Revisar los procesos y preparar preguntas puntuales.</li>
      </ol></section>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchMindsetTitle">
      <div class="campus-section-title"><h2 id="launchMindsetTitle">Clase 03 · Cualificación y termostato financiero</h2></div>
      <iframe class="lesson-video" src="https://drive.google.com/file/d/133ErURw58rmd6J7xHaSMnE34BG6_oJsp/preview" title="Clase de lanzamiento: cualificación y termostato financiero" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      <div class="lesson-video-note"><p>Si el video no se reproduce, abrilo directamente en Drive.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/133ErURw58rmd6J7xHaSMnE34BG6_oJsp/view?usp=sharing" target="_blank" rel="noopener noreferrer">Ver clase en Drive ↗</a></div>
      <section class="lesson-panel"><h3>Puntos tratados</h3><ul>
        <li><strong>Resultados del lanzamiento:</strong> revisión de leads, conversaciones y tasas de respuesta.</li>
        <li><strong>Comunicación comercial:</strong> los audios generan mejores respuestas en las experiencias compartidas. Importancia de probar diferentes formatos.</li>
        <li><strong>Cualificación:</strong> priorizar prospectos según facturación y perfil comercial.</li>
        <li><strong>Etiquetas:</strong> mantener rojo, amarillo y celeste según calificación. Opcionalmente, agregar etiquetas de nivel de interés.</li>
        <li><strong>Seguimiento:</strong> utilizar preguntas estratégicas, testimonios y redes sociales para conocer mejor al prospecto.</li>
        <li><strong>Mentalidad comercial:</strong> paciencia, perseverancia y congruencia entre lo que pensamos, decimos y hacemos.</li>
        <li><strong>Termostato financiero:</strong> identificar las limitaciones personales para comunicar y sostener precios elevados.</li>
        <li><strong>Crecimiento personal:</strong> experiencias nuevas, entorno, metas SMART y visualización de objetivos.</li>
      </ul></section>
      <section class="lesson-panel"><h3>Actividades asignadas</h3><ol>
        <li>Continuar probando audios, videos y textos para identificar qué genera mejores respuestas.</li>
        <li>Mantener las etiquetas de calificación y priorizar los prospectos con mayor potencial.</li>
        <li>Practicar preguntas de diagnóstico para identificar desafíos, facturación y objetivos del negocio.</li>
        <li>Registrar información relevante en GoHighLevel.</li>
        <li>Practicar audios comerciales con naturalidad, energía y sin muletillas.</li>
        <li>Responder para mañana las preguntas del termostato financiero:
          <ul>
            <li>¿Qué precio decís sin dudar?</li>
            <li>¿Desde qué monto te empieza a costar?</li>
            <li>¿Alguna vez invertiste un monto similar?</li>
            <li>¿Cómo te sentiste al invertirlo?</li>
            <li>¿Qué precio vas a comunicar con seguridad y qué acción vas a realizar para lograrlo?</li>
          </ul>
        </li>
        <li>Durante la semana: realizar nuevas experiencias que desafíen los límites financieros personales y compartir qué hicieron y cómo se sintieron.</li>
        <li>Continuar trabajando con el vision board y las metas personales.</li>
      </ol></section>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchConversationsTitle">
      <div class="campus-section-title"><h2 id="launchConversationsTitle">Clase 04 · Primeros resultados y conversaciones comerciales</h2></div>
      <iframe class="lesson-video" src="https://drive.google.com/file/d/1_y69YZVzbdmFh5XBnYy8gy5asRaSRKUS/preview" title="Clase de lanzamiento: primeros resultados y conversaciones comerciales" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      <div class="lesson-video-note"><p>Si el video no se reproduce, abrilo directamente en Drive.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/1_y69YZVzbdmFh5XBnYy8gy5asRaSRKUS/view?usp=sharing" target="_blank" rel="noopener noreferrer">Ver clase en Drive ↗</a></div>
      <section class="lesson-panel"><h3>Puntos tratados</h3><ul>
        <li><strong>Primeros resultados:</strong> revisión de leads recibidos, conversaciones y respuestas.</li>
        <li><strong>Cualificación:</strong> las etiquetas determinan prioridades, pero no descartan prospectos automáticamente.</li>
        <li><strong>Comunicación comercial:</strong> probar textos, audios y videos para mejorar las respuestas.</li>
        <li><strong>Mensajes de bienvenida:</strong> dividirlos en dos partes y finalizar con una pregunta abierta.</li>
        <li><strong>Mentalidad comercial:</strong> gestionar el rechazo, evitar frustraciones y evaluar resultados con suficientes conversaciones.</li>
        <li><strong>Seguimiento:</strong> utilización de testimonios, casos de éxito y recursos para generar interés y conseguir agendas.</li>
        <li><strong>Alter ego:</strong> presentación de personajes comerciales y sus rituales de activación.</li>
        <li><strong>GoHighLevel:</strong> registro de información y resolución de inconvenientes técnicos.</li>
      </ul></section>
      <section class="lesson-panel"><h3>Actividades asignadas</h3><ol>
        <li>Modificar los mensajes de bienvenida: dividirlos y finalizar con una sola pregunta abierta.</li>
        <li>Probar diferentes formatos de contacto: texto, audio, video y combinaciones.</li>
        <li>Registrar qué mensajes generan mejores respuestas.</li>
        <li>Contactar también a los leads de baja prioridad cuando haya disponibilidad.</li>
        <li>Actualizar las etiquetas según la información obtenida en las conversaciones.</li>
        <li>Registrar datos importantes de cada prospecto en GoHighLevel.</li>
        <li>Consultar con Jota los inconvenientes técnicos de asignación o contacto.</li>
        <li>Continuar practicando y perfeccionando el alter ego comercial.</li>
        <li>Utilizar testimonios y casos de éxito relevantes para realizar seguimientos comerciales.</li>
      </ol></section>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchWorkflowTitle">
      <div class="campus-section-title"><h2 id="launchWorkflowTitle">Clase 05 · Gestión de leads y proceso de lanzamiento</h2></div>
      <iframe class="lesson-video" src="https://drive.google.com/file/d/1ugLxGtufdN8dg0M9It-MsJCvJ8Q38HST/preview" title="Clase de lanzamiento: gestión de leads y proceso de lanzamiento" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      <div class="lesson-video-note"><p>Si el video no se reproduce, abrilo directamente en Drive.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/1ugLxGtufdN8dg0M9It-MsJCvJ8Q38HST/view?usp=sharing" target="_blank" rel="noopener noreferrer">Ver clase en Drive ↗</a></div>
      <section class="lesson-panel"><h3>Puntos tratados</h3><ul>
        <li><strong>Lanzamiento:</strong> inicio de campañas y asignación automática y rotativa de leads.</li>
        <li><strong>Discord:</strong> recepción de notificaciones de nuevos prospectos.</li>
        <li><strong>WhatsApp:</strong> contacto inicial, bienvenida y verificación de ingreso al grupo.</li>
        <li><strong>GoHighLevel:</strong> consulta de facturación, registro de notas y seguimiento de prospectos.</li>
        <li><strong>Clasificación:</strong> etiquetas rojo (caliente), amarillo (tibio) y celeste (frío).</li>
        <li><strong>Cualificación:</strong> identificar facturación, rubro, estructura, necesidades y potencial de compra.</li>
        <li><strong>Recursos gratuitos:</strong> entrega de regalos los días 4, 7 y 9 del lanzamiento.</li>
        <li><strong>Comisiones:</strong> importancia de registrar las conversaciones para validar las ventas.</li>
        <li><strong>Alter ego comercial:</strong> reforzar la identidad, vestimenta y anclajes del personaje.</li>
      </ul></section>
      <section class="lesson-panel"><h3>Actividades asignadas</h3><ol>
        <li>Enviar foto del vision board, colocado en pantalla o pared.</li>
        <li>Perfeccionar el alter ego y definir su anclaje.</li>
        <li>Preparar diferentes versiones de mensajes de bienvenida.</li>
        <li>Practicar el proceso completo: Discord → GoHighLevel → WhatsApp.</li>
        <li>Verificar que cada prospecto ingrese al grupo y compartirle el historial.</li>
        <li>Clasificar los leads con etiquetas en WhatsApp Business.</li>
        <li>Registrar información relevante de cada prospecto en las notas de GoHighLevel.</li>
        <li>Preparar los enlaces de los regalos y respetar los días de entrega.</li>
        <li>Repasar la guía de asesores y las preguntas de cualificación.</li>
        <li>Reportar problemas técnicos o dudas para resolverlos rápidamente.</li>
      </ol></section>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchClassSixTitle">
      <div class="campus-section-title"><h2 id="launchClassSixTitle">Clase 06 · Lanzamiento</h2></div>
      <iframe class="lesson-video" src="https://drive.google.com/file/d/1xV2aYU5NATfAVItZlep492GN-CeXq_dH/preview" title="Clase 06 de lanzamiento" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      <div class="lesson-video-note"><p>Si el video no se reproduce, abrilo directamente en Drive.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/1xV2aYU5NATfAVItZlep492GN-CeXq_dH/view" target="_blank" rel="noopener noreferrer">Ver clase en Drive ↗</a></div>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section" aria-labelledby="launchSetterTitle">
      <div class="campus-section-title"><h2 id="launchSetterTitle">Clase 07 · Capacitación de Setters | Proceso de atención y gestión de leads</h2></div>
      <div class="lesson-panel lesson-recording">
        <p class="campus-eyebrow">Capacitación de setters · 61 minutos</p>
        <p>En esta capacitación se resuelven dudas operativas y se realiza un simulacro práctico del circuito de atención de leads durante un lanzamiento.</p>
        <a class="campus-button" href="https://fathom.video/share/Pv3Ryr2igdG5645UrPkAq-Yntszx6Syn" target="_blank" rel="noopener noreferrer">Ver capacitación en Fathom ↗</a>
      </div>
      <details class="lesson-panel launch-setter-guide">
        <summary>Ver de qué habla el video y el paso a paso operativo</summary>
        <h3>¿Qué vas a aprender en este video?</h3>
        <ul>
          <li>Recepción y asignación de leads mediante Discord.</li>
          <li>Uso de GoHighLevel (GHL) para consultar información y registrar interacciones.</li>
          <li>Calificación y priorización de prospectos según su facturación.</li>
          <li>Primer contacto, seguimiento y gestión de conversaciones por WhatsApp.</li>
          <li>Entrega de recursos gratuitos y gestión de comunidades.</li>
          <li>Agendamiento de llamadas con los closers.</li>
          <li>Manejo de objeciones y prácticas comerciales.</li>
        </ul>
        <h3>Paso a paso operativo del setter</h3>
        <ol>
          <li><h4>Recibir el lead en Discord</h4><ul>
            <li>Ingresá al canal personal donde llegan las notificaciones de tus leads asignados.</li>
            <li>Identificá el nombre y los datos del prospecto.</li>
            <li>No marques la notificación como gestionada hasta haber realizado el contacto.</li>
          </ul></li>
          <li><h4>Revisar el prospecto en GoHighLevel</h4><ul>
            <li>Ingresá a GHL y buscá el contacto asignado.</li>
            <li>Abrí su ficha y buscá la sección Additional Info (Información adicional).</li>
            <li>Revisá las respuestas del formulario, especialmente la facturación mensual declarada.</li>
          </ul></li>
          <li><h4>Calificar y priorizar</h4><ul>
            <li>Más de USD 50.000 mensuales: prioridad alta.</li>
            <li>Entre USD 30.000 y USD 50.000: prioridad media.</li>
            <li>Menos de USD 10.000: prioridad baja; evaluar si corresponde otra oferta.</li>
          </ul><p>Estos rangos se utilizan como referencia inicial de priorización, no como única condición para descartar un prospecto.</p></li>
          <li><h4>Verificar si está en la comunidad de WhatsApp</h4><ul>
            <li>Buscá al prospecto en las comunidades correspondientes.</li>
            <li>Si todavía no ingresó, enviale el enlace de invitación.</li>
            <li>Recordá que no se lo puede agregar manualmente según lo probado durante la capacitación.</li>
          </ul></li>
          <li><h4>Realizar el primer contacto por WhatsApp</h4><ul>
            <li>Presentate como asesor del equipo de Matías Randazzo.</li>
            <li>Iniciá una conversación breve y personalizada.</li>
            <li>Consultá si pudo ingresar a la comunidad.</li>
            <li>Utilizá las preguntas de calificación del procedimiento comercial.</li>
          </ul></li>
          <li><h4>Registrar la gestión</h4><ul>
            <li>Agregá una nota en GoHighLevel indicando qué acción realizaste y el estado del prospecto.</li>
            <li>Colocá la etiqueta correspondiente en WhatsApp para identificar su nivel de calificación.</li>
            <li>Volvé a Discord y reaccioná a la notificación una vez realizado el contacto.</li>
          </ul></li>
          <li><h4>Gestionar los recursos gratuitos</h4><ul>
            <li>Seguí el cronograma de videos y materiales indicado en Miro.</li>
            <li>Compartí los contenidos correspondientes dentro de la comunidad.</li>
            <li>Cuando un prospecto solicite un recurso por privado, aprovechá la conversación para realizar preguntas de calificación antes de entregarlo.</li>
            <li>Tené en cuenta las condiciones de acceso de cada herramienta.</li>
          </ul></li>
          <li><h4>Realizar seguimiento</h4><ul>
            <li>Priorizá a los prospectos de mayor calificación y a quienes mostraron interés.</li>
            <li>Revisá los registros anteriores antes de volver a contactar.</li>
            <li>Mantené las notas y etiquetas actualizadas.</li>
            <li>Evitá mensajes masivos indiscriminados y respetá las políticas vigentes de WhatsApp.</li>
          </ul></li>
          <li><h4>Gestionar el agendamiento con un closer</h4><ul>
            <li>Cuando el prospecto esté calificado y corresponda avanzar, compartí el enlace de agendamiento.</li>
            <li>La asignación de closers se realiza automáticamente según la configuración y disponibilidad.</li>
            <li>Si no encuentra horarios disponibles, coordiná internamente con los closers.</li>
            <li>Registrá la gestión y el resultado en el CRM.</li>
          </ul></li>
        </ol>
        <h3>¿Para qué te sirve esta capacitación?</h3>
        <p>Este video te permitirá comprender el circuito operativo que debe realizar un setter, desde la recepción de un lead hasta su calificación, seguimiento y agendamiento comercial.</p>
        <h3>Momentos importantes del video</h3>
        <ul>
          <li><strong>Minuto 0–17:</strong> dudas operativas, recursos, comunidades y agendamiento.</li>
          <li><strong>Minuto 20–31:</strong> simulacro práctico con Discord, GHL y WhatsApp.</li>
          <li><strong>Minuto 32–45:</strong> objeciones comerciales, experiencias y entrenamiento.</li>
          <li><strong>Minuto 48–60:</strong> práctica de identificación, calificación y registro de leads.</li>
        </ul>
        <p><strong>Recomendación:</strong> Mirá el video con Discord, GoHighLevel, WhatsApp y el procedimiento de Miro abiertos para poder replicar el circuito mientras se explica.</p>
        <p class="lesson-deadline"><strong>Importante:</strong> Esta grabación corresponde a un lanzamiento específico. Para trabajar con nuevos prospectos, seguí siempre el SOP, los mensajes, los enlaces, los criterios de calificación y las condiciones comerciales vigentes.</p>
      </details>
    </section>`);
    content.insertAdjacentHTML('beforeend', `<section class="materials-section launch-gifts" aria-labelledby="launchGiftsTitle"><div class="campus-section-title"><h2 id="launchGiftsTitle">Regalos del lanzamiento</h2><p>Guía de entrega para asesores</p></div><div class="lesson-panel"><h3>La clave se comparte sólo si el lead la solicita.</h3><p>Cada regalo permite 7 usos. Después, la herramienta pide una clave que el lead debe solicitar a su asesor. Entregá el enlace el día indicado y compartí la clave únicamente cuando te la pidan, para continuar la interacción.</p></div><div id="launchGiftList" class="class-grid"><p role="status">Cargando regalos…</p></div></section>`);
    window.http.getJson('/api/metricas/launch-gifts').then(({gifts}) => {
      document.getElementById('launchGiftList').innerHTML = gifts.map(gift => `<article class="lesson-panel launch-gift"><p class="campus-eyebrow">Regalo ${esc(gift.number)} · Día ${esc(gift.day)}</p><h3>${esc(gift.title)}</h3><p>7 usos antes de solicitar la clave.</p><a class="campus-button secondary" href="${esc(gift.url)}" target="_blank" rel="noopener noreferrer">Abrir regalo ↗</a><p class="launch-gift-url">${esc(gift.url)}</p><details><summary>Ver clave para el asesor</summary><p>Compartila sólo si el lead la solicita.</p><code>${esc(gift.key)}</code></details></article>`).join('');
    }).catch(() => { document.getElementById('launchGiftList').innerHTML = '<p role="alert">No se pudieron cargar los regalos. Recargá la página para reintentar.</p>'; });
  } else if (selected && !lesson) {
    content.innerHTML='<div class="campus-hero"><div><h1>Esta clase no está disponible</h1><p class="campus-intro">Elegí una de las clases de la capacitación.</p><a class="campus-back" href="/views/entrenamiento.html">← Ver todas las clases</a></div></div>';
  } else if (lesson) {
    document.title=`Clase ${lesson.id} · ${lesson.title} | Central MR`;
    content.innerHTML=`<a class="campus-back" href="/views/entrenamiento.html">← Todas las capacitaciones</a><header class="lesson-heading"><p class="campus-eyebrow">Capacitación comercial · Clase ${String(lesson.id).padStart(2,'0')}</p><h1>${lesson.title}</h1><p class="campus-intro">${lesson.summary}</p></header>
    <div class="lesson-layout"><div>${lesson.videoUrl ? `<section class="lesson-panel lesson-recording"><span class="lesson-recording-play" aria-hidden="true">▶</span><p class="campus-eyebrow">Capacitación principal · Carlos · 26 minutos</p><h2>Herramienta de diagnóstico de rentabilidad</h2><p>Empezá por esta capacitación: cómo analizar la rentabilidad, el punto de equilibrio y las oportunidades de mejora durante una llamada comercial.</p><a class="campus-button" href="${esc(lesson.videoUrl)}" target="_blank" rel="noopener noreferrer">Ver capacitación principal ↗</a><p class="lesson-deadline">Descarga de la herramienta: próximamente.</p></section><section class="lesson-panel lesson-recording"><p class="campus-eyebrow">Material complementario · Matías Randazzo</p><h2>Cómo hacer una auditoría</h2><p>La clase anterior queda disponible para complementar el diagnóstico.</p><a class="campus-button secondary" href="https://fathom.video/share/uZ6MzG7H_Jj_-oYykAxqrbqQqAfxCDQ4" target="_blank" rel="noopener noreferrer">Ver clase complementaria ↗</a></section>` : `<iframe class="lesson-video" src="https://drive.google.com/file/d/${lesson.video}/preview" title="Video de la clase ${lesson.id}: ${lesson.title}" allow="fullscreen; autoplay" allowfullscreen></iframe><div class="lesson-video-note"><p>Si el video solicita acceso, abrilo en Drive con tu cuenta autorizada.</p><a class="campus-button secondary" href="https://drive.google.com/file/d/${lesson.video}/view?usp=sharing" target="_blank" rel="noopener noreferrer">Abrir video en Drive ↗</a></div>`}
    ${lesson.materials.length ? `<section id="materiales" class="lesson-panel lesson-materials" aria-labelledby="lessonMaterialsTitle"><h2 id="lessonMaterialsTitle">Materiales de la clase ${lesson.id}</h2><p class="lesson-materials-intro">${lesson.id === 1 ? 'Dejá tus datos de contacto para acceder a los materiales del programa.' : lesson.id === 3 ? 'Usá estos tres materiales para estudiar el guion y la presentación, y analizar las llamadas de esta clase.' : 'Completá el test de perfil indicado en las actividades de esta clase.'}</p>${resourcesMarkup(lesson)}</section>` : ''}
    ${lesson.topics.length ? `<section class="lesson-panel"><h2>Qué vas a trabajar</h2>${lesson.topics.map(([title,text])=>`<div class="lesson-topic"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join('')}</section>` : ''}
    ${lesson.decisions?`<section class="lesson-panel"><h2>Acuerdos del programa</h2>${listMarkup(lesson.decisions)}</section>`:''}
    ${lesson.tasks.length ? `<section class="lesson-panel"><h2>Actividades y próximos pasos</h2>${listMarkup(lesson.tasks)}<p class="lesson-deadline">Los días y horarios corresponden a las indicaciones de la grabación. Confirmá con Leonardo las fechas de tu grupo.</p></section>` : ''}
    <nav class="lesson-next" aria-label="Navegación entre clases">${lesson.id>1?`<a class="campus-button secondary" href="${classUrl(lesson.id-1)}">← Clase ${lesson.id-1}</a>`:'<span></span>'}${lesson.id<classes.length?`<a class="campus-button" href="${classUrl(lesson.id+1)}">Siguiente · Clase ${lesson.id+1} →</a>`:'<a class="campus-button" href="/views/entrenamiento.html">Volver a capacitaciones</a>'}</nav></div>
    <aside class="lesson-aside"><div class="lesson-index"><h2>Contenido del programa</h2>${classes.map(c=>`<a href="${classUrl(c.id)}"${c.id===lesson.id?' aria-current="page"':''}><small>CLASE ${c.id}</small>${c.title}</a>`).join('')}</div></aside></div>`;
  } else {
    content.innerHTML=`<section class="campus-hero"><div><p class="campus-eyebrow">Formación para todo el equipo</p><h1>Capacitaciones</h1><p class="campus-intro">Cada clase reúne su grabación, sus actividades y los materiales que le corresponden. Empezá por la primera y seguí el recorrido.</p></div><div class="campus-stats"><div><strong>${String(classes.length).padStart(2,'0')}</strong><span>Clases grabadas</span></div></div></section>
    <section id="clases" aria-labelledby="classesTitle"><div class="campus-section-title"><h2 id="classesTitle">Tu recorrido de formación</h2><p>Entrá a cada clase para ver sus materiales y actividades.</p></div><div class="class-grid">${classes.map(c=>`<a class="class-card" href="${classUrl(c.id)}"><div class="class-art"><span class="class-label">Clase ${String(c.id).padStart(2,'0')}</span><span class="class-number" aria-hidden="true">0${c.id}</span><span class="class-play" aria-hidden="true">▶</span></div><div class="class-body"><h3>${c.title}</h3><p>${c.teaser}</p><p class="class-material-summary"><strong>Dentro de esta clase</strong>${c.materialSummary}</p><span class="class-cta">Entrar a la clase <span aria-hidden="true">→</span></span></div></a>`).join('')}</div></section>
`;
    if (['#materiales', '#clases'].includes(location.hash)) document.getElementById('clases').scrollIntoView();
  }
  window.http.getJson('/api/metricas/auth/session').then(({user})=>{document.getElementById('discResults').hidden=user?.permissions?.canReviewDisc!==true;}).catch(()=>{});
})();
