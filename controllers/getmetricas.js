// controllers/getmetricas.js
const Metricas = require('../models/metricasdata'); // Asegúrate de que la ruta sea correcta

exports.getAllData = async (req, res) => {
  try {
    console.log("Iniciando el controlador getAllData (solo campos específicos)...");
    console.time("TiempoTotalConsulta");
    const inicio = new Date();
    console.log("Inicio de la consulta:", inicio.toISOString());


    const metricas = await Metricas.find({}, {
      "Fecha correspondiente": 1,
      "Responsable": 1,
      "Cash collected total": 1,
      "Venta Meg": 1,
      "Venta Club":1,
      "Precio": 1
    }).lean();
    


    const fin = new Date();
    console.log("Consulta completada a:", fin.toISOString());
    console.log("Cantidad de documentos obtenidos:", metricas.length);
    console.timeEnd("TiempoTotalConsulta");

    res.status(200).json(metricas);
  } catch (error) {
    console.error('Error al obtener las métricas:', error);
    res.status(500).json({ message: 'Error al obtener las métricas' });
  }
};
