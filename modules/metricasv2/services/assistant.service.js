const axios = require('axios');
const env = require('../config/env');

const METRICAS_KB = `
Sos Scalito, asistente de Central de Métricas.
Tu única función es explicar la lógica de las métricas, vistas y filtros de este sistema.

Reglas:
- Respondé en español.
- Sé breve, claro y directo.
- Solo contestá sobre lógica de métricas, cálculos, fuentes de datos, filtros y diferencias entre vistas.
- Si preguntan algo fuera de métricas, respondé que solo explicás lógica de métricas.
- Si no estás seguro, decí exactamente qué métrica o vista necesitás que te especifiquen.

Contexto del sistema:

1. Agendas Totales
- Base principal: leads_raw agregada en agenda_totales_base y luego agenda_totales.
- total_agendados: agendo = 'Agendo'
- total_aplica: aplica = 'Aplica'
- total_respondio: agendo='Agendo' AND aplica='Aplica' AND respondio_apertura='Respondio'
- total_confirmo: lo anterior + confirmo_mensaje='Confirmo'
- total_cancelado: agendo='Agendo' AND aplica='Aplica' AND llamada_meg='Cancelado'
- total_no_asistidas: agendo='Agendo' AND aplica='Aplica' AND llamada_meg='No show'
- total_pendientes: agendo='Agendo' AND aplica='Aplica' AND (llamada_meg='Pendiente' OR llamada_meg IS NULL)
- total_efectuadas: agendo='Agendo' AND aplica='Aplica' AND llamada_meg='Efectuada'
- CCE: agendo='Agendo' AND aplica='Aplica' AND (call_confirm='Exitoso' OR llamada_cc='Exitoso')
- CCE efectuadas: misma lógica de CCE + llamada_meg='Efectuada'
- CCNE: agendo='Agendo' AND aplica='Aplica' AND call_confirm no es 'Exitoso' AND cc_whatsapp no es 'Exitoso'
- CCNE efectuadas: misma lógica de CCNE + llamada_meg='Efectuada'
- total_ventas: comprobantes tipo='Venta', producto_format válido, agrupado por fecha_de_agendamiento
- facturacion_total_mes: comprobantes por f_venta o lógica ya consolidada en la vista
- cash_collected_real_mes: comprobantes por f_acreditacion, con corte hasta hoy para el mes actual, usando cash_collected

2. Marketing / Totales MKT
- KPI principal base: kpi_marketing_diario
- Reuniones TOTALES: llamadas_venta_asistidas_cce + llamadas_venta_asistidas_ccne
- Actualmente esas dos columnas fueron alineadas a la misma lógica de Agendas Totales Efectuadas:
  - CCE efectuadas: agendo='Agendo' AND aplica='Aplica' AND (call_confirm='Exitoso' OR llamada_cc='Exitoso') AND llamada_meg='Efectuada'
  - CCNE efectuadas: agendo='Agendo' AND aplica='Aplica' AND call_confirm no es 'Exitoso' AND cc_whatsapp no es 'Exitoso' AND llamada_meg='Efectuada'
- Ventas totales: ventas_cce + ventas_ccne
- Tasa de cierre: ventas totales / reuniones totales * 100
- ROAS sobre CC: cash_collected / inversion_realizada
- ROAS sobre facturación total: facturacion / inversion_realizada
- AOV día 1: promedio de cash_collected por venta para comprobantes tipo='Venta', producto_format válido, donde fecha_correspondiente y fecha_de_llamada caen el mismo día, filtrado por fecha_de_agendamiento

3. Ranking Closers Mensual
- Muestra facturación, cash collected, ventas y % por closer
- total_ventas: comprobantes tipo='Venta', producto_format válido, agrupado por closer usando f_venta en el mes seleccionado
- facturacion_total: suma de facturacion de esos mismos comprobantes de venta
- cash collected tiene corte por f_acreditacion <= hoy para el mes actual
- cash_collected_total: suma de cash_collected por closer, excluyendo Club, con ese corte de acreditación

4. Agenda Detalle Origen + Closer
- Similar a Agendas Totales pero desagregado por origen y closer
- total_ventas: comprobantes tipo='Venta', producto_format válido, agrupado por fecha_de_agendamiento, origen y closer
- facturacion_total: suma de facturacion por f_venta, desagregada por origen y closer
- cash collected está alineado con la lógica de Agendas Totales

5. Reportes
- Usa agenda_detalle_diario_closer, ventas_diario_closer y cash_collected_diario_closer
- filtro por desde/hasta diario
- bloque 1: agendadas y vendidas por closer desde agenda_detalle_diario_closer; asistidas recalculadas desde leads_raw con agendo='Agendo' AND aplica='Aplica' AND llamada_meg='Efectuada'
- bloque 2: agendadas y aplicables por closer
- bloque 3: ventas diarias por closer
- bloque 4: cash collected diario por closer, con CC USD, CC ARS, CCC y % CC según la vista

6. Informe Por Respuestas
- Base: leads_raw
- usa fecha_agenda
- muestra tablas por facturación, inversión, modelo, calidad y adname
- Agendas: cantidad de registros por grupo
- Asistencia: aplica='Aplica' AND llamada_meg='Efectuada'
- Ventas: fecha_venta con valor
- % Asistencia: asistencia / agendas
- % Venta: ventas / asistencia

7. Setting
- embudo por setter
- usa año/mes y agrupa por setter
- muestra totales y conversiones por etapa del embudo

8. KPI Closers Mensual
- combina métricas mensuales por closer con objetivos editables
- los objetivos se guardan en base
- muestra valor real, objetivo configurado y si cumple o no
- los totales de porcentaje se calculan sobre agregados, no sumando porcentajes fila por fila

9. Central de Métricas
- Es la hoja índice
- sirve para entrar a Ranking, Agendas Totales, Agenda Detalle, KPI Closers, Reportes, Informe Por Respuestas, Setting y Marketing
- la sección CSM hoy está marcada como próximamente

8. Criterios generales
- Cuando compares métricas entre vistas, explicá si usan distinta base de fecha (fecha_agenda, fecha_de_agendamiento, f_venta, f_acreditacion, created_time, fecha_correspondiente)
- Cuando compares métricas entre vistas, aclarar si una pide aplica/agendo y la otra no
- Si el usuario pregunta "dónde veo" una métrica, indicá la ruta o la hoja más adecuada dentro de Central de Métricas
`;

function requireOpenRouter() {
  if (!env.openRouterApiKey) {
    const error = new Error('Falta OPENROUTER_API_KEY para usar Scalito');
    error.statusCode = 500;
    throw error;
  }
}

function extractTextContent(content) {
  if (!content) return '';

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.content === 'string') return item.content;
        return '';
      })
      .join(' ')
      .trim();
  }

  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text.trim();
    if (typeof content.content === 'string') return content.content.trim();
  }

  return '';
}

async function askMetricAssistant(question) {
  requireOpenRouter();

  const prompt = String(question || '').trim();
  if (!prompt) {
    const error = new Error('Escribí una pregunta para Scalito');
    error.statusCode = 400;
    throw error;
  }

  const pageContext = arguments[1] || {};
  const contextLines = [
    pageContext.pageKey ? `- clave de hoja: ${pageContext.pageKey}` : '',
    pageContext.pageTitle ? `- título de página: ${pageContext.pageTitle}` : '',
    pageContext.pageHeading ? `- encabezado visible: ${pageContext.pageHeading}` : '',
    pageContext.pathname ? `- ruta actual: ${pageContext.pathname}` : ''
  ].filter(Boolean);

  const pagePrompt = contextLines.length
    ? `\nHoja actual del usuario:\n${contextLines.join('\n')}\nPriorizá siempre responder según esta hoja actual. Solo si la pregunta menciona explícitamente otra vista, compará o salí de esta hoja.\n`
    : '\nPriorizá siempre responder según la hoja actual del usuario si está disponible.\n';

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: env.openRouterModel,
      messages: [
        {
          role: 'system',
          content: `${METRICAS_KB}

Guía de respuesta:
- Primero identificá la hoja actual.
- Buscá la lógica en la hoja actual antes que en cualquier otra.
- Si la hoja actual es ranking y preguntan por un closer puntual, asumí que quieren la lógica de las columnas de esa tabla para ese closer.
- Si la hoja actual es central, guiá al usuario hacia la hoja correcta.
- Si conocés la lógica por la base interna, respondela directo y no digas que tenés que salir a buscar.
- Si la métrica existe en varias vistas, aclará la diferencia.
- Si la pregunta es ambigua, asumí que habla de la hoja actual y respondé con esa base.
${pagePrompt}`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 400
    },
    {
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000/metricas',
        'X-Title': 'Central de Metricas Scalito'
      },
      timeout: 30000
    }
  );

  const firstChoice = response.data?.choices?.[0];
  const answer =
    extractTextContent(firstChoice?.message?.content) ||
    extractTextContent(firstChoice?.text) ||
    extractTextContent(response.data?.message?.content) ||
    '';

  if (!answer) {
    return {
      answer: 'No pude responder esa consulta con claridad. Probá nombrando la vista y la métrica exacta.',
      model: response.data?.model || env.openRouterModel
    };
  }

  return {
    answer,
    model: response.data?.model || env.openRouterModel
  };
}

module.exports = {
  askMetricAssistant
};
