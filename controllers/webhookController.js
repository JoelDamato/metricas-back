const NotionData = require('../models/notiondata');

// Controlador para manejar el webhook
exports.handleWebhook = async (req, res) => {
    try {
        // Filtrar solo las propiedades de Notion
        const { properties } = req.body.data || {};

        if (!properties) {
            return res.status(400).json({ error: 'No se encontraron propiedades en los datos recibidos' });
        }

        // Crear un nuevo documento con las propiedades filtradas
        const newData = new NotionData(properties);

        // Guardar en la base de datos
        await newData.save();

        console.log('Datos recibidos y guardados:', properties);
        res.status(200).json({ message: 'Datos guardados con éxito' });
    } catch (error) {
        console.error('Error al guardar los datos:', error);
        res.status(500).json({ error: 'Error al guardar los datos' });
    }
};
