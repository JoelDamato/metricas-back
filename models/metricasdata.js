const mongoose = require("mongoose");

const MetricasDataSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    // Propiedades de texto y numéricas
    Interaccion: { type: String },
    Agenda: { type: Number }, // Formula - Number
    "Aplica?": { type: String }, // Select
    Aplicacion: { type: Number }, // Formula - Number
    "Asistio?": { type: String }, // Select

    // Campos de llamadas y confirmaciones
    "Call Confirm Exitoso": { type: Number }, // Formula - Number
    "Call Confirm No exitoso": { type: Number }, // Formula - Number

    // Otros campos de selección y numéricos
    Canal: { type: String }, // Select
    "Cash collected": { type: Number },
    "Cash collected total": { type: Number }, // Formula - Number
    "CC / Precio": { type: Number }, // Formula - Number

    // Campos relacionados con personas
    "Closer Actual": { type: String }, // Formula - Person o String
    "Creado por": { type: String }, // Person

    // Checkbox
    Eliminar: { type: Boolean },

    // Campos de facturación y fechas
    Facturacion: { type: Number }, // Formula - Number
    "Fecha correspondiente": { type: Date }, // Formula - Date
    "Fecha creada": { type: Date },

    // Identificadores y enlaces
    "Id Interaccion": { type: Number }, // Formula - Number
    "Link enviado": { type: String }, // URL
    "Links enviados": { type: Number }, // Formula - Number

    // Campos relacionados a llamadas
    "Llamadas agendadas": { type: Number }, // Formula - Number
    "Llamadas aplicables": { type: Number }, // Formula - Number
    "Llamadas efectuadas": { type: Number }, // Formula - Number
    "Llamadas no efectuadas": { type: Number }, // Formula - Number
    "Llamadas vendidas": { type: Number }, // Formula - Number

    "Nombre cliente": { type: String },

    // Más campos numéricos y de selección
    "Ofertas ganadas": { type: Number }, // Formula - Number
    Origen: { type: String }, // Select
    Precio: { type: Number },
    "Primer Origen": { type: String }, // Formula - String
    "Producto Adq": { type: String }, // Formula - String

    // Responsable y confirmación
    Responsable: { type: String }, // Formula - Person
    "Responsable?": { type: Boolean }, // Checkbox

    // Respuestas y seguimiento
    Respuesta: { type: String }, // Select
    "Respuesta al primer contacto": { type: Number }, // Formula - Number
    "Respuestas al seguimiento": { type: Number }, // Formula - Number

    // Otros campos de texto y numéricos
    Rol: { type: String }, // Formula - String
    "Saldo pendiente": { type: Number }, // Formula - Number
    "Seña": { type: Number }, // Formula - Number
    Tc: { type: Number },
    "Tipo contacto": { type: String }, // Select
    "Total Nuevas conversaciones": { type: Number }, // Formula - Number
    "Ult. Origen": { type: String }, // Formula - String
    "Venta Club": { type: Number }, // Formula - Number
    "Venta Meg": { type: Number }, // 🚀 Índice agregado aquí
  },
  { collection: "metricas" }
);


MetricasDataSchema.index({ "Venta Meg": 1 });
MetricasDataSchema.index({ "Llamadas efectuadas": 1 });
MetricasDataSchema.index({ "Agenda": 1 });
MetricasDataSchema.index({ "Cash collected total": 1 });
MetricasDataSchema.index({ "Facturación": 1 });


module.exports = mongoose.model("metricas", MetricasDataSchema);
