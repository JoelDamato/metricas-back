const axios = require('axios');
const MetricasCliente = require('../models/metricascliente');

const NOTION_DATABASE_ID = '14e482517a9581458d4bfefbcde4ea03';
const NOTION_API_TOKEN = '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';
const NOTION_API_URL = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

const getTextValue = (prop) => prop?.title?.map((item) => item.plain_text).join(' ') || '';
const getNumberFromFormula = (prop) => prop?.formula?.type === 'number' ? prop.formula.number : null;
const getTextFromFormula = (prop) => prop?.formula?.type === 'string' ? prop.formula.string : '';
const getPerson = (prop) => prop?.people?.[0]?.name || '';

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
  return tieneHora ? new Date(fechaOriginal.getTime() - 3 * 60 * 60 * 1000) : fechaOriginal;
};

const formatNotionId = (id) => id.includes('-')
  ? id
  : id.replace(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/, '$1-$2-$3-$4-$5');

exports.importarMetricasCliente = async (req, res) => {
  try {
    let hasMore = true;
    let nextCursor = null;
    let total = 0;

    while (hasMore) {
      const response = await axios.post(
        NOTION_API_URL,
        {
          page_size: 100,
          start_cursor: nextCursor || undefined,
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'descending'
            }
          ]
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
        try {
          const props = page.properties;
          const pageId = formatNotionId(page.id);

          const transformedData = {
            id: pageId,
            Nombre: getTextValue(props['Nombre']),
            Closer: getPerson(props['Closer']),
            Agendo: getNumberFromFormula(props['Agendo']),
            "Aplica Con CC": getTextFromFormula(props['Aplica Con CC']),
            "Aplica N": getNumberFromFormula(props['Aplica N']),
            "Call confirm exitoso": getNumberFromFormula(props['Call confirm exitoso']),
            "Fecha de agendamiento": getDateFromFormula(props['Fecha de agendamiento ']),
            "Llamadas efectuadas": getNumberFromFormula(props['Llamadas efectuadas']),
            "Ultimo origen": getTextFromFormula(props['Ultimo origen']),
          };

          await MetricasCliente.findOneAndUpdate(
            { id: pageId },
            transformedData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          total++;
        } catch (errInterno) {
          console.error(`❌ Error al procesar registro individual: ${errInterno.message}`);
          // Continúa con los demás
        }
      }
    }

    res.status(200).json({ message: `✅ Importación completada. Total registros: ${total}` });
  } catch (error) {
    console.error("❌ Error global al importar:", error.response?.data || error.message);
    res.status(500).json({
      error: "Fallo al importar datos.",
      details: error.response?.data || error.message
    });
  }
};
