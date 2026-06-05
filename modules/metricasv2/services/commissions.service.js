const axios = require('axios');
const env = require('../config/env');
const supabaseService = require('./supabase.service');

const DEFAULT_CONFIG = {
  version: 1,
  global: {
    minimumSetterPct: 0.045,
    clubTransferPct: 0.4,
    includeOnlyVerified: true,
    defaultCloserPct: 0.08,
    personalizedCloserPct: 0.1
  },
  agendaScale: [
    { min: 0, pct: 0.045 },
    { min: 15, pct: 0.05 },
    { min: 25, pct: 0.055 },
    { min: 35, pct: 0.06 }
  ],
  setterSalesScale: [
    { min: 0, pct: 0.045 },
    { min: 5, pct: 0.05 },
    { min: 10, pct: 0.055 },
    { min: 15, pct: 0.06 }
  ],
  clubScale: [
    { min: 1, pct: 0.5 },
    { min: 4, pct: 0.55 },
    { min: 9, pct: 0.6 }
  ],
  fixedOverrides: [
    { person: 'Walter Alegre', pct: 0.1, enabled: true, note: 'Regla fija individual' }
  ],
  setterFixedOverrides: [],
  setterClubScale: [
    { min: 1, pct: 0.4 },
    { min: 3, pct: 0.45 },
    { min: 5, pct: 0.5 }
  ],
  closerRules: [
    {
      person: 'Carlos Tu',
      product: 'Meg 2.1',
      type: 'Venta',
      calendarIncludes: 'A - B',
      pct: 0.09,
      enabled: true,
      note: 'CSV abril 2026: los cierres A-B de Carlos quedaron al 9%.'
    },
    {
      person: 'Carlos Tu',
      originIncludes: 'ORG',
      calendarIncludes: '| C',
      pct: 0.1,
      enabled: true,
      note: 'CSV abril 2026: ORG C de Carlos quedó al 10%.'
    },
    {
      person: 'Mauro Gaitan',
      calendarIncludes: 'RT',
      pct: 0.09,
      enabled: true,
      note: 'CSV abril 2026: los casos RT de Mauro quedaron al 9%.'
    },
    {
      person: 'Pablo Butera',
      product: 'Meg 2.1',
      originIncludes: 'VSL - 3',
      pct: 0.09,
      enabled: true,
      note: 'CSV abril 2026: la venta VSL - 3 de Pablo quedó al 9%.'
    }
  ],
  personRoles: [
    { person: 'Mauro Gaitan', role: 'Closer' },
    { person: 'Carlos Tu', role: 'Closer' },
    { person: 'Walter Alegre', role: 'Closer' },
    { person: 'Patricia Conti', role: 'Closer' },
    { person: 'Pablo Butera', role: 'Closer' },
    { person: 'Claudio Nicolini', role: 'Closer' },
    { person: 'Nahuel Iasci', role: 'Setter' }
  ],
  personAreas: [],
  notes: [
    'Semilla inicial creada en el panel de métricas.',
    'Las escalas se pueden editar sin tocar código.',
    'El bloque principal del CSV muestra comisión de closer en "Porcentaje / Comision final ARS" y comisión de setter en "% Setter / Comision Setter".',
    'Club en closers escala por venta secuencial del mes: 50%, 55% y 60%.'
  ]
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeMonthKey(value) {
  const monthKey = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    const error = new Error('El mes debe venir en formato YYYY-MM');
    error.statusCode = 400;
    throw error;
  }
  return monthKey;
}

function getMonthBounds(monthKey) {
  const [year, month] = normalizeMonthKey(monthKey).split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  const to = next.toISOString().slice(0, 10);
  return { year, month, from, to };
}

function parseDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function safeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return ['true', 'si', 'sí', 'yes', '1', 'checked'].includes(normalized);
}

function titleCaseName(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  return source
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractResponsibleVenta(infoComprobantes = '') {
  const raw = String(infoComprobantes || '').trim();
  if (!raw) return '';
  const match = raw.match(/responsable venta:\s*([^|]+)/i);
  return titleCaseName(match?.[1] || '');
}

function normalizeScale(scale = [], fallback = []) {
  const rows = Array.isArray(scale) ? scale : fallback;
  return rows
    .map((row) => ({
      min: Math.max(0, Number(row?.min || 0)),
      pct: Number(row?.pct || 0)
    }))
    .filter((row) => Number.isFinite(row.min) && Number.isFinite(row.pct))
    .sort((a, b) => a.min - b.min);
}

function normalizeOverrides(overrides = []) {
  return (Array.isArray(overrides) ? overrides : [])
    .map((row) => ({
      person: titleCaseName(row?.person),
      pct: Number(row?.pct || 0),
      enabled: row?.enabled !== false,
      note: String(row?.note || '').trim()
    }))
    .filter((row) => row.person && Number.isFinite(row.pct));
}

function normalizePersonAreas(items = []) {
  const allowed = new Set(['Comercial', 'CSM', 'Administración']);
  return (Array.isArray(items) ? items : [])
    .map((row) => ({
      person: titleCaseName(row?.person),
      area: allowed.has(row?.area) ? row.area : 'Comercial'
    }))
    .filter((row) => row.person);
}

function normalizePersonRoles(items = []) {
  const allowed = new Set(['Closer', 'Setter', 'Ambos']);
  return (Array.isArray(items) ? items : [])
    .map((row) => ({
      person: titleCaseName(row?.person),
      role: allowed.has(row?.role) ? row.role : 'Ambos'
    }))
    .filter((row) => row.person);
}

function normalizeConfig(rawConfig = {}) {
  const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  return {
    version: 1,
    global: {
      minimumSetterPct: Number(config.global?.minimumSetterPct ?? DEFAULT_CONFIG.global.minimumSetterPct),
      clubTransferPct: Number(config.global?.clubTransferPct ?? DEFAULT_CONFIG.global.clubTransferPct),
      includeOnlyVerified: config.global?.includeOnlyVerified !== false,
      defaultCloserPct: Number(config.global?.defaultCloserPct ?? DEFAULT_CONFIG.global.defaultCloserPct),
      personalizedCloserPct: Number(config.global?.personalizedCloserPct ?? DEFAULT_CONFIG.global.personalizedCloserPct)
    },
    agendaScale: normalizeScale(config.agendaScale, DEFAULT_CONFIG.agendaScale),
    setterSalesScale: normalizeScale(config.setterSalesScale, config.agendaScale || DEFAULT_CONFIG.setterSalesScale),
    clubScale: normalizeScale(config.clubScale, DEFAULT_CONFIG.clubScale),
    fixedOverrides: normalizeOverrides(config.fixedOverrides),
    setterFixedOverrides: normalizeOverrides(config.setterFixedOverrides),
    setterClubScale: normalizeScale(config.setterClubScale, DEFAULT_CONFIG.setterClubScale),
    closerRules: normalizeCloserRules(config.closerRules, DEFAULT_CONFIG.closerRules),
    personRoles: normalizePersonRoles(config.personRoles?.length ? config.personRoles : DEFAULT_CONFIG.personRoles),
    personAreas: normalizePersonAreas(config.personAreas),
    notes: Array.isArray(config.notes) && config.notes.length
      ? config.notes.map((note) => String(note || '').trim()).filter(Boolean)
      : [...DEFAULT_CONFIG.notes]
  };
}

function normalizeCloserRules(items = [], fallback = []) {
  const rows = Array.isArray(items) && items.length ? items : fallback;
  return rows
    .map((row) => ({
      person: titleCaseName(row?.person),
      product: String(row?.product || '').trim(),
      type: titleCaseName(row?.type),
      originIncludes: String(row?.originIncludes || '').trim(),
      calendarIncludes: String(row?.calendarIncludes || '').trim(),
      pct: Number(row?.pct || 0),
      enabled: row?.enabled !== false,
      note: String(row?.note || '').trim()
    }))
    .filter((row) => Number.isFinite(row.pct));
}

function applyConfigPatch(baseConfig, patch = {}) {
  return normalizeConfig({
    ...baseConfig,
    ...patch,
    global: {
      ...(baseConfig.global || {}),
      ...(patch.global || {})
    }
  });
}

function buildHeaders(extra = {}) {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan variables de Supabase para comisiones');
    error.statusCode = 500;
    throw error;
  }

  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function fetchAllRows(resource, options = {}) {
  const pageSize = 1000;
  const rows = [];
  let offset = 0;

  while (true) {
    const chunk = await supabaseService.listRows(resource, {
      ...options,
      limit: pageSize,
      offset
    });

    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function readDefaultConfigRow() {
  try {
    const rows = await supabaseService.listRows('commission_settings', {
      limit: 1,
      eqFilters: { scope: 'default' }
    });
    return rows[0] || null;
  } catch (error) {
    if (error.statusCode === 404 || String(error.message || '').includes('commission_settings')) {
      return null;
    }
    throw error;
  }
}

async function readMonthSnapshotRow(monthKey) {
  try {
    const rows = await supabaseService.listRows('commission_month_snapshots', {
      limit: 1,
      eqFilters: { month_key: monthKey }
    });
    return rows[0] || null;
  } catch (error) {
    if (error.statusCode === 404 || String(error.message || '').includes('commission_month_snapshots')) {
      return null;
    }
    throw error;
  }
}

async function upsertTableRow(resource, body, onConflict) {
  const url = `${env.supabaseUrl}/rest/v1/${resource}`;
  const response = await axios.post(url, body, {
    headers: buildHeaders({
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    params: onConflict ? { on_conflict: onConflict } : undefined
  });

  return response.data?.[0] || body;
}

function matchesMonth(value, monthKey) {
  return parseDateOnly(value).startsWith(`${monthKey}-`);
}

function buildAreaMap(config) {
  const map = new Map();
  (config.personAreas || []).forEach((row) => {
    map.set(normalizeText(row.person), row.area);
  });
  return map;
}

function buildRoleMap(config) {
  const map = new Map();
  (config.personRoles || []).forEach((row) => {
    map.set(normalizeText(row.person), row.role);
  });
  return map;
}

function isRoleAllowed(roleMap, person, expectedRole) {
  if (!roleMap || roleMap.size === 0) return true;
  const assigned = roleMap.get(normalizeText(person));
  if (!assigned) return false;
  if (assigned === 'Ambos') return true;
  return normalizeText(assigned) === normalizeText(expectedRole);
}

function getAreaForPerson(areaMap, person, fallback = 'Comercial') {
  return areaMap.get(normalizeText(person)) || fallback;
}

function getOverridePct(overrides, person) {
  const override = (Array.isArray(overrides) ? overrides : []).find((row) => row.enabled && normalizeText(row.person) === normalizeText(person));
  return override ? Number(override.pct || 0) : null;
}

function pickScalePct(scale, count, fallbackPct) {
  const tiers = normalizeScale(scale);
  let pct = Number(fallbackPct || 0);
  tiers.forEach((tier) => {
    if (count >= tier.min) pct = tier.pct;
  });
  return pct;
}

function isClubProduct(value) {
  return normalizeText(value).includes('club');
}

function isPersonalizedProduct(value) {
  return normalizeText(value).includes('personalizado');
}

function isTransferPayment(value) {
  const normalized = normalizeText(value);
  return normalized.includes('transfer');
}

function isVerifiedForCommissions(value) {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  return !normalized.includes('error');
}

function isBclRtCase(row) {
  const origen = normalizeText(row.origen);
  const calendario = normalizeText(row.calendario_agendado);
  return origen.includes('bcl') && calendario.includes('rt');
}

function selectCashBase(row) {
  const ars = safeNumber(row.cash_collected_ars);
  if (ars > 0) return ars;
  const total = safeNumber(row.cash_collected_total);
  if (total > 0) return total;
  return safeNumber(row.cash_collected);
}

function selectCashUsd(row) {
  const total = safeNumber(row.cash_collected_total);
  if (total > 0) return total;
  return safeNumber(row.cash_collected);
}

function selectClubBase(row) {
  const neto = safeNumber(row.neto_club);
  if (neto > 0) return neto;
  return safeNumber(row.cash_collected);
}

function getSetterAgendaCount(settersMap, setterName) {
  return Number(settersMap.get(normalizeText(setterName))?.agendo || 0);
}

function getSetterClubSalesCount(settersMap, setterName) {
  return Number(settersMap.get(normalizeText(setterName))?.venta_club || 0);
}

function buildSettersMonthMap(setterRows, monthKey) {
  const map = new Map();
  setterRows
    .filter((row) => `${row.anio}-${String(row.mes).padStart(2, '0')}` === monthKey)
    .forEach((row) => {
      map.set(normalizeText(row.setter), {
        setter: titleCaseName(row.setter),
        agendo: safeNumber(row.agendo),
        ventaClub: safeNumber(row.venta_club)
      });
    });
  return map;
}

function normalizeComprobanteRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    id: String(row.id || '').trim(),
    tipo: titleCaseName(row.tipo),
    producto_format: String(row.producto_format || '').trim(),
    cliente_format: String(row.cliente_format || row.cliente || '').trim(),
    creado_por: titleCaseName(row.creado_por),
    responsable_venta_db: titleCaseName(row.responsable_venta),
    responsable_actual: titleCaseName(row.responsable_actual),
    info_comprobantes: String(row.info_comprobantes || '').trim(),
    responsable_venta: titleCaseName(
      row.responsable_venta
      || extractResponsibleVenta(row.info_comprobantes)
      || row.responsable_actual
      || row.creado_por
    ),
    setter: titleCaseName(row.setter),
    origen: String(row.origen || '').trim(),
    calendario_agendado: String(row.calendario_agendado || '').trim(),
    medios_de_pago: String(row.medios_de_pago || row.medios_de_pago_format || '').trim(),
    ghlid: String(row.ghlid || '').trim(),
    cobranza_relacionada: String(row.cobranza_relacionada || row.venta_relacionada || '').trim(),
    porcentaje_venta_vieja: safeNumber(row.porcentaje_venta_vieja),
    tc: safeNumber(row.tc),
    cheque: safeBoolean(row.cheque),
    estado: String(row.estado || '').trim(),
    conciliado: String(row.conciliacion_financiera || row.conciliacion_financiera_2 || row.conciliar || '').trim(),
    facturacion: safeNumber(row.facturacion),
    facturacion_ars: safeNumber(row.facturacion_ars),
    cash_collected_ars: safeNumber(row.cash_collected_ars),
    cash_usd: selectCashUsd(row),
    f_acreditacion_only: parseDateOnly(row.f_acreditacion),
    f_venta_only: parseDateOnly(row.f_venta),
    cash_base: selectCashBase(row),
    club_base: selectClubBase(row),
    verified_for_commissions: isVerifiedForCommissions(row.verificacion_comisiones)
  }));
}

function buildHistoricalSaleIndex(rows) {
  const byId = new Map();
  const byGhlId = new Map();

  rows
    .filter((row) => normalizeText(row.tipo) === 'venta' && !isClubProduct(row.producto_format))
    .sort((a, b) => String(a.f_acreditacion_only || a.f_venta_only || '').localeCompare(String(b.f_acreditacion_only || b.f_venta_only || '')))
    .forEach((row) => {
      if (row.id) byId.set(row.id, row);
      if (!row.ghlid) return;
      const current = byGhlId.get(row.ghlid) || [];
      current.push(row);
      byGhlId.set(row.ghlid, current);
    });

  return { byId, byGhlId };
}

function buildHistoricalTransactionIndex(rows) {
  const byId = new Map();

  rows
    .filter((row) => ['venta', 'cobranza'].includes(normalizeText(row.tipo)))
    .forEach((row) => {
      if (row.id) byId.set(row.id, row);
    });

  return { byId };
}

function findRelatedSale(row, saleIndex) {
  if (row.cobranza_relacionada && saleIndex.byId.has(row.cobranza_relacionada)) {
    return saleIndex.byId.get(row.cobranza_relacionada);
  }

  const candidates = saleIndex.byGhlId.get(row.ghlid) || [];
  const rowDate = row.f_acreditacion_only || row.f_venta_only;
  const eligible = candidates.filter((sale) => {
    const saleDate = sale.f_acreditacion_only || sale.f_venta_only;
    return !rowDate || !saleDate || saleDate <= rowDate;
  });

  return eligible[eligible.length - 1] || null;
}

function buildClubSequenceMap(rows, monthKey) {
  const groups = new Map();
  rows
    .filter((row) => matchesMonth(row.f_acreditacion_only || row.f_venta_only, monthKey))
    .filter((row) => normalizeText(row.tipo) === 'venta' && isClubProduct(row.producto_format))
    .sort((a, b) => String(a.f_acreditacion_only || a.f_venta_only || '').localeCompare(String(b.f_acreditacion_only || b.f_venta_only || '')) || a.id.localeCompare(b.id))
    .forEach((row) => {
      const setterKey = normalizeText(row.setter || row.creado_por);
      if (!setterKey) return;
      const current = groups.get(setterKey) || 0;
      groups.set(`${setterKey}:${row.id}`, current + 1);
      groups.set(setterKey, current + 1);
    });

  return groups;
}

function buildSetterMegSalesCountMap(rows) {
  const map = new Map();
  rows
    .filter((row) => normalizeText(row.tipo) === 'venta' && !isClubProduct(row.producto_format))
    .forEach((row) => {
      const setterKey = normalizeText(row.setter);
      if (!setterKey) return;
      map.set(setterKey, Number(map.get(setterKey) || 0) + 1);
    });
  return map;
}

function buildCloserClubSequenceMap(rows, monthKey) {
  const groups = new Map();
  rows
    .filter((row) => matchesMonth(row.f_acreditacion_only || row.f_venta_only, monthKey))
    .filter((row) => normalizeText(row.tipo) === 'venta' && isClubProduct(row.producto_format))
    .sort((a, b) => String(a.f_acreditacion_only || a.f_venta_only || '').localeCompare(String(b.f_acreditacion_only || b.f_venta_only || '')) || a.id.localeCompare(b.id))
    .forEach((row) => {
      const closerKey = normalizeText(row.responsable_venta || row.creado_por);
      if (!closerKey) return;
      const current = groups.get(closerKey) || 0;
      groups.set(`${closerKey}:${row.id}`, current + 1);
      groups.set(closerKey, current + 1);
    });

  return groups;
}

function matchContains(haystack, fragment) {
  if (!fragment) return true;
  return normalizeText(haystack).includes(normalizeText(fragment));
}

function findCloserRule(config, closerName, row) {
  return (config.closerRules || []).find((rule) => {
    if (!rule.enabled) return false;
    if (rule.person && normalizeText(rule.person) !== normalizeText(closerName)) return false;
    if (rule.product && normalizeText(rule.product) !== normalizeText(row.producto_format || '')) return false;
    if (rule.type && normalizeText(rule.type) !== normalizeText(row.tipo || '')) return false;
    if (!matchContains(row.origen, rule.originIncludes)) return false;
    if (!matchContains(row.calendario_agendado, rule.calendarIncludes)) return false;
    return true;
  }) || null;
}

function resolveCloserMegCommission(row, context) {
  const {
    config,
    saleIndex,
    transactionIndex,
    closerMegCache,
    visited = new Set()
  } = context;

  if (!row?.id) return null;
  if (closerMegCache.has(row.id)) return closerMegCache.get(row.id);
  if (visited.has(row.id)) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(row.id);
  const closerName = row.responsable_venta || row.creado_por || '';
  if (!closerName) return null;

  const type = normalizeText(row.tipo);
  if (type !== 'venta' && type !== 'cobranza') return null;
  if (isClubProduct(row.producto_format)) return null;

  if (type === 'cobranza') {
    if (row.porcentaje_venta_vieja > 0) {
      const payload = {
        pct: row.porcentaje_venta_vieja,
        sourceRule: 'Cobranzas heredan porcentaje',
        sourceRuleNote: 'La cobranza toma el porcentaje guardado de la venta madre.'
      };
      closerMegCache.set(row.id, payload);
      return payload;
    }

    const explicitRelatedId = row.cobranza_relacionada && transactionIndex.byId.has(row.cobranza_relacionada)
      ? row.cobranza_relacionada
      : null;
    const historicalSale = findRelatedSale(row, saleIndex);
    const relatedRow = explicitRelatedId ? transactionIndex.byId.get(explicitRelatedId) : historicalSale;
    const inherited = relatedRow
      ? resolveCloserMegCommission(relatedRow, {
        ...context,
        visited: nextVisited
      })
      : null;

    if (inherited?.pct > 0) {
      const payload = {
        pct: inherited.pct,
        sourceRule: 'Cobranzas heredan porcentaje',
        sourceRuleNote: 'La cobranza toma el porcentaje de la venta madre y no recalcula el producto.'
      };
      closerMegCache.set(row.id, payload);
      return payload;
    }
  }

  const matchedRule = findCloserRule(config, closerName, row);
  if (matchedRule) {
    const payload = {
      pct: Number(matchedRule.pct || 0),
      sourceRule: 'Regla especial closer',
      sourceRuleNote: matchedRule.note || 'Se aplicó una regla especial editable para este closer.'
    };
    closerMegCache.set(row.id, payload);
    return payload;
  }

  const overridePct = getOverridePct(config.fixedOverrides, closerName);
  if (overridePct !== null) {
    const payload = {
      pct: overridePct,
      sourceRule: 'Porcentaje fijo closer',
      sourceRuleNote: `${closerName} tiene una regla fija individual activa.`
    };
    closerMegCache.set(row.id, payload);
    return payload;
  }

  if (isPersonalizedProduct(row.producto_format)) {
    const payload = {
      pct: config.global.personalizedCloserPct,
      sourceRule: 'Producto personalizado',
      sourceRuleNote: 'Los productos personalizados toman el porcentaje fijo de closer.'
    };
    closerMegCache.set(row.id, payload);
    return payload;
  }

  const payload = {
    pct: config.global.defaultCloserPct,
    sourceRule: 'Base closer MEG',
    sourceRuleNote: 'No hubo regla especial ni fija, así que se tomó el porcentaje base del closer.'
  };
  closerMegCache.set(row.id, payload);
  return payload;
}

function buildTransactionDetails({ monthKey, config, comprobantesRows, settersRows }) {
  const normalizedRows = normalizeComprobanteRows(comprobantesRows);
  const monthRows = normalizedRows.filter((row) => matchesMonth(row.f_acreditacion_only || row.f_venta_only, monthKey));
  const activeRows = config.global.includeOnlyVerified
    ? monthRows.filter((row) => row.verified_for_commissions)
    : monthRows;

  const settersMap = buildSettersMonthMap(settersRows, monthKey);
  const saleIndex = buildHistoricalSaleIndex(normalizedRows);
  const transactionIndex = buildHistoricalTransactionIndex(normalizedRows);
  const clubSequenceMap = buildClubSequenceMap(activeRows, monthKey);
  const closerClubSequenceMap = buildCloserClubSequenceMap(activeRows, monthKey);
  const setterMegSalesMap = buildSetterMegSalesCountMap(activeRows);
  const areaMap = buildAreaMap(config);
  const roleMap = buildRoleMap(config);
  const details = [];
  const closerMegCache = new Map();

  activeRows.forEach((row) => {
    const type = normalizeText(row.tipo);
    if (type !== 'venta' && type !== 'cobranza') return;

    const isClub = isClubProduct(row.producto_format);
    const setterName = row.setter || '';
    const closerName = row.responsable_venta || row.creado_por || '';

    if (closerName && isRoleAllowed(roleMap, closerName, 'Closer')) {
      const closerArea = getAreaForPerson(areaMap, closerName, 'Comercial');
      if (isClub && type === 'venta') {
        const sequenceKey = `${normalizeText(closerName)}:${row.id}`;
        const sequentialCount = Number(closerClubSequenceMap.get(sequenceKey) || 0);
        const appliedPct = isTransferPayment(row.medios_de_pago)
          ? config.global.clubTransferPct
          : pickScalePct(config.clubScale, sequentialCount, config.global.defaultCloserPct);
        const baseAmount = row.club_base;
        if (baseAmount > 0) {
          details.push({
            id: `${row.id}:closer`,
            transactionId: row.id,
            date: row.f_acreditacion_only || row.f_venta_only || '',
            acreditacionDate: row.f_acreditacion_only || '',
            area: closerArea,
            person: closerName,
            role: 'Closer',
            category: 'Club',
            tipo: row.tipo || 'Venta',
            product: row.producto_format || 'Club',
            clientName: row.cliente_format || '',
            ghlid: row.ghlid || '',
            setter: setterName,
            closer: closerName,
            origin: row.origen || '',
            calendar: row.calendario_agendado || '',
            tc: row.tc,
            cheque: row.cheque,
            conciliado: row.conciliado || '',
            status: row.estado || '',
            facturacionUsd: row.facturacion,
            cashUsd: row.cash_usd,
            cashArs: row.cash_collected_ars,
            baseAmount,
            commissionPct: appliedPct,
            commissionAmount: baseAmount * appliedPct,
            sourceRule: isTransferPayment(row.medios_de_pago) ? 'Transferencia Club fija' : 'Escala Club closer',
            sourceRuleNote: isTransferPayment(row.medios_de_pago)
              ? 'Cuenta para la escala, pero el closer cobra el porcentaje fijo de transferencias.'
              : `Venta Club #${sequentialCount || 1} del mes para ${closerName}.`,
            counters: {
              agendas: 0,
              clubSalesSequential: sequentialCount
            }
          });
        }
      } else if (!isClub) {
        const baseAmount = row.cash_base;
        const closerResult = resolveCloserMegCommission(row, {
          config,
          saleIndex,
          transactionIndex,
          closerMegCache
        });
        if (baseAmount > 0 && closerResult?.pct > 0) {
          details.push({
            id: `${row.id}:closer`,
            transactionId: row.id,
            date: row.f_acreditacion_only || row.f_venta_only || '',
            acreditacionDate: row.f_acreditacion_only || '',
            area: closerArea,
            person: closerName,
            role: 'Closer',
            category: 'MEG',
            tipo: row.tipo || '',
            product: row.producto_format || (type === 'cobranza' ? 'Cobranza' : 'Venta'),
            clientName: row.cliente_format || '',
            ghlid: row.ghlid || '',
            setter: setterName,
            closer: closerName,
            origin: row.origen || '',
            calendar: row.calendario_agendado || '',
            tc: row.tc,
            cheque: row.cheque,
            conciliado: row.conciliado || '',
            status: row.estado || '',
            facturacionUsd: row.facturacion,
            cashUsd: row.cash_usd,
            cashArs: row.cash_collected_ars,
            baseAmount,
            commissionPct: closerResult.pct,
            commissionAmount: baseAmount * closerResult.pct,
            sourceRule: closerResult.sourceRule,
            sourceRuleNote: closerResult.sourceRuleNote,
            counters: {
              agendas: 0,
              clubSalesSequential: 0
            }
          });
        }
      }
    }

    if (!setterName || !isRoleAllowed(roleMap, setterName, 'Setter')) return;

    const fixedPct = getOverridePct(config.setterFixedOverrides, setterName);
    const setterAgendas = getSetterAgendaCount(settersMap, setterName);
    const setterClubSales = getSetterClubSalesCount(settersMap, setterName);
    const setterMegSales = Number(setterMegSalesMap.get(normalizeText(setterName)) || 0);
    const area = getAreaForPerson(areaMap, setterName, 'Comercial');

    if (isClub && type === 'venta') {
      const sequenceKey = `${normalizeText(setterName)}:${row.id}`;
      const sequentialCount = Number(clubSequenceMap.get(sequenceKey) || 0);
      const scalePct = pickScalePct(config.setterClubScale, sequentialCount || setterClubSales, config.global.clubTransferPct);
      const appliedPct = isTransferPayment(row.medios_de_pago) ? config.global.clubTransferPct : scalePct;
      const baseAmount = row.club_base;
      const commissionAmount = baseAmount * appliedPct;

      details.push({
        id: `${row.id}:setter`,
        transactionId: row.id,
        date: row.f_acreditacion_only || row.f_venta_only || '',
        acreditacionDate: row.f_acreditacion_only || '',
        area,
        person: setterName,
        role: 'Setter',
        category: 'Club',
        tipo: row.tipo || 'Venta',
        product: row.producto_format || 'Club',
        clientName: row.cliente_format || '',
        ghlid: row.ghlid || '',
        setter: setterName,
        closer: row.responsable_venta || row.creado_por || '',
        origin: row.origen || '',
        calendar: row.calendario_agendado || '',
        tc: row.tc,
        cheque: row.cheque,
        conciliado: row.conciliado || '',
        status: row.estado || '',
        facturacionUsd: row.facturacion,
        cashUsd: row.cash_usd,
        cashArs: row.cash_collected_ars,
        baseAmount,
        commissionPct: appliedPct,
        commissionAmount,
        sourceRule: isTransferPayment(row.medios_de_pago) ? 'Transferencia Club fija' : 'Escala Club setter',
        sourceRuleNote: isTransferPayment(row.medios_de_pago)
          ? 'La venta cuenta para la escala, pero cobra el porcentaje fijo de transferencias.'
          : `Venta Club #${sequentialCount || setterClubSales || 1} del mes para ${setterName}.`,
        counters: {
          agendas: setterAgendas,
          clubSalesSequential: sequentialCount || setterClubSales
        }
      });
      return;
    }

    if (isClub) return;

    const relatedSale = type === 'cobranza' ? findRelatedSale(row, saleIndex) : null;
    const inheritedPct = row.porcentaje_venta_vieja > 0
      ? row.porcentaje_venta_vieja
      : (safeNumber(relatedSale?.porcentaje_venta_vieja) > 0 ? safeNumber(relatedSale.porcentaje_venta_vieja) : null);

    let appliedPct = config.global.minimumSetterPct;
    let sourceRule = 'Mínimo global';
    let sourceRuleNote = 'Aplicado sobre el cash acreditado de la transacción.';

    if (type === 'cobranza' && inheritedPct && inheritedPct > 0) {
      appliedPct = inheritedPct;
      sourceRule = 'Cobranzas heredan porcentaje';
      sourceRuleNote = 'La cobranza toma el porcentaje de la venta madre y no recalcula la escala.';
    } else if (fixedPct !== null) {
      appliedPct = fixedPct;
      sourceRule = 'Porcentaje fijo individual';
      sourceRuleNote = `${setterName} tiene una regla fija individual activa.`;
    } else if (isBclRtCase(row)) {
      appliedPct = config.global.minimumSetterPct;
      sourceRule = 'BCL RT fijo';
      sourceRuleNote = 'Si el origen es BCL y el calendario agendado es RT, cobra fijo el mínimo global.';
    } else {
      appliedPct = pickScalePct(config.setterSalesScale, setterMegSales, config.global.minimumSetterPct);
      sourceRule = 'Escala por ventas';
      sourceRuleNote = `Escala calculada sobre ${setterMegSales} ventas MEG del setter en ${monthKey}.`;
    }

    const baseAmount = row.cash_base;
    if (baseAmount <= 0) return;

    details.push({
      id: `${row.id}:setter`,
      transactionId: row.id,
      date: row.f_acreditacion_only || row.f_venta_only || '',
      acreditacionDate: row.f_acreditacion_only || '',
      area,
      person: setterName,
      role: 'Setter',
      category: 'MEG',
      tipo: row.tipo || '',
      product: row.producto_format || (type === 'cobranza' ? 'Cobranza' : 'Venta'),
      clientName: row.cliente_format || '',
      ghlid: row.ghlid || '',
      setter: setterName,
      closer: row.responsable_venta || row.creado_por || '',
      origin: row.origen || '',
      calendar: row.calendario_agendado || '',
      tc: row.tc,
      cheque: row.cheque,
      conciliado: row.conciliado || '',
      status: row.estado || '',
      facturacionUsd: row.facturacion,
      cashUsd: row.cash_usd,
      cashArs: row.cash_collected_ars,
      baseAmount,
      commissionPct: appliedPct,
      commissionAmount: baseAmount * appliedPct,
      sourceRule,
      sourceRuleNote,
      counters: {
        agendas: setterAgendas,
        clubSalesSequential: 0
      }
    });
  });

  return details.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.person.localeCompare(b.person, 'es'));
}

function summarizeDetails(details) {
  const peopleMap = new Map();
  const uniqueTransactions = new Set();

  details.forEach((detail) => {
    if (detail.transactionId) uniqueTransactions.add(detail.transactionId);
    const key = normalizeText(`${detail.area}|${detail.person}|${detail.role}`);
    const current = peopleMap.get(key) || {
      area: detail.area,
      person: detail.person,
      role: detail.role,
      totalCommission: 0,
      totalBase: 0,
      transactionCount: 0,
      agendas: 0,
      clubSalesSequential: 0
    };

    current.totalCommission += safeNumber(detail.commissionAmount);
    current.totalBase += safeNumber(detail.baseAmount);
    current.transactionCount += 1;
    current.agendas = Math.max(current.agendas, safeNumber(detail.counters?.agendas));
    current.clubSalesSequential = Math.max(current.clubSalesSequential, safeNumber(detail.counters?.clubSalesSequential));
    peopleMap.set(key, current);
  });

  const people = [...peopleMap.values()].sort((a, b) => b.totalCommission - a.totalCommission || a.person.localeCompare(b.person, 'es'));
  const areaMap = new Map();

  people.forEach((person) => {
    const current = areaMap.get(person.area) || {
      area: person.area,
      totalCommission: 0,
      totalBase: 0,
      peopleCount: 0,
      transactionCount: 0,
      people: []
    };

    current.totalCommission += person.totalCommission;
    current.totalBase += person.totalBase;
    current.peopleCount += 1;
    current.transactionCount += person.transactionCount;
    current.people.push(person);
    areaMap.set(person.area, current);
  });

  const areas = [...areaMap.values()].sort((a, b) => b.totalCommission - a.totalCommission || a.area.localeCompare(b.area, 'es'));
  return {
    summary: {
      totalCommission: people.reduce((sum, person) => sum + person.totalCommission, 0),
      totalBase: people.reduce((sum, person) => sum + person.totalBase, 0),
      peopleCount: people.length,
      transactionCount: uniqueTransactions.size,
      commissionLineCount: details.length
    },
    areas,
    people
  };
}

async function getCommissionConfig(monthKey) {
  const safeMonth = normalizeMonthKey(monthKey);
  const defaultRow = await readDefaultConfigRow();
  const snapshotRow = await readMonthSnapshotRow(safeMonth);

  const defaultConfig = normalizeConfig(defaultRow?.config || DEFAULT_CONFIG);
  const effectiveConfig = snapshotRow?.config
    ? normalizeConfig(snapshotRow.config)
    : defaultConfig;

  return {
    month: safeMonth,
    locked: snapshotRow?.locked === true,
    defaultConfig,
    config: effectiveConfig,
    snapshot: snapshotRow || null
  };
}

async function saveCommissionConfig(monthKey, patch, user) {
  const current = await getCommissionConfig(monthKey);
  if (current.locked) {
    const error = new Error(`El mes ${monthKey} está bloqueado y no se puede modificar.`);
    error.statusCode = 409;
    throw error;
  }

  const merged = applyConfigPatch(current.config, patch);
  const saved = await upsertTableRow('commission_month_snapshots', {
    month_key: normalizeMonthKey(monthKey),
    config: merged,
    locked: false,
    locked_at: null,
    locked_by: null,
    updated_by: String(user?.email || '').trim().toLowerCase() || null
  }, 'month_key');

  return {
    month: monthKey,
    locked: false,
    config: normalizeConfig(saved.config || merged)
  };
}

async function saveDefaultCommissionConfig(patch, user) {
  const defaultRow = await readDefaultConfigRow();
  const base = normalizeConfig(defaultRow?.config || DEFAULT_CONFIG);
  const merged = applyConfigPatch(base, patch);

  const saved = await upsertTableRow('commission_settings', {
    scope: 'default',
    config: merged,
    updated_by: String(user?.email || '').trim().toLowerCase() || null
  }, 'scope');

  return normalizeConfig(saved.config || merged);
}

async function lockCommissionMonth(monthKey, user) {
  const current = await getCommissionConfig(monthKey);
  const saved = await upsertTableRow('commission_month_snapshots', {
    month_key: normalizeMonthKey(monthKey),
    config: current.config,
    locked: true,
    locked_at: new Date().toISOString(),
    locked_by: String(user?.email || '').trim().toLowerCase() || null,
    updated_by: String(user?.email || '').trim().toLowerCase() || null
  }, 'month_key');

  return {
    month: monthKey,
    locked: true,
    config: normalizeConfig(saved.config || current.config)
  };
}

async function buildCommissionDashboard(monthKey) {
  const safeMonth = normalizeMonthKey(monthKey);
  const [{ config, locked }, comprobantesRows, settersRows] = await Promise.all([
    getCommissionConfig(safeMonth),
    fetchAllRows('comprobantes', {
      select: 'id,tipo,producto_format,cliente,cliente_format,creado_por,responsable_venta,responsable_actual,info_comprobantes,setter,ghlid,origen,calendario_agendado,medios_de_pago,medios_de_pago_format,f_acreditacion,f_venta,cash_collected,cash_collected_ars,cash_collected_total,facturacion,facturacion_ars,neto_club,cobranza_relacionada,venta_relacionada,porcentaje_venta_vieja,verificacion_comisiones,tc,cheque,estado,conciliacion_financiera,conciliacion_financiera_2,conciliar'
    }),
    fetchAllRows('setters', {
      select: 'anio,mes,setter,agendo,venta_club'
    })
  ]);

  const details = buildTransactionDetails({
    monthKey: safeMonth,
    config,
    comprobantesRows,
    settersRows
  });

  const summary = summarizeDetails(details);
  return {
    month: safeMonth,
    locked,
    config,
    ...summary,
    details
  };
}

async function getCommissionPersonDetail(monthKey, person) {
  const safePerson = titleCaseName(person);
  if (!safePerson) {
    const error = new Error('Falta la persona para ver el detalle');
    error.statusCode = 400;
    throw error;
  }

  const dashboard = await buildCommissionDashboard(monthKey);
  const personDetails = dashboard.details.filter((detail) => normalizeText(detail.person) === normalizeText(safePerson));
  const personSummary = dashboard.people.find((row) => normalizeText(row.person) === normalizeText(safePerson)) || null;

  return {
    month: dashboard.month,
    locked: dashboard.locked,
    person: safePerson,
    summary: personSummary,
    details: personDetails
  };
}

module.exports = {
  DEFAULT_CONFIG,
  normalizeConfig,
  getCommissionConfig,
  saveCommissionConfig,
  saveDefaultCommissionConfig,
  lockCommissionMonth,
  buildCommissionDashboard,
  getCommissionPersonDetail
};
