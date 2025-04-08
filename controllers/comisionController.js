const MetricasDataSchema = require('../models/metricasdata');

async function calcularComisiones(req, res) {
  try {
    const transacciones = await MetricasDataSchema.find({
      $or: [
        { 'Producto Adq': { $exists: true, $ne: '' }, 'Precio': { $exists: true, $ne: null } },
        { 'Cash collected': { $exists: true, $gt: 0 } }
      ],
      Eliminar: false
    }).lean();

    const agrupados = {};
    const ventasPrincipales = {};

    // Primero, identificamos todas las ventas principales (con producto y precio)
    for (const doc of transacciones) {
      const tieneProducto = doc['Producto Adq'] && doc['Producto Adq'].trim() !== '';
      const tienePrecio = doc['Precio'] != null;
      const esVentaPrincipal = tieneProducto && tienePrecio;

      if (esVentaPrincipal) {
        const id = doc.id
        ventasPrincipales[id] = {
          id,
          cliente: doc['Nombre cliente'],
          fecha: doc['Fecha correspondiente'],
          producto: doc['Producto Adq'],
          precio: doc['Precio'],
          cashCollected: parseFloat(doc['Cash collected']) || 0,
          responsable: (doc['Responsable'] || '').trim(),
          closer: (doc['Closer Actual'] || '').trim(),
          interaccion: doc['Interaccion'] || '',
          cobranzas: [],
          totalCobrado: 0
        };
      }
    }

    // Ahora procesamos todas las transacciones y las agrupamos
    for (const doc of transacciones) {
      const rawResponsable = doc['Responsable'] || '';
      const rawCloser = doc['Closer Actual'] || '';
      const responsable = rawResponsable.trim();
      const closer = rawCloser.trim();
      const quienCerro = responsable || closer || 'Sin asignar';

      const fecha = new Date(doc['Fecha correspondiente']);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const key = `${quienCerro}_${mes}`;

      if (!agrupados[key]) {
        agrupados[key] = {
          responsable: quienCerro,
          mes,
          totalCashCollected: 0,
          totalCashCollectedClub: 0,
          totalCashCollectedOtros: 0,
          ventas: [], // Solo incluirá ventas principales con sus cobranzas
          comisionTotal: 0,
          comisionClub: 0,
          comisionMEG: 0,
          detalleComisiones: {
            MEG: {
              ventasNivel1: 0, // 1-4 ventas (8%)
              ventasNivel2: 0, // 5-9 ventas (9%)
              ventasNivel3: 0, // 10+ ventas (10%)
              comisionNivel1: 0,
              comisionNivel2: 0,
              comisionNivel3: 0
            },
            CLUB: {
              ventas: 0,
              comision: 0
            }
          }
        };
      }

      const cashCollected = parseFloat(doc['Cash collected']) || 0;
      const productoRaw = (doc['Producto Adq'] || '').toLowerCase().trim();
      const esClub = productoRaw === 'club';
      const tieneProducto = doc['Producto Adq'] && doc['Producto Adq'].trim() !== '';
      const tienePrecio = doc['Precio'] != null;
      const esVentaPrincipal = tieneProducto && tienePrecio;

      // Actualizar totales
      if (cashCollected > 0) {
        agrupados[key].totalCashCollected += cashCollected;
        if (esClub) {
          agrupados[key].totalCashCollectedClub += cashCollected;
        } else {
          agrupados[key].totalCashCollectedOtros += cashCollected;
        }
      }

      // La transacción actual
      const transaccion = {
        id: doc.id,
        cliente: doc['Nombre cliente'],
        fecha: doc['Fecha correspondiente'],
        cashCollected,
        producto: doc['Producto Adq'] || 'No tiene producto',
        precio: doc['Precio'] != null ? doc['Precio'] : 'No tiene precio',
        responsableOriginal: responsable,
        closerOriginal: closer,
        mes,
        closer: quienCerro,
        interaccion: doc['Interaccion'] || '',
        esCobranza: cashCollected > 0 && !esVentaPrincipal
      };

      // Identificar a qué venta pertenece esta transacción
      const ventaRelacionada = doc['Venta relacionada'] || (esVentaPrincipal ? doc.id : null);

      // Si es una cobranza o una venta principal, la procesamos
      if (ventaRelacionada) {
        // Si es una venta principal, la añadimos a la lista de ventas del responsable
        if (esVentaPrincipal) {
          // Aseguramos que esta venta no esté ya en la lista
          const existeVenta = agrupados[key].ventas.some(v => v.id === (doc.id));
          if (!existeVenta) {
            const nuevaVenta = {
              ...transaccion,
              cobranzas: [],
              totalCobrado: cashCollected
            };
            agrupados[key].ventas.push(nuevaVenta);
            ventasPrincipales[transaccion.id] = nuevaVenta;
          }
        }
        // Si es una cobranza, la añadimos a su venta correspondiente
        else if (cashCollected > 0) {
          // Si tiene venta relacionada, intentamos asociar como cobranza
          if (ventaRelacionada) {
            let ventaEncontrada = ventasPrincipales[ventaRelacionada];

            if (ventaEncontrada) {
              // Añadir la cobranza a la venta correspondiente
              ventaEncontrada.cobranzas.push(transaccion);
              ventaEncontrada.totalCobrado += cashCollected;
            } else {
              // Si no encontramos la venta, creamos una entrada provisional
              const ventaProvisional = {
                id: ventaRelacionada,
                cliente: doc['Nombre cliente'],
                producto: 'Venta no encontrada',
                precio: 'No disponible',
                fecha: doc['Fecha correspondiente'],
                cashCollected: 0,
                cobranzas: [transaccion],
                totalCobrado: cashCollected,
                responsableOriginal: responsable,
                closerOriginal: closer,
                mes,
                closer: quienCerro,
                interaccion: 'Venta principal no encontrada'
              };

              agrupados[key].ventas.push(ventaProvisional);
              ventasPrincipales[ventaRelacionada] = ventaProvisional;
            }
          } else {
            // Caso extra: transacción con cash, pero sin venta relacionada ni es venta principal
            const transaccionExtra = {
              ...transaccion,
              cobranzas: [],
              totalCobrado: cashCollected,
              producto: doc['Producto Adq'] || 'No tiene producto',
              precio: doc['Precio'] || 'No tiene precio',
              interaccion: doc['Interaccion'] || 'Transacción sin venta relacionada'
            };

            agrupados[key].ventas.push(transaccionExtra);
          }
        }

      }
    }

    // Calcular comisiones para cada responsable
    for (const key in agrupados) {
      const datos = agrupados[key];

      // Ordenar ventas por fecha (de más antigua a más nueva)
      datos.ventas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      // Clasificar ventas en MEG/MEG 2.0 y CLUB
      const ventasMEG = datos.ventas.filter(v => {
        const producto = (v.producto || '').toUpperCase();
        return producto.includes('MEG');
      });

      const ventasCLUB = datos.ventas.filter(v => {
        const producto = (v.producto || '').toUpperCase();
        return producto === 'CLUB';
      });

      // Calcular comisiones para MEG/MEG 2.0
      ventasMEG.forEach((venta, index) => {
        // Determinar el porcentaje de comisión según el número de venta
        let porcentajeComision;
        if (index < 4) {
          // Ventas 1-4: 8%
          porcentajeComision = 0.08;
          datos.detalleComisiones.MEG.ventasNivel1++;
          const comision = venta.totalCobrado * porcentajeComision;
          datos.detalleComisiones.MEG.comisionNivel1 += comision;
          venta.comision = comision;
          venta.nivelComision = 1;
          venta.porcentajeComision = '8%';
        } else if (index < 9) {
          // Ventas 5-9: 9%
          porcentajeComision = 0.09;
          datos.detalleComisiones.MEG.ventasNivel2++;
          const comision = venta.totalCobrado * porcentajeComision;
          datos.detalleComisiones.MEG.comisionNivel2 += comision;
          venta.comision = comision;
          venta.nivelComision = 2;
          venta.porcentajeComision = '9%';
        } else {
          // Ventas 10+: 10%
          porcentajeComision = 0.10;
          datos.detalleComisiones.MEG.ventasNivel3++;
          const comision = venta.totalCobrado * porcentajeComision;
          datos.detalleComisiones.MEG.comisionNivel3 += comision;
          venta.comision = comision;
          venta.nivelComision = 3;
          venta.porcentajeComision = '10%';
        }
      });

      // Calcular comisiones para CLUB (60% sobre el cashCollected)
      ventasCLUB.forEach(venta => {
        const comision = venta.totalCobrado * 0.6; // 60%
        datos.detalleComisiones.CLUB.ventas++;
        datos.detalleComisiones.CLUB.comision += comision;
        venta.comision = comision;
        venta.porcentajeComision = '60%';
      });

      // Calcular comisiones totales
      datos.comisionMEG =
        datos.detalleComisiones.MEG.comisionNivel1 +
        datos.detalleComisiones.MEG.comisionNivel2 +
        datos.detalleComisiones.MEG.comisionNivel3;

      datos.comisionClub = datos.detalleComisiones.CLUB.comision;
      datos.comisionTotal = datos.comisionMEG + datos.comisionClub;
    }

    for (const doc of transacciones) {
      const cashCollected = parseFloat(doc['Cash collected']) || 0;
      const ventaRelacionadaId = doc['Venta relacionada'];
      const esCobranza = cashCollected > 0 && !doc['Producto Adq'] && ventaRelacionadaId;

      if (!esCobranza) continue;

      const ventaOriginal = ventasPrincipales[ventaRelacionadaId];
      if (!ventaOriginal) continue;

      const fechaVenta = new Date(ventaOriginal.fecha);
      const fechaCobranza = new Date(doc['Fecha correspondiente']);
      const mesVenta = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
      const mesCobranza = `${fechaCobranza.getFullYear()}-${String(fechaCobranza.getMonth() + 1).padStart(2, '0')}`;

      // Solo si la cobranza pertenece a un mes distinto
      if (mesVenta === mesCobranza) continue;

      const rawResponsable = doc['Responsable'] || '';
      const rawCloser = doc['Closer Actual'] || '';
      const responsable = rawResponsable.trim();
      const closer = rawCloser.trim();
      const quienCerro = responsable || closer || 'Sin asignar';

      const key = `${quienCerro}_${mesCobranza}`;
      const agrupacion = agrupados[key];

      if (!agrupacion) continue; // No debería pasar, pero mejor prevenir

      agrupacion.cobranzasDeVentasAnteriores ??= [];

      // Obtener % de comisión real desde la venta original
      const porcentajeStr = ventaOriginal.porcentajeComision;
      let porcentaje = 0;
      if (porcentajeStr === '8%') porcentaje = 0.08;
      else if (porcentajeStr === '9%') porcentaje = 0.09;
      else if (porcentajeStr === '10%') porcentaje = 0.10;
      else if (porcentajeStr === '60%') porcentaje = 0.6;

      const comision = cashCollected * porcentaje;

      // Sumar comisiones solo en este mes (no modificar ventas originales)
      agrupacion.comisionTotal += comision;
      // Agregar también a comisionMEG si corresponde
      if (ventaOriginal.producto.toUpperCase().includes('MEG')) {
        agrupacion.comisionMEG += comision;

        // También reflejar en el nivel correspondiente si lo tiene

      }

      agrupacion.cobranzasDeVentasAnteriores.push({
        id: doc.id,
        fechaCobranza: doc['Fecha correspondiente'],
        cliente: doc['Nombre cliente'],
        producto: ventaOriginal.producto,
        porcentajeComision: porcentajeStr,
        cashCollected,
        comision,
        ventaOriginalId: ventaOriginal.id,
        fechaVenta: ventaOriginal.fecha
      });
    }


    //todas las transacciones
    // Agrupar y ordenar transacciones por mes para el front
    const transaccionesPorMes = {};

    for (const doc of transacciones) {
      const fecha = new Date(doc['Fecha correspondiente']);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

      if (!transaccionesPorMes[mes]) {
        transaccionesPorMes[mes] = [];
      }

      transaccionesPorMes[mes].push({
        id: doc.id,
        cliente: doc['Nombre cliente'],
        fecha,
        producto: doc['Producto Adq'] || 'No tiene producto',
        precio: doc['Precio'] != null ? doc['Precio'] : 'No tiene precio',
        cashCollected: parseFloat(doc['Cash collected']) || 0,
        responsable: doc['Responsable'] || '',
        closer: doc['Closer Actual'] || '',
        interaccion: doc['Interaccion'] || '',
        ventaRelacionada: doc['Venta relacionada'] || null
      });
    }

    // Ordenar las transacciones de cada mes de más reciente a más antigua
    for (const mes in transaccionesPorMes) {
      transaccionesPorMes[mes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }



    res.json({
      success: true,
      resumen: Object.values(agrupados),
      transaccionesPorMes
    });

  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

module.exports = { calcularComisiones };