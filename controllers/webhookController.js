const NotionData = require('../models/notiondata');

// Controlador para manejar el webhook
exports.handleWebhook = async (req, res) => {
  try {
    // Extraer datos de la solicitud
    const { data } = req.body;

    // Validar que el dato contenga un ID y propiedades
    if (!data || !data.id || !data.properties) {
      return res.status(400).json({ error: 'Datos inválidos o incompletos en la solicitud' });
    }

    const pageId = data.id; // ID único de la página en Notion
    const properties = data.properties; // Propiedades dinámicas de la página

    // Verificar si la propiedad ELIMINAR existe y está marcada como true
    if (properties.ELIMINAR && properties.ELIMINAR.type === 'checkbox' && properties.ELIMINAR.checkbox === true) {
      console.log(`Eliminando el documento con nombreCliente: ${pageId}`);
      
      // Eliminar el documento usando el campo 'nombreCliente'
      const deletedDocument = await NotionData.findOneAndDelete({ nombreCliente: pageId });

      if (deletedDocument) {
        console.log(`Documento eliminado:`, deletedDocument);
        return res.status(200).json({
          message: 'Documento eliminado con éxito',
          operation: 'eliminado',
          data: deletedDocument
        });
      } else {
        console.log(`No se encontró un documento con nombreCliente: ${pageId} para eliminar.`);
        return res.status(404).json({
          error: 'Documento no encontrado para eliminar'
        });
      }
    }

    // Crear un objeto con el campo 'nombreCliente' y las propiedades
    const filteredData = { nombreCliente: pageId, properties };

    console.log('Buscando el documento en la base de datos con nombreCliente:', pageId);

    // Buscar el documento usando 'nombreCliente'
    const existingDocument = await NotionData.findOne({ nombreCliente: pageId });

    let operationType = 'actualizado'; // Por defecto, se asume que es una actualización

    // Si no existe el documento, se creará uno nuevo
    if (!existingDocument) {
      operationType = 'creado';
    }

    // Actualizar o crear el documento en la base de datos
    const updatedOrCreatedData = await NotionData.findOneAndUpdate(
      { nombreCliente: pageId },
      filteredData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Documento ${operationType}:`, updatedOrCreatedData);

    // Responder con la operación realizada y los datos procesados
    res.status(200).json({
      message: `Datos ${operationType} con éxito`,
      operation: operationType,
      data: updatedOrCreatedData
    });
  } catch (error) {
    console.error('Error al procesar los datos:', error);
    res.status(500).json({ error: 'Error al procesar los datos' });
  }
};
