(function (root) {
  const dimensions = { D: 'Dominio', I: 'Influencia', S: 'Estabilidad', C: 'Conformidad' };
  const format = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function percentages(answers) {
    const counts = { D: 0, I: 0, S: 0, C: 0 };
    answers.forEach(answer => { if (Object.hasOwn(counts, answer)) counts[answer]++; });
    return Object.fromEntries(Object.entries(counts).map(([key, count]) =>
      [key, answers.length ? Math.round(count / answers.length * 10000) / 100 : 0]));
  }

  function markup(values = {}) {
    return `<div class="disc-results">${Object.entries(dimensions).map(([key, name]) => {
      const raw = Number(values[key]);
      const value = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
      const label = format.format(value) + '%';
      return `<div class="disc-result-row" data-disc-dimension="${key}">
        <span class="disc-result-label">${name}</span>
        <div class="disc-result-track" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-valuetext="${label}">
          <span class="disc-result-fill" style="width:${value}%"></span>
        </div>
        <strong class="disc-result-value">${label}</strong>
      </div>`;
    }).join('')}</div>`;
  }

  root.DiscResults = { percentages, markup };
})(window);
