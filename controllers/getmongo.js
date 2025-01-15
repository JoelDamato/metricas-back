const NotionData = require('../models/notiondata');

// Controlador para obtener todos los documentos de la colección
exports.getAllData = async (req, res) => {
    try {
        // Obtener todos los documentos
        const data = await NotionData.find();

        // Transformar los datos
        const transformedData = data.map((item) => {
            // Construir un nuevo objeto con la estructura deseada
            const transformedProperties = {};
            for (const [key, value] of Object.entries(item.properties)) {
                transformedProperties[key] = value?.formula?.string || value?.formula?.number || value?.select?.name || value?.checkbox || value?.number || null;
            }

            return {
                id: item.id, // Mantener el ID
                ...transformedProperties, // Agregar las propiedades transformadas
            };
        });

        res.status(200).json({
            message: 'Datos obtenidos y transformados con éxito',
            data: transformedData,
        });
    } catch (error) {
        console.error('Error al transformar los datos:', error);
        res.status(500).json({ error: 'Error al obtener y transformar los datos' });
    }
};


// Controlador para obtener un documento por ID
exports.getDataById = async (req, res) => {
    try {
        // Obtener el ID de los parámetros de la solicitud
        const { id } = req.params;

        // Buscar el documento por su ID
        const document = await NotionData.findOne({ id });

        // Si no se encuentra el documento, responder con un error
        if (!document) {
            return res.status(404).json({ message: `No se encontró un documento con el ID: ${id}` });
        }

        // Responder con el documento encontrado
        res.status(200).json({
            message: 'Documento encontrado con éxito',
            data: document,
        });
    } catch (error) {
        console.error('Error al obtener el documento:', error);
        res.status(500).json({ error: 'Error al obtener el documento' });
    }
};
