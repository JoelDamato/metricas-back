const MetricasDataSchema = require('../models/metricasdata');

const COMMISSION_TIERS = [
  { minSales: 9, rate: 0.10 },
  { minSales: 4, rate: 0.09 },
  { minSales: 0, rate: 0.08 },
];

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

function getCommissionRate(salesCount, isAutoagenda = false) {
  if (isAutoagenda) return AUTOAGENDA_RATE;
  return COMMISSION_TIERS.find(tier => salesCount >= tier.minSales)?.rate || 0.08;
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
        cash,
        precio,
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
    ventas.forEach(venta => {
      const key = `${venta.responsable}_${venta.mes}`;

      if (!resumen[key]) {
        resumen[key] = {
          responsable: venta.responsable,
          mes: venta.mes,
          productos: {},
          totalVentas: 0,
          totalCashCollected: 0,
          ganancia: 0
        };
      }

   
      if (!resumen[key].productos[venta.producto]) {
        resumen[key].productos[venta.producto] = 0;
      }
      resumen[key].productos[venta.producto]++;

      resumen[key].totalVentas++;
      resumen[key].totalCashCollected += venta.totalCobrado;

      const isAutoagenda = venta.origen.toLowerCase().includes('autoagenda');
      const rate = getCommissionRate(resumen[key].totalVentas, isAutoagenda);

      resumen[key].ganancia += parseFloat((venta.totalCobrado * rate).toFixed(2));
    });

   
    const resumenConsolidado = Object.values(resumen).map(item => ({
      ...item,
      productos: Object.entries(item.productos).map(([producto, cantidad]) => ({
        producto,
        cantidad
      }))
    }));

    const ajustes = [
      { ajuste: 'Cantidad de ventas', number: 4, porcentaje: '8%' },
      { ajuste: 'Cantidad de ventas', number: 9, porcentaje: '9%' },
      { ajuste: 'Cantidad de ventas', number: 15, porcentaje: '10%' },
      { ajuste: 'Cantidad de ventas', number: 100, porcentaje: '15%' },
      { ajuste: 'Autoagenda', number: 'SIN OPCION', porcentaje: '10%' }
    ];

    const transacciones = ventas.map(v => ({
      fecha: v.fecha,
      cliente: v.cliente,
      responsable: v.responsable,
      cash: v.totalCobrado,
      producto: v.producto
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