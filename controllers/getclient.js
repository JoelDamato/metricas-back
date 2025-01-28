const NotionData = require('../models/clientedata.js');

// Controlador para obtener todos los documentos de la colección
exports.getAllData = async (req, res) => {
    try {
        // Obtener todos los documentos
        const data = await NotionData.find();

        // Verificar si se obtuvieron datos
        if (!data || data.length === 0) {
            console.log('No se encontraron datos en la colección.');
            return res.status(404).json({
                message: 'No se encontraron datos en la colección.',
                data: [],
            });
        }

        console.log('Datos obtenidos de MongoDB:', JSON.stringify(data, null, 2));

        // Transformar los datos
        const transformedData = data.map((item) => {
            const transformedProperties = {};

            for (const [key, value] of Object.entries(item.properties)) {
                if (key.trim() === 'Closer') {
                    // Manejar el campo Closer
                    if (Array.isArray(value) && value.length > 0) {
                        transformedProperties[key.trim()] = value[0]?.name?.split(' ')[0]?.toLowerCase() || null;
                        console.log(`Closer extraído: ${transformedProperties[key.trim()]}`);
                    } else {
                        transformedProperties[key.trim()] = null;
                        console.log('Closer no tiene un valor válido.');
                    }
                } else if (key.trim() === 'Setter') {
                    // Manejar el campo Setter
                    if (value?.type === 'people' && Array.isArray(value.people) && value.people.length > 0) {
                        transformedProperties[key.trim()] = value.people[0]?.name?.split(' ')[0]?.toLowerCase() || null;
                        console.log(`Setter extraído: ${transformedProperties[key.trim()]}`);
                    } else {
                        transformedProperties[key.trim()] = null;
                        console.log('Setter no tiene un valor válido.');
                    }
                } else if (key.trim() === 'Fecha de agendamiento') {
                    // Manejar la propiedad "Fecha de agendamiento"
                    if (value?.formula?.type === 'date' && value.formula.date?.start) {
                        transformedProperties[key.trim()] = value.formula.date.start;
                        console.log(`Fecha de agendamiento extraída: ${value.formula.date.start}`);
                    } else {
                        transformedProperties[key.trim()] = null;
                        console.log('Fecha de agendamiento no tiene un valor válido.');
                    }
                } else {
                    // Transformar otros tipos de datos
                    transformedProperties[key.trim()] = value?.formula?.string 
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

        console.log('Datos transformados:', transformedData);

        res.status(200).json({
            message: 'Datos obtenidos y transformados con éxito',
            data: transformedData,
        });
    } catch (error) {
        console.error('Error al transformar los datos:', error);
        res.status(500).json({ error: 'Error al obtener y transformar los datos' });
    }
};
