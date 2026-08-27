const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../modules/metricasv2/services/comprobantes-loader.service');
const {
  NOTION_PERSON_NAME_BY_ID,
  NOTION_PERSON_BY_EMAIL
} = require('../modules/metricasv2/config/notion-people');

const PABLO_NOTION_ID = '32ed872b-594c-8111-8b96-0002d7decc97';

test('Pablo se resuelve por su correo aunque Notion lo omita del listado de usuarios', () => {
  const match = _test.findBestNotionUserMatch([], 'Pablo Butera', {
    email: 'pmbutera1234@gmail.com'
  });

  assert.deepEqual(match, {
    id: PABLO_NOTION_ID,
    name: 'Pablo Butera',
    email: 'pmbutera1234@gmail.com'
  });
});

test('el directorio compartido conserva el nombre canónico del guest oculto', () => {
  assert.equal(NOTION_PERSON_NAME_BY_ID[PABLO_NOTION_ID], 'Pablo Butera');
  assert.equal(NOTION_PERSON_BY_EMAIL['pmbutera1234@gmail.com'].id, PABLO_NOTION_ID);
});

test('los demás responsables siguen resolviéndose por correo o similitud de nombre', () => {
  const candidates = [
    { id: 'user-1', name: 'Walter Alegre', email: 'walteralegre56@gmail.com' },
    { id: 'user-2', name: 'Valeria Calmet', email: '' }
  ];

  assert.equal(
    _test.findBestNotionUserMatch(candidates, 'Walter Alegre', { email: 'walteralegre56@gmail.com' }).id,
    'user-1'
  );
  assert.equal(
    _test.findBestNotionUserMatch(candidates, 'Vale Calmet', {}).id,
    'user-2'
  );
});
