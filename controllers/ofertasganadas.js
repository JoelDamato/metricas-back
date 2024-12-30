const axios = require('axios');

// Función para transformar las propiedades
const transformProperties = (page) => {
    const properties = page.properties;

    const transformed = Object.entries(properties).reduce((acc, [key, value]) => {
        if (value.type === 'formula') {
            acc[key] = value.formula?.number ?? value.formula?.string ?? value.formula?.date ?? null;
        } else if (value.type === 'select') {
            acc[key] = value.select?.name ?? null;
        } else if (value.type === 'multi_select') {
            acc[key] = value.multi_select?.map(option => option.name) ?? [];
        } else if (value.type === 'relation') {
            acc[key] = value.relation?.map(relation => relation.id) ?? [];
        } else if (value.type === 'created_time') {
            acc[key] = value.created_time ?? null;
        } else if (value.type === 'date') {
            acc[key] = value.date?.start ?? null;
        } else if (value.type === 'number') {
            acc[key] = value.number ?? null;
        } else if (value.type === 'rich_text') {
            acc[key] = value.rich_text?.map(text => text.plain_text).join(' ') ?? null;
        } else if (value.type === 'title') {
            acc[key] = value.title?.map(text => text.plain_text).join(' ') ?? null;
        } else if (value.type === 'checkbox') {
            acc[key] = value.checkbox ?? false;
        } else if (value.type === 'url') {
            acc[key] = value.url ?? null;
        } else if (value.type === 'email') {
            acc[key] = value.email ?? null;
        } else if (value.type === 'phone_number') {
            acc[key] = value.phone_number ?? null;
        } else {
            // Para cualquier tipo no contemplado
            acc[key] = null;
        }
        return acc;
    }, {});

    return {
        id: page.id,
        ...transformed,
    };
};

// Controlador principal
const getCallsDatas = async (req, res) => {
    try {
        const response = await axios.post(
            `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
            {}, // Consulta vacía
            {
                headers: {
                    Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            }
        );

        // Transformar los resultados para que sean más fáciles de usar en el front
        const transformedResults = response.data.results.map(transformProperties);

        res.json(transformedResults);
    } catch (error) {
        console.error("Error al obtener datos de Notion:", error.response?.data || error.message);
        res.status(500).send('Error al obtener datos de Notion');
    }
};

module.exports = { getCallsDatas };
