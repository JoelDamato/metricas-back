const mongoose = require('mongoose');

// Esquema flexible para guardar datos de Notion
const notionDataSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('NotionData', notionDataSchema);
