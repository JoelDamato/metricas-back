const axios = require('axios');
const mongoose = require('mongoose');
const NotionData = require('../models/notiondata'); // Asegúrate de que este modelo exista


 mongoose.connect('mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('Conectado a MongoDB'))
  .catch((error) => console.error('Error al conectar a MongoDB:', error));

// Variables para la API de Notion
const NOTION_DATABASE_ID = '14e482517a9581cbbfa7e9fc3dd61bae';
const NOTION_API_TOKEN = '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';
const NOTION_API_URL = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

const fetchNotionData = async () => {
    let hasMore = true;
    let nextCursor = null;
    let totalProcessed = 0; // Para llevar un conteo de los registros procesados

    try {
        while (hasMore) {
            // Configuración de la solicitud
            const response = await axios.post(
                NOTION_API_URL,
                { 
                    page_size: 100, // Tamaño de la página
                    start_cursor: nextCursor || undefined,
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

            // Procesar cada resultado y guardarlo en MongoDB
            for (const page of results) {
                const pageId = page.id;
                const properties = page.properties;

                const filteredData = { id: pageId, properties };

                // Guardar o actualizar el documento en MongoDB
                await NotionData.findOneAndUpdate(
                    { id: pageId },
                    filteredData,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }

            totalProcessed += results.length; // Actualizar el contador
            console.log(`Se han procesado ${totalProcessed} registros hasta ahora.`); // Mensaje por cada lote de 100
        }

        console.log('Todos los registros han sido procesados.');
    } catch (error) {
        console.error('Error al obtener los datos de Notion:', error);
    }
};

// Ejecutar la función para traer los datos de Notion
fetchNotionData().then(() => {
    console.log('Importación completada.');
    mongoose.disconnect(); // Cerrar la conexión a MongoDB
}).catch((error) => {
    console.error('Error durante la importación:', error);
    mongoose.disconnect(); // Asegurarse de cerrar la conexión en caso de error
});
