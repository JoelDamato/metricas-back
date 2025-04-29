const axios = require('axios');
const mongoose = require('mongoose');
const MetricasCliente = require('./models/metricascliente.js'); // Asegúrate de que la ruta sea correcta

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
).then(() => console.log('Conectado a MongoDB'))
 .catch((error) => console.error('Error al conectar a MongoDB:', error));

/* === Helpers para extraer datos de Notion === */
const getTextValue = (prop) => prop?.title?.map((item) => item.plain_text).join(' ') || '';
const getNumberFromFormula = (prop) => prop?.formula?.type === 'number' ? prop.formula.number : null;
const getTextFromFormula = (prop) => prop?.formula?.type === 'string' ? prop.formula.string : '';
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
  
const getPerson = (prop) => prop?.people?.[0]?.name || '';

const formatNotionId = (id) => id.includes('-') ? id : id.replace(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/, '$1-$2-$3-$4-$5');

/* === Configuración Notion === */
const NOTION_DATABASE_ID = '14e482517a9581458d4bfefbcde4ea03';
const NOTION_API_TOKEN = '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';
const NOTION_API_URL = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

/* === Función principal === */
const fetchNotionData = async () => {
  let hasMore = true;
  let nextCursor = null;

  while (hasMore) {
    const response = await axios.post(
      NOTION_API_URL,
      { page_size: 100, start_cursor: nextCursor || undefined },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      }
    );

    const { results, has_more, next_cursor } = response.data;
    hasMore = has_more;
    nextCursor = next_cursor;

    for (const page of results) {
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
        "Ultimo origen": getTextFromFormula(props['Ultimo origen'])
      };

      await MetricasCliente.findOneAndUpdate(
        { id: pageId },
        transformedData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`Guardado registro: ${transformedData.Nombre}`);
    }
  }
};

/* === Ejecutar === */
fetchNotionData()
  .then(() => {
    console.log('Importación completada.');
    mongoose.disconnect();
  })
  .catch((error) => {
    console.error('Error durante la importación:', error);
    mongoose.disconnect();
  });
