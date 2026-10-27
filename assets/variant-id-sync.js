(() => {
  const dataEl = document.getElementById('VariantSyncData');
  const root = document.querySelector('product-info[id^="MainProduct"]');
  if (!dataEl || !root) return;
  const variants = JSON.parse(dataEl.textContent);
  const FORMS = 'form.main-product-form, form.installment, form.sticky-atc-form';
  const BUTTON_FORMS = 'form.main-product-form, form.sticky-atc-form';
  const T = window.FoxThemeStrings || {};

  // All visible pickers (colour + size); skip the hidden old copy kept during redraw
  const visiblePickers = () =>
    [...root.querySelectorAll('variant-picker')].filter(p => p.style.display !== 'none');
  const positionOf = el => { const m = (el.name || '').trim().match(/-(\d+)$/); return m ? +m[1] : NaN; };

  const selectedOptions = () => {
    const opts = [];
    visiblePickers().forEach(picker => {
      picker.querySelectorAll('input[type="radio"]:checked, select').forEach(el => {
        const pos = positionOf(el);
        if (pos && opts[pos - 1] === undefined) opts[pos - 1] = el.value;
      });
    });
    return opts;
  };
  const currentVariant = () => {
    const o = selectedOptions();
    return variants.find(v => v.options.every((val, i) => val === o[i])) || null;
  };
  const setButtons = v => {
    document.querySelectorAll(BUTTON_FORMS).forEach(f => {
      const btn = f.querySelector('[name="add"]');
      if (!btn) return;
      const label = btn.querySelector('span:not(.f-icon)');
      btn.disabled = !v.available;
      if (label) label.textContent = v.available ? (T.addToCart || 'Add to cart') : (T.soldOut || 'Sold out');
    });
  };
  const sync = () => {
    const v = currentVariant();
    if (!v) return null;
    document.querySelectorAll(FORMS).forEach(f => {
      const input = f.querySelector('[name="id"]');
      if (input && input.value != v.id) input.value = v.id;
    });
    setButtons(v);
    return v;
  };

  document.addEventListener('change', e => {
    // Sticky dropdown: drive the real pickers instead of the theme's single-picker handler
    const stickySelect = e.target.closest?.('sticky-atc-bar select');
    if (stickySelect) {
      e.stopImmediatePropagation();
      const v = variants.find(x => String(x.id) === stickySelect.value);
      if (!v) return;
      v.options.forEach((val, i) => {
        for (const picker of visiblePickers()) {
          const radio = [...picker.querySelectorAll('input[type="radio"]')]
            .find(r => positionOf(r) === i + 1 && r.value === val);
          if (radio) { if (!radio.checked) radio.click(); return; }
          const select = [...picker.querySelectorAll('select')].find(s => positionOf(s) === i + 1);
          if (select) {
            if (select.value !== val) { select.value = val; select.dispatchEvent(new Event('change', { bubbles: true })); }
            return;
          }
        }
      });
      sync();
      return;
    }
    if (e.target.closest?.('product-info variant-picker')) sync();
  }, true);

  document.addEventListener('submit', e => {
    if (!e.target.matches?.(FORMS)) return;
    const v = sync();
    if (v && !v.available) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Safety net: after every theme redraw, re-assert what the customer sees
  const afterRedraw = () => requestAnimationFrame(() => requestAnimationFrame(sync));
  const hook = () => window.FoxThemeEvents?.subscribe
    ? window.FoxThemeEvents.subscribe('variant-change', afterRedraw)
    : setTimeout(hook, 200);
  hook();
})();