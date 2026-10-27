(function () {
  'use strict';


  const SOLDOUT_CLASS = 'variant-picker__option--soldout';
  const PICKER_SELECTOR = 'variant-picker[data-update-url="false"]';

  // Option names (case-insensitive, matched against .variant-picker__field
  // [data-option-name]) that use GLOBAL availability — struck only when sold
  // out everywhere, never cross-filtered by the other selected option.
  const GLOBAL_AVAILABILITY_OPTIONS = ['color'];

  let product = null;
  let pickers = [];
  let isUpdating = false;
  let lastKnownSelection = {}; // { position: value } — remembered across re-renders

  // ── Helpers ──────────────────────────────────────────────────────────────

  function refreshPickers() {
    pickers = Array.from(document.querySelectorAll(PICKER_SELECTOR));
  }

  function getPositionFromInput(input) {
    if (!input?.name) return NaN;
    const parts = input.name.split('-');
    return parseInt(parts[parts.length - 1], 10);
  }

  function getCurrentSelection() {
    const byPosition = {};
    const byId = [];
    refreshPickers();

    pickers.forEach(picker => {
      picker.querySelectorAll('.variant-picker__field input[type="radio"]:checked').forEach(radio => {
        const pos = getPositionFromInput(radio);
        if (!isNaN(pos)) byPosition[pos] = radio.value;
        if (radio.dataset.optionValueId && !byId.includes(radio.dataset.optionValueId)) {
          byId.push(radio.dataset.optionValueId);
        }
      });
    });

    return { byPosition, byId };
  }

  function getAllSelectedIds() {
    // Merge DOM current with lastKnownSelection — DOM takes priority,
    // but fall back to remembered values for positions where DOM has nothing
    const { byPosition, byId } = getCurrentSelection();
    const merged = { ...lastKnownSelection, ...byPosition };

    // Convert merged back to IDs by looking up inputs
    const ids = [];
    refreshPickers();

    Object.entries(merged).forEach(([pos, val]) => {
      let foundId = null;
      for (const picker of pickers) {
        const input = picker.querySelector(
          `.variant-picker__field input[type="radio"][value="${CSS.escape(val)}"]`
        );
        if (input && getPositionFromInput(input) === parseInt(pos, 10) && input.dataset.optionValueId) {
          foundId = input.dataset.optionValueId;
          break;
        }
      }
      if (foundId && !ids.includes(foundId)) ids.push(foundId);
    });

    return ids.length ? ids : byId;
  }

  function resolveVariant(byPosition) {
    if (!product?.variants) return null;
    return product.variants.find(v => {
      const opts = { 1: v.option1, 2: v.option2, 3: v.option3 };
      return Object.entries(byPosition).every(([pos, val]) => opts[pos] === val);
    }) || null;
  }

  // ignoreOthers = true → GLOBAL availability: true if this option value is
  // available in ANY variant, regardless of the other selected options.
  // ignoreOthers = false → standard cross-filter against current selection.
  function isOptionAvailable(position, value, byPosition, ignoreOthers) {
    if (!product?.variants) return true;
    return product.variants.some(v => {
      const opts = { 1: v.option1, 2: v.option2, 3: v.option3 };
      if (opts[position] !== value) return false;
      if (!ignoreOthers) {
        for (const [pos, val] of Object.entries(byPosition)) {
          if (parseInt(pos, 10) === position) continue;
          if (opts[pos] !== val) return false;
        }
      }
      return v.available;
    });
  }

  // ── DOM updates ──────────────────────────────────────────────────────────

  function markAvailability(byPosition) {
    refreshPickers();
    pickers.forEach(picker => {
      picker.querySelectorAll('.variant-picker__option').forEach(optionEl => {
        const input = optionEl.querySelector('input[type="radio"]');
        if (!input) return;
        const pos = getPositionFromInput(input);
        if (isNaN(pos)) return;

        // Determine whether this option uses global availability (no cross-filter)
        const field = optionEl.closest('.variant-picker__field');
        const optionName = (field?.dataset.optionName || '').trim().toLowerCase();
        const ignoreOthers = GLOBAL_AVAILABILITY_OPTIONS.includes(optionName);

        const available = isOptionAvailable(pos, input.value, byPosition, ignoreOthers);
        const has = optionEl.classList.contains(SOLDOUT_CLASS);
        if (available && has) optionEl.classList.remove(SOLDOUT_CLASS);
        else if (!available && !has) optionEl.classList.add(SOLDOUT_CLASS);
      });
    });
  }

  function enforceSelection(desired) {
    refreshPickers();
    pickers.forEach(picker => {
      picker.querySelectorAll('.variant-picker__field').forEach(field => {
        const inputs = Array.from(field.querySelectorAll('input[type="radio"]'));
        if (!inputs.length) return;

        const pos = getPositionFromInput(inputs[0]);
        const desiredValue = desired[pos];
        if (desiredValue === undefined) return;

        const desiredInput = inputs.find(i => i.value === desiredValue);
        if (!desiredInput) return;

        inputs.forEach(input => {
          const shouldBeChecked = input === desiredInput;
          if (input.checked !== shouldBeChecked) {
            input.checked = shouldBeChecked;
          }
        });

        const labelSpan = field.querySelector('.selected-value');
        if (labelSpan && labelSpan.textContent !== desiredValue) {
          labelSpan.textContent = desiredValue;
        }
      });
    });
  }

  // ── Load product JSON ────────────────────────────────────────────────────

  function loadProduct() {
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        if (data?.variants && Array.isArray(data.variants) && data.handle) {
          product = data;
          return Promise.resolve();
        }
      } catch (_) {}
    }

    const handle = document.querySelector('[data-product-handle]')?.dataset.productHandle
      || window.location.pathname.match(/\/products\/([^\/?#]+)/)?.[1];
    if (!handle) return Promise.reject(new Error('Product handle not found'));

    return fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(data => { product = data; });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    refreshPickers();
    if (pickers.length < 2) return;

    if (!window.FoxThemeEvents?.emit) {
      setTimeout(init, 300);
      return;
    }

    loadProduct()
      .then(() => {
        if (!product?.variants?.length) {
          console.warn('[VP Sync] No variants available.');
          return;
        }

        // Initialize lastKnownSelection from current DOM
        lastKnownSelection = getCurrentSelection().byPosition;

        // ── 1. Capture-phase listener: track user's intent BEFORE any handler runs
        document.addEventListener('change', function (event) {
          if (isUpdating) return;
          const target = event.target;
          if (!target || target.type !== 'radio') return;

          refreshPickers();
          if (!pickers.some(p => p.contains(target))) return;

          const pos = getPositionFromInput(target);
          if (!isNaN(pos)) {
            lastKnownSelection[pos] = target.value;
          }
        }, true);

        // ── 2. Patch FoxThemeEvents.emit to inject FULL ids from both pickers
        //       (merged with remembered selection to survive DOM re-renders)
        const originalEmit = window.FoxThemeEvents.emit.bind(window.FoxThemeEvents);
        window.FoxThemeEvents.emit = function (eventName, payload) {
          if (eventName === 'option-value-selection-change') {
            refreshPickers();
            const fromPicker = payload?.data?.event?.target &&
              pickers.some(p => p.contains(payload.data.event.target));
            if (fromPicker) {
              const fullIds = getAllSelectedIds();
              if (fullIds.length) payload.data.selectedOptionValues = fullIds;
            }
          }
          return originalEmit(eventName, payload);
        };

        // ── 3. After variant-change (server re-render complete): enforce our
        //       selection + mark availability. Uses FoxThemeEvents.subscribe
        //       which is what product-info.js uses.
        if (typeof window.FoxThemeEvents.subscribe === 'function') {
          window.FoxThemeEvents.subscribe('variant-change', function () {
            if (isUpdating) return;
            requestAnimationFrame(function () {
              isUpdating = true;
              try {
                enforceSelection(lastKnownSelection);
                markAvailability(lastKnownSelection);
              } finally {
                requestAnimationFrame(() => { isUpdating = false; });
              }
            });
          });
        }

        // ── 4. Also mark availability immediately on local change (before fetch)
        //       for snappy UX
        document.addEventListener('change', function (event) {
          if (isUpdating) return;
          const target = event.target;
          if (!target || target.type !== 'radio') return;
          refreshPickers();
          if (!pickers.some(p => p.contains(target))) return;

          requestAnimationFrame(function () {
            markAvailability(lastKnownSelection);
          });
        });

        // ── 5. Initial paint
        markAvailability(lastKnownSelection);

        console.log('[VP Sync] Initialised |', pickers.length, 'pickers |', product.variants.length, 'variants');
      })
      .catch(err => console.error('[VP Sync] Init failed:', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  } else {
    setTimeout(init, 200);
  }

})();