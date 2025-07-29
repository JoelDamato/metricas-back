// controllers/resumen.js
const Metricas = require('../models/metricasdata');

exports.getVentasAgrupadas = async (req, res) => {
  try {
    const { closer = "all", origin = "all", month } = req.query;

    if (!month) {
      return res.status(400).json({ error: "Se requiere el parámetro 'month'" });
    }

    const filtros = {
      "Venta Meg": { $gt: 0 },
      "Nombre cliente": { $ne: null },
      "Fecha correspondiente": { $ne: null }
    };

    if (closer !== "all") filtros["Responsable"] = closer;
    if (origin !== "all") filtros["Origen"] = origin;

    const ventas = await Metricas.find(filtros, {
      "Nombre cliente": 1,
      "Venta Meg": 1,
      "Fecha correspondiente": 1,
      "Agenda": 1,
    }).lean();

    // 1. Mapear fecha de agendamiento más antigua por cliente
    const fechasAgendamiento = {};
    ventas.forEach(item => {
      if (item.Agenda === 1 && item["Fecha correspondiente"]) {
        const clienteId = item["Nombre cliente"];
        const fecha = new Date(item["Fecha correspondiente"]);
        if (!fechasAgendamiento[clienteId] || fecha < fechasAgendamiento[clienteId]) {
          fechasAgendamiento[clienteId] = fecha;
        }
      }
    });

    // 2. Filtrar solo ventas con Fecha correspondiente que coincida con el mes solicitado
    const ventasDelMes = ventas.filter(item => {
      const fechaVenta = new Date(item["Fecha correspondiente"]);
      const ventaMonth = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, "0")}`;
      return ventaMonth === month;
    });

    // 3. Agrupar por mes de agendamiento
    const agrupadas = {};
    ventasDelMes.forEach(item => {
      const clienteId = item["Nombre cliente"];
      const fechaAgenda = fechasAgendamiento[clienteId];

      const mesKey = fechaAgenda
        ? `${fechaAgenda.getFullYear()}-${String(fechaAgenda.getMonth() + 1).padStart(2, "0")}`
        : "Sin fecha de agendamiento";

      agrupadas[mesKey] = (agrupadas[mesKey] || 0) + 1;
    });

    const agrupadasOrdenadas = Object.entries(agrupadas).sort(([a], [b]) => {
      if (a === "Sin fecha de agendamiento") return 1;
      if (b === "Sin fecha de agendamiento") return -1;
      return new Date(a) - new Date(b);
    });

    return res.status(200).json({
      total: ventasDelMes.length,
      agrupadas,
      agrupadasOrdenadas
    });

  } catch (error) {
    console.error("❌ Error en getVentasAgrupadas:", error);
    return res.status(500).json({ error: "Error al agrupar ventas" });
  }
};
