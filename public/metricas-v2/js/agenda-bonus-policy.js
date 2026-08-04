(function initAgendaBonusPolicy(root, factory) {
  const policy = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = policy;
  }

  if (root) {
    root.agendaBonusPolicy = policy;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAgendaBonusPolicy() {
  function hasLaterClosedBaseMiss(rows, generatedWeekIndex) {
    return (Array.isArray(rows) ? rows : []).some((candidate) => (
      Number(candidate?.index) > Number(generatedWeekIndex)
      && candidate?.baseMiss === true
    ));
  }

  return Object.freeze({
    hasLaterClosedBaseMiss
  });
});
