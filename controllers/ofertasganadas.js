// notionController.js (o el nombre que quieras darle)

// Requerimos axios para hacer la petición a la API de Notion
const axios = require("axios");

/**
 * Función interna para "acomodar" las propiedades de una página Notion.
 * Recibe un objeto "page" tal como lo devuelve Notion y retorna un objeto plano.
 */
function transformProperties(page) {
  const { properties } = page;

  const transformed = Object.entries(properties).reduce((acc, [key, value]) => {
    switch (value.type) {
      case "title":
        // Un array de texto en "value.title"
        acc[key] = value.title?.map((t) => t.plain_text).join(" ") ?? null;
        break;

      case "rich_text":
        acc[key] = value.rich_text?.map((t) => t.plain_text).join(" ") ?? null;
        break;

      case "select":
        // "select" es un objeto { id, name, color }
        acc[key] = value.select?.name ?? null;
        break;

      case "multi_select":
        // "multi_select" es un array de { id, name, color }
        acc[key] = value.multi_select?.map((ms) => ms.name) ?? [];
        break;

      case "date":
        // "date" => { start, end, time_zone }
        acc[key] = value.date?.start ?? null;
        break;

        
      case "checkbox":
        acc[key] = value.checkbox ?? false;
        break;

      case "number":
        acc[key] = value.number ?? 0;
        break;

      case "url":
        acc[key] = value.url ?? null;
        break;

      case "email":
        acc[key] = value.email ?? null;
        break;

      case "phone_number":
        acc[key] = value.phone_number ?? null;
        break;

      case "formula":
        // "formula" => { type: "string"|"number"|"date"|"boolean", ... }
        if (value.formula?.type === "string") {
          acc[key] = value.formula.string ?? "";
        } else if (value.formula?.type === "number") {
          acc[key] = value.formula.number ?? 0;
        } else if (value.formula?.type === "boolean") {
          acc[key] = value.formula.boolean ?? false;
        } else if (value.formula?.type === "date") {
          acc[key] = value.formula.date?.start ?? null;
        } else {
          acc[key] = null;
        }
        break;

      case "relation":
        // Un array de { id: '...' }
        acc[key] = value.relation?.map((rel) => rel.id) ?? [];
        break;

      case "created_time":
        // Simple string con fecha
        acc[key] = value.created_time ?? null;
        break;

      case "last_edited_time":
        acc[key] = value.last_edited_time ?? null;
        break;

      // Agrega más casos si usas otros tipos (people, files, rollup, etc.)
      default:
        // Para tipos no contemplados
        acc[key] = null;
    }

    return acc;
  }, {});

  // Retornamos un objeto con `id` + las propiedades transformadas
  return {
    id: page.id,
    ...transformed,
  };
}

/**
 * Controlador para obtener datos de Notion y devolverlos "acomodados".
 * Llama a la API con un POST a /v1/databases/{ID}/query.
 */
const getCallsDatas = async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
      }
    );

    // Extraemos y transformamos cada "page"
    const transformedResults = response.data.results.map((page) => {
      return transformProperties(page);
    });

    // Respondemos con el array de objetos transformados
    res.json(transformedResults);
  } catch (error) {
    console.error(
      "Error al obtener datos de Notion:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Error al obtener datos de Notion" });
  }
};

// Exportamos la función de controlador
module.exports = { getCallsDatas };
