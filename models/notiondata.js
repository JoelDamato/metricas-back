const mongoose = require('mongoose');

const NotionDataSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    properties: { type: Object, required: true }
}, { collection: 'notiondatas' }); // Asegúrate de usar el nombre correcto de la colección

module.exports = mongoose.model('NotionData', NotionDataSchema);
