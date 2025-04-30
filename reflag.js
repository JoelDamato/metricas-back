const mongoose = require('mongoose');
const Metricas = require('./models/metricasdata'); // Ajustá el path si hace falta

mongoose.connect(
  'mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(async () => {
  console.log('✅ Conectado a MongoDB');

  const documentos = await Metricas.find({}, {
    _id: 1,
    "Venta Meg": 1,
    "Llamadas efectuadas": 1,
    "Agenda": 1,
    "Cash collected total": 1,
    "Facturacion": 1,
    Flagllamadas: 1
  });

  const operaciones = [];

  for (const doc of documentos) {
    const nuevaFlag =
      (doc["Venta Meg"] > 0) ||
      (doc["Llamadas efectuadas"] > 0) ||
      (doc["Agenda"] > 0) ||
      (doc["Cash collected total"] > 0) ||
      (doc["Facturacion"] > 0);

    if (doc.Flagllamadas !== nuevaFlag) {
      operaciones.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { Flagllamadas: nuevaFlag } }
        }
      });
    }
  }

  if (operaciones.length > 0) {
    const result = await Metricas.bulkWrite(operaciones);
    console.log(`✅ Actualizados: ${result.modifiedCount} documentos`);
  } else {
    console.log('✅ Todos los documentos ya están actualizados.');
  }

  mongoose.disconnect();
})
.catch((err) => {
  console.error('❌ Error durante el reprocesamiento:', err);
  mongoose.disconnect();
});
