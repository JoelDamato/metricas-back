const mongoose = require("mongoose");

const MetricasClienteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    Nombre: { type: String }, // Título del cliente
    Agendo: { type: Number }, // Formula - Number
    "Aplica Con CC": { type: String }, // Formula - String
    "Call confirm exitoso": { type: Number }, // Formula - Number
    "Fecha de agendamiento": { type: Date }, // Formula - Date
    "Llamadas efectuadas": { type: Number }, // Formula - Number
    Closer: { type: String }, // People - Name del closer
    "Ultimo origen": { type: String } // Formula - String
  },
  { collection: "metricascliente" }
);

module.exports = mongoose.model("metricascliente", MetricasClienteSchema);
