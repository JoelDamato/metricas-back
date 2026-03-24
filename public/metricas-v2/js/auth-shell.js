(async function initAuthShell() {
  if (window.location.pathname.endsWith('/login.html')) return;

  try {
    const response = await fetch('/api/metricas/auth/session', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data.user;
    if (!user) return;

    const shell = document.createElement('div');
    shell.className = 'auth-shell';
    shell.innerHTML = `
      <span>${user.email} · ${user.role}</span>
      <button id="logoutMetricas">Salir</button>
    `;
    document.body.appendChild(shell);

    document.querySelectorAll('[data-roles]').forEach((node) => {
      const allowedRoles = String(node.dataset.roles || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        node.remove();
      }
    });

    document.getElementById('logoutMetricas').addEventListener('click', async () => {
      await fetch('/api/metricas/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/metricas/login.html';
    });

    if (!window.location.pathname.endsWith('/unauthorized.html')) {
      const pageConfigByPath = {
        '/metricas': {
          pageKey: 'central',
          suggestions: [
            { label: 'Qué ver', question: '¿Qué métrica conviene mirar según lo que necesito analizar?' },
            { label: 'Dónde está', question: '¿En qué hoja veo ventas, cash y agendas?' },
            { label: 'Diferencias', question: '¿Cuál es la diferencia entre Ranking, Agendas Totales y Marketing?' }
          ]
        },
        '/metricas/index.html': {
          pageKey: 'central',
          suggestions: [
            { label: 'Qué ver', question: '¿Qué métrica conviene mirar según lo que necesito analizar?' },
            { label: 'Dónde está', question: '¿En qué hoja veo ventas, cash y agendas?' },
            { label: 'Diferencias', question: '¿Cuál es la diferencia entre Ranking, Agendas Totales y Marketing?' }
          ]
        },
        '/metricas/views/ranking.html': {
          pageKey: 'ranking',
          suggestions: [
            { label: 'Ventas Ranking', question: '¿Cómo se calculan las ventas de un closer en Ranking?' },
            { label: 'Cash Ranking', question: '¿Qué fecha usa el cash collected en Ranking?' },
            { label: 'Ranking vs Agendas', question: '¿Por qué las ventas pueden no coincidir entre Ranking y Agendas Totales?' }
          ]
        },
        '/metricas/views/agendas-totales.html': {
          pageKey: 'agendas_totales',
          suggestions: [
            { label: 'CCNE Agendas', question: '¿Cómo se calcula CCNE en Agendas Totales?' },
            { label: 'Ventas Agendas', question: '¿Qué fecha usa ventas en Agendas Totales?' },
            { label: 'Cash Agendas', question: '¿Qué fecha usa cash collected en Agendas Totales?' }
          ]
        },
        '/metricas/views/agendas-detalle-closer.html': {
          pageKey: 'agenda_detalle_origen_closer',
          suggestions: [
            { label: 'Cash detalle', question: '¿Cómo se calcula el cash collected en Agenda Detalle por Origen + Closer?' },
            { label: 'Ventas detalle', question: '¿Qué fecha usa ventas en Agenda Detalle por Origen + Closer?' },
            { label: 'Origen y closer', question: '¿Cómo se agrupan origen y closer en esta hoja?' }
          ]
        },
        '/metricas/views/marketing.html': {
          pageKey: 'marketing',
          suggestions: [
            { label: 'Fecha Marketing', question: '¿Qué fecha usa Marketing para ventas totales?' },
            { label: 'Reuniones MKT', question: '¿Cómo se calculan las reuniones totales en Marketing?' },
            { label: 'AOV día 1', question: '¿Cómo se calcula AOV día 1 en Marketing?' }
          ]
        },
        '/metricas/views/reportes.html': {
          pageKey: 'reportes',
          suggestions: [
            { label: 'Bloques', question: '¿Qué muestra cada bloque de Reportes?' },
            { label: 'Fecha Reportes', question: '¿Qué fecha usan los reportes diarios?' },
            { label: 'Cash diario', question: '¿Cómo se calcula el cash collected diario por closer?' }
          ]
        },
        '/metricas/views/leads-bdd.html': {
          pageKey: 'informe_por_respuestas',
          suggestions: [
            { label: 'Fecha hoja', question: '¿Qué fecha usa Informe Por Respuestas?' },
            { label: 'Tablas', question: '¿Qué calcula cada tabla de Informe Por Respuestas?' },
            { label: 'Asistencia y venta', question: '¿Cómo se calcula asistencia y venta en esta hoja?' }
          ]
        },
        '/metricas/views/setting.html': {
          pageKey: 'setting',
          suggestions: [
            { label: 'Fecha Setting', question: '¿Qué fecha usa Setting?' },
            { label: 'Setter', question: '¿Cómo se agrupa la información por setter en esta hoja?' },
            { label: 'Embudo', question: '¿Qué representa cada fila del embudo de Setting?' }
          ]
        },
        '/metricas/views/kpi-closers.html': {
          pageKey: 'kpi_closers',
          suggestions: [
            { label: 'Objetivos', question: '¿Cómo funcionan los objetivos editables en KPI Closers?' },
            { label: 'Cumplimiento', question: '¿Cómo se calcula si un closer cumple un objetivo en esta hoja?' },
            { label: 'Totales KPI', question: '¿Cómo se calculan los totales en KPI Closers?' }
          ]
        }
      };

      const pageConfig = pageConfigByPath[window.location.pathname] || {
        pageKey: 'general',
        suggestions: [
          { label: 'CCNE Agendas', question: '¿Cómo se calcula CCNE en Agendas Totales?' },
          { label: 'Fecha Marketing', question: '¿Qué fecha usa Marketing para ventas totales?' },
          { label: 'Diferencias vistas', question: '¿Por qué una métrica puede no coincidir entre Marketing y Agendas Totales?' }
        ]
      };

      const pageContext = {
        pageKey: pageConfig.pageKey,
        pathname: window.location.pathname,
        pageTitle: document.title || '',
        pageHeading: document.querySelector('h1')?.textContent?.trim() || ''
      };

      const suggestionsHtml = pageConfig.suggestions
        .map((item) => (
          `<button type="button" class="scalito-chip" data-question="${item.question}">${item.label}</button>`
        ))
        .join('');

      const assistant = document.createElement('div');
      assistant.className = 'scalito-shell';
      assistant.innerHTML = `
        <button class="scalito-fab" id="scalitoToggle" type="button" aria-label="Abrir Scalito">S</button>
        <section class="scalito-panel" id="scalitoPanel" hidden>
          <div class="scalito-head">
            <div>
              <strong>Scalito</strong>
              <p>Te explico la lógica de cada métrica.</p>
            </div>
            <button class="scalito-close" id="scalitoClose" type="button">×</button>
          </div>
          <div class="scalito-suggestions" id="scalitoSuggestions">
            ${suggestionsHtml}
          </div>
          <div class="scalito-messages" id="scalitoMessages">
            <div class="scalito-msg bot">Preguntame cómo se calcula una métrica, qué fecha usa o por qué no coincide entre vistas.</div>
          </div>
          <form class="scalito-form" id="scalitoForm">
            <textarea id="scalitoInput" rows="3" placeholder="Ej: ¿Cómo se calcula CCNE en Agendas Totales?"></textarea>
            <button type="submit" id="scalitoSend">Preguntar</button>
          </form>
        </section>
      `;
      document.body.appendChild(assistant);

      const panel = document.getElementById('scalitoPanel');
      const toggle = document.getElementById('scalitoToggle');
      const messages = document.getElementById('scalitoMessages');
      const input = document.getElementById('scalitoInput');
      const sendButton = document.getElementById('scalitoSend');
      const suggestionButtons = document.querySelectorAll('.scalito-chip');
      let typingNode = null;

      function addMessage(text, type) {
        const item = document.createElement('div');
        item.className = `scalito-msg ${type}`;
        item.textContent = text;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
        return item;
      }

      function showTyping() {
        hideTyping();
        typingNode = addMessage('Scalito está escribiendo', 'bot typing');
      }

      function hideTyping() {
        if (!typingNode) return;
        typingNode.remove();
        typingNode = null;
      }

      async function submitQuestion(question) {
        if (!question) return;

        addMessage(question, 'user');
        input.value = '';
        input.disabled = true;
        sendButton.disabled = true;
        suggestionButtons.forEach((button) => { button.disabled = true; });
        showTyping();

        try {
          const response = await window.metricasApi.askScalito(question, pageContext);
          hideTyping();
          addMessage(response.answer || 'No encontré respuesta.', 'bot');
        } catch (error) {
          hideTyping();
          addMessage(error.message || 'No pude responder esa consulta.', 'bot error');
        } finally {
          input.disabled = false;
          sendButton.disabled = false;
          suggestionButtons.forEach((button) => { button.disabled = false; });
          input.focus();
        }
      }

      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.hidden = !panel.hidden;
        if (!panel.hidden) {
          input.focus();
        }
      });

      document.getElementById('scalitoClose').addEventListener('click', () => {
        panel.hidden = true;
        toggle.hidden = false;
      });

      document.getElementById('scalitoForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const question = input.value.trim();
        await submitQuestion(question);
      });

      suggestionButtons.forEach((button) => {
        button.addEventListener('click', async () => {
          const question = button.dataset.question || '';
          await submitQuestion(question);
        });
      });
    }
  } catch (error) {
    // noop
  }
})();
