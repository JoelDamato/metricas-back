const axios = require('axios');
const MetricasCliente = require('../models/metricascliente.js'); // Asegurate que la ruta sea correcta

/* ======================
   Helper functions
   ====================== */

const getNumber = (prop) => prop?.number ?? null;
const getSelectValue = (prop) => prop?.select?.name ?? '';
const getDateFromFormula = (prop) => prop?.formula?.type === 'date' ? prop.formula.date?.start : null;
const getNumberFromFormula = (prop) => prop?.formula?.type === 'number' ? prop.formula.number : null;
const getTextFromFormula = (prop) => prop?.formula?.type === 'string' ? prop.formula.string : '';

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

    // Transformar los datos alineados al esquema metricascliente
    const transformedData = {
      id: normalizedPageId,
      Agendo: getNumberFromFormula(props['Agenda']),
      "Aplica con CCA": getSelectValue(props['Aplica?']),
      "No efectuada con CC": getNumberFromFormula(props['Llamadas no efectuadas']),
      "Call Confirm No exitoso": getNumberFromFormula(props['Call Confirm No exitoso']),
      Origen: getTextFromFormula(props['Ult. Origen']),
      Closer: getTextFromFormula(props['Responsable']),
      Facturacion: getNumberFromFormula(props['Facturacion']),
      "Fecha correspondiente": getDateFromFormula(props['Fecha correspondiente']),
      "Fecha de agendamiento": getDateFromFormula(props['Fecha de agendamiento']),
      "Llamadas efectuadas": getNumberFromFormula(props['Llamadas efectuadas'])
    };

    // Actualizar o crear el documento
    const existingDocument = await MetricasCliente.findOne({ id: normalizedPageId });
    const operationType = existingDocument ? 'actualizado' : 'creado';

    const updatedOrCreatedData = await MetricasCliente.findOneAndUpdate(
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
