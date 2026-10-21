const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({stdTTL: 120, useClones: true});
const calendars = new NodeCache({stdTTL: 3600});
const pending = new Map();
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const FIELD_IDS = {
  products: 'juv4dioQEEaOOELKtWdU', support: 'O4aDm5mD3cSNVAqqboEl',
  contractType: 'RgygmQecy6WWV4DOX3IS', pause: 'uVxcIdaL82MoKYNywQ7v',
  programEnd: 'aH75309glRcblx1oFxnc', renewalEnd: 'SBJ30WpKhfP8WNZuXdWV'
};

function linksFromNotes(notes) {
  const text = String(notes || '').replace(/&amp;/g, '&');
  const seen = new Set();
  return (text.match(/https?:\/\/[^\s<>"']+/gi) || []).flatMap(raw => {
    try {
      const url = new URL(raw.replace(/[),.;]+$/, ''));
      if (url.username || url.password || seen.has(url.href)) return [];
      seen.add(url.href);
      const host = url.hostname.toLowerCase();
      return [{url: url.href, label: host === 'fathom.video' || host.endsWith('.fathom.video')
        ? 'Ver grabación' : ['drive.google.com', 'docs.google.com'].includes(host) ? 'Ver informe' : 'Ver archivo'}];
    } catch { return []; }
  });
}

function sessionLabel(title, calendarName) {
  const text = normalize(`${title} ${calendarName}`);
  if (/diagnost/.test(text)) return /final/.test(text) ? 'Diagnóstico final' : 'Diagnóstico';
  if (/onboard|bienvenida/.test(text)) return 'Onboarding';
  if (/costo/.test(text)) return 'Costos';
  if (/cash\s*flow/.test(text)) return 'Cashflow';
  if (/financier/.test(text)) return 'EERR financiero';
  if (/economic/.test(text)) return 'EERR económico';
  if (/traffi|trafic/.test(text)) return 'Traffiker';
  if (/coach/.test(text)) return 'Coaching';
  if (/apoyo/.test(text)) return 'Apoyo';
  return null;
}

function mapAppointments(events, calendarNames = {}) {
  return events.filter(event => !event.deleted).flatMap(event => {
    const links = linksFromNotes(event.notes);
    const label = sessionLabel(event.title, calendarNames[event.calendarId]);
    if (['Traffiker', 'Coaching'].includes(label)) return [];
    // Keep unclassified material instead of silently dropping it.
    if (!label && !links.length) return [];
    return [{
      id: event.id, label: label || 'Otras sesiones', title: event.title || calendarNames[event.calendarId] || 'Sesión',
      date: String(event.startTime || '').slice(0, 10),
      status: event.appointmentStatus || event.appoinmentStatus || '',
      links
    }];
  }).sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}

function mapFields(contact) {
  const values = new Map((contact.customFields || []).map(field => [field.id, field.value]));
  return Object.fromEntries(Object.entries(FIELD_IDS).map(([key, id]) => [key, values.get(id) ?? null]));
}

async function fetchContactMaterials(contactId, options = {}) {
  const key = options.key ?? process.env.GHL_API_KEY;
  const locationId = options.locationId || process.env.GHL_LOCATION_ID || 'WU2z8kl23Dr3IyBW1hv5';
  if (!key) return {available: false, appointments: [], fields: {}};
  const request = options.request || axios.get;
  const base = (options.base || process.env.GHL_BASE_URL || process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com').replace(/\/$/, '');
  const get = async path => (await request(`${base}${path}`, {
    headers: {Authorization: `Bearer ${key}`, Version: '2021-07-28'}, timeout: 10000
  })).data;
  const cacheKey = `${base}:${locationId}:${contactId}`;
  if (!options.request && cache.has(cacheKey)) return cache.get(cacheKey);
  if (!options.request && pending.has(cacheKey)) return pending.get(cacheKey);
  const work = async () => {
    try {
      const data = await get(`/contacts/${encodeURIComponent(contactId)}`);
      const contact = data.contact;
      if (!contact || contact.locationId !== locationId) return {available: false, appointments: [], fields: {}};
      const fields = mapFields(contact);
      let events;
      try {
        const result = await get(`/contacts/${encodeURIComponent(contactId)}/appointments`);
        if (!Array.isArray(result.events)) throw Error('Invalid appointments response');
        events = result.events.filter(e => (!e.contactId || e.contactId === contactId) && (!e.locationId || e.locationId === locationId));
      } catch { return {available: false, appointments: [], fields}; }
      const names = {};
      await Promise.all([...new Set(events.map(e => e.calendarId).filter(Boolean))].map(async id => {
        const calendarKey = `${base}:${locationId}:${id}`;
        try {
          let name = !options.request && calendars.get(calendarKey);
          if (!name) {
            const data = await get(`/calendars/${encodeURIComponent(id)}`);
            name = data.calendar?.name || '';
            if (!options.request && name) calendars.set(calendarKey, name);
          }
          names[id] = name;
        } catch { /* The title and links remain available if the calendar cannot be read. */ }
      }));
      const result = {available: true, appointments: mapAppointments(events, names), fields};
      if (!options.request) cache.set(cacheKey, result);
      return result;
    } catch { return {available: false, appointments: [], fields: {}}; }
  };
  const promise = work();
  if (!options.request) pending.set(cacheKey, promise);
  try { return await promise; } finally { if (!options.request) pending.delete(cacheKey); }
}

function productsForContact(csm, fields, receipts) {
  const values = [csm?.productos_adquiridos, csm?.ultimo_producto_adquirido, fields.products,
    ...receipts.filter(r => r.tipo === 'Venta').map(r => r.producto_format)];
  const products = new Map();
  values.flat(Infinity).filter(Boolean).flatMap(value => String(value).split(/[,;\n]+/)).forEach(value => {
    const name = value.trim();
    if (name) products.set(normalize(name), name);
  });
  return [...products.values()];
}

function contractLabel(type, receipts) {
  if (!type) return 'Sin dato';
  if (!/cuotas/i.test(type)) return type;
  const latest = receipts.filter(r => r.tipo === 'Venta')
    .sort((a,b) => String(b.f_venta || b.fecha_creado || '').localeCompare(String(a.f_venta || a.fecha_creado || '')))[0];
  const match = String(latest?.cantidad_de_pagos || '').trim().match(/^(\d+)(?:\s*(?:pagos?|cuotas?))?$/i);
  const count = match && Number(match[1]);
  return count > 0 ? `${type} · ${count} ${count === 1 ? 'cuota' : 'cuotas'}` : `${type} · Cantidad de cuotas sin registrar`;
}

module.exports = {fetchContactMaterials, linksFromNotes, mapAppointments, mapFields, productsForContact, contractLabel};
