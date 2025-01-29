const NotionData = require('../models/notiondata');

exports.getAllData = async (req, res) => {
const NotionData = require("../models/notiondata");

exports.getMatiasData = async (req, res) => {
  try {
    console.log("Buscando datos de Matías Randazzo...");

    // Obtener todos los documentos desde MongoDB
    const data = await NotionData.find();

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

    // Filtrar solo los registros donde "Closer Actual" sea Matías Randazzo
    const matiasRecords = transformedData.filter(
      (item) => item["Closer Actual"] === "Matías Randazzo"
    );

    console.log("Registros de Matías Randazzo encontrados:", matiasRecords.length);

    res.status(200).json({
      message: "Datos de Matías Randazzo obtenidos con éxito",
      data: matiasRecords,
    });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).json({ error: "Error al obtener los datos" });
  }
};


    try {
        const { origin, closer } = req.query;
        console.log("Filtros recibidos:", { origin, closer });
        const data = await NotionData.find();

        const transformedData = data.map((item) => {
            const transformedProperties = {};
            for (const [key, value] of Object.entries(item.properties)) {
                if (key === 'Fecha correspondiente' && value?.formula?.date?.start) {
                    transformedProperties[key] = value.formula.date.start;
                } else if (key === 'Nombre cliente' && value?.relation?.[0]?.id) {
                    transformedProperties[key] = value.relation[0].id;
                } else {
                    transformedProperties[key] = value?.formula?.string 
                        || value?.formula?.number 
                        || value?.select?.name 
                        || value?.checkbox 
                        || value?.number 
                        || null;
                }
            }

            return {
                id: item.id,
                ...transformedProperties,
            };
        });

        const filteredData = transformedData.filter((item) => {
            const matchesOrigin = origin ? item['Origen'] === origin : true;
            const matchesCloser = closer ? item['Closer Actual'] === closer : true;
            return matchesOrigin && matchesCloser;
        });
        console.log("Datos filtrados:", filteredData);
        const groupedData = filteredData.reduce((acc, item) => {
            const date = new Date(item['Fecha correspondiente']);
            if (isNaN(date)) return acc;
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!acc[yearMonth]) {
                acc[yearMonth] = {
                    llamadasAgendadas: 0,
                    llamadasAplicables: 0,
                    llamadasEfectuadas: 0,
                    llamadasVendidas: 0,
                };
            }

            acc[yearMonth].llamadasAgendadas += item['Llamadas agendadas'] || 0;
            acc[yearMonth].llamadasAplicables += item['Llamadas aplicables'] || 0;
            acc[yearMonth].llamadasEfectuadas += item['Llamadas efectuadas'] || 0;
            acc[yearMonth].llamadasVendidas +=
                !isNaN(Number(item['Venta Meg'])) ? Number(item['Venta Meg']) : 0;

            return acc;
        }, {});

        // Extraer valores únicos de Origen y Closer Actual
        const uniqueOrigins = [...new Set(transformedData.map((item) => item['Origen']).filter(Boolean))];
        const uniqueClosers = [...new Set(transformedData.map((item) => item['Closer Actual']).filter(Boolean))];

        res.status(200).json({
            message: 'Datos obtenidos, filtrados, transformados y agrupados con éxito',
            data: groupedData,
            origins: uniqueOrigins,
            closers: uniqueClosers,
        });
    } catch (error) {
        console.error('Error al transformar y agrupar los datos:', error);
        res.status(500).json({ error: 'Error al obtener y transformar los datos' });
    }
};
