const axios = require('axios');
const mongoose = require('mongoose');
const NotionData = require('./models/metricasdata.js'); // Asegúrate de que este modelo exista y tenga "Nombre cliente" como String

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority',
  {
    // Estas opciones son obsoletas en el driver 4.x pero se incluyen para compatibilidad
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((error) => console.error('Error al conectar a MongoDB:', error));

/* ======================
   Helper functions para transformar propiedades de Notion
   ====================== */

/**
 * Extrae el texto de propiedades de tipo "title" o "rich_text"
 */
const getTextValue = (prop) => {
  if (!prop) return '';
  if (prop.type === 'title') {
    return prop.title.map((item) => item.plain_text).join(' ');
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map((item) => item.plain_text).join(' ');
  }
  return '';
};

/**
 * Para campos de tipo Number (no fórmula)
 */
const getNumber = (prop) => {
  if (!prop) return null;
  return prop.number || null;
};

/**
 * Para propiedades de tipo Select
 */
const getSelectValue = (prop) => {
  if (!prop) return '';
  return prop.select ? prop.select.name : '';
};

/**
 * Para propiedades de tipo Checkbox
 */
const getCheckbox = (prop) => {
  if (!prop) return false;
  return prop.checkbox || false;
};

/**
 * Para propiedades de tipo Date (no fórmula)
 */
const getDate = (prop) => {
  if (!prop) return null;
  if (prop.date) {
    return prop.date.start;
  }
  return null;
};

/**
 * Para propiedades de tipo URL
 */
const getURL = (prop) => {
  if (!prop) return '';
  return prop.url || '';
};

/**
 * Para propiedades de tipo Person
 * Se asume que se trata de un array de personas y se retorna el nombre (o id) de la primera.
 */
const getPerson = (prop) => {
  if (!prop || !prop.people || prop.people.length === 0) return '';
  return prop.people[0].name || prop.people[0].id;
};

/**
 * Para propiedades de tipo Relation
 * Se retorna un array con los id de los elementos relacionados.
 */
const getRelation = (prop) => {
  if (!prop) return [];
  return prop.relation ? prop.relation.map((rel) => rel.id) : [];
};

/**
 * Para propiedades de tipo Fórmula que retornan Number
 */
const getNumberFromFormula = (prop) => {
  if (!prop) return null;
  if (prop.type === 'formula' && prop.formula.type === 'number') {
    return prop.formula.number;
  }
  return null;
};

/**
 * Para propiedades de tipo Fórmula que retornan String.
 * Esta función extrae la cadena directamente, que es lo que necesitamos para Responsable.
 */
const getTextFromFormula = (prop) => {
  if (!prop) return '';
  if (prop.type === 'formula' && prop.formula.type === 'string') {
    return prop.formula.string;
  }
  return '';
};

/**
 * Para propiedades de tipo Fórmula que retornan Date
 */
const getDateFromFormula = (prop) => {
  if (!prop) return null;
  if (prop.type === 'formula' && prop.formula.type === 'date') {
    return prop.formula.date.start;
  }
  return null;
};

/**
 * Para propiedades que pueden ser Persona o String en fórmula.
 * En este ejemplo, se asume que si es fórmula se retorna el string.
 */
const getPersonOrString = (prop) => {
  if (!prop) return '';
  if (prop.type === 'formula') {
    if (prop.formula.type === 'string') {
      return prop.formula.string;
    }
    return '';
  }
  return '';
};

/* ======================
   Configuración de la API de Notion
   ====================== */
const NOTION_DATABASE_ID = '14e482517a9581cbbfa7e9fc3dd61bae';
const NOTION_API_TOKEN = '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';
const NOTION_API_URL = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

/* ======================
   Función para obtener datos de Notion y guardarlos en MongoDB
   ====================== */
const fetchNotionData = async () => {
  let hasMore = true;
  let nextCursor = null;
  let totalProcessed = 0; // Para llevar un conteo de los registros procesados

  try {
    while (hasMore) {
      console.log(`Iniciando llamada a Notion API con cursor: ${nextCursor || 'none'}`);
      
      // Realizamos la solicitud a la API de Notion
      const response = await axios.post(
        NOTION_API_URL,
        {
          page_size: 100, // Tamaño del lote
          start_cursor: nextCursor || undefined,
          sorts: [
            {
              property: "Fecha correspondiente", // Nombre de la propiedad en Notion
              direction: "descending"           // Orden descendente: del más nuevo al más viejo
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
      console.log(`Recibidos ${results.length} registros desde Notion.`);
      hasMore = has_more;
      nextCursor = next_cursor;

      // Iteramos sobre cada página (registro) obtenido de Notion
      for (const page of results) {
        const pageId = page.id;
        console.log(`Procesando registro con id: ${pageId}`);
        const props = page.properties;

        // Transformamos las propiedades según el tipo esperado.
        // En particular, para "Responsable" usamos getTextFromFormula para extraer la cadena.
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
          "Cash collected": getNumber(props['Cash collected']),
          "Cash collected total": getNumberFromFormula(props['Cash collected total']),
          "CC / Precio": getNumberFromFormula(props['CC / Precio']),
          "Closer Actual": getPersonOrString(props['Closer Actual']),
          "Creado por": getPerson(props['Creado por']),
          Eliminar: getCheckbox(props['Eliminar']),
          Facturacion: getNumberFromFormula(props['Facturacion']),
          "Fecha correspondiente": getDateFromFormula(props['Fecha correspondiente']),
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
            // Extrae el arreglo de relaciones y toma el primer elemento
            const relaciones = getRelation(props['Nombre cliente']);
            return Array.isArray(relaciones) && relaciones.length > 0 ? relaciones[0] : null;
          })(),
          "Ofertas ganadas": getNumberFromFormula(props['Ofertas ganadas']),
          Origen: getSelectValue(props['Origen']),
          Precio: getNumber(props['Precio']),
          "Primer Origen": getTextFromFormula(props['Primer Origen']),
          "Producto Adq": getTextFromFormula(props['Producto Adq']),
          // Aquí se transforma Responsable: se extrae la cadena usando getTextFromFormula
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
        };

        console.log(`Datos transformados para registro ${pageId}:`, transformedData);

        // Guardamos o actualizamos el documento en MongoDB
        await NotionData.findOneAndUpdate(
          { id: pageId },
          transformedData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`Documento actualizado para registro con id: ${pageId}`);
      }

      totalProcessed += results.length;
      console.log(`Se han procesado un total de ${totalProcessed} registros hasta ahora.\n`);
    }

    console.log('Todos los registros han sido procesados.');
  } catch (error) {
    console.error(
      'Error al obtener los datos de Notion:',
      error.response ? error.response.data : error.message
    );
  }
};

// Ejecutar la función para traer los datos de Notion y luego cerrar la conexión
fetchNotionData()
  .then(() => {
    console.log('Importación completada.');
    mongoose.disconnect(); // Cerrar la conexión a MongoDB
  })
  .catch((error) => {
    console.error('Error durante la importación:', error);
    mongoose.disconnect(); // Cerrar la conexión en caso de error
  });
