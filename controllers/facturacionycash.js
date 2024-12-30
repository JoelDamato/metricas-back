// controllers/notionController.js
const axios = require('axios');

const getfactt = async (req, res) => {
    try {
        const response = await axios.post(
            `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
            {
                filter: {
                    or: [
                        {
                            property: 'Cash Collected',
                            number: {
                                greater_than: 0
                            }
                        },
                        {
                            property: 'Precio',
                            number: {
                                greater_than: 0
                            }
                        }
                    ]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.NOTION_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            }
        );

        const filteredResults = response.data.results.map(page => ({
            id: page.id,
            interaccion: page.properties['Interaccion']?.title?.[0]?.plain_text ?? '',
            cash_collected: page.properties['Cash Collected']?.number ?? null,
            precio: page.properties['Precio']?.number ?? null,
              closer: page.properties['Closer']?.formula?.string ?? '',
            setter: page.properties['Setter']?.formula?.string ?? '',
            fecha_creada: page.created_time,
            conciliado: page.properties['Conciliado']?.checkbox ?? false,
            origen: page.properties['Ult. Origen']?.formula?.string ?? '',
        }));

        res.json(filteredResults);
    } catch (error) {
        console.error("Error al obtener datos de Notion:", error);
        res.status(500).send('Error al obtener datos de Notion');
    }
};

module.exports = { getfactt};
