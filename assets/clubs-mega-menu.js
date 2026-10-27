/* Clubs mega menu — tab + master/detail + view-all switching.
   Open/close is handled by the theme's existing header dropdown logic.
   This only manages the internal state of the Clubs panel. */
(function () {
  function ping() {
    window.dispatchEvent(new Event('resize'));
  }

  function init(root) {
    if (root.dataset.clubsInit) return;
    root.dataset.clubsInit = '1';

    var tabs = root.querySelectorAll('[data-tab]');
    var panels = root.querySelectorAll('[data-panel]');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var name = t.getAttribute('data-tab');
        tabs.forEach(function (x) { x.classList.toggle('is-active', x === t); });
        panels.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === name);
        });
        ping();
      });
    });

    function select(item) {
      var key = item.getAttribute('data-master');
      var idx = item.getAttribute('data-index');
      root.querySelectorAll('[data-master="' + key + '"]').forEach(function (x) {
        x.classList.toggle('is-active', x === item);
      });
      root.querySelectorAll('[data-detail="' + key + '"]').forEach(function (d) {
        d.classList.toggle('is-active', d.getAttribute('data-index') === idx);
      });
      ping();
    }

    root.querySelectorAll('[data-master]').forEach(function (item) {
      if (item.hasAttribute('data-hover')) {
        item.addEventListener('mouseenter', function () { select(item); });
        item.addEventListener('focus', function () { select(item); });
      } else {
        item.addEventListener('click', function () { select(item); });
      }
    });

    root.querySelectorAll('[data-view-toggle]').forEach(function (toggle) {
      var panel = toggle.closest('[data-panel]');
      var bands = panel ? panel.querySelector('[data-all-grid]') : root.querySelector('[data-all-grid]');
      if (!bands) return;

      toggle.addEventListener('click', function () {
        var collapsed = bands.classList.toggle('is-collapsed');
        toggle.innerHTML = collapsed
          ? toggle.getAttribute('data-more')
          : toggle.getAttribute('data-less');
        ping();
      });

      bands.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'max-height') ping();
      });
    });
  }

  function boot() {
    document.querySelectorAll('[data-clubs-root]').forEach(init);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();