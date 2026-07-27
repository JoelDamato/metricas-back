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
  address: 'Argentina'
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

  doc.rect(40, 40, 515, 138).stroke('#26344a');
  doc.image(LOGO_PATH, 52, 52, { fit: [105, 93], align: 'center', valign: 'center' });
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(10).text(ISSUER.name, 52, 150, { width: 210 });
  doc.fillColor('#28364c').font('Helvetica').fontSize(7.5).text(`${ISSUER.vat} · CUIT ${ISSUER.cuit} · ${ISSUER.address}`, 52, 164, { width: 215 });

  doc.rect(275, 40, 50, 59).stroke('#26344a');
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(28).text(type, 275, 54, { width: 50, align: 'center' });
  doc.fontSize(7).text(`Cód. ${String(typeCode).padStart(2, '0')}`, 275, 101, { width: 50, align: 'center' });
  doc.fontSize(20).text('FACTURA', 343, 56);
  doc.fillColor('#28364c').font('Helvetica').fontSize(9.5).text(`N.º ${invoiceNumber(pointOfSale, number)}\nFecha: ${issued.toLocaleDateString('es-AR')}`, 343, 88, { lineGap: 6 });

  doc.rect(40, 190, 515, 82).stroke('#26344a');
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(9).text('Receptor:', 52, 205);
  doc.font('Helvetica').text(record.payer || 'Consumidor final', 112, 205, { width: 420 });
  doc.font('Helvetica-Bold').text('Documento:', 52, 228);
  const documentLabel = `${record.identificationType || (arca.documentType === 99 ? 'Consumidor final' : '')} ${record.identificationNumber || ''}`.trim();
  doc.font('Helvetica').text(documentLabel || 'No informado', 120, 228, { width: 160 });
  doc.font('Helvetica-Bold').text('Condición IVA:', 300, 228);
  doc.font('Helvetica').text(arca.vatCondition || 'Consumidor Final', 380, 228, { width: 160 });
  doc.font('Helvetica-Bold').text('Condición de venta:', 52, 251);
  doc.font('Helvetica').text(record.paymentMethod || 'Mercado Pago', 150, 251, { width: 370 });

  doc.rect(40, 288, 515, 34).fill('#00112f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('Cant.', 52, 300).text('Descripción', 100, 300).text('P. unitario', 402, 300).text('Subtotal', 490, 300);
  doc.rect(40, 322, 515, 88).stroke('#26344a');
  doc.fillColor('#111827').font('Helvetica').fontSize(9).text('1,00', 52, 339);
  doc.text(description, 100, 337, { width: 270, height: 55, ellipsis: true });
  doc.fontSize(7.5).fillColor('#526078').text(arca.taxTreatment || (isTaxed ? 'Gravado 21%' : 'Exento'), 100, 390);
  doc.fillColor('#111827').fontSize(9).text(money(unitPrice), 382, 339, { width: 80, align: 'right' });
  doc.text(money(unitPrice), 474, 339, { width: 68, align: 'right' });

  const totalsHeight = isTaxed ? 91 : 70;
  doc.rect(335, 425, 220, totalsHeight).stroke('#26344a');
  let totalY = 440;
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

  doc.fillColor('#526078').font('Helvetica').fontSize(7.5).text(`Observaciones: comprobante generado por operación de Mercado Pago con ID ${row.record_id}`, 40, 430, { width: 275 });

  let legendY = 530;
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

  const footerY = Math.max(legendY + 7, 662);
  doc.image(qr, 45, footerY, { width: 105 });
  doc.fillColor('#00112f').font('Helvetica-Bold').fontSize(10).text('Comprobante autorizado por ARCA', 170, footerY + 8);
  doc.fillColor('#28364c').font('Helvetica').fontSize(9).text(
    `CAE: ${row.arca_cae}\nVencimiento CAE: ${arcaDate(arca.caeExpiration)}\nOperación: ${row.record_id}`,
    170,
    footerY + 32,
    { lineGap: 5, width: 360 }
  );
  doc.fontSize(7).fillColor('#526078').text('El código QR permite verificar los datos fiscales de este comprobante en ARCA.', 170, footerY + 88, { width: 360 });
  doc.end();
  return completed;
}

module.exports = { createInvoicePdf };
