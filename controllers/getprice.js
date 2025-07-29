const PrecioClub = require("../models/priceproducts"); // Asegúrate que esté bien

exports.handlePrecioClub = async (req, res) => {
  try {
    console.log(`📥 Método recibido: ${req.method}`);

    if (req.method === "GET") {
      const precios = await PrecioClub.find().sort({ mes: 1 });
      console.log("📤 Precios encontrados:", precios.length);
      return res.status(200).json(precios);
    }

    if (req.method === "POST") {
      const { mes, precio } = req.body;
      console.log("📩 Payload recibido:", req.body);

      // Validaciones
      if (!mes || typeof mes !== "string" || !mes.match(/^\d{4}-\d{2}$/)) {
        console.error("❌ Error: 'mes' inválido. Debe ser un string con formato 'YYYY-MM'");
        return res.status(400).json({
          message: "'mes' es obligatorio y debe tener el formato 'YYYY-MM'",
        });
      }

      if (typeof precio !== "number" || isNaN(precio) || precio < 0) {
        console.error("❌ Error: 'precio' debe ser un número positivo.");
        return res.status(400).json({
          message: "'precio' es obligatorio y debe ser un número positivo",
        });
      }

      // Crear o actualizar
      const actualizado = await PrecioClub.findOneAndUpdate(
        { mes },
        { precio, fechaCreacion: new Date() },
        { new: true, upsert: true }
      );

      console.log("✅ Precio actualizado/creado:", actualizado);

      return res.status(200).json({
        message: "Precio guardado correctamente",
        data: actualizado,
      });
    }

    console.warn("⚠️ Método HTTP no permitido:", req.method);
    return res.status(405).json({ message: "Método no permitido" });

  } catch (error) {
    console.error("💥 Error inesperado en handlePrecioClub:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};
