const MetricasDataSchema = require('../models/metricasdata');

const COMMISSION_TIERS = [
  { minSales: 10, rate: 0.10 },
  { minSales: 5, rate: 0.09 },
  { minSales: 0, rate: 0.08 },
];

const CLUB_RATE = 0.60;
const CLUB_WHATSAPP_RATE = 0.40;
const AUTOAGENDA_RATE = 0.10;

function parseCash(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9\.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function getCommissionRate(megSalesCount) {
  return COMMISSION_TIERS.find(tier => megSalesCount >= tier.minSales)?.rate || 0.08;
}

async function calcularComisiones(req, res) {
  try {
    const registros = await MetricasDataSchema.find({
      'Producto Adq': { $ne: null },
      'Responsable': { $ne: null }
    }).lean();

    const ventas = [];
    const pagos = [];

    registros.forEach(doc => {
      const producto = doc['Producto Adq']?.trim() || '';
      const fecha = new Date(doc['Fecha correspondiente']);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

      const cliente = doc['Nombre cliente']?.trim().toLowerCase() || '';
      const responsable = doc['Responsable'] || doc['Closer Actual'] || 'Sin asignar';

      const cashCollected = parseCash(doc['Cash collected']);
      const cashCollectedTotal = parseCash(doc['Cash collected total']);
      const precio = parseCash(doc['Precio']);
      const origen = doc['Origen'] || '';
      
      // Determinar si es un producto Club
      const isClub = producto.toLowerCase().includes('club');

      const cash = cashCollectedTotal > 0 ? cashCollectedTotal : 
                   cashCollected > 0 ? cashCollected : 
                   precio > 0 ? precio : 0;

      const baseItem = {
        fecha,
        mes,
        cliente,
        responsable,
        producto,
        origen,
        cashCollected,
        precio,
        isClub,
        id: doc.id || doc._id
      };

      if (cash > 0) {
        if (doc.Interaccion?.toLowerCase().includes('cash collected')) {
          pagos.push(baseItem);
        } else if (producto && precio > 0) {
          ventas.push(baseItem);
        }
      }
    });

    ventas.forEach(venta => {
      const pagosDelCliente = pagos.filter(p =>
        p.cliente === venta.cliente && new Date(p.fecha) >= new Date(venta.fecha)
      );

      venta.totalCobrado = pagosDelCliente.reduce((sum, p) => sum + p.cash, 0) || venta.precio;
    });

    const resumen = {};
    
    // Primer bucle: contar ventas MEG para calcular correctamente las tasas
    ventas.forEach(venta => {
      const key = `${venta.responsable}_${venta.mes}`;
      
      if (!resumen[key]) {
        resumen[key] = {
          responsable: venta.responsable,
          mes: venta.mes,
          productos: {},
          totalVentas: 0,
          totalVentasMEG: 0,  
          totalVentasClub: 0,   
          totalCashCollected: 0,
          totalCashCollectedMEG: 0,
          totalCashCollectedClub: 0,
          ganancia: 0,
          ventasDetalle: []
        };
      }
      
      if (!resumen[key].productos[venta.producto]) {
        resumen[key].productos[venta.producto] = 0;
      }
      resumen[key].productos[venta.producto]++;
      
      resumen[key].totalVentas++;
      
      if (venta.isClub) {
        resumen[key].totalVentasClub++;
        resumen[key].totalCashCollectedClub += venta.totalCobrado;
      } else {
        // Solo contamos MEG para el escalón de comisiones
        resumen[key].totalVentasMEG++;
        resumen[key].totalCashCollectedMEG += venta.totalCobrado;
      }
      
      resumen[key].totalCashCollected += venta.totalCobrado;
      
      // Guardamos el detalle para calcular comisiones en el siguiente paso
      resumen[key].ventasDetalle.push(venta);
    });
    
    // Segundo bucle: calcular comisiones con la tasa correcta basada solo en ventas MEG
    Object.values(resumen).forEach(item => {
      const megCommissionRate = getCommissionRate(item.totalVentasMEG);
      
      let gananciaTotal = 0;
      
      item.ventasDetalle.forEach(venta => {
        let rate;
        const isAutoagenda = venta.origen.toLowerCase().includes('autoagenda');
        const isWhatsapp = venta.origen.toLowerCase().includes('whatsapp');
        
        if (venta.isClub) {
          // Si es Club con origen WhatsApp, usa tasa 40%, sino 60%
          rate = isWhatsapp ? CLUB_WHATSAPP_RATE : CLUB_RATE;
        } else if (isAutoagenda) {
          // Si es Autoagenda, usa 10%
          rate = AUTOAGENDA_RATE;
        } else {
          // Si es MEG normal, usa la tasa basada en la cantidad de ventas MEG
          rate = megCommissionRate;
        }
        
        const comision = parseFloat((venta.totalCobrado * rate).toFixed(2));
        gananciaTotal += comision;
      });
      
      item.ganancia = parseFloat(gananciaTotal.toFixed(2));
      delete item.ventasDetalle; // Eliminamos los detalles antes de enviar la respuesta
    });

    const resumenConsolidado = Object.values(resumen).map(item => ({
      ...item,
      productos: Object.entries(item.productos).map(([producto, cantidad]) => ({
        producto,
        cantidad
      }))
    }));

    const ajustes = [
      { ajuste: 'Cantidad de ventas MEG', number: '0-4', porcentaje: '8%' },
      { ajuste: 'Cantidad de ventas MEG', number: '5-9', porcentaje: '9%' },
      { ajuste: 'Cantidad de ventas MEG', number: '10+', porcentaje: '10%' },
      { ajuste: 'Club', number: 'SIN OPCION', porcentaje: '60%' },
      { ajuste: 'Club origen Whatsapp', number: 'SIN OPCION', porcentaje: '40%' },
      { ajuste: 'Autoagenda', number: 'SIN OPCION', porcentaje: '10%' }
    ];

    const transacciones = ventas.map(v => ({
      fecha: v.fecha,
      cliente: v.cliente,
      responsable: v.responsable,
      cash: v.totalCobrado,
      producto: v.producto,
      isClub: v.isClub
    }));

    res.json({
      success: true,
      transacciones,
      ajustes,
      resumen: resumenConsolidado
    });

  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

module.exports = { calcularComisiones };