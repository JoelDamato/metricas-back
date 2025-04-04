const axios = require('axios');
const mongoose = require('mongoose');
const NotionData = require('./models/metricasdata.js');

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error));

const NOTION_API_TOKEN = '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';
const PAGE_ID = '1ba48251-7a95-80b2-a592-d642cf05ec5d';

/* === Helpers === */

const getNumber = (prop) => {
  if (!prop || typeof prop.number !== 'number') return null;
  return prop.number;
};

const getTextValue = (prop) => {
  if (!prop) return '';
  if (prop.type === 'title') {
    return prop.title.map((item) => item.plain_text).join(' ');
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map((item) => item.plain_text).join(' ');
  }
  return '';
};

/* === Función principal para consultar ese registro === */

const checkPage = async () => {
  try {
    const response = await axios.get(`https://api.notion.com/v1/pages/${PAGE_ID}`, {
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    });

    const props = response.data.properties;
    const cashCollectedRaw = props['Cash Collected'];

    console.log('\n🧾 === DETALLE DEL REGISTRO ===');
    console.log('➡️ ID:', PAGE_ID);
    console.log('➡️ Propiedad "Cash Collected" cruda desde Notion:\n', cashCollectedRaw);
    console.log('➡️ Valor leído con getNumber:', getNumber(cashCollectedRaw));

    const transformedData = {
      id: PAGE_ID,
      Interaccion: getTextValue(props['Interaccion']),
      "Cash collected": getNumber(cashCollectedRaw),
    };

    console.log('\n📦 Documento que se guardaría en MongoDB:\n', transformedData);

    await NotionData.findOneAndUpdate(
      { id: PAGE_ID },
      transformedData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('\n✅ Documento guardado/actualizado en MongoDB.');

  } catch (error) {
    console.error('\n❌ Error al obtener o procesar el registro:', error.response?.data || error.message);
  } finally {
    mongoose.disconnect();
  }
};

checkPage();
