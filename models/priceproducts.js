const mongoose = require("mongoose");

const PrecioClubSchema = new mongoose.Schema({
  mes: { type: String, required: true }, // formato 'YYYY-MM'
  precio: { type: Number, required: true },
  fechaCreacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PrecioClub", PrecioClubSchema);
