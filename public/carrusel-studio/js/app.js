const state = { prompts: [] };

function addMessage(text, role = 'assistant') {
  const wrap = document.getElementById('chatMessages');
  const node = document.createElement('div');
  node.className = `msg ${role}`;
  node.textContent = text;
  wrap.appendChild(node);
  wrap.scrollTop = wrap.scrollHeight;
}

function getPayload() {
  return {
    prompt: document.getElementById('promptInput').value.trim(),
    brand: document.getElementById('brandInput').value.trim(),
    audience: document.getElementById('audienceInput').value.trim(),
    cta: document.getElementById('ctaInput').value.trim(),
    visualStyle: document.getElementById('styleInput').value.trim(),
    aspect: document.getElementById('aspectInput').value,
    slides: Number(document.getElementById('slidesInput').value)
  };
}

function renderPrompts(prompts) {
  const list = document.getElementById('promptList');
  state.prompts = prompts;
  list.innerHTML = prompts.map((item) => `
    <article class="prompt-card">
      <strong>Slide ${item.index}</strong>
      <textarea data-slide-index="${item.index}">${item.prompt}</textarea>
    </article>
  `).join('');
}

function collectPromptOverrides() {
  return [...document.querySelectorAll('[data-slide-index]')].map((node) => ({
    index: Number(node.dataset.slideIndex),
    prompt: node.value.trim()
  }));
}

function renderGallery(images) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = images.map((image) => `
    <article class="gallery-card">
      <img src="${image.url}" alt="Slide ${image.slide}" />
      <div class="gallery-meta">
        <strong>Slide ${image.slide}</strong>
        <div><a href="${image.url}" target="_blank" rel="noreferrer">Abrir imagen</a></div>
      </div>
    </article>
  `).join('');
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Error HTTP ${res.status}`);
  }
  return data;
}

document.getElementById('chatForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = getPayload();
  if (!payload.prompt) return;

  addMessage(payload.prompt, 'user');
  addMessage('Estoy bajando esa idea a una secuencia visual para carrusel...', 'assistant');

  try {
    const response = await postJson('/api/carrusel/chat', payload);
    document.getElementById('providerBadge').textContent = 'Prompt pack listo';
    renderPrompts(response.prompts || []);
    addMessage(response.answer || 'Te dejé los prompts listos.', 'assistant');
  } catch (error) {
    addMessage(error.message, 'assistant');
  }
});

document.getElementById('generateBtn').addEventListener('click', async () => {
  const payload = getPayload();
  if (!payload.prompt) {
    addMessage('Primero pasame la idea del carrusel.', 'assistant');
    return;
  }

  const overrides = collectPromptOverrides();
  const generatePayload = {
    ...payload,
    promptOverrides: overrides
  };

  addMessage('Voy a generar las imágenes del carrusel. Esto puede tardar un poco.', 'assistant');

  try {
    const response = await postJson('/api/carrusel/generate', generatePayload);
    renderPrompts(response.prompts || []);
    renderGallery(response.images || []);
    addMessage(`Listo. Te generé ${response.images?.length || 0} imágenes.`, 'assistant');
  } catch (error) {
    addMessage(error.message, 'assistant');
  }
});
