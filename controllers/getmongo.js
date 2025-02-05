const NotionData = require('../models/notiondata');

exports.getAllData = async (req, res) => {
    try {
        console.time("⏳ Tiempo total");

        console.time("📡 Tiempo consulta MongoDB");
        console.log("🔍 Realizando consulta a MongoDB...");

        // Traer toda la base de datos seleccionando solo los campos necesarios
        const data = await NotionData.find({}, {
            "properties.Responsable": 1,
            "properties.Cash collected total": 1,
            "properties.Venta Meg": 1,
            "properties.Precio": 1,
            "properties.Llamadas aplicables": 1,
            "properties.Llamadas agendadas": 1,
            "properties.Llamadas efectuadas": 1,
            "properties.Origen": 1,
            "properties.Fecha correspondiente": 1, 
            _id: 1
        });

        console.timeEnd("📡 Tiempo consulta MongoDB");
        console.log(`✅ Documentos obtenidos: ${data.length}`);

        console.time("⚙️ Transformación de datos");
        console.log("🔄 Iniciando transformación de datos...");

        const transformedData = data.map(({ _id, properties }) => {
            // Accedemos de forma directa y segura sin demasiadas validaciones anidadas
            const responsable = properties?.["Responsable"]?.formula?.string || "Desconocido";
            const cashCollectedTotal = properties?.["Cash collected total"]?.formula?.number ?? 0;
            const ventaMeg = properties?.["Venta Meg"]?.formula?.number ?? 0;
            const precio = properties?.["Precio"]?.number ?? 0;
            const llamadasAplicables = properties?.["Llamadas aplicables"]?.formula?.number ?? 0;
            const llamadasAgendadas = properties?.["Llamadas agendadas"]?.formula?.number ?? 0;
            const llamadasEfectuadas = properties?.["Llamadas efectuadas"]?.formula?.number ?? 0;
            const origen = properties?.["Origen"]?.select?.name || "Desconocido";
            const fechaCorrespondiente = properties?.["Fecha correspondiente"]?.formula?.date?.start || null; // ✅ Extraer la fecha

            return Object.assign({}, {
                id: _id,
                Responsable: responsable,
                "Cash collected total": cashCollectedTotal,
                "Venta Meg": ventaMeg,
                Precio: precio,
                "Llamadas aplicables": llamadasAplicables,
                "Llamadas agendadas": llamadasAgendadas,
                "Llamadas efectuadas": llamadasEfectuadas,
                Origen: origen,
                "Fecha correspondiente": fechaCorrespondiente // ✅ Agregar al objeto transformado
            });
        });

        console.timeEnd("⚙️ Transformación de datos");
        console.log("✅ Transformación de datos finalizada");

        console.time("🚀 Envío de respuesta");
        res.status(200).json({
            message: 'Datos obtenidos y transformados con éxito',
            totalRecords: transformedData.length,
            data: transformedData,
        });
        console.timeEnd("🚀 Envío de respuesta");

        console.timeEnd("⏳ Tiempo total");

    } catch (error) {
        console.error('❌ Error al obtener los datos:', error);
        res.status(500).json({ error: 'Error al obtener y transformar los datos' });
    }
};
