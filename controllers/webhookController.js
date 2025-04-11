exports.handleWebhook = async (req, res) => {
  try {
    console.log("=====================================");
    console.log(`HTTP Method: ${req.method}`);
    console.log("Webhook recibido:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=====================================");

    const { data } = req.body;
    if (!data || !data.id || !data.properties) {
      console.error("❌ Datos inválidos en el payload");
      return res.status(400).json({ error: 'Datos inválidos o incompletos en la solicitud' });
    }

    const pageId = data.id;
    const normalizedPageId = formatNotionId(pageId);

    // 🔁 Obtener props completos desde Notion (el webhook no siempre trae todos los datos)
    const fullPageData = await axios.get(`https://api.notion.com/v1/pages/${normalizedPageId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_TOKEN || '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'}`,
        'Notion-Version': '2022-06-28',
      },
    });

    const props = fullPageData.data.properties;

    if (props.ELIMINAR?.type === 'checkbox' && props.ELIMINAR.checkbox === true) {
      const deletedDocument = await NotionData.findOneAndDelete({ id: normalizedPageId });
      if (deletedDocument) {
        return res.status(200).json({
          message: 'Documento eliminado con éxito',
          operation: 'eliminado',
          data: deletedDocument
        });
      } else {
        return res.status(404).json({ error: 'Documento no encontrado para eliminar' });
      }
    }

    // 🔁 Obtener nombre del producto adquirido
    const relacionesProducto = getRelation(props['Producto Adquirido']);
    const productoAdq = relacionesProducto.length > 0
      ? (await Promise.all(relacionesProducto.map(getNombreDeRelacion))).join(', ')
      : '';

    const transformedData = {
      id: normalizedPageId,
      Interaccion: getTextValue(props['Interaccion']),
      Agenda: getNumberFromFormula(props['Agenda']),
      "Aplica?": getSelectValue(props['Aplica?']),
      Aplicacion: getNumberFromFormula(props['Aplicacion']),
      "Asistio?": getSelectValue(props['Asistio?']),
      "Call Confirm Exitoso": getNumberFromFormula(props['Call Confirm Exitoso']),
      "Call Confirm No exitoso": getNumberFromFormula(props['Call Confirm No exitoso']),
      Canal: getSelectValue(props['Canal']),
      "Cash collected": getNumber(props['Cash Collected']),
      "Cash collected total": getNumberFromFormula(props['Cash collected total']),
      "CC / Precio": getNumberFromFormula(props['CC / Precio']),
      "Closer Actual": getPersonOrString(props['Closer Actual']),
      "Closer Sub": getPersonOrString(props['Closer Actual']),
      "Creado por": getPerson(props['Creado por']),
      ELIMINAR: getCheckbox(props['Eliminar']),
      Facturacion: getNumberFromFormula(props['Facturacion']),
      "Fecha correspondiente": getDateFromFormula(props['Fecha correspondiente']),
      "Fecha creada": getDate(props['Fecha creada']),
      "Id Interaccion": getNumberFromFormula(props['Id Interaccion']),
      "Link enviado": getURL(props['Link enviado']),
      "Links enviados": getNumberFromFormula(props['Links enviados']),
      "Llamadas agendadas": getNumberFromFormula(props['Llamadas agendadas']),
      "Llamadas aplicables": getNumberFromFormula(props['Llamadas aplicables']),
      "Llamadas efectuadas": getNumberFromFormula(props['Llamadas efectuadas']),
      "Llamadas no efectuadas": getNumberFromFormula(props['Llamadas no efectuadas']),
      "Llamadas vendidas": getNumberFromFormula(props['Llamadas vendidas']),
      "Nombre cliente": (() => {
        const relaciones = getRelation(props['Nombre cliente']);
        return relaciones.length > 0 ? relaciones[0] : null;
      })(),
      "Ofertas ganadas": getNumberFromFormula(props['Ofertas ganadas']),
      Origen: getSelectValue(props['Origen']),
      Precio: getNumber(props['Precio']),
      "Primer Origen": getTextFromFormula(props['Primer Origen']),
      "Producto Adq": productoAdq,
      Responsable: getTextFromFormula(props['Responsable']),
      "Responsable?": getCheckbox(props['Responsable?']),
      Respuesta: getSelectValue(props['Respuesta']),
      "Respuesta al primer contacto": getNumberFromFormula(props['Respuesta al primer contacto']),
      "Respuestas al seguimiento": getNumberFromFormula(props['Respuestas al seguimiento']),
      Rol: getTextFromFormula(props['Rol']),
      "Saldo pendiente": getNumberFromFormula(props['Saldo pendiente']),
      "Seña": getNumberFromFormula(props['Seña']),
      Tc: getNumber(props['Tc']),
      "Tipo contacto": getSelectValue(props['Tipo contacto']),
      "Total Nuevas conversaciones": getNumberFromFormula(props['Total Nuevas conversaciones']),
      "Ult. Origen": getTextFromFormula(props['Ult. Origen']),
      "Venta Club": getNumberFromFormula(props['Venta Club']),
      "Venta Meg": getNumberFromFormula(props['Venta Meg']),
      "Venta relacionada": (() => {
        const relaciones = getRelation(props['Venta relacionada']);
        return Array.isArray(relaciones) && relaciones.length > 0 ? relaciones[0] : '';
      })(),
      "Cobranza relacionada": getRelation(props['Cobranza relacionada']),
    };

    const existingDocument = await NotionData.findOne({ id: normalizedPageId });
    const operationType = existingDocument ? 'actualizado' : 'creado';

    const updatedOrCreatedData = await NotionData.findOneAndUpdate(
      { id: normalizedPageId },
      transformedData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: `Datos ${operationType} con éxito`,
      operation: operationType,
      data: updatedOrCreatedData
    });

  } catch (error) {
    console.error("❌ Error en webhook:", error);
    return res.status(500).json({ error: "Error al procesar los datos del webhook" });
  }
};
