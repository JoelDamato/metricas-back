async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

window.http = { getJson };
