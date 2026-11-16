// Caché de lecturas de métricas (vistas de Supabase): se guarda en IndexedDB del navegador
// por unas horas para no recalcular las vistas pesadas en cada carga de página.
// Se vacía al entrar al login (cambio de cuenta o sesión vencida) y con cualquier escritura.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const CACHE_DB = 'metricas-cache';
const CACHE_STORE = 'respuestas';
const CACHE_PREFIXES = ['/api/metricas/views/'];
let cacheDbPromise = null;

function cacheable(url) {
  return CACHE_PREFIXES.some((prefix) => String(url).startsWith(prefix));
}

function openCacheDb() {
  if (cacheDbPromise) return cacheDbPromise;
  cacheDbPromise = new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const request = window.indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(CACHE_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
  return cacheDbPromise;
}

async function cacheOp(mode, fn) {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CACHE_STORE, mode);
      const request = fn(tx.objectStore(CACHE_STORE));
      tx.oncomplete = () => resolve(request ? request.result : null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
}

async function readCache(url) {
  const entry = await cacheOp('readonly', (store) => store.get(url));
  if (!entry || Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  return entry.data;
}

function writeCache(url, data) {
  return cacheOp('readwrite', (store) => store.put({ savedAt: Date.now(), data }, url));
}

function clearCache() {
  return cacheOp('readwrite', (store) => store.clear());
}

if (/login/i.test(window.location.pathname)) clearCache();

async function fetchJson(url) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store'
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

async function getJson(url, options = {}) {
  if (!cacheable(url) || options.fresh) {
    const data = await fetchJson(url);
    if (cacheable(url)) writeCache(url, data);
    return data;
  }
  const cached = await readCache(url);
  if (cached) return cached;
  const data = await fetchJson(url);
  writeCache(url, data);
  return data;
}

async function postJson(url, payload) {
  clearCache();
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

async function postForm(url, formData, options = {}) {
  clearCache();
  const timeoutMs = Math.max(0, Number(options.timeoutMs || 0));
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller && timeoutMs > 0
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
      headers: options.onProgress ? {Accept:'application/x-ndjson'} : undefined,
      signal: controller?.signal
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Error HTTP ${res.status}`);
    }

    if (res.headers.get('Content-Type')?.includes('application/x-ndjson')) {
      const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',result;
      function consume(line){if(!line.trim())return;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.message);if(event.type==='progress')options.onProgress?.(event);if(event.type==='result')result=event.data;}
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let index;while((index=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,index));buffer=buffer.slice(index+1);}}
      buffer+=decoder.decode();if(buffer.trim())consume(buffer);
      if(!result)throw new Error('Se perdió la confirmación del servidor. Reintentá la misma carga para consultar el resultado sin duplicarla.');
      return result;
    }
    return res.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        options.timeoutMessage
        || 'La solicitud tardó demasiado. Podés reintentar sin duplicar la carga.'
      );
    }
    throw error;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

async function patchJson(url, payload) {
  clearCache();
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
  clearCache();
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

window.http = { getJson, postJson, postForm, patchJson, deleteJson, clearCache };
