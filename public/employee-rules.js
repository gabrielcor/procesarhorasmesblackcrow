document.querySelectorAll('[data-rule-selector]').forEach(selector => {
  const panels = selector.form.querySelectorAll('[data-rule-panel]');
  function updateRule() {
    panels.forEach(panel => {
      const selected = panel.dataset.rulePanel === selector.value;
      panel.hidden = !selected;
      panel.querySelectorAll('input').forEach(input => { input.disabled = !selected; });
    });
  }
  selector.addEventListener('change', updateRule);
  updateRule();
});
