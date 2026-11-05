const express = require('express');
function createRouter() {
  const router = express.Router();
  router.use((req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!req.authUser) return res.status(401).json({ message: 'Sesión requerida' });
    return res.status(410).json({ message: 'Mati World fue desactivado.', disabled: true });
  });
  return router;
}
module.exports = { createRouter };
