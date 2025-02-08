// controllers/webhookController.js

const NotionData = require('../models/metricasdata');

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
 * Para propiedades de tipo Person (retorna el nombre o id de la primera persona)
 */
const getPerson = (prop) => {
  if (!prop || !prop.people || prop.people.length === 0) return '';
  return prop.people[0].name || prop.people[0].id;
};

/**
 * Para propiedades de tipo Relation (retorna un array con los id de los elementos relacionados)
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
 * Para propiedades de tipo Fórmula que retornan String
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

/**
 * Normaliza el formato del ID de Notion.
 * Si el ID viene sin guiones (32 caracteres), lo formatea insertando guiones en el patrón 8-4-4-4-12.
 */
const formatNotionId = (id) => {
  if (!id) return id;
  // Si ya contiene guiones, retornar tal cual
  if (id.includes('-')) return id;
  // Si tiene 32 caracteres sin guiones, insertarlos
  if (id.length === 32) {
    return id.replace(
      /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/,
      '$1-$2-$3-$4-$5'
    );
  }
  return id;
};

/* ======================
   Controlador para manejar el webhook de Notion
   ====================== */
exports.handleWebhook = async (req, res) => {
  try {
    console.log("=====================================");
    console.log("Webhook recibido:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=====================================");

    // Extraer datos del payload
    const { data } = req.body;
    if (!data || !data.id || !data.properties) {
      console.error("Datos inválidos o incompletos en la solicitud:", req.body);
      return res.status(400).json({ error: 'Datos inválidos o incompletos en la solicitud' });
    }
    
    const pageId = data.id;
    // Normalizamos el ID para que tenga guiones (ya que en Mongo se almacena con guiones)
    const normalizedPageId = formatNotionId(pageId);
    const props = data.properties;
    console.log(`Procesando página de Notion con ID: ${normalizedPageId}`);

    // Si la propiedad "Eliminar" existe y está marcada en true, se procede a borrar el documento
    if (props.Eliminar && props.Eliminar.type === 'checkbox' && props.Eliminar.checkbox === true) {
      console.log(`La propiedad "Eliminar" está en true. Se eliminará el documento con ID: ${normalizedPageId}`);
      
      const deletedDocument = await NotionData.findOneAndDelete({ id: normalizedPageId });
      if (deletedDocument) {
        console.log("Documento eliminado correctamente:", deletedDocument);
        return res.status(200).json({
          message: 'Documento eliminado con éxito',
          operation: 'eliminado',
          data: deletedDocument
        });
      } else {
        console.warn(`No se encontró documento con ID: ${normalizedPageId} para eliminar.`);
        return res.status(404).json({
          error: 'Documento no encontrado para eliminar'
        });
      }
    }

    // Transformar todas las propiedades recibidas para que queden con la estructura esperada
    console.log(`Transformando propiedades para el registro con ID: ${normalizedPageId}`);
    const transformedData = {
      id: normalizedPageId,
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
        const relaciones = getRelation(props['Nombre cliente']);
        return Array.isArray(relaciones) && relaciones.length > 0 ? relaciones[0] : null;
      })(),
      "Ofertas ganadas": getNumberFromFormula(props['Ofertas ganadas']),
      Origen: getSelectValue(props['Origen']),
      Precio: getNumber(props['Precio']),
      "Primer Origen": getTextFromFormula(props['Primer Origen']),
      "Producto Adq": getTextFromFormula(props['Producto Adq']),
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

    console.log("Datos transformados:", JSON.stringify(transformedData, null, 2));

    // Verificar si existe un documento con el mismo id en la base de datos
    const existingDocument = await NotionData.findOne({ id: normalizedPageId });
    const operationType = existingDocument ? 'actualizado' : 'creado';
    console.log(`Documento ${existingDocument ? "encontrado" : "no encontrado"} para ID ${normalizedPageId}. Se procederá a ${operationType}.`);

    // Crear o actualizar el documento en MongoDB
    const updatedOrCreatedData = await NotionData.findOneAndUpdate(
      { id: normalizedPageId },
      transformedData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Documento ${operationType}:`, updatedOrCreatedData);

    return res.status(200).json({
      message: `Datos ${operationType} con éxito`,
      operation: operationType,
      data: updatedOrCreatedData
    });
  } catch (error) {
    console.error("Error al procesar los datos:", error);
    return res.status(500).json({ error: "Error al procesar los datos" });
  }
};
