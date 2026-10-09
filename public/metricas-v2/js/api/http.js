async function getJson(url) {
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

async function postForm(url, formData, options = {}) {
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

window.http = { getJson, postJson, postForm, patchJson, deleteJson };
