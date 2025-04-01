const MetricasDataSchema = require('../models/metricasdata');

const COMMISSION_RATES = [
  { minSales: 1, rate: 0.08 },
  { minSales: 4, rate: 0.09 },
  { minSales: 9, rate: 0.10 },
  { type: 'Autoagenda', rate: 0.10 }
];

function calculateCommissionRate(salesCount) {
  const sortedRates = [...COMMISSION_RATES]
    .filter(rate => rate.minSales !== undefined)
    .sort((a, b) => b.minSales - a.minSales);

  const applicableRate = sortedRates.find(rate => salesCount >= rate.minSales);
  return applicableRate ? applicableRate.rate : 0.08;
}

async function getMegTransactions(startDate, endDate) {
  try {
    const results = await MetricasDataSchema.find({
      "Producto Adq": {
        $regex: /MEG/i,
        $not: /RENOV/i
      },
      "Fecha correspondiente": {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .select('Fecha correspondiente Responsable Closer Actual Origen Cash collected Cash collected total Producto Adq Nombre cliente Interaccion Precio')
      .lean();

    console.log(`Transacciones MEG encontradas: ${results.length}`);
    return results;
  } catch (error) {
    console.error('Error en getMegTransactions:', error);
    throw error;
  }
}

function parseCashValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  }
  return 0;
}

async function calculateCommissions(transactions) {
  const summary = {};

  transactions.forEach(transaction => {
    const closer = transaction['Closer Actual'] || transaction.Responsable;
    if (!closer) return;

    const fecha = new Date(transaction['Fecha correspondiente']);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const key = `${closer}_${mes}`;

    if (!summary[key]) {
      summary[key] = {
        closer,
        mes,
        salesCount: 0,
        cashCollected: 0,
        commission: 0,
        transactions: []
      };
    }

    const isMeg = /MEG/i.test(transaction['Producto Adq']) && !/RENOV/i.test(transaction['Producto Adq']);
    const isAutoagenda = transaction.Origen?.toLowerCase().includes("autoagenda");

    if (isMeg) {
      summary[key].salesCount += 1;
    }

    const cash = parseCashValue(transaction['Cash collected']) ||
      parseCashValue(transaction['Cash collected total']) || 0;

    summary[key].cashCollected += cash;

    summary[key].transactions.push({
      id: transaction.id,
      date: transaction['Fecha correspondiente'],
      client: transaction['Nombre cliente'],
      product: transaction['Producto Adq'],
      amount: cash,
      isMeg,
      isAutoagenda
    });
  });

  Object.keys(summary).forEach(key => {
    const data = summary[key];
    const { salesCount, cashCollected, transactions } = data;

    const rate = transactions.some(t => t.isAutoagenda)
      ? 0.10
      : calculateCommissionRate(salesCount);

    data.commission = parseFloat((cashCollected * rate).toFixed(2));
  });

  return summary;
}

async function associatePayments(transactions) {
  const result = { ventas: [], pagos: [] };

  transactions.forEach(transaction => {
    if (transaction.Interaccion?.toLowerCase().includes('cash collected')) {
      result.pagos.push(transaction);
    } else {
      result.ventas.push(transaction);
    }
  });

  result.pagos.forEach(pago => {
    const venta = result.ventas.find(v =>
      v['Nombre cliente'] === pago['Nombre cliente'] &&
      new Date(pago['Fecha correspondiente']) >= new Date(v['Fecha correspondiente'])
    );
    if (venta) {
      venta.pagosAsociados = venta.pagosAsociados || [];
      venta.pagosAsociados.push({
        id: pago.id,
        monto: parseCashValue(pago['Cash collected']) || parseCashValue(pago['Cash collected total']),
        fecha: pago['Fecha correspondiente']
      });
    }
  });

  return result;
}

module.exports = {
  getMegTransactions,
  calculateCommissions,
  associatePayments
};