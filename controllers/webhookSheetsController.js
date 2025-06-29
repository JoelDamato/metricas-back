const { google } = require('googleapis');

// Configura tus credenciales y el ID de tu hoja
const SHEET_ID = '13pYaCyJVFz67tH_YDjl_KQ2Z2HoFl8TCddF8pe5_NAc'; // ID actualizado
const SHEET_NAME = 'MR / BDD'; // Nombre de la hoja actualizado

// Autenticación con Google
async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credenciales-google.json', // Debes tener este archivo
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return await auth.getClient();
}

async function findRowByUniqueField(sheets, data, uniqueField, value) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_NAME,
  });
  const rows = res.data.values || [];
  const header = rows[0];
  const idx = header.indexOf(uniqueField);
  if (idx === -1) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idx] === value) return i + 1; // Google Sheets es 1-based
  }
  return -1;
}

exports.handleWebhookSheets = async (req, res) => {
  try {
    const data = req.body;
    // Define el campo único para identificar filas (por ejemplo, 'email' o 'id')
    const uniqueField = 'email'; // Cambia esto según tu estructura
    const uniqueValue = data[uniqueField];

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Obtener encabezados
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME + '!1:1',
    });
    const header = headerRes.data.values[0];

    // Buscar si ya existe la fila
    const rowIndex = await findRowByUniqueField(sheets, data, uniqueField, uniqueValue);

    const rowData = header.map(col => data[col] || '');

    if (rowIndex > 0) {
      // Actualizar fila existente
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${rowIndex}`,
        valueInputOption: 'RAW',
        resource: { values: [rowData] },
      });
      res.json({ message: 'Fila actualizada', row: rowIndex });
    } else {
      // Agregar nueva fila
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: SHEET_NAME,
        valueInputOption: 'RAW',
        resource: { values: [rowData] },
      });
      res.json({ message: 'Fila agregada' });
    }
  } catch (error) {
    console.error('Error en webhook-sheets:', error);
    res.status(500).json({ error: 'Error al guardar en Google Sheets', details: error.message });
  }
};
