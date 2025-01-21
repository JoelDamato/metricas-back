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
                if (key === 'Fecha correspondiente' && value?.formula?.date?.start) {
                    // Extraer la fecha del campo formula.date.start
                    transformedProperties[key] = value.formula.date.start;
                } else {
                    // Transformar otros tipos de datos
                    transformedProperties[key] = value?.formula?.string 
                        || value?.formula?.number 
                        || value?.select?.name 
                        || value?.checkbox 
                        || value?.number 
                        || null;
                }
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
