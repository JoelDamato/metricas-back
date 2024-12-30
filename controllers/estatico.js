// controllers/notionController.js
const axios = require('axios');

const getInteractionsData = async (req, res) => {
    try {
        const response = await axios.post(
            'https://api.notion.com/v1/databases/128032a62365817cb2aef2c4c2b20179/query',
            {}, // Se eliminan los filtros para traer todos los datos de la base de datos
            {
                headers: {
                    'Authorization': `Bearer ${process.env.NOTION_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            }
        );

        // Agregar log para ver la respuesta completa de Notion
        console.log("Respuesta de Notion Interactions:", JSON.stringify(response.data, null, 2));

        const filteredResults = response.data.results.map(page => ({
            id: page.id,
            fecha_creada: page.created_time,
            total_nuevas_conversaciones: page.properties['Total nuevas conversaciones']?.formula?.number ?? 0,
            respuestas_primer_contacto: page.properties['Respuestas a primer contacto']?.formula?.number ?? 0,
            seguimiento_con_respuesta: page.properties['Seguimiento con respuesta']?.formula?.number ?? 0,
            link_enviado: page.properties['Link enviado']?.formula?.string ?? '',
            agendamiento: page.properties['Agendamiento']?.formula?.number ?? 0,
            aplica: page.properties['Aplica']?.formula?.string ?? '',
        }));

        res.json(filteredResults);
    } catch (error) {
        console.error("Error al obtener datos de Notion Interactions:", error?.response?.data || error);
        res.status(500).send('Error al obtener datos de Notion Interactions');
    }
};

module.exports = { getInteractionsData };
