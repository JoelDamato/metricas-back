const MetricasDataSchema = require('../models/metricasdata');

async function calcularComisiones(req, res) {
  try {
    const interacciones = await MetricasDataSchema.find({
      $or: [
        { 'Producto Adq': { $exists: true, $ne: '' }, 'Precio': { $ne: null, $gt: 0 } },
        { 'Cash collected': { $gt: 0 } }
      ],
      $or: [
        { Eliminar: false },
        { Eliminar: { $exists: false } }
      ]
    }).lean();

    const ventas = interacciones.filter(i =>
      i['Producto Adq'] && i['Producto Adq'].trim() !== '' &&
      i['Precio'] != null && i['Precio'] > 0
    );

    const cobranzas = interacciones.filter(i =>
      (!i['Producto Adq'] || i['Producto Adq'].trim() === '') &&
      (!i['Precio'] || i['Precio'] === null) &&
      i['Cash collected'] > 0
    );

    const interaccionesPorId = Object.fromEntries(interacciones.map(i => [i.id, i]));
    const agrupado = {};

    for (const venta of ventas) {
      const fechaVenta = new Date(venta['Fecha correspondiente']);
      const mesVenta = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
      const responsable = venta['Responsable'] || 'Sin Responsable';
      const key = `${responsable}-${mesVenta}`;

      if (!agrupado[key]) {
        agrupado[key] = {
          responsable,
          mes: mesVenta,
          ventas: [],
          cobranzasDeVentasDeMesesAnteriores: [],
          transaccionesSinRelacionDelMes: [],
          totalCashCollected: 0,
          totalCashCollectedClub: 0,
          totalCashCollectedOtros: 0,
          comisionClub: 0,
          comisionOtros: 0,
          comisionTotal: 0
        };
      }

      const cobranzasRelacionadas = [];
      const cashPropio = parseFloat(venta['Cash collected']) || 0;
      if (cashPropio > 0) {
        cobranzasRelacionadas.push({
          id: venta.id,
          cliente: venta['Nombre cliente'],
          fecha: fechaVenta,
          producto: venta['Producto Adq'],
          precio: venta['Precio'],
          cashCollected: cashPropio,
          responsable,
          interaccion: venta['Interaccion'] || ''
        });

        const producto = (venta['Producto Adq'] || '').toUpperCase().trim();
        if (producto === 'CLUB') agrupado[key].totalCashCollectedClub += cashPropio;
        else agrupado[key].totalCashCollectedOtros += cashPropio;
        agrupado[key].totalCashCollected += cashPropio;
      }

      const idsRelacionados = Array.isArray(venta['Cobranza relacionada']) ? venta['Cobranza relacionada'].filter(id => id !== venta.id) : [];
      for (const id of idsRelacionados) {
        const cobranza = interaccionesPorId[id];
        if (!cobranza) continue;

        const fechaCobranza = new Date(cobranza['Fecha correspondiente']);
        const mesCobranza = `${fechaCobranza.getFullYear()}-${String(fechaCobranza.getMonth() + 1).padStart(2, '0')}`;
        if (mesCobranza !== mesVenta) continue;

        const cash = parseFloat(cobranza['Cash collected']) || 0;
        cobranzasRelacionadas.push({
          id: cobranza.id,
          cliente: cobranza['Nombre cliente'],
          fecha: fechaCobranza,
          producto: cobranza['Producto Adq'] || 'No tiene producto',
          precio: cobranza['Precio'] != null ? cobranza['Precio'] : 'No tiene precio',
          cashCollected: cash,
          responsable: cobranza['Responsable'] || '',
          interaccion: cobranza['Interaccion'] || '',
        });

        const producto = (venta['Producto Adq'] || '').toUpperCase().trim();
        if (producto === 'CLUB') agrupado[key].totalCashCollectedClub += cash;
        else agrupado[key].totalCashCollectedOtros += cash;
        agrupado[key].totalCashCollected += cash;
      }

      agrupado[key].ventas.push({
        id: venta.id,
        cliente: venta['Nombre cliente'],
        fecha: venta['Fecha correspondiente'],
        producto: venta['Producto Adq'],
        precio: venta['Precio'],
        responsable,
        interaccion: venta['Interaccion'],
        cobranzas: cobranzasRelacionadas
      });
    }

    for (const key in agrupado) {
      const grupo = agrupado[key];
      grupo.comisionClub = 0;
      grupo.comisionOtros = 0;
      grupo.comisionTotal = 0;

      const ventasOrdenadas = [...grupo.ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      ventasOrdenadas.forEach((venta, index) => {
        const nivel = index < 4 ? 0.08 : index < 14 ? 0.09 : 0.10;
        const producto = (venta.producto || '').toUpperCase().trim();

        let totalCobrado = 0;
        venta.cobranzas.forEach(c => {
          totalCobrado += parseFloat(c.cashCollected) || 0;
        });

        const comision = producto === 'CLUB' ? totalCobrado * 0.6 : totalCobrado * nivel;
        venta.porcentaje = producto === 'CLUB' ? '60%' : `${nivel * 100}%`;
        venta.comisionTotal = comision;

        if (producto === 'CLUB') grupo.comisionClub += comision;
        else grupo.comisionOtros += comision;

        grupo.comisionTotal += comision;
      });
    }

    for (const cobranza of cobranzas) {
      const idVentaRelacionada = cobranza['Venta relacionada'];
      const venta = interaccionesPorId[idVentaRelacionada];
      const fechaCobranza = new Date(cobranza['Fecha correspondiente']);
      const mesCobranza = `${fechaCobranza.getFullYear()}-${String(fechaCobranza.getMonth() + 1).padStart(2, '0')}`;
      const responsable = cobranza['Responsable'] || 'Sin Responsable';
      const key = `${responsable}-${mesCobranza}`;

      if (!venta) {
        if (!agrupado[key]) {
          agrupado[key] = {
            responsable,
            mes: mesCobranza,
            ventas: [],
            cobranzasDeVentasDeMesesAnteriores: [],
            transaccionesSinRelacionDelMes: [],
            totalCashCollected: 0,
            totalCashCollectedClub: 0,
            totalCashCollectedOtros: 0,
            comisionClub: 0,
            comisionOtros: 0,
            comisionTotal: 0
          };
        }

        agrupado[key].transaccionesSinRelacionDelMes.push({
          id: cobranza.id,
          cliente: cobranza['Nombre cliente'],
          fecha: fechaCobranza,
          cashCollected: parseFloat(cobranza['Cash collected']) || 0,
          interaccion: cobranza['Interaccion'] || '',
          responsable: cobranza['Responsable'] || '',
          motivo: 'No se encontró venta relacionada',
          producto: cobranza['Producto Adq'] || ''
        });
        continue;
      }

      const fechaVenta = new Date(venta['Fecha correspondiente']);
      const mesVenta = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
      if (mesCobranza <= mesVenta) continue;

      if (!agrupado[key]) {
        agrupado[key] = {
          responsable,
          mes: mesCobranza,
          ventas: [],
          cobranzasDeVentasDeMesesAnteriores: [],
          transaccionesSinRelacionDelMes: [],
          totalCashCollected: 0,
          totalCashCollectedClub: 0,
          totalCashCollectedOtros: 0,
          comisionClub: 0,
          comisionOtros: 0,
          comisionTotal: 0
        };
      }

      const cash = parseFloat(cobranza['Cash collected']) || 0;
      const producto = (venta['Producto Adq'] || '').toUpperCase().trim();
      const keyVentaMes = `${responsable}-${mesVenta}`;
      const agrupacionVenta = agrupado[keyVentaMes];
      let idxVenta = -1;
      if (agrupacionVenta) {
        const ventasOrdenadas = [...agrupacionVenta.ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        idxVenta = ventasOrdenadas.findIndex(v => v.id === venta.id);
      }

      const nivel = producto === 'CLUB' ? 0.6 : idxVenta >= 0 && idxVenta < 4 ? 0.08 : idxVenta < 14 ? 0.09 : 0.10;
      const comision = cash * nivel;

      agrupado[key].cobranzasDeVentasDeMesesAnteriores.push({
        id: cobranza.id,
        fechaCobranza,
        fechaVenta,
        cliente: cobranza['Nombre cliente'],
        producto: venta['Producto Adq'],
        precio: venta['Precio'],
        cashCollected: cash,
        interaccion: cobranza['Interaccion'] || '',
        vinculadaA: venta.id,
        comision,
        porcentaje: producto === 'CLUB' ? '60%' : `${nivel * 100}%`
      });

      if (producto === 'CLUB') agrupado[key].totalCashCollectedClub += cash;
      else agrupado[key].totalCashCollectedOtros += cash;
      agrupado[key].totalCashCollected += cash;

      if (producto === 'CLUB') agrupado[key].comisionClub += comision;
      else agrupado[key].comisionOtros += comision;
      agrupado[key].comisionTotal += comision;
    }

    res.json({ success: true, agrupado });
  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

module.exports = { calcularComisiones };








