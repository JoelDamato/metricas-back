const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../public/diagnostico/diagnostico-core');

const root = path.resolve(__dirname, '..');
const adminHtml = fs.readFileSync(path.join(root, 'public/metricas-v2/views/diagnostico.html'), 'utf8');
const adminScript = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/diagnostico.page.js'), 'utf8');
const publicHtml = fs.readFileSync(path.join(root, 'public/diagnostico/index.html'), 'utf8');
const themeScript = fs.readFileSync(path.join(root, 'public/diagnostico/diagnostico-theme.js'), 'utf8');
const diagnosticService = require('../modules/metricasv2/services/diagnosticos.service');

test('calcula automáticamente puntajes, márgenes, rentabilidad y cashflow', () => {
  const data = core.emptyData('Valeria');
  const checkpoint = data.checkpoints.inicial;
  checkpoint.areas.costos.selects = {
    costosOcultosNivel: 'Con % exacto por cada uno',
    entiendeMargenReal: 'Sí, entiende la diferencia',
    trasladoFinanciero: 'Sí, con fórmula correcta (PV ÷ (1−%))',
    trasladoImpositivo: 'No traslada pero sabe el impacto en su rentabilidad',
    ivaEsCosto: 'No'
  };
  checkpoint.areas.costos.nums.costosFinancieros = '10%';
  checkpoint.areas.costos.nums.impuestosVariables = '3%';
  checkpoint.areas.resultados.selects = {
    comoCalculaRentabilidad: 'Ventas menos costos, con Excel/sistema',
    ivaRentabilidadGeneral: 'No',
    mezclaCostosFinancierosFijos: 'No'
  };
  checkpoint.areas.resultados.nums = {
    margenMarcacion: '100%',
    margenContribucion: '',
    facturacionPromedio: '1.000.000',
    costosFijos: '300.000'
  };
  checkpoint.areas.finanzas.selects = {
    conoceSituacionFinanciera: 'Lo tiene calculado con precisión',
    tieneFondoEmergencia: 'Sí',
    tieneFondoInversiones: 'No'
  };
  checkpoint.areas.finanzas.nums = {
    dineroDisponible: '100.000',
    porCobrar: '200.000',
    deudaProveedores: '50.000',
    otrasDeudas: '20.000',
    cobranzaEstimada: '300.000',
    pagosCostosFijos: '100.000'
  };

  core.autofillDerivedMargins(checkpoint);
  core.applyAutoScores(checkpoint);
  const calculated = core.calculateStage(checkpoint);

  assert.equal(checkpoint.areas.resultados.nums.margenContribucion, '50.0%');
  assert.equal(checkpoint.areas.costos.score, 4);
  assert.equal(checkpoint.areas.resultados.score, 5);
  assert.equal(checkpoint.areas.finanzas.score, 3);
  assert.equal(calculated.netMargin, 47);
  assert.equal(calculated.monthlyResult, 170000);
  assert.equal(calculated.netProfitPercent, 17);
  assert.equal(Math.round(calculated.breakEven), 638298);
  assert.equal(calculated.finance.totalResult, 230000);
  assert.equal(calculated.finance.projectedResult, 430000);
});

test('un diagnóstico vacío no aparece como avanzado ni inventa costos en cero', () => {
  const data = core.emptyData();
  const checkpoint = data.checkpoints.inicial;
  const summary = core.computeSummary(checkpoint, 'inicial');
  const calculated = core.calculateStage(checkpoint);

  assert.equal(summary.average, null);
  assert.equal(summary.band, 'grey');
  assert.equal(calculated.financialCost, null);
  assert.equal(calculated.taxCost, null);
});

test('migra diagnósticos anteriores sin perder valores, puntajes ni dificultades', () => {
  const oldData = {
    checkpoints: {
      inicial: {
        date: '2026-01-10',
        areas: {
          costos: {
            score: 2,
            values: { margenMarcacionProducto: '100', productoMasVendido: 'Servicio A' },
            patterns: ['Mezcla finanzas personales y del negocio', 'No conoce su margen de contribución'],
            note: 'Nota existente'
          }
        }
      },
      medio: { date: '', areas: {} },
      final: {
        date: '',
        areas: {
          rentabilidadFinal: { score: null, values: { facturacionPromedio: '2.000.000', costosFijos: '500.000' } },
          finanzas_u7: { score: 4, values: {} }
        }
      }
    }
  };

  const migrated = core.normalizeData(oldData, 'Belén');

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.checkpoints.inicial.areas.costos.nums.productoMasVendido, 'Servicio A');
  assert.equal(migrated.checkpoints.inicial.areas.costos.nums.margenContribucionProducto, '50.0%');
  assert.equal(migrated.checkpoints.inicial.areas.costos.note, 'Nota existente');
  assert.ok(migrated.checkpoints.inicial.patterns.includes('mezclaFinanzas'));
  assert.ok(migrated.checkpoints.inicial.patterns.includes('otro'));
  assert.match(migrated.checkpoints.inicial.otroDetalle, /No conoce su margen/);
  assert.equal(migrated.checkpoints.final.areas.resultados.nums.facturacionPromedio, '2.000.000');
  assert.equal(migrated.checkpoints.final.areas.finanzas.score, 4);
});

test('mantiene búsqueda CSM, persistencia Supabase y link público por GHL', () => {
  assert.match(adminHtml, /id="clientSearch"/);
  assert.match(adminHtml, /id="clientSuggestions"/);
  assert.match(adminHtml, /id="copyLink"/);
  assert.match(adminHtml, /\/diagnostico\/diagnostico-core\.js/);
  assert.match(adminScript, /\/api\/metricas\/diagnosticos\/clientes-csm/);
  assert.match(adminScript, /\/diagnostico\/\?ghl_id=/);
  assert.match(adminScript, /method: 'PATCH'/);
  assert.match(adminScript, /navigator\.clipboard\.writeText/);
  assert.match(adminScript, /clientes-csm\?q=/);
  assert.match(adminHtml, /CSM y en Leads/);
});

test('la búsqueda de diagnóstico incorpora Leads y prioriza CSM sin duplicados', () => {
  const { mergeDiagnosticClients, normalizeSearchTerm } = diagnosticService._test;
  const clients = mergeDiagnosticClients(
    [{ nombre: 'Cliente CSM', ghlid: 'ghl-1', modelo_negocio: '' }],
    [
      { nombre: 'Nombre anterior', ghlid: 'ghl-1', modelo_negocio: 'Servicios' },
      { nombre: 'Ivan Gabino Orellano', ghlid: 'TKdbAGdg2lIDVRvat9u8', modelo_negocio: 'Reventa' },
      { nombre: '', ghlid: 'sin-nombre', modelo_negocio: 'Otro' }
    ]
  );

  assert.deepEqual(clients, [
    { ghlId: 'ghl-1', name: 'Cliente CSM', businessName: 'Servicios', source: 'csm' },
    { ghlId: 'TKdbAGdg2lIDVRvat9u8', name: 'Ivan Gabino Orellano', businessName: 'Reventa', source: 'leads_raw' }
  ]);
  assert.equal(normalizeSearchTerm(' Iván, Gabino (Orellano) '), 'Iván Gabino Orellano');
});

test('la vista pública usa los cálculos nuevos y no muestra información interna', () => {
  assert.match(publicHtml, /\/api\/diagnostico\/cliente\//);
  assert.match(publicHtml, /diagnostico-core\.js/);
  assert.match(publicHtml, /core\.calculateStage/);
  assert.match(publicHtml, /Carta de Rumbo/);
  assert.doesNotMatch(publicHtml, /Nota interna del CSM/);
  assert.doesNotMatch(publicHtml, /Principales dificultades detectadas/);
});

test('la carta interna y pública permiten elegir tema blanco o nocturno', () => {
  [adminHtml, publicHtml].forEach((html) => {
    assert.match(html, /diagnostico-theme\.js/);
    assert.match(html, /data-diagnostic-theme-option="light"/);
    assert.match(html, /data-diagnostic-theme-option="dark"/);
    assert.match(html, /Blanco/);
    assert.match(html, /Nocturno/);
  });
  assert.match(themeScript, /localStorage\.setItem\(STORAGE_KEY, theme\)/);
  assert.match(themeScript, /documentElement\.dataset\.diagnosticTheme/);
});
