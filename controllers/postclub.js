const ObjetivoCloser = require("../models/objetivoCloser");

exports.updatePrecioClub = async (req, res) => {
  try {
    const { month, precio } = req.body;

    if (!month || typeof precio !== "number" || precio <= 0) {
      console.log("❌ Datos inválidos:", req.body);
      return res.status(400).json({ message: "Mes o precio inválido" });
    }

    const closer = "Club";
    const monthFilter = month;

    let objetivo = await ObjetivoCloser.findOne({ closer, monthFilter });

    if (!objetivo) {
      objetivo = new ObjetivoCloser({
        closer,
        monthFilter,
        metricas: {
          Precio: {
            base: precio
          }
        }
      });
      console.log("🆕 Nuevo objetivo creado para Club:", month);
    } else {
      objetivo.metricas = objetivo.metricas || {};
      objetivo.metricas.Precio = { base: precio };
      console.log("✅ Precio actualizado para Club:", month);
    }

    await objetivo.save();

    return res.status(200).json({ message: "Precio guardado correctamente", precio });
  } catch (err) {
    console.error("❌ Error en updatePrecioClub:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
