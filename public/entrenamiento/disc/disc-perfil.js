/* =========================================================
   Bloque "Perfil DISC" para el Centro de entrenamiento
   Uso:
     renderPerfilDisc(contenedor, { D: 30, I: 13.33, S: 20, C: 36.67 });
   - contenedor: el elemento HTML donde se dibuja (por ejemplo, dentro de la tarjeta de cada participante).
   - porcentajes: los 4 valores del test (Dominio, Influencia, Estabilidad, Conformidad).
   Muestra el perfil predominante y el secundario con:
     características positivas, características limitantes y cómo mejorar.
   ========================================================= */
(function () {
  /* Características positivas y limitantes: material "Teoría DISC" de Leonardo Alaniz.
     "Cómo mejorar": acciones concretas para el trabajo de closer. */
  var PERFILES = {
    D: {
      nombre: "Dominio",
      resumen: "Orientado a resultados, directo y rápido para decidir.",
      positivas: ["Exigente", "Líder", "Pionero", "Energía", "Determinado", "Competitivo", "Responsable", "Rápido", "Overachiever", "Valiente", "Supera los retos"],
      limitantes: ["Ser arrogante", "Hablar sin pensar", "Crear miedo en la gente", "No saber escuchar", "Ser impaciente", "Multitarea y no hacer frente a los problemas", "Ser insensible con la gente", "Asumir demasiados riesgos", "Buscar resultados a toda costa", "Problemas para delegar", "No recibir bien la retroalimentación"],
      mejorar: [
        { que: "Escuchar antes de proponer", como: "En cada llamada, hacé al menos 3 preguntas de descubrimiento antes de presentar la solución." },
        { que: "Bajar la presión sobre el lead", como: "Después de dar el precio, quedate en silencio y dejá que el lead hable primero." },
        { que: "Recibir la devolución sin defenderse", como: "Respondé \"Gracias, lo pruebo en la próxima llamada\" antes de explicar por qué lo hiciste así." },
        { que: "Cuidar el vínculo", como: "Antes de corregir a alguien, reconocé algo que hizo bien." },
        { que: "Medir los riesgos", como: "Antes de una decisión importante, preguntate: ¿qué puede salir mal?" }
      ]
    },
    I: {
      nombre: "Influencia",
      resumen: "Comunicativo, entusiasta y orientado a las personas.",
      positivas: ["Entusiasta", "Optimista", "Diplomático", "Elocuente", "Persuasivo", "Cálido", "Convincente", "Atento", "Fiable", "Sociable", "Con humor"],
      limitantes: ["Abandonar cuando hay conflicto", "Ser demasiado optimista", "Ser indirecto en la comunicación", "Hablar demasiado rápido", "Problemas con el tiempo", "Problemas para completar tareas", "Ser desorganizado", "Tener problemas de comunicación", "Confiar demasiado en la gente", "Hablar sin pensar", "Perder la concentración con facilidad"],
      mejorar: [
        { que: "Seguir una estructura", como: "Usá el guion de llamada como mapa: no pases a la etapa siguiente sin cerrar la anterior." },
        { que: "Ordenar el tiempo", como: "Bloqueá en la agenda los horarios de llamadas y de seguimiento, y respetalos." },
        { que: "Completar el seguimiento", como: "Cargá cada llamada en el CRM el mismo día, antes de terminar la jornada." },
        { que: "Prometer solo lo que se entrega", como: "Antes de afirmar algo sobre el programa, verificá que figure en el material oficial." },
        { que: "Sostener la objeción", como: "Cuando aparece una objeción, hacé una pregunta sobre ella en vez de cambiar de tema." },
        { que: "Hablar más pausado", como: "Grabá una llamada por semana y marcá dónde hablaste de corrido sin dejar responder." }
      ]
    },
    S: {
      nombre: "Estabilidad",
      resumen: "Paciente, constante y confiable.",
      positivas: ["Parte del equipo", "Leal", "Fiable", "Paciente", "Termina lo que empieza", "Estable", "Servicial", "Planificador", "Gran oyente", "Calmo", "Transmite calma"],
      limitantes: ["Ser posesivo", "Guardar rencor", "Ser demasiado tolerante", "Asumir muy pocos riesgos", "No le gustan los cambios", "Falta de iniciativa", "No tener demasiada ambición", "Ser tímido", "Hacer una cosa por vez", "Ser lento"],
      mejorar: [
        { que: "Pedir la decisión", como: "Practicá una frase de cierre fija y usala en todas las llamadas, aunque te incomode." },
        { que: "Tomar la iniciativa", como: "Proponé una idea o acción por semana sin esperar a que te la pidan." },
        { que: "Poner límites", como: "Cuando algo no te sirve, decí \"no\" y ofrecé una alternativa en el momento." },
        { que: "Hablar lo que molesta", como: "Planteá un problema dentro de las 24 horas, antes de que se acumule." },
        { que: "Adaptarse a los cambios", como: "Ante un cambio, pedí que te expliquen el motivo y probalo durante una semana antes de juzgarlo." },
        { que: "Subir el ritmo", como: "Fijate una meta diaria mínima de llamadas y revisala al final del día." }
      ]
    },
    C: {
      nombre: "Conformidad",
      resumen: "Analítico, preciso y cuidadoso con la calidad.",
      positivas: ["Altos niveles de calidad", "Cuidadoso", "Termina lo que empieza", "Sistemático", "Piensa objetivamente", "Con tacto", "Firme", "Hace buenas preguntas", "Mejora continua"],
      limitantes: ["Exigir demasiados datos", "Asumir pocos riesgos", "Interiorizar los sentimientos", "Ser muy duro consigo mismo", "Ser demasiado lento para actuar", "Ser demasiado crítico", "Perfeccionismo: lo perfecto es enemigo de lo bueno", "Arrogante cuando se lo contradice", "Inflexible"],
      mejorar: [
        { que: "Actuar sin tener todo", como: "Si tenés el 80% de la información, decidí. Poné un plazo a la preparación." },
        { que: "Conectar con la emoción", como: "En cada llamada, preguntá cómo se siente el lead con su situación, no solo qué le pasa." },
        { que: "Ser menos duro consigo mismo", como: "Después de cada llamada, anotá una cosa que salió bien antes de anotar qué mejorar." },
        { que: "Priorizar las correcciones", como: "Al revisar tu trabajo o el de otros, elegí una sola mejora, la más importante." },
        { que: "Escuchar cuando lo contradicen", como: "Antes de rebatir, preguntá \"¿por qué lo ves así?\"." },
        { que: "Ganar velocidad", como: "Usá el guion como base y ajustá en la llamada, en vez de preparar cada caso desde cero." }
      ]
    }
  };

  var ORDEN = ["D", "I", "S", "C"];
  var COLOR = { D: "#ef4444", I: "#f59e0b", S: "#22a04b", C: "#3b82f6" };

  function fmt(n) { return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function lista(items) { var ul = el("ul", "dp-list"); items.forEach(function (t) { ul.appendChild(el("li", null, t)); }); return ul; }

  function bloque(k, etiqueta, pct) {
    var p = PERFILES[k];
    var box = el("section", "dp-perfil");
    box.style.setProperty("--dp-color", COLOR[k]);

    var head = el("div", "dp-head");
    head.appendChild(el("span", "dp-tag", etiqueta + " · " + fmt(pct)));
    head.appendChild(el("h3", "dp-nombre", p.nombre));
    head.appendChild(el("p", "dp-resumen", p.resumen));
    box.appendChild(head);

    var cols = el("div", "dp-cols");
    var pos = el("div", "dp-col"); pos.appendChild(el("h4", "dp-sub dp-pos", "Características positivas")); pos.appendChild(lista(p.positivas));
    var lim = el("div", "dp-col"); lim.appendChild(el("h4", "dp-sub dp-lim", "Características limitantes")); lim.appendChild(lista(p.limitantes));
    cols.appendChild(pos); cols.appendChild(lim);
    box.appendChild(cols);

    var mej = el("div", "dp-mejorar");
    mej.appendChild(el("h4", "dp-sub dp-mej", "Qué mejorar y cómo"));
    var ol = el("ol", "dp-acciones");
    p.mejorar.forEach(function (m) {
      var li = el("li");
      li.appendChild(el("strong", null, m.que));
      li.appendChild(el("span", null, m.como));
      ol.appendChild(li);
    });
    mej.appendChild(ol);
    box.appendChild(mej);
    return box;
  }

  window.renderPerfilDisc = function (contenedor, porcentajes) {
    if (!contenedor || !porcentajes) return;
    var pct = {}; ORDEN.forEach(function (k) {
      var value = Number(porcentajes[k]);
      pct[k] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });
    var ranking = ORDEN.slice().sort(function (a, b) { return pct[b] - pct[a]; });
    var max = pct[ranking[0]];
    if (max === 0) {
      contenedor.textContent = "No hay respuestas suficientes para mostrar las características.";
      return;
    }
    var top = ranking.filter(function (k) { return Math.abs(pct[k] - max) < 0.01; });
    var mostrar = top.map(function (k) { return [k, "Perfil predominante"]; });
    if (top.length === 1 && pct[ranking[1]] > 0) {
      ranking.slice(1).filter(function (k) { return Math.abs(pct[k] - pct[ranking[1]]) < 0.01; })
        .forEach(function (k) { mostrar.push([k, "Perfil secundario"]); });
    }

    var wrap = el("div", "dp-wrap");
    mostrar.forEach(function (x) { wrap.appendChild(bloque(x[0], x[1], pct[x[0]])); });
    contenedor.textContent = "";
    contenedor.appendChild(wrap);
  };

  window.PERFILES_DISC = PERFILES;
})();
