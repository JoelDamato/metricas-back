const mongoose = require("mongoose");

const MetricasCliente = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

 
    Agendo: { type: Number }, // Formula - Number
    "Aplica con CCA": { type: String }, // Select

    // Campos de llamadas y confirmaciones
    "No efectuada con CC": { type: Number }, // Formula - Number
    "Call Confirm No exitoso": { type: Number }, // Formula - Number
    Origen: { type: String }, // Select
    "Closer": { type: String },
    Facturacion: { type: Number }, // Formula - Number
    "Fecha correspondiente": { type: Date }, // Formula - Date
    "Fecha de agendamiento": { type: Date },
    "Llamadas efectuadas": { type: Number }, // Formula - Number


  },
  { collection: "metricas" }
);


MetricasCliente.index({ "Venta Meg": 1 });
MetricasCliente.index({ "Llamadas efectuadas": 1 });
MetricasCliente.index({ "Agenda": 1 });



module.exports = mongoose.model("metricascliente", MetricasCliente);



