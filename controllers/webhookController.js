const axios = require('axios');
const NotionData = require('../models/metricasdata');

/* ======================
   Helper functions
   ====================== */

const getTextValue = (prop) => {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map((item) => item.plain_text).join(' ');
  if (prop.type === 'rich_text') return prop.rich_text.map((item) => item.plain_text).join(' ');
  return '';
};

const getNumber = (prop) => prop?.number ?? null;
const getSelectValue = (prop) => prop?.select?.name ?? '';
const getCheckbox = (prop) => prop?.checkbox ?? false;
const getDate = (prop) => prop?.date?.start ?? null;
const getURL = (prop) => prop?.url ?? '';
const getPerson = (prop) => prop?.people?.[0]?.name ?? '';
const getRelation = (prop) => prop?.relation?.map((rel) => rel.id) ?? [];
const getNumberFromFormula = (prop) => prop?.formula?.type === 'number' ? prop.formula.number : null;
const getTextFromFormula = (prop) => prop?.formula?.type === 'string' ? prop.formula.string : '';
const getDateFromFormula = (prop) => {
  if (!prop || prop.type !== 'formula') return null;

  let fechaString = null;

  if (prop.formula.type === 'date' && prop.formula.date?.start) {
    fechaString = prop.formula.date.start;
  } else if (prop.formula.type === 'string' && prop.formula.string) {
    fechaString = prop.formula.string.replace('@', '').trim();
  }

  if (!fechaString) return null;

  const fechaOriginal = new Date(fechaString);
  if (isNaN(fechaOriginal)) return null;

  const tieneHora = fechaOriginal.getUTCHours() !== 0 || fechaOriginal.getUTCMinutes() !== 0 || fechaOriginal.getUTCSeconds() !== 0;

  if (tieneHora) {
    return new Date(fechaOriginal.getTime() - 3 * 60 * 60 * 1000);
  } else {
    return fechaOriginal;
  }
};

const getPersonOrString = (prop) => {
  if (!prop) return '';
  if (prop.type === 'formula') {
    if (prop.formula.type === 'string') return prop.formula.string;
    if (prop.formula.type === 'text') return prop.formula.text;
    if (prop.formula.type === 'rich_text') return prop.formula.rich_text?.[0]?.plain_text ?? '';
    if (prop.formula.type === 'title') return prop.formula.title?.[0]?.plain_text ?? '';
  }
  return '';
};

const formatNotionId = (id) => {
  if (!id) return id;
  if (id.includes('-')) return id;
  if (id.length === 32) {
    return id.replace(
      /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/,
      '$1-$2-$3-$4-$5'
    );
  }
  return id;
};

const getNombreDeRelacion = async (pageId) => {
  try {
    const response = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_TOKEN || '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'}`,
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

/* ======================
   Webhook Controller
   ====================== */

exports.handleWebhook = async (req, res) => {
  try {
    console.log("=====================================");
    console.log(`HTTP Method: ${req.method}`);
    console.log("Webhook recibido:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=====================================");

    const { data } = req.body;
    if (!data || !data.id || !data.properties) {
      console.error("❌ Datos inválidos en el payload");
      return res.status(400).json({ error: 'Datos inválidos o incompletos en la solicitud' });
    }

    const pageId = data.id;
    const normalizedPageId = formatNotionId(pageId);
    const props = data.properties;

    if (props.ELIMINAR?.type === 'checkbox' && props.ELIMINAR.checkbox === true) {
      const deletedDocument = await NotionData.findOneAndDelete({ id: normalizedPageId });
      if (deletedDocument) {
        return res.status(200).json({
          message: 'Documento eliminado con éxito',
          operation: 'eliminado',
          data: deletedDocument
        });
      } else {
        return res.status(404).json({ error: 'Documento no encontrado para eliminar' });
      }
    }

    const relacionesProducto = getRelation(props['Producto Adquirido']);
    const productoAdq = relacionesProducto.length > 0
      ? (await Promise.all(relacionesProducto.map(getNombreDeRelacion))).join(', ')
      : '';

    const ventaMeg = getNumberFromFormula(props['Venta Meg']);
    const llamadasEfectuadas = getNumberFromFormula(props['Llamadas efectuadas']);
    const agenda = getNumberFromFormula(props['Agenda']);
    const cashTotal = getNumberFromFormula(props['Cash collected total']);
    const facturacion = getNumberFromFormula(props['Facturacion']);

    const transformedData = {
      id: normalizedPageId,
      Interaccion: getTextValue(props['Interaccion']),
      Agenda: agenda,
      "Aplica?": getSelectValue(props['Aplica?']),
      Aplicacion: getNumberFromFormula(props['Aplicacion']),
      "Asistio?": getSelectValue(props['Asistio?']),
      "Call Confirm Exitoso": getNumberFromFormula(props['Call Confirm Exitoso']),
      "Call Confirm No exitoso": getNumberFromFormula(props['Call Confirm No exitoso']),
      Canal: getSelectValue(props['Canal']),
      "Cash collected": getNumber(props['Cash Collected']),
      "Cash collected total": cashTotal,
      "CC / Precio": getNumberFromFormula(props['CC / Precio']),
      "Closer Actual": getPersonOrString(props['Closer Actual']),
      "Closer Sub": getPersonOrString(props['Closer Sub']),
      "Creado por": getPerson(props['Creado por']),
      ELIMINAR: getCheckbox(props['Eliminar']),
      Facturacion: facturacion,
      "Fecha correspondiente": getDateFromFormula(props['Fecha correspondiente']),
      "Fecha de agendamiento": getDateFromFormula(props['Fecha de agendamiento']),
      "Fecha creada": getDate(props['Fecha creada']),
      "Id Interaccion": getNumberFromFormula(props['Id Interaccion']),
      "Link enviado": getURL(props['Link enviado']),
      "Links enviados": getNumberFromFormula(props['Links enviados']),
      "Llamadas agendadas": getNumberFromFormula(props['Llamadas agendadas']),
      "Llamadas aplicables": getNumberFromFormula(props['Llamadas aplicables']),
      "Llamadas efectuadas": llamadasEfectuadas,
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
      "Producto Adq": productoAdq,
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
      "Venta Meg": ventaMeg,
      "Venta relacionada": (() => {
        const relaciones = getRelation(props['Venta relacionada']);
        return Array.isArray(relaciones) && relaciones.length > 0 ? relaciones[0] : '';
      })(),
      "Cobranza relacionada": getRelation(props['Cobranza relacionada']),

      // 🚀 Flag optimizada para búsquedas rápidas
      Flagllamadas:
        (ventaMeg > 0) ||
        (llamadasEfectuadas > 0) ||
        (agenda > 0) ||
        (cashTotal > 0) ||
        (facturacion > 0)
    };

    const existingDocument = await NotionData.findOne({ id: normalizedPageId });
    const operationType = existingDocument ? 'actualizado' : 'creado';

    const updatedOrCreatedData = await NotionData.findOneAndUpdate(
      { id: normalizedPageId },
      transformedData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: `Datos ${operationType} con éxito`,
      operation: operationType,
      data: updatedOrCreatedData
    });

  } catch (error) {
    console.error("❌ Error en webhook:", error);
    return res.status(500).json({ error: "Error al procesar los datos del webhook" });
  }
};
