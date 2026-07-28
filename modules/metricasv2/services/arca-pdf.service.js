const path = require('node:path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { CUIT, POINT_OF_SALE } = require('../../../scripts/arca_wsfe_probe');
const {
  MONOTRIBUTO_LEGEND,
  TRANSPARENCY_LEGEND,
  invoiceAmounts
} = require('./club-invoice-policy.service');

const LOGO_PATH = path.resolve(__dirname, '../../../public/metricas-v2/assets/club-del-costo-logo.png');
const ISSUER = {
  name: 'RANDAZZO MATIAS HERNAN',
  cuit: '20-34813700-0',
  vat: 'Responsable Inscripto',
  address: 'Brown Almte Av. 706 Piso 9 Dpto A - Ciudad de Buenos Aires',
  grossIncome: '20348137000',
  activitiesStart: '01/06/2021'
};

function arcaDate(value) {
  const text = String(value || '');
  return /^\d{8}$/.test(text) ? `${text.slice(6, 8)}/${text.slice(4, 6)}/${text.slice(0, 4)}` : text;
}

function money(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
}

function invoiceNumber(pointOfSale, number) {
  return `${String(pointOfSale).padStart(5, '0')}-${String(number).padStart(8, '0')}`;
}

function displayDate(value) {
  if (!value) return 'No informado';
  const text = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00Z` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? arcaDate(text) : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function invoiceDisplayDates(row, arca) {
  const issued = new Date(arca.issuedAt || row.invoiced_at);
  const safeIssued = Number.isNaN(issued.getTime()) ? new Date() : issued;
  return {
    issued: displayDate(arca.issuedAt || row.invoiced_at),
    serviceFrom: displayDate(arca.serviceFrom || new Date(Date.UTC(safeIssued.getUTCFullYear(), safeIssued.getUTCMonth(), 1)).toISOString().slice(0, 10)),
    serviceTo: displayDate(arca.serviceTo || new Date(Date.UTC(safeIssued.getUTCFullYear(), safeIssued.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)),
    paymentDueDate: displayDate(arca.paymentDueDate || arca.issuedAt || row.invoiced_at)
  };
}

function normalizedAmounts(arca, amount) {
  if (arca.amounts) {
    return {
      total: Number(arca.amounts.total || amount),
      net: Number(arca.amounts.net || 0),
      exempt: Number(arca.amounts.exempt || 0),
      vat: Number(arca.amounts.vat || 0),
      vatRate: Number(arca.amounts.vatRate || 0),
      vatRateId: arca.amounts.vatRateId ?? null
    };
  }
  return invoiceAmounts(amount, arca.taxTreatment === 'Gravado 21%' ? 'Gravado 21%' : 'Exento');
}

function drawLegend(doc, title, body, y) {
  const bodyHeight = body ? doc.heightOfString(body, { width: 485, lineGap: 1 }) : 0;
  const height = 26 + bodyHeight;
  doc.roundedRect(40, y, 515, height, 4).fillAndStroke('#f6f8fc', '#b8c1d1');
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(8).text(title, 52, y + 8, { width: 490 });
  if (body) doc.font('Helvetica').fontSize(7).text(body, 52, y + 20, { width: 490, lineGap: 1 });
  return y + height + 7;
}

async function createInvoicePdf(row) {
  const record = row.record_snapshot || {};
  const arca = row.arca_response || {};
  const type = String(arca.invoiceType || 'B').toUpperCase();
  const typeCode = Number(arca.invoiceTypeCode || (type === 'A' ? 1 : 6));
  const pointOfSale = Number(arca.pointOfSale || POINT_OF_SALE);
  const number = Number(arca.invoiceNumber || String(row.arca_invoice_number || '').split('-').pop());
  const issued = new Date(arca.issuedAt || row.invoiced_at);
  const issuedDate = issued.toISOString().slice(0, 10);
  const amount = Number(arca.amount || record.amount || 0);
  const amounts = normalizedAmounts(arca, amount);
  const description = arca.description || record.description || 'Suscripción Club del Costo';
  const isTaxed = amounts.vat > 0;
  const unitPrice = isTaxed ? amounts.net : amounts.total;
  const dates = invoiceDisplayDates(row, arca);
  const recipientName = arca.recipientName || record.payer || 'Consumidor final';
  const recipientAddress = arca.recipientAddress || record.payerAddress || 'No informado';
  const documentType = String(record.identificationType || (Number(arca.documentType) === 80 ? 'CUIT' : Number(arca.documentType) === 96 ? 'DNI' : 'Documento'));
  const documentNumber = record.identificationNumber || arca.documentNumber || 'No informado';
  const qrPayload = {
    ver: 1,
    fecha: issuedDate,
    cuit: Number(CUIT),
    ptoVta: pointOfSale,
    tipoCmp: typeCode,
    nroCmp: number,
    importe: amounts.total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(arca.documentType || 99),
    nroDocRec: Number(arca.documentNumber || 0),
    tipoCodAut: 'E',
    codAut: Number(row.arca_cae)
  };
  const qrUrl = `https://www.arca.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(qrPayload)).toString('base64')}`;
  const qr = await QRCode.toBuffer(qrUrl, { type: 'png', width: 220, margin: 1, errorCorrectionLevel: 'M' });
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Factura ${type} ${invoiceNumber(pointOfSale, number)}` } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(40, 40, 515, 190).stroke('#26344a');
  doc.image(LOGO_PATH, 52, 52, { fit: [105, 78], align: 'center', valign: 'center' });
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(9).text(ISSUER.name, 52, 132, { width: 210 });
  doc.fillColor('#28364c').font('Helvetica').fontSize(7).text(
    `Domicilio Comercial: ${ISSUER.address}\nCondición frente al IVA: ${ISSUER.vat}\nCUIT: ${ISSUER.cuit}\nIngresos Brutos: ${ISSUER.grossIncome}\nFecha de Inicio de Actividades: ${ISSUER.activitiesStart}`,
    52,
    146,
    { width: 215, lineGap: 1.5 }
  );

  doc.rect(275, 40, 50, 59).stroke('#26344a');
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(28).text(type, 275, 54, { width: 50, align: 'center' });
  doc.fontSize(7).text(`Cód. ${String(typeCode).padStart(2, '0')}`, 275, 101, { width: 50, align: 'center' });
  doc.fontSize(20).text('FACTURA', 343, 56);
  doc.fillColor('#28364c').font('Helvetica').fontSize(8).text(
    `Punto de Venta: ${String(pointOfSale).padStart(5, '0')}\nComp. Nro.: ${String(number).padStart(8, '0')}\nFecha de Emisión: ${dates.issued}\nPeríodo Facturado Desde: ${dates.serviceFrom}\nHasta: ${dates.serviceTo}\nFecha de Vto. para el pago: ${dates.paymentDueDate}`,
    343,
    86,
    { width: 200, lineGap: 3 }
  );

  doc.rect(40, 242, 515, 116).stroke('#26344a');
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(8).text('Apellido y Nombre / Razón Social:', 52, 253, { width: 225 });
  doc.font('Helvetica').text(recipientName, 52, 265, { width: 225 });
  doc.font('Helvetica-Bold').text('Domicilio Comercial:', 52, 287, { width: 225 });
  doc.font('Helvetica').text(recipientAddress, 52, 299, { width: 225 });
  doc.font('Helvetica-Bold').text(`${documentType}:`, 52, 327);
  doc.font('Helvetica').text(String(documentNumber), 92, 327, { width: 175 });
  doc.font('Helvetica-Bold').text('Condición IVA:', 300, 253, { width: 240 });
  doc.font('Helvetica').text(arca.vatCondition || 'Consumidor Final', 300, 265, { width: 240 });
  doc.font('Helvetica-Bold').text('Condición de venta:', 300, 287, { width: 240 });
  doc.font('Helvetica').text(record.paymentMethod || 'Mercado Pago', 300, 299, { width: 240 });

  doc.rect(40, 374, 515, 34).fill('#00112f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('Cant.', 52, 386).text('Descripción', 100, 386).text('P. unitario', 402, 386).text('Subtotal', 490, 386);
  doc.rect(40, 408, 515, 76).stroke('#26344a');
  doc.fillColor('#111827').font('Helvetica').fontSize(9).text('1,00', 52, 425);
  doc.text(description, 100, 423, { width: 270, height: 48, ellipsis: true });
  doc.fillColor('#111827').fontSize(9).text(money(unitPrice), 382, 425, { width: 80, align: 'right' });
  doc.text(money(unitPrice), 474, 425, { width: 68, align: 'right' });

  const totalsHeight = isTaxed ? 91 : 70;
  doc.rect(335, 500, 220, totalsHeight).stroke('#26344a');
  let totalY = 515;
  if (isTaxed) {
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text('Subtotal gravado', 350, totalY);
    doc.text(money(amounts.net), 450, totalY, { width: 90, align: 'right' });
    totalY += 20;
    doc.text('IVA (21%)', 350, totalY).text(money(amounts.vat), 450, totalY, { width: 90, align: 'right' });
    totalY += 21;
  } else {
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text('Importe exento', 350, totalY);
    doc.text(money(amounts.exempt), 450, totalY, { width: 90, align: 'right' });
    totalY += 21;
  }
  doc.font('Helvetica-Bold').fontSize(12).text('TOTAL', 350, totalY).text(money(amounts.total), 430, totalY, { width: 110, align: 'right' });

  doc.fillColor('#526078').font('Helvetica').fontSize(7.5).text(`Observaciones: comprobante generado por operación de Mercado Pago con ID ${row.record_id}`, 40, 505, { width: 275 });

  let legendY = 606;
  if (arca.showMonotributoLegend || Number(arca.vatConditionId) === 6) {
    legendY = drawLegend(doc, 'Ley N.º 27.618', MONOTRIBUTO_LEGEND, legendY);
  }
  if (arca.showTransparency || (Number(arca.vatConditionId) !== 1 && !isTaxed)) {
    legendY = drawLegend(
      doc,
      TRANSPARENCY_LEGEND,
      `IVA CONTENIDO: ${money(amounts.vat)}\nOTROS IMPUESTOS NACIONALES INDIRECTOS: ${money(0)}`,
      legendY
    );
  }

  const footerY = Math.max(legendY + 7, 704);
  doc.image(qr, 45, footerY, { width: 105 });
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(10).text('Comprobante autorizado por ARCA', 170, footerY + 8);
  doc.fillColor('#28364c').font('Helvetica').fontSize(9).text(
    `CAE: ${row.arca_cae}\nVencimiento CAE: ${arcaDate(arca.caeExpiration)}\nOperación: ${row.record_id}`,
    170,
    footerY + 32,
    { lineGap: 5, width: 360 }
  );
  doc.fontSize(6.5).fillColor('#526078').text('El código QR permite verificar los datos fiscales de este comprobante en ARCA.', 170, footerY + 76, { width: 360 });
  doc.end();
  return completed;
}

module.exports = { createInvoicePdf };
