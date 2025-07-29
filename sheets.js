require("dotenv").config();
const axios = require("axios");

const NOTION_API = `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`;
const NOTION_VERSION = "2022-06-28";

function formatPage(page) {
  return {
    data: {
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url,
      properties: page.properties,
      source: {
        automation_id: process.env.AUTOMATION_ID
      },
      object: "page"
    }
  };
}

async function syncPagesToWebhook() {
  let hasMore = true;
  let nextCursor = undefined;
  let count = 0;

  console.log("🚀 Iniciando sincronización con Notion y Google Sheets...\n");

  while (hasMore) {
    const response = await axios.post(
      NOTION_API,
      { start_cursor: nextCursor },
      {
        headers: {
          Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
      }
    );

    const pages = response.data.results;

    for (const page of pages) {
      const payload = formatPage(page);

      try {
        const res = await axios.post(process.env.GOOGLE_SCRIPT_WEBHOOK, payload, {
          headers: { "Content-Type": "application/json" },
        });

        count++;
        console.log(`✅ [${count}] Enviado ${page.id} | ${res.data.message || "OK"}`);
      } catch (err) {
        console.error(`❌ Error al enviar ${page.id}:`, err.response?.data || err.message);
      }
    }

    hasMore = response.data.has_more;
    nextCursor = response.data.next_cursor;
  }

  console.log(`\n🎉 Sincronización finalizada. Total de páginas enviadas: ${count}`);
}

syncPagesToWebhook().catch((err) => {
  console.error("❌ Error crítico:", err.message);
});
