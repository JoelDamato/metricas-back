const axios = require('axios');
const NotionData = require('../models/metricasdata.js');

const NOTION_DATABASE_ID = '14e482517a9581cbbfa7e9fc3dd61bae';
const NOTION_API_TOKEN = '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';
const NOTION_API_URL = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

const getTextValue = (prop) => prop?.title?.map((item) => item.plain_text).join(' ') || '';
const getNumber = (prop) => (prop?.number ?? null);
const getSelectValue = (prop) => prop?.select?.name ?? '';
const getCheckbox = (prop) => prop?.checkbox ?? false;
const getDate = (prop) => prop?.date?.start ?? null;
const getURL = (prop) => prop?.url ?? '';
const getPerson = (prop) => prop?.people?.[0]?.name ?? '';
const getRelation = (prop) => prop?.relation?.map((rel) => rel.id) ?? [];
const getNumberFromFormula = (prop) => prop?.type === 'formula' && prop.formula?.type === 'number' ? prop.formula.number : null;
const getTextFromFormula = (prop) => prop?.type === 'formula' && prop.formula?.type === 'string' ? prop.formula.string : '';
const getDateFromFormula = (prop) => {
  if (!prop || prop.type !== 'formula') return null;
  const date = prop.formula.date?.start || prop.formula.string;
  const parsed = new Date(date);
  return isNaN(parsed) ? null : parsed.toISOString();
};
const getPersonOrString = (prop) => prop?.type === 'formula' && prop.formula?.type === 'string' ? prop.formula.string : '';

const getNombreDeRelacion = async (pageId) => {
  try {
    const response = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    });
    const props = response.data.properties;
    const tituloProp = Object.values(props).find(p => p.type === 'title');
    return getTextValue(tituloProp);
  } catch (error) {
    console.error(`❌ Error al obtener nombre del producto (ID ${pageId}):`, error.message);
    return '';
  }
};

exports.importarMetricasdata = async () => {
  let hasMore = true;
  let nextCursor = null;
  let totalProcessed = 0;

  try {
    while (hasMore && totalProcessed < 1000) {
      const response = await axios.post(
        NOTION_API_URL,
        {
          page_size: 100,
          start_cursor: nextCursor || undefined,
          sorts: [{ timestamp: "created_time", direction: "descending" }]
        },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
        }
      );

      const { results, has_more, next_cursor } = response.data;
      hasMore = has_more;
      nextCursor = next_cursor;

      for (const page of results) {
        if (totalProcessed >= 1000) break;

        const pageId = page.id;
        const props = page.properties;

        const transformedData = {
          id: pageId,
          Interaccion: getTextValue(props['Interaccion']),
          Agenda: getNumberFromFormula(props['Agenda']),
          "Aplica?": getSelectValue(props['Aplica?']),
          Aplicacion: getNumberFromFormula(props['Aplicacion']),
          "Asistio?": getSelectValue(props['Asistio?']),
          "Call Confirm Exitoso": getNumberFromFormula(props['Call Confirm Exitoso']),
          "Call Confirm No exitoso": getNumberFromFormula(props['Call Confirm No exitoso']),
          Canal: getSelectValue(props['Canal']),
          "Cash collected": getNumber(props['Cash Collected']),
          "Cash collected total": getNumberFromFormula(props['Cash collected total']),
          "CC / Precio": getNumberFromFormula(props['CC / Precio']),
          "Closer Actual": getPersonOrString(props['Closer Actual']),
          "Closer Sub": getPersonOrString(props['Closer Sub']),
          "Creado por": getPerson(props['Creado por']),
          Eliminar: getCheckbox(props['Eliminar']),
          Facturacion: getNumberFromFormula(props['Facturacion']),
          "Fecha correspondiente": getDateFromFormula(props['Fecha correspondiente']),
          "Fecha de agendamiento": getDateFromFormula(props['Fecha de agendamiento']),
          "Fecha creada": getDate(props['Fecha creada']),
          "Id Interaccion": getNumberFromFormula(props['Id Interaccion']),
          "Link enviado": getURL(props['Link enviado']),
          "Links enviados": getNumberFromFormula(props['Links enviados']),
          "Llamadas agendadas": getNumberFromFormula(props['Llamadas agendadas']),
          "Llamadas aplicables": getNumberFromFormula(props['Llamadas aplicables']),
          "Llamadas efectuadas": getNumberFromFormula(props['Llamadas efectuadas']),
          "Llamadas no efectuadas": getNumberFromFormula(props['Llamadas no efectuadas']),
          "Llamadas vendidas": getNumberFromFormula(props['Llamadas vendidas']),
          "Nombre cliente": (() => {
            const relaciones = getRelation(props['Nombre cliente']);
            return relaciones.length > 0 ? relaciones[0] : null;
          })(),
          "Ofertas ganadas": getNumberFromFormula(props['Ofertas ganadas']),
          Origen: getTextFromFormula(props['Ult. Origen']),
          Precio: getNumber(props['Precio']),
          "Primer Origen": getTextFromFormula(props['Primer Origen']),
          "Producto Adq": await (async () => {
            const relaciones = getRelation(props['Producto Adquirido']);
            if (relaciones.length === 0) return '';
            const nombres = await Promise.all(relaciones.map(getNombreDeRelacion));
            return nombres.join(', ');
          })(),
          Responsable: getTextFromFormula(props['Responsable']),
          "Responsable?": getCheckbox(props['Responsable?']),
          Respuesta: getSelectValue(props['Respuesta']),
          "Respuesta al primer contacto": getNumberFromFormula(props['Respuesta al primer contacto']),
          "Respuestas al seguimiento": getNumberFromFormula(props['Respuestas al seguimiento']),
          Rol: getTextFromFormula(props['Rol']),
          "Saldo pendiente": getNumberFromFormula(props['Saldo pendiente']),
          "Seña": getNumberFromFormula(props['Seña']),
          Tc: getNumber(props['Tc']),
          "Tipo contacto": getSelectValue(props['Tipo contacto']),
          "Total Nuevas conversaciones": getNumberFromFormula(props['Total Nuevas conversaciones']),
          "Ult. Origen": getTextFromFormula(props['Ult. Origen']),
          "Venta Club": getNumberFromFormula(props['Venta Club']),
          "Venta Meg": getNumberFromFormula(props['Venta Meg']),
          "Venta relacionada": (() => {
            const relaciones = getRelation(props['Venta relacionada']);
            return relaciones.length > 0 ? relaciones[0] : '';
          })(),
          "Cobranza relacionada": getRelation(props['Cobranza relacionada']),
        };

        transformedData.Flagllamadas =
          (transformedData["Venta Meg"] > 0) ||
          (transformedData["Llamadas efectuadas"] > 0) ||
          (transformedData["Agenda"] > 0) ||
          (transformedData["Cash collected total"] > 0) ||
          (transformedData["Facturacion"] > 0);

        await NotionData.findOneAndUpdate(
          { id: pageId },
          transformedData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        totalProcessed++;
      }

      console.log(`📊 Total acumulado: ${totalProcessed}`);
    }

    console.log('✅ Finalizado. Total registros importados:', totalProcessed);
    return { total: totalProcessed };
  } catch (error) {
    console.error('❌ Error en la importación:', error.response?.data || error.message);
    throw error;
  }
};
