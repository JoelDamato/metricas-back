const mongoose = require("mongoose");

const ObjetivoCloserSchema = new mongoose.Schema({
  closer: { type: String, required: true }, 
  monthFilter: { type: String, required: true },
  metricas: {
    type: {
      "Total Sales": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Ofertas Ganadas": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Cash collected": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Agendas totales": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Cerradas": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Cierre/Asistencias": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Asistencia": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Recuperado": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "No asiste": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "No aplican": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
      "Precio": {
  base: { type: Number, default: 0, min: 0 } // sin max
},
      "Aplican": {
        objetivo: { type: Number, default: 0, min: 0, max: 100 },
        base: { type: Number, default: 0, min: 0, max: 100 },
      },
    },
    required: true,
    default: {}, 
  },
  fecha: { type: Date, default: Date.now }, 
});

module.exports = mongoose.model("ObjetivoCloser", ObjetivoCloserSchema);