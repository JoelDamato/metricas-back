async function getJson(url) {
  const res = await fetch(url, {
    credentials: 'same-origin'
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }

  return res.json();
}

async function patchJson(url, payload) {
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }

  return res.json();
}

async function deleteJson(url, payload) {
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }

  return res.json();
}

window.http = { getJson, postJson, patchJson, deleteJson };
