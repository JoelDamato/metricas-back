const Metricas = require('../models/metricasdata');
const { performance } = require('perf_hooks');

exports.getVentasPorMesDeAgendamiento = async (req, res) => {
  const start = performance.now();

  try {
    const { month, closer = "all", origin = "all" } = req.query;
    if (!month) return res.status(400).json({ error: "Falta el parámetro 'month'" });

    // Separar año y mes para comparar luego
    const [year, mes] = month.split("-").map(Number);

    const pipeline = [
      {
        $match: {
          $or: [
            { "Agenda": 1 },
            { "Venta Meg": { $gt: 0 } }
          ],
          "Nombre cliente": { $ne: null }
        }
      },
      {
        $match: {
          ...(closer !== "all" ? { "Responsable": closer } : {}),
          ...(origin !== "all" ? { "Origen": origin } : {})
        }
      },
      {
        $project: {
          "Nombre cliente": 1,
          "Venta Meg": 1,
          "Agenda": 1,
          "Fecha correspondiente": 1
        }
      },
      {
        $group: {
          _id: "$Nombre cliente",
          fechaAgendamiento: {
            $min: {
              $cond: [{ $eq: ["$Agenda", 1] }, "$Fecha correspondiente", null]
            }
          },
          ventas: {
            $push: {
              ventaMeg: "$Venta Meg",
              fechaVenta: "$Fecha correspondiente"
            }
          }
        }
      },
      {
        $unwind: "$ventas"
      },
      {
        $match: {
          "ventas.ventaMeg": { $gt: 0 }
        }
      },
      {
        $addFields: {
          mesAgendamiento: {
            $dateToString: { format: "%Y-%m", date: "$fechaAgendamiento" }
          }
        }
      },
      {
        $match: {
          mesAgendamiento: month
        }
      },
      {
        $count: "total"
      }
    ];

    const resultado = await Metricas.aggregate(pipeline);
    const total = resultado.length > 0 ? resultado[0].total : 0;

    const end = performance.now();
    console.log(`✅ Tiempo de ejecución (aggregate): ${(end - start).toFixed(2)} ms`);

    return res.status(200).json({ total });

  } catch (error) {
    console.error("❌ Error en aggregate getVentasPorMesDeAgendamiento:", error);
    return res.status(500).json({ error: "Error al procesar ventas por agendamiento (aggregate)" });
  }
};
