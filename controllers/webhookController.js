const NotionData = require('../models/notiondata');

// Controlador para manejar el webhook
exports.handleWebhook = async (req, res) => {
    try {
        const newData = new NotionData(req.body);
        await newData.save();

        console.log('Datos recibidos y guardados:', req.body);
        res.status(200).json({ message: 'Datos guardados con éxito' });
    } catch (error) {
        console.error('Error al guardar los datos:', error);
        res.status(500).json({ error: 'Error al guardar los datos' });
    }
};
