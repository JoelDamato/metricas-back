const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const axios = require('axios');

const CUIT = '20348137000';
const POINT_OF_SALE = 5;
const INVOICE_B = 6;
const CERT_PATH = path.resolve(__dirname, '../secrets/arca/matias-randazzo-wsfe-produccion.crt');
const KEY_PATH = path.resolve(__dirname, '../secrets/arca/matias-randazzo-wsfe-produccion.key');

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlValue(xml, tag) {
  const match = String(xml).match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function xmlEscape(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[char]));
}

async function getWsaaCredentials(service = 'wsfe') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arca-wsaa-'));
  const traPath = path.join(tempDir, 'tra.xml');
  const cmsPath = path.join(tempDir, 'tra.cms');
  const now = Date.now();
  const generationTime = new Date(now - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(now + 10 * 60 * 60 * 1000).toISOString();
  const tra = `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(now / 1000)}</uniqueId><generationTime>${generationTime}</generationTime><expirationTime>${expirationTime}</expirationTime></header><service>${xmlEscape(service)}</service></loginTicketRequest>`;

  try {
    fs.writeFileSync(traPath, tra, { mode: 0o600 });
    execFileSync('openssl', [
      'smime', '-sign', '-signer', CERT_PATH, '-inkey', KEY_PATH,
      '-in', traPath, '-out', cmsPath, '-outform', 'DER', '-nodetach'
    ]);
    const cms = fs.readFileSync(cmsPath).toString('base64');
    const envelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
    const response = await axios.post('https://wsaa.afip.gov.ar/ws/services/LoginCms', envelope, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      timeout: 30000
    });
    const loginResponse = xmlValue(response.data, 'loginCmsReturn');
    const token = xmlValue(loginResponse, 'token');
    const sign = xmlValue(loginResponse, 'sign');
    if (!token || !sign) throw new Error(`WSAA no devolvió token/sign: ${String(response.data).slice(0, 600)}`);
    return { token, sign };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function getLastAuthorizedInvoice(auth, invoiceType = INVOICE_B) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/"><Auth><Token>${xmlEscape(auth.token)}</Token><Sign>${xmlEscape(auth.sign)}</Sign><Cuit>${CUIT}</Cuit></Auth><PtoVta>${POINT_OF_SALE}</PtoVta><CbteTipo>${invoiceType}</CbteTipo></FECompUltimoAutorizado></soap:Body></soap:Envelope>`;
  const response = await axios.post('https://servicios1.afip.gov.ar/wsfev1/service.asmx', envelope, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado' },
    timeout: 30000
  });
  const errorsXml = xmlValue(response.data, 'Errors');
  const errorCode = xmlValue(errorsXml, 'Code');
  const errorMessage = xmlValue(errorsXml, 'Msg');
  if (errorCode && errorCode !== '0') throw new Error(`WSFE ${errorCode}: ${errorMessage}`);
  const number = Number(xmlValue(response.data, 'CbteNro') || 0);
  return number;
}

async function main() {
  for (const filePath of [CERT_PATH, KEY_PATH]) {
    if (!fs.existsSync(filePath)) throw new Error(`Falta ${filePath}`);
  }
  const auth = await getWsaaCredentials();
  const lastNumber = await getLastAuthorizedInvoice(auth);
  console.log(JSON.stringify({ ok: true, environment: 'production', cuit: CUIT, pointOfSale: POINT_OF_SALE, invoiceType: 'Factura B', lastAuthorizedNumber: lastNumber }));
}

module.exports = {
  CUIT,
  POINT_OF_SALE,
  decodeXml,
  xmlValue,
  xmlEscape,
  getWsaaCredentials,
  getLastAuthorizedInvoice
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.response?.data || error.message);
    process.exit(1);
  });
}
