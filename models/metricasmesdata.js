const mongoose = require("mongoose");

const MonthlyGoalSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // Ejemplo: "2025-02"
  facturacion: { type: Number, required: true, default: 0 }, // Objetivo de facturación
  porcentaje: { type: Number, required: true, default: 0 }, // % Objetivo
});

module.exports = mongoose.model("MonthlyGoal", MonthlyGoalSchema);
