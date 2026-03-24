const express = require('express');
const controller = require('../modules/carrusel/controller');

const router = express.Router();

router.get('/health', controller.health);
router.post('/chat', controller.chat);
router.post('/generate', controller.generate);

module.exports = router;
