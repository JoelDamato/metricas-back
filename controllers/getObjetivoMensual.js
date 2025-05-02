exports.getObjetivosCloser = async (req, res) => {
  try {
    const { monthFilter, closer } = req.query;

    if (!closer) {
      return res.status(400).json({
        message: 'El campo "closer" es requerido en la solicitud'
      });
    }

    const filtro = { closer };
    if (monthFilter) {
      filtro.monthFilter = monthFilter;
    }

    const objetivos = await objetivoCloser.find(filtro);

    if (!objetivos.length) {
      return res.status(404).json({ message: "No se encontraron registros" });
    }

    const resultados = objetivos.map(obj => ({
      closer: obj.closer,
      monthFilter: obj.monthFilter,
      metricas: obj.metricas
    }));

    res.status(200).json(resultados);

  } catch (error) {
    console.error("Error al obtener los objetivos:", error);
    res.status(500).json({ message: "Error al obtener los objetivos" });
  }
};
