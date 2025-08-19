const axios = require('axios');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const closers = {
  Tu: "f67663b3-b033-4a66-b119-f3c069666caa",
  Sanchez: "13cd872b-594c-81a2-adbf-0002854c4356",
  Alegre: "87876e86-58f2-4b10-8b0a-67b15c55d59b",
  Gaitan: "13cd872b-594c-81e6-9132-000280ded969",
  Randazzo: "14cd872b-594c-81fd-b1b9-0002cf942368",
  Nicolini: "70be794b-9974-4707-aee8-09789b765757"
};

const handleWebhook = async (req, res) => {
  try {
    await delay(5000);

    const body = req.body;
    const full_name = body?.full_name || "Sin nombre";
    const email = body?.email || null;
    const phone = body?.phone || null;
    const tags = body?.tags || "";
    const firstName = body?.user?.firstName || "Sin nombre";
    const lastName = body?.user?.lastName || "";
    const instagram = body?.["Instagram o sitio web de tu negocio. (Si no tenés ningúno de los dos escribí NO TENGO)"] || "No completo";
    let updatedDate = null;
    if (body?.calendar?.startTime) {
      const originalDate = new Date(body.calendar.startTime);
      updatedDate = new Date(originalDate);
      updatedDate.setHours(originalDate.getHours() + 3);
    }

    if (["Herrera", "Gallardo", "Chiapello"].includes(lastName)) {
      return res.status(200).json({ message: `No se crea nada porque el apellido es ${lastName}.` });
    }
    if (body?.calendar?.calendarName === "Revisión de Avances con Mati") {
      return res.status(200).json({ message: "No se crea nada Revisión de Avances con Mati" });
    }

    const closer = closers[lastName] ? { id: closers[lastName] } : null;
    if (!closer) {
      return res.status(200).json({ message: "No se crea el cliente porque no tiene closer asignado por apellido." });
    }

    const NOTION_TOKEN = process.env.NOTION_API_KEY;
    const database_id = "14e482517a9581458d4bfefbcde4ea03";
    const interacciones_database_id = "14e482517a9581cbbfa7e9fc3dd61bae";

    const normalizePhoneNumber = phone => {
      if (!phone) return "";
      let normalized = phone.replace(/[\s\-\(\)\.]/g, "");
      if (normalized.startsWith("+")) return normalized;
      if (normalized.startsWith("54") && normalized.length > 10) return `+${normalized}`;
      if (normalized.length === 10 && /^\d{10}$/.test(normalized)) return `+54${normalized}`;
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
        if (searchResponse.data.results && searchResponse.data.results.length > 0) {
          return searchResponse.data.results[0].id;
        }
        return null;
      } catch (error) {
        return null;
      }
    };

    const updateClientFields = async (clientId, newPhone, closerId) => {
      try {
        const data = {
          properties: {
            ...(newPhone && { "Telefono": { phone_number: newPhone } }),
            "Closer": { people: [{ id: closerId }] },
            "Setter": { people: [] },
          },
        };
        await axios({
          method: "patch",
          url: `https://api.notion.com/v1/pages/${clientId}`,
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          data,
        });
      } catch (error) {}
    };

    let client_id = await searchForClient();

    if (client_id) {
      const clientDetails = await axios({
        method: "get",
        url: `https://api.notion.com/v1/pages/${client_id}`,
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
        },
      });
      const existingPhone = clientDetails.data?.properties?.Telefono?.phone_number || null;
      if (!existingPhone && phone) {
        await updateClientFields(client_id, phone, closer?.id);
      } else {
        await updateClientFields(client_id, null, closer?.id);
      }
    }

    if (!client_id && full_name && phone) {
      try {
        const clientResponse = await axios({
          method: "post",
          url: `https://api.notion.com/v1/pages`,
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": `2022-06-28`,
            "Content-Type": "application/json",
          },
          data: {
            parent: { database_id },
            properties: {
              "Nombre": {
                title: [{ text: { content: full_name } }],
              },
              "Instagram": {
                rich_text: [{ text: { content: instagram } }],
              },
              ...(email && { "Mail": { email: email } }),
              ...(phone && { "Telefono": { phone_number: phone } }),
              "Closer": { people: [{ id: closer.id }] },
              "Setter": { people: [] },
            },
          },
        });
        client_id = clientResponse.data?.id;
        if (!client_id) {
          await delay(500);
          client_id = await searchForClient();
        }
        if (!client_id) {
          return res.status(500).json({ error: "No se pudo obtener el ID del cliente recién creado." });
        }
      } catch (error) {
        return res.status(500).json({ error: "Error al crear el cliente." });
      }
    } else if (!client_id) {
      return res.status(400).json({ error: "Faltan datos suficientes para crear un nuevo cliente." });
    }

    // Crear interacción de agendamiento
    try {
      const interactionSearchResponse = await axios({
        method: "post",
        url: `https://api.notion.com/v1/databases/${interacciones_database_id}/query`,
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": `2022-06-28`,
          "Content-Type": "application/json",
        },
        data: {
          filter: {
            and: [
              { property: "Nombre cliente", relation: { contains: client_id } },
              { property: "Agendamiento", checkbox: { equals: true } },
            ],
          },
        },
      });

      if (interactionSearchResponse.data.results && interactionSearchResponse.data.results.length === 0) {
        await axios({
          method: "post",
          url: `https://api.notion.com/v1/pages`,
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": `2022-06-28`,
            "Content-Type": "application/json",
          },
          data: {
            parent: { database_id: interacciones_database_id },
            properties: {
              "Interaccion": {
                title: [{ text: { content: `Agendamiento de ${full_name || "Sin nombre"}` } }],
              },
              "Canal": { select: { name: "GHL" } },
              "Tipo contacto": { select: { name: "Generado por usuario" } },
              "Estado interaccion": { select: { name: "Finalizada" } },
              "Nombre cliente": { relation: [{ id: client_id }] },
              "Closer Actual": { people: [{ id: closer.id }] },
              "Setter": { people: [] },
              "Agendamiento": { checkbox: true },
              ...(updatedDate && {
                "Proximo contacto Closer / Setter": {
                  date: { start: updatedDate.toISOString() },
                },
              }),
              ...(body?.contact_source
                ? {
                    "Origen": {
                      select: {
                        name: body.contact_source,
                      },
                    },
                  }
                : body?.calendar?.calendarName
                ? {
                    "Origen": {
                      select: {
                        name: body.calendar.calendarName,
                      },
                    },
                  }
                : {}),
              "Respuesta": {
                select: {
                  name: "Respondio",
                },
              },
              "Call?": {
                rich_text: [
                  {
                    text: {
                      content: body["(5) Un miembro de nuestro equipo se pondrá en contacto con vos por WhatsApp, te comprometés a responder los mensajes? (Si no respondés los mensajes, la llamada se cancelará automaticamente)"] || "Sin información",
                    },
                  },
                ],
              },
              "Producto de interes": {
                multi_select: [
                  {
                    name: body?.["Producto de interés"] || "MEG",
                  },
                ],
              },
              "Sistema Facturacion": {
                rich_text: [
                  {
                    text: {
                      content: body["¿Contás con un sistema de gestión en tu empresa?"] || "Sin información",
                    },
                  },
                ],
              },
              "Modelo de negocio": {
                rich_text: [
                  {
                    text: {
                      content: body["¿Cuál es tu modelo de negocio?"] || "Sin información",
                    },
                  },
                ],
              },
              "Observaciones": {
                rich_text: [
                  {
                    text: {
                      content: body["Contame más sobre tu negocio: ¿Que crees que deberías mejorar en tus finanzas para que tu empresa sea más rentable? "] || "Sin observaciones",
                    },
                  },
                ],
              },
              "Aplica?": {
                select: {
                  name: "Aplica",
                },
              },
              "Facturacion promedio": {
                select: {
                  name: body["¿Cuál es el nivel de facturación promedio mensual en dólares de la empresa?"] || body["¿Cuál es tu nivel de facturación promedio mensual en dólares?"] || "No especificado",
                },
              },
              "Score": {
                number: Number(body["Score "]) || 0
              },
              "Inversion?": {
                rich_text: [
                  {
                    text: {
                      content: body["En caso de que podamos ayudarte ¿Estas dispuesto a invertir para profesionalizar tus números e incrementar tu rentabilidad? "] || body["El Método Acelerador de Ganancias ofrece distintos niveles de acompañamiento. ¿Estás dispuesto a invertir para profesionalizar tus números e incrementar tu rentabilidad?"] || "Sin respuesta",
                    },
                  },
                ],
              },
              "Adname": {
                rich_text: [
                  {
                    text: {
                      content: body.adname || body["El Método Acelerador de Ganancias ofrece distintos niveles de acompañamiento. ¿Estás dispuesto a invertir para profesionalizar tus números e incrementar tu rentabilidad?"] || "NO ES VSL",
                    },
                  },
                ],
              },
            },
          },
        });
      }
      return res.status(200).json({ message: "Cliente procesado correctamente." });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = { handleWebhook };