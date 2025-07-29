const MetricasCliente = require('../models/metricascliente.js');

const getTextValue = (prop) => {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map((item) => item.plain_text).join(' ');
  return '';
};
const getTextFromFormula = (prop) => prop?.formula?.type === 'string' ? prop.formula.string : '';

const getNumberFromFormula = (prop) => prop?.formula?.type === 'number' ? prop.formula.number : null;
const getDateFromFormula = (prop) => {
  if (!prop || prop.type !== 'formula') return null;
  
  if (prop.formula.type === 'date') {
    return prop.formula.date?.start ? new Date(prop.formula.date.start) : null;
  }

  if (prop.formula.type === 'string' && prop.formula.string) {
    const fechaString = prop.formula.string.replace('@', '').trim(); // saco el @
    const fecha = new Date(fechaString);
    return isNaN(fecha) ? null : fecha;
  }

  return null;
};

const getPerson = (prop) => prop?.people?.[0]?.name ?? ''; // 🔥 CATCH Closer

const formatNotionId = (id) => {
  if (!id) return id;
  if (id.includes('-')) return id;
  return id.replace(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/, '$1-$2-$3-$4-$5');
};

exports.handleWebhook = async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.id || !data.properties) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const pageId = formatNotionId(data.id);
    const props = data.properties;

    const transformedData = {
      id: pageId,
      Nombre: getTextValue(props['Nombre']),
      Closer: getPerson(props['Closer']), // 🔥 NUEVO
      Agendo: getNumberFromFormula(props['Agendo']),
      "Aplica Con CC": getTextFromFormula(props['Aplica Con CC']),
      "Aplica N": getNumberFromFormula(props['Aplica N']),
      "Call confirm exitoso": getNumberFromFormula(props['Call confirm exitoso']),
      "Fecha de agendamiento": getDateFromFormula(props['Fecha de agendamiento ']),
      "Llamadas efectuadas": getNumberFromFormula(props['Llamadas efectuadas']),
      "Ultimo origen": getTextFromFormula(props['Ultimo origen'])
    };

    const updatedOrCreatedData = await MetricasCliente.findOneAndUpdate(
      { id: pageId },
      transformedData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: 'Datos guardados con éxito',
      data: updatedOrCreatedData
    });

  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.status(500).json({ error: "Error al procesar el webhook" });
  }
};
