const objetivoCloser = require("../models/objetivoCloser.js");

exports.getObjetivosCloser = async (req, res) => {
  try {
    const { monthFilter, closer } = req.query;

    if (!monthFilter || !closer) {
      return res.status(400).json({
        message: 'Los campos "monthFilter" y "closer" son requeridos en la solicitud'
      });
    }




    const objetivoCloserRegistro = await objetivoCloser.findOne({
      closer: closer,
      monthFilter: monthFilter, 
    });

    if (!objetivoCloserRegistro) {
      return res.status(404).json({ message: "No se encontró ningún registro para el mes y closer seleccionados" });
    }

    const metricasLimpias = JSON.parse(JSON.stringify(objetivoCloserRegistro.metricas));

    console.log("Registros encontrados:", metricasLimpias);
    res.status(200).json({
      closer: objetivoCloserRegistro.closer,
      monthFilter,
      metricas: metricasLimpias
    });

  } catch (error) {
    console.error("Error al obtener los objetivos:", error);
    res.status(500).json({ message: "Error al obtener los objetivos" });
  }
};
