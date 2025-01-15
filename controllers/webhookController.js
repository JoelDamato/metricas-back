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

        // Crear un objeto con el ID y las propiedades
        const filteredData = { id: pageId, properties };

        // Buscar el documento por su ID y actualizarlo, o crear uno nuevo si no existe
        const updatedOrCreatedData = await NotionData.findOneAndUpdate(
            { id: pageId }, // Criterio de búsqueda
            filteredData, // Datos a guardar
            { upsert: true, new: true, setDefaultsOnInsert: true } // Opciones
        );

        console.log('Documento procesado:', updatedOrCreatedData);

        res.status(200).json({
            message: 'Datos procesados con éxito',
            data: updatedOrCreatedData
        });
    } catch (error) {
        console.error('Error al procesar los datos:', error);
        res.status(500).json({ error: 'Error al procesar los datos' });
    }
};
