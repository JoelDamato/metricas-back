const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mapeo de closers
const closers = {
  Tu: "f67663b3-b033-4a66-b119-f3c069666caa",
  Sanchez: "13cd872b-594c-81a2-adbf-0002854c4356",
  Alegre: "87876e86-58f2-4b10-8b0a-67b15c55d59b",
  Gaitan: "13cd872b-594c-81e6-9132-000280ded969",
  Randazzo: "14cd872b-594c-81fd-b1b9-0002cf942368",
  Nicolini: "70be794b-9974-4707-aee8-09789b765757"
};

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    console.log("Esperando para evitar duplicaciones...");
    await delay(5000);

    const full_name = body?.full_name || "Sin nombre";
    const email = body?.email || null;
    const phone = body?.phone || null;
    const tags = body?.tags || "";
    const firstName = body?.user?.firstName || "Sin nombre";
    const lastName = body?.user?.lastName || "";
    const instagram = body?.["Instagram o sitio web de tu negocio. (Si no tenés ningúno de los dos escribí NO TENGO)"] || "No completo";

    if (["Herrera", "Gallardo", "Chiapello"].includes(lastName)) {
      console.log("Apellido excluido:", lastName);
      return res.status(200).json({ message: `No se crea nada porque el apellido es ${lastName}.` });
    }

    if (body?.calendar?.calendarName === "Revisión de Avances con Mati") {
      console.log("Revisión de Avances con Mati - ignorado");
      return res.status(200).json({ message: "No se crea nada Revisión de Avances con Mati" });
    }

    const closer = closers[lastName] ? { id: closers[lastName] } : null;

    if (!closer) {
      console.log("Apellido sin closer asignado:", lastName);
      return res.status(200).json({ message: "No se crea el cliente porque no tiene closer asignado." });
    }

    const NOTION_TOKEN = process.env.NOTION_API_KEY;
    const database_id = "14e482517a9581458d4bfefbcde4ea03";

    const normalizePhoneNumber = phone => {
      if (!phone) return "";
      let normalized = phone.replace(/[\s\-\(\)\.]/g, "");
      if (normalized.startsWith("+")) return normalized;
      if (normalized.startsWith("54")) return `+${normalized}`;
      if (normalized.length === 10) return `+54${normalized}`;
      return normalized;
    };

    const searchForClient = async () => {
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) return null;

      try {
        const searchResponse = await axios({
          method: "post",
          url: `https://api.notion.com/v1/databases/${database_id}/query`,
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          data: {
            filter: {
              property: "Telefono",
              phone_number: { equals: normalizedPhone }
            },
            page_size: 1
          },
        });

        return searchResponse.data.results?.[0]?.id || null;

      } catch (err) {
        console.error("Error buscando cliente:", err);
        return null;
      }
    };

    const client_id = await searchForClient();

    // continuar lógica según tu versión...

    res.status(200).json({ message: 'Cliente procesado' });
  } catch (err) {
    console.error("Error general en webhook:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

app.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000');
});
