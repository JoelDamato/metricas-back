const ObjetivoCloser = require("../models/objetivoCloser");

exports.updateObjetivoCloser = async (req, res) => {
  try {
    const { closer, metricas, monthFilter } = req.body;


    if (!closer || !metricas || !monthFilter) {
      console.log("Datos incompletos en la solicitud");
      return res.status(400).json({ message: "Faltan datos en la solicitud" });
    }

    
    for (const [metrica, valores] of Object.entries(metricas)) {
      const { objetivo, base } = valores;

      if (objetivo !== undefined && (objetivo < 0 || objetivo > 100)) {
        console.log(`Valor de objetivo fuera del rango permitido para la métrica: ${metrica}`);
        return res.status(400).json({
          message: `El valor de objetivo para ${metrica} debe estar entre 0 y 100`,
        });
      }

      if (base !== undefined && (base < 0 || base > 100)) {
        console.log(`Valor de base fuera del rango permitido para la métrica: ${metrica}`);
        return res.status(400).json({
          message: `El valor de base para ${metrica} debe estar entre 0 y 100`,
        });
      }
    }

   
    let objetivoCloser = await ObjetivoCloser.findOne({ closer, monthFilter });

    if (!objetivoCloser) {
      
      objetivoCloser = new ObjetivoCloser({
        closer,
        monthFilter, 
        metricas,
      });
      console.log(" Nuevo registro creado para el closer:", closer);
    } else {
      
      for (const [metrica, valores] of Object.entries(metricas)) {
        if (objetivoCloser.metricas[metrica]) {
        
          if (valores.objetivo !== undefined) {
            objetivoCloser.metricas[metrica].objetivo = valores.objetivo;
          }
          if (valores.base !== undefined) {
            objetivoCloser.metricas[metrica].base = valores.base;
          }
        } else {
          
          objetivoCloser.metricas[metrica] = {
            objetivo: valores.objetivo !== undefined ? valores.objetivo : 0,
            base: valores.base !== undefined ? valores.base : 0,
          };
        }
      }
      objetivoCloser.fecha = Date.now(); 
      console.log(" Registro actualizado para el closer:", closer);
    }


    await objetivoCloser.save();
 


    res.status(200).json({ message: "Objetivo actualizado correctamente", objetivoCloser });
  } catch (error) {
    console.error("Error al actualizar el objetivo:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Error al actualizar el objetivo" });
  }
};