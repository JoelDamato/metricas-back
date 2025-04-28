const mongoose = require("mongoose");

const MetricasClienteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    Agendo: { type: Number }, // Formula - Number
    "Aplica con CCA": { type: String }, // Formula - String

    "No efectuada con CC": { type: Number }, // (Este no llega, pero lo dejamos)
    "Call confirm exitoso": { type: Number }, // Formula - Number
    Origen: { type: String }, // Formula - String
    Closer: { type: String }, // (Este no llega, pero lo dejamos)
    Facturacion: { type: Number }, // (Este no llega, pero lo dejamos)
    "Fecha correspondiente": { type: Date }, // (Este no llega, pero lo dejamos)
    "Fecha de agendamiento": { type: Date }, // Formula - Date

    "Llamadas efectuadas": { type: Number } // Formula - Number
  },
  { collection: "metricascliente" } // ✅ Cambié el nombre para que coincida
);

module.exports = mongoose.model("metricascliente", MetricasClienteSchema);
