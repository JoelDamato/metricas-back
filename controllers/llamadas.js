const axios = require('axios');

const getCallsData = async (req, res) => {
    try {
        const response = await axios.post(
            `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
            {
                filter: {
                    or: [
                        { property: 'Llamadas agendadas', formula: { number: { greater_than: 0 } } },
                        { property: 'Llamadas aplicables', formula: { number: { greater_than: 0 } } },
                        { property: 'Llamadas efectuadas', formula: { number: { greater_than: 0 } } },
                        { property: 'Llamadas no efectuadas', formula: { number: { greater_than: 0 } } },
                        { property: 'Llamadas vendidas', formula: { number: { greater_than: 0 } } }
                    ]
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            }
        );

        const filteredResults = response.data.results.map(page => {
            console.log("Propiedades de la página:", JSON.stringify(page.properties, null, 2)); // Depuración

            const properties = page.properties;
            return {
                id: page.id,
                fecha_creada: page.created_time,
                venta_club: properties['Venta Club']?.formula?.number ?? null,
                venta_meg: properties['Venta Meg']?.formula?.number ?? null,
                closer: properties['Closer']?.formula?.string ?? '',
                setter: properties['Setter']?.formula?.string ?? '',
                origen: properties['Ult. Origen']?.formula?.string ?? '',
                producto_vendido: properties['Producto vendido']?.multi_select?.map(option => option.name) ?? [],
                llamadas_agendadas: properties['Llamadas agendadas']?.formula?.number ?? 0,
                llamadas_aplicables: properties['Llamadas aplicables']?.formula?.number ?? 0,
                llamadas_efectuadas: properties['Llamadas efectuadas']?.formula?.number ?? 0,
                llamadas_no_efectuadas: properties['Llamadas no efectuadas']?.formula?.number ?? 0,
                llamadas_vendidas: properties['Llamadas vendidas']?.formula?.number ?? 0
            };
        });

        res.json(filteredResults);
    } catch (error) {
        console.error("Error al obtener datos de Notion:", error.response?.data || error.message);
        res.status(500).send('Error al obtener datos de Notion');
    }
};

module.exports = { getCallsData };
