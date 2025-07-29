const MonthlyGoal = require("../models/metricasmesdata");

// Crear o actualizar objetivo mensual
exports.updateMonthlyGoal = async (req, res) => {
  try {
    
    const { month, closer, origin, metrics } = req.body;

    // Validar datos requeridos
    if (!month || !metrics || !Array.isArray(metrics)) {
      console.log("❌ Datos incompletos o inválidos en la solicitud");
      return res.status(400).json({ message: "Faltan datos en la solicitud o las métricas no son válidas" });
    }

    // Buscar si ya existe un registro para este mes, closer y origen
    const filter = { month, closer: closer || "all", origin: origin || "all" };
    let goal = await MonthlyGoal.findOne(filter);
    console.log("🔎 ¿Existe ya un objetivo para este mes, closer y origen?", goal ? "Sí" : "No");

    if (!goal) {
      // Si no existe, crear un nuevo registro
      console.log("🆕 Creando nuevo objetivo para:", month);
      goal = new MonthlyGoal({
        month,
        closer: closer || "all",
        origin: origin || "all",
        metrics,
      });
    } else {

      metrics.forEach((newMetric) => {
        const existingMetricIndex = goal.metrics.findIndex(
          (m) => m.name === newMetric.name
        );
        if (existingMetricIndex !== -1) {

          goal.metrics[existingMetricIndex].goal = newMetric.goal;
        } else {

          goal.metrics.push(newMetric);
        }
      });
    }

    // guardar el registro en la base de datos
    await goal.save();
    console.log(" Objetivo guardado exitosamente:", goal);

    res.status(200).json({ message: "Objetivo actualizado correctamente", goal });
  } catch (error) {
    console.error(" Error al actualizar el objetivo:", error);
    res.status(500).json({ message: "Error al actualizar el objetivo" });
  }
};

// Obtener todos los objetivos mensuales
exports.getMonthlyGoals = async (req, res) => {
  try {

    // Obtener los parámetros de consulta
    const { selectedCloser, selectedOrigin, monthFilter } = req.query;
    console.log("🔍 Parámetros de consulta:", { selectedCloser, selectedOrigin, monthFilter });
    // Establecer valores por defecto si no se proporcionan
    const closer = selectedCloser || "all";
    const origin = selectedOrigin || "all";

    // Crear el filtro para la consulta
    const filter = {
      closer: closer,
      origin: origin,
    };

    // Si se proporciona monthFilter, agregarlo al filtro
    if (monthFilter) {
      filter.month = monthFilter;
    }

    console.log("🔎 Filtro aplicado:", filter);

    // Buscar los registros que coincidan con el filtro
    const goals = await MonthlyGoal.find(filter);
    console.log("📊 Objetivos obtenidos:", goals);

    res.status(200).json(goals);
  } catch (error) {
    console.error("❌ Error al obtener los objetivos:", error);
    res.status(500).json({ message: "Error al obtener los objetivos" });
  }
};