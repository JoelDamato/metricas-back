const mongoose = require('mongoose');

const NotionDataSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    properties: { type: Object, required: true }
}, { collection: 'clientedatas' }); // Asegúrate de usar el nombre correcto de la colección

module.exports = mongoose.model('ClienteData', NotionDataSchema);
