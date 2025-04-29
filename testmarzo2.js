const mongoose = require('mongoose');

const MetricasClienteSchema = new mongoose.Schema({
  id: String,
  Agendo: Number,
  "Fecha de agendamiento": mongoose.Schema.Types.Mixed,
}, { collection: "metricascliente" });

const MetricasCliente = mongoose.model('metricascliente', MetricasClienteSchema);

mongoose.connect('mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log("🔵 Conectado a MongoDB");

  const documentos = await MetricasCliente.find({ Agendo: 1 });

  const agrupadosPorMes = {};
  let invalidos = [];

  documentos.forEach(doc => {
    const fechaRaw = doc["Fecha de agendamiento"];
    const fecha = new Date(fechaRaw);

    if (!fechaRaw || isNaN(fecha)) {
      invalidos.push(doc.id);
    } else {
      // Agrupamos por mes usando UTC, no hora local
      const anio = fecha.getUTCFullYear();
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const clave = `${anio}-${mes}`;
      agrupadosPorMes[clave] = (agrupadosPorMes[clave] || 0) + 1;
    }
  });

  console.log(`📋 Total documentos Agendo:1: ${documentos.length}`);
  console.log(`📆 Agendados por mes (UTC):`);
  console.table(agrupadosPorMes);

  console.log(`❌ Documentos con fecha inválida: ${invalidos.length}`);
  if (invalidos.length > 0) {
    console.log("🧪 IDs con fecha inválida:");
    console.table(invalidos.slice(0, 10));
  }

  mongoose.disconnect();
})
.catch(error => {
  console.error("❌ Error al conectar:", error);
});
