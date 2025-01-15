const mongoose = require('mongoose');

const NotionDataSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // ID único de la página
    properties: { type: Object, required: true }, // Propiedades dinámicas de la página
}, { versionKey: false }); // Desactiva el campo __v

module.exports = mongoose.model('NotionData', NotionDataSchema);
