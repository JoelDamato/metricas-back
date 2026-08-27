const NOTION_PERSON_NAME_BY_ID = Object.freeze({
  // Notion oculta nombre y correo de este guest, pero conserva el ID dentro
  // de las propiedades people de sus comprobantes históricos.
  '32ed872b-594c-8111-8b96-0002d7decc97': 'Pablo Butera'
});

const NOTION_PERSON_BY_EMAIL = Object.freeze({
  'pmbutera1234@gmail.com': Object.freeze({
    id: '32ed872b-594c-8111-8b96-0002d7decc97',
    name: 'Pablo Butera',
    email: 'pmbutera1234@gmail.com'
  })
});

module.exports = {
  NOTION_PERSON_NAME_BY_ID,
  NOTION_PERSON_BY_EMAIL
};
