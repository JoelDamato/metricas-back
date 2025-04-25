// controllers/getmetricas.js
const Metricas = require('../models/metricasdata'); // Asegúrate de que la ruta sea correcta

exports.getAllData = async (req, res) => {
  try {
    console.log("Iniciando el controlador getAllData (solo campos específicos)...");
    console.time("TiempoTotalConsulta");

    const inicio = new Date();
    console.log("Inicio de la consulta:", inicio.toISOString());

    const metricas = await Metricas.find(
      {
        $or: [
          { "Venta Meg": { $gt: 0 } },
          { "Llamadas efectuadas": { $gt: 0 } },
          { "Agenda": { $gt: 0 } },
          { "Cash collected total": { $gt: 0 } },
          { "Facturación": { $gt: 0 } },
          { "Call Confirm Exitoso": { $gt: 0 } } ,
          { "Id Interaccion": { $gt: 0 } } 
        ]
      },
      {
        "Fecha correspondiente": 1,
        "Responsable": 1,
        "Venta Meg": 1,
        "Cash collected total": 1,
        "Origen": 1,
        "Agenda": 1,
        "Precio": 1,
        "Aplica?": 1,
        "Llamadas efectuadas": 1,
        "Nombre cliente": 1,
        "Venta Club": 1,
        "Call Confirm Exitoso": 1,
        "Fecha de agendamiento":1,
        "id": 1 // 👈 CAMPO NUEVO AGREGADO
      }
    ).lean();

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
