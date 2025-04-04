const MetricasDataSchema = require('../models/metricasdata');

async function calcularComisiones(req, res) {
  try {
    const ventas = await MetricasDataSchema.find({
      'Producto Adq': { $exists: true, $ne: '' },
      'Cash collected': { $gt: 0 },
      Eliminar: false
    }).lean();

    const cobranzas = await MetricasDataSchema.find({
      'Cash collected': { $gt: 0 },
      Eliminar: false
    }).lean();

    const cobranzasPorCliente = {};
    cobranzas.forEach(c => {
      const cliente = c['Nombre cliente'];
      if (!cliente) return;
      if (!cobranzasPorCliente[cliente]) cobranzasPorCliente[cliente] = [];
      cobranzasPorCliente[cliente].push(c);
    });

    const agrupados = {};
    const cobranzasAsociadas = new Set();

    for (const doc of ventas) {
      const clienteId = doc['Nombre cliente'];
      const rawResponsable = doc['Responsable'] || '';
      const rawCloser = doc['Closer Actual'] || '';
      const responsable = rawResponsable.trim();
      const closer = rawCloser.trim();
      const quienCerro = responsable || closer || 'Sin asignar';

      const productoRaw = doc['Producto Adq'] || '';
      const producto = productoRaw.toLowerCase().trim();
      const isClub = producto.includes('club');
      const isMEG = (producto.includes('meg') && !producto.includes('renovacion')) || producto === '';
      const isAutoagenda = (doc['Origen'] || '').toLowerCase().includes('autoagenda');

      const fechaVenta = new Date(doc['Fecha correspondiente']);
      const mes = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
      const key = `${quienCerro}_${mes}`;

      if (!agrupados[key]) {
        agrupados[key] = {
          responsable: quienCerro,
          mes,
          totalCashCollected: 0,
          totalCashClub: 0,
          totalCashMEG: 0,
          comisionMEG: 0,
          comisionCLUB: 0,
          comisionAutoagenda: 0,
          transacciones: [],
          cobranzasNoAsociadas: []
        };
      }

      const cobros = cobranzasPorCliente[clienteId] || [];
      let totalCashCollected = parseFloat(doc['Cash collected']) || 0;
      const cobranzasAplicadas = [];

      for (const cobro of cobros) {
        const fechaCobro = new Date(cobro['Fecha correspondiente']);
        if (fechaCobro >= fechaVenta) {
          const cash = parseFloat(cobro['Cash collected']) || 0;
          if (cash > 0 && cobro._id.toString() !== (doc._id || doc.id).toString()) {
            cobranzasAplicadas.push({
              id: cobro.id || cobro._id,
              fecha: fechaCobro,
              cash,
              esCobranza: true
            });
            cobranzasAsociadas.add(cobro._id.toString());
            totalCashCollected += cash;
          }
        }
      }

      agrupados[key].totalCashCollected += totalCashCollected;

      let comision = 0;
      if (isClub) {
        agrupados[key].totalCashClub += totalCashCollected;
        comision = totalCashCollected * 0.6;
        agrupados[key].comisionCLUB += comision;
      } else if (isAutoagenda) {
        comision = totalCashCollected * 0.10;
        agrupados[key].comisionAutoagenda += comision;
      } else if (isMEG) {
        agrupados[key].totalCashMEG += totalCashCollected;

        const ventasMEGPrevias = agrupados[key].transacciones.filter(t => {
          const prod = (t.producto || '').toLowerCase();
          return (prod.includes('meg') && !prod.includes('renovacion')) || prod === '';
        }).length;

        comision = totalCashCollected * (ventasMEGPrevias < 4 ? 0.08 : 0.09);
        agrupados[key].comisionMEG += comision;
      }

      agrupados[key].transacciones.push({
        id: doc.id || doc._id,
        cliente: clienteId,
        fecha: fechaVenta,
        cashCollected: totalCashCollected,
        producto: productoRaw,
        responsableOriginal: rawResponsable.trim(),
        closerOriginal: rawCloser.trim(),
        inconsistente: rawResponsable.trim() !== rawCloser.trim(),
        comision,
        esVenta: true,
        cobranzas: cobranzasAplicadas
      });
    }

    const resultado = Object.values(agrupados).map(entry => ({
      ...entry,
      comisionTotal: entry.comisionMEG + entry.comisionCLUB + entry.comisionAutoagenda
    }));

    const cobranzasNoAsociadas = cobranzas.filter(c => !cobranzasAsociadas.has(c._id.toString()));

    cobranzasNoAsociadas.forEach(doc => {
      const responsable = (doc['Responsable'] || doc['Closer Actual'] || '').trim();
      const fecha = new Date(doc['Fecha correspondiente']);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const key = `${responsable}_${mes}`;

      if (!agrupados[key]) {
        agrupados[key] = {
          responsable,
          mes,
          totalCashCollected: 0,
          totalCashClub: 0,
          totalCashMEG: 0,
          comisionMEG: 0,
          comisionCLUB: 0,
          comisionAutoagenda: 0,
          transacciones: [],
          cobranzasNoAsociadas: []
        };
      }

      agrupados[key].totalCashCollected += parseFloat(doc['Cash collected']) || 0;
      agrupados[key].cobranzasNoAsociadas.push({
        id: doc.id || doc._id,
        cliente: doc['Nombre cliente'],
        fecha: doc['Fecha correspondiente'],
        cashCollected: doc['Cash collected'],
        producto: doc['Producto Adq'] || ''
      });
    });

    res.json({
      success: true,
      resumen: Object.values(agrupados).map(entry => ({
        ...entry,
        comisionTotal: entry.comisionMEG + entry.comisionCLUB + entry.comisionAutoagenda
      }))
    });
  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

module.exports = { calcularComisiones };
