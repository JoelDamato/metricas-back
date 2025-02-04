const NotionData = require("../models/notiondata");

exports.getAllData = async (req, res) => {
    try {
        // Capturar los filtros desde la consulta
        const { origin, closer } = req.query;
        console.log("Filtros recibidos:", { origin, closer });

        // Obtener todos los datos desde MongoDB
        const data = await NotionData.find();

        if (!data || data.length === 0) {
            return res.status(404).json({ message: "No se encontraron datos." });
        }

        // Transformar los datos en un formato más manejable
        const transformedData = data.map((item) => {
            const transformedProperties = {};
            for (const [key, value] of Object.entries(item.properties)) {
                if (key === "Fecha correspondiente" && value?.formula?.date?.start) {
                    transformedProperties[key] = value.formula.date.start;
                } else if (key === "Nombre cliente" && value?.relation?.[0]?.id) {
                    transformedProperties[key] = value.relation[0].id;
                } else {
                    transformedProperties[key] =
                        value?.formula?.string ||
                        value?.formula?.number ||
                        value?.select?.name ||
                        value?.checkbox ||
                        value?.number ||
                        null;
                }
            }

            return {
                id: item.id,
                ...transformedProperties,
            };
        });

        // Aplicar filtros
        const filteredData = transformedData.filter((item) => {
            const matchesOrigin = origin ? item["Origen"] === origin : true;
            const matchesCloser = closer ? item["Responsable"] === closer : true;
            return matchesOrigin && matchesCloser;
        });

        console.log("Datos filtrados:", filteredData.length);

        // Agrupar los datos por mes
        const groupedData = filteredData.reduce((acc, item) => {
            const date = new Date(item["Fecha correspondiente"]);
            if (isNaN(date)) return acc; // Ignorar si la fecha no es válida

            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

            if (!acc[yearMonth]) {
                acc[yearMonth] = {
                    llamadasAgendadas: 0,
                    llamadasAplicables: 0,
                    llamadasEfectuadas: 0,
                    llamadasVendidas: 0,
                };
            }

            acc[yearMonth].llamadasAgendadas += item["Llamadas agendadas"] || 0;
            acc[yearMonth].llamadasAplicables += item["Llamadas aplicables"] || 0;
            acc[yearMonth].llamadasEfectuadas += item["Llamadas efectuadas"] || 0;
            acc[yearMonth].llamadasVendidas += !isNaN(Number(item["Venta Meg"])) ? Number(item["Venta Meg"]) : 0;

            return acc;
        }, {});

        // Extraer valores únicos de `Origen` y `Closer Actual`
        const uniqueOrigins = [...new Set(filteredData.map((item) => item["Origen"]).filter(Boolean))];
        const uniqueClosers = [...new Set(filteredData.map((item) => item["Responsable"]).filter(Boolean))];

        // Responder con los datos agrupados y filtrados
        res.status(200).json({
            message: "Datos obtenidos, filtrados y agrupados con éxito",
            data: groupedData,
            origins: uniqueOrigins,
            closers: uniqueClosers,
        });
    } catch (error) {
        console.error("Error al obtener y transformar los datos:", error);
        res.status(500).json({ error: "Error al obtener y transformar los datos" });
    }
};

