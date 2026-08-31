function cleanText(value) {
  return String(value || '').trim();
}

function normalizeGhlId(value) {
  return cleanText(value).toLowerCase();
}

function rowEditedAt(row = {}) {
  const raw = row.last_edited_time || row.updated_at || row.created_time || '';
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildMarketingLeadByGhlId(rows = []) {
  return (rows || []).reduce((map, row) => {
    const ghlId = normalizeGhlId(row?.ghlid || row?.ghl_id);
    if (!ghlId) return map;

    const current = map.get(ghlId);
    if (!current || rowEditedAt(row) >= rowEditedAt(current)) {
      map.set(ghlId, row);
    }
    return map;
  }, new Map());
}

function resolveMarketingOrigin(row = {}, leadByGhlId = new Map()) {
  const directCurrentOrigin = cleanText(row.origen_actual);
  if (directCurrentOrigin) return directCurrentOrigin;

  const ghlId = normalizeGhlId(row.ghlid || row.ghl_id);
  const linkedLead = ghlId ? leadByGhlId.get(ghlId) : null;
  const linkedCurrentOrigin = cleanText(linkedLead?.origen_actual);
  if (linkedCurrentOrigin) return linkedCurrentOrigin;

  return '';
}

module.exports = {
  buildMarketingLeadByGhlId,
  resolveMarketingOrigin
};
