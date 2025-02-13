const MonthlyGoal = require("../models/metricasmesdata");

// Crear o actualizar objetivo mensual
exports.updateMonthlyGoal = async (req, res) => {
  try {
    console.log("🔹 Recibida solicitud POST /update-goal");
    console.log("📩 Datos recibidos en el body:", req.body);

    const { month, facturacion, porcentaje } = req.body;

    if (!month || facturacion === undefined || porcentaje === undefined) {
      console.log("❌ Datos incompletos en la solicitud");
      return res.status(400).json({ message: "Faltan datos en la solicitud" });
    }

    let goal = await MonthlyGoal.findOne({ month });
    console.log("🔎 ¿Existe ya un objetivo para este mes?", goal ? "Sí" : "No");

    if (!goal) {
      console.log("🆕 Creando nuevo objetivo para:", month);
      goal = new MonthlyGoal({ month, facturacion, porcentaje });
    } else {
      console.log("🔄 Actualizando objetivo existente:", goal);
      goal.facturacion = facturacion;
      goal.porcentaje = porcentaje;
    }

    await goal.save();
    console.log("✅ Objetivo guardado exitosamente:", goal);

    res.status(200).json({ message: "Objetivo actualizado correctamente", goal });
  } catch (error) {
    console.error("❌ Error al actualizar el objetivo:", error);
    res.status(500).json({ message: "Error al actualizar el objetivo" });
  }
};

// Obtener todos los objetivos mensuales
exports.getMonthlyGoals = async (req, res) => {
  try {
    console.log("🔹 Recibida solicitud GET /goals");
    
    const goals = await MonthlyGoal.find({});
    console.log("📊 Objetivos obtenidos:", goals.length);

    res.status(200).json(goals);
  } catch (error) {
    console.error("❌ Error al obtener los objetivos:", error);
    res.status(500).json({ message: "Error al obtener los objetivos" });
  }
};
