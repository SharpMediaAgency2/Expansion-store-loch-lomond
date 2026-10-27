/**
 * wishlist.js — Zest Theme (v9.1.0)
 * Wishlist page renderer + Quick View with variant sync.
 */

(function () {
  'use strict';


  var SHOP_DOMAIN      = window.Shopify && Shopify.shop ? Shopify.shop : window.location.hostname;


  // ── Helpers ───────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatMoney(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: currencyCode || 'USD', minimumFractionDigits: 2
      }).format(parseFloat(amount));
    } catch (e) { return '$' + parseFloat(amount).toFixed(2); }
  }

  function normaliseHandle(item) {
    return typeof item === 'string' ? item.split('/')[0] : String(item);
  }

  function shopifyHandle(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2018\u2019\u02bc]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ── Storage ───────────────────────────────────────────────────────

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); }
    catch (e) { return []; }
  }

  function saveWishlist(list) {
    try { localStorage.setItem('wishlist', JSON.stringify(list)); }
    catch (e) { console.error('[Wishlist] save:', e); }
  }

  function isWishlisted(handle) {
    return getWishlist().some(function (i) { return normaliseHandle(i) === handle; });
  }

  function addHandle(handle) {
    var l = getWishlist();
    if (!isWishlisted(handle)) { l.push(handle); saveWishlist(l); }
  }

  function removeHandle(handle) {
    saveWishlist(getWishlist().filter(function (i) { return normaliseHandle(i) !== handle; }));
  }

  // ── Inject styles for expanding add-to-cart button ────────────────

  function ensureButtonStyles() {
    if (document.getElementById('wl-atc-styles')) return;
    var style = document.createElement('style');
    style.id = 'wl-atc-styles';
    style.textContent = [
      '.product-card__atc {',
      '  display: inline-flex !important;',
      '  align-items: center;',
      '  justify-content: flex-start;',
      '  gap: 8px;',
      '  width: 40px;',
      '  height: 40px;',
      '  padding: 0;',
      '  overflow: hidden;',
      '  white-space: nowrap;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  opacity: 1 !important;',
      '  visibility: visible !important;',
      '  transform: none !important;',
      '  transition: width 0.3s ease, padding 0.3s ease;',
      '}',
      '.product-card__atc-icon {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 40px;',
      '  height: 40px;',
      '  flex: 0 0 40px;',
      '}',
      '.product-card__atc-text {',
      '  opacity: 0;',
      '  transition: opacity 0.2s ease 0.1s;',
      '  font-size: 0.9rem;',
      '  font-weight: 500;',
      '}',
      '.product-card__atc:hover,',
      '.product-card__atc:focus-visible {',
      '  width: 150px;',
      '  padding: 0 12px 0 0;',
      '}',
      '.product-card__atc:hover .product-card__atc-text,',
      '.product-card__atc:focus-visible .product-card__atc-text {',
      '  opacity: 1;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── CSS loader ────────────────────────────────────────────────────

  var productCssLoaded = false;

  function ensureProductCss(callback) {
    if (document.querySelector('link[href*="product.css"]')) {
      productCssLoaded = true;
    }
    if (productCssLoaded) { callback(); return; }
    if (!window.FoxThemeStyles || !FoxThemeStyles.product) { callback(); return; }

    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = FoxThemeStyles.product;
    link.onload  = function () { productCssLoaded = true; callback(); };
    link.onerror = function () { callback(); };
    document.head.appendChild(link);
  }

  // ── Quick View modal shell ────────────────────────────────────────

  var wlOverlay = null;
  var wlModal   = null;

  function ensureModalShell() {
    if (wlModal) return;

    wlOverlay = document.createElement('div');
    wlOverlay.id = 'wl-qv-overlay';
    wlOverlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.6)',
      'z-index:98', 'display:none',
      'backdrop-filter:blur(2px)', '-webkit-backdrop-filter:blur(2px)'
    ].join(';');
    wlOverlay.addEventListener('click', closeQuickView);

    wlModal = document.createElement('div');
    wlModal.id = 'wl-qv-modal';
    wlModal.setAttribute('role', 'dialog');
    wlModal.setAttribute('aria-modal', 'true');
    wlModal.setAttribute('tabindex', '-1');
    wlModal.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:99', 'background:#fff',
      'border-radius:12px',
      'box-shadow:0 24px 64px rgba(0,0,0,0.22)',
      'width:min(94vw,1100px)', 'max-height:90vh',
      'overflow-y:auto', '-webkit-overflow-scrolling:touch',
      'display:none', 'outline:none'
    ].join(';');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = [
      'position:sticky', 'top:12px', 'float:right',
      'margin:12px 12px 0 0', 'padding:0px',
      'width:36px', 'height:36px',
      'border:none', 'background:#f3f4f6',
      'border-radius:50%', 'cursor:pointer',
      'display:flex', 'align-items:center', 'justify-content:center',
      'z-index:10', 'flex-shrink:0', 'font-size:18px', 'line-height:1'
    ].join(';');
    closeBtn.innerHTML = 'X';
    closeBtn.addEventListener('click', closeQuickView);

    var wlBody = document.createElement('div');
    wlBody.id = 'wl-qv-body';
    wlBody.style.cssText = 'padding:0 24px 32px;clear:both;';

    wlModal.appendChild(closeBtn);
    wlModal.appendChild(wlBody);
    document.body.appendChild(wlOverlay);
    document.body.appendChild(wlModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeQuickView();
    });
  }

  function openModalShell() {
    ensureModalShell();
    wlOverlay.style.display = 'block';
    wlModal.style.display   = 'block';
    document.body.style.overflow = 'hidden';
    wlModal.focus();
  }

  function closeQuickView() {
    if (!wlModal) return;
    var qvBody = document.getElementById('wl-qv-body');
    if (qvBody && qvBody._qvDeactivateSync) qvBody._qvDeactivateSync();
    wlOverlay.style.display = 'none';
    wlModal.style.display   = 'none';
    document.body.style.overflow = '';
    qvBody.innerHTML = '';
    restoreHistory();
  }

  function showModalLoading() {
    ensureModalShell();
    document.getElementById('wl-qv-body').innerHTML = [
      '<div style="padding:64px;text-align:center;color:#9ca3af">',
      '<div style="width:32px;height:32px;border:2px solid #e5e7eb;border-top-color:#374151;',
      'border-radius:50%;animation:wlspin .7s linear infinite;margin:0 auto 16px"></div>',
      'Loading product…</div>',
      '<style>@keyframes wlspin{to{transform:rotate(360deg)}}</style>'
    ].join('');
    openModalShell();
  }

  function showModalError(handle) {
    document.getElementById('wl-qv-body').innerHTML = [
      '<div style="padding:64px;text-align:center;color:#9ca3af">',
      'Could not load product. ',
      '<a href="/products/' + esc(handle) + '" style="color:inherit;text-decoration:underline">View product page</a>',
      '</div>'
    ].join('');
  }

  // ── URL lock — block pushState/replaceState while QV is open ─────

  var _origPushState    = null;
  var _origReplaceState = null;

  function lockHistory() {
    if (_origPushState) return;
    _origPushState    = history.pushState.bind(history);
    _origReplaceState = history.replaceState.bind(history);

    history.pushState = function (state, title, url) {
      if (wlModal && wlModal.style.display !== 'none') return;
      _origPushState(state, title, url);
    };

    history.replaceState = function (state, title, url) {
      if (wlModal && wlModal.style.display !== 'none') return;
      _origReplaceState(state, title, url);
    };
  }

  function restoreHistory() {
    if (!_origPushState) return;
    history.pushState    = _origPushState;
    history.replaceState = _origReplaceState;
    _origPushState    = null;
    _origReplaceState = null;
  }

  // ── QV Variant Sync ───────────────────────────────────────────────
  // Runs fresh on every modal open. Re-runs on every colour/size change.
  //
  // KEY DESIGN: Uses event delegation on the modal body instead of direct
  // radio listeners. The theme replaces the entire <variant-picker> element
  // on every colour change, destroying any directly-attached listeners.
  // Delegating to body survives all picker rebuilds indefinitely.

  function initQVVariantSync(body) {

    var variantData = null;
    body.querySelectorAll('script[type="application/json"]').forEach(function (el) {
      try {
        var p = JSON.parse(el.textContent);
        if (p.variants && p.variants.length)      { variantData = p.variants; return; }
        if (Array.isArray(p) && p[0] && p[0].id) { variantData = p;          return; }
      } catch (e) {}
    });
    if (!variantData) return;

    var _state = {};

    function readStateFromDOM() {
      body.querySelectorAll('variant-picker').forEach(function (picker) {
        picker.querySelectorAll('input[type="radio"]:checked').forEach(function (r) {
          var name = (r.name || '').trim();
          var match = name.match(/-(\d+)$/);
          if (match) _state[parseInt(match[1])] = r.value;
        });
        picker.querySelectorAll('select').forEach(function (sel) {
          var selName = (sel.name || '').trim();
          if (!selName.match(/^options\[/)) return;
          var fieldWrapper = sel.closest('[data-picker-field]');
          var pk = sel.closest('variant-picker');
          if (!fieldWrapper || !pk) return;
          var allFields = Array.from(pk.querySelectorAll('[data-picker-field]'));
          var pos = allFields.indexOf(fieldWrapper) + 1;
          if (pos > 0 && sel.value) _state[pos] = sel.value;
        });
      });
    }

    readStateFromDOM();

    function syncAvailability() {
      if (!Object.keys(_state).length) return;

      body.querySelectorAll('variant-picker [data-picker-field]').forEach(function (field, fieldIdx) {
        var pos = fieldIdx + 1;
        var radios = field.querySelectorAll('input[type="radio"]');
        if (!radios.length) return;

        var otherLocks = {};
        Object.keys(_state).forEach(function (p) {
          if (parseInt(p) !== pos) otherLocks[p] = _state[p];
        });

        radios.forEach(function (radio) {
          var available = variantData.some(function (v) {
            return v['option' + pos] === radio.value
              && Object.keys(otherLocks).every(function (p) {
                return v['option' + p] === otherLocks[p];
              })
              && v.available;
          });

          var label   = body.querySelector('label[for="' + CSS.escape(radio.id) + '"]');
          var wrapper = radio.closest('.variant-picker__option');

          radio.classList.toggle('disabled', !available);
          if (label) {
            label.classList.toggle('disabled',           !available);
            label.classList.toggle('f-variant-disabled', !available);
            label.classList.toggle('unavailable',        !available);
          }
          if (wrapper) {
            wrapper.classList.toggle('variant-picker__option--soldout', !available);
          }
        });
      });
    }

    var _syncActive = true;
    body._qvDeactivateSync = function () { _syncActive = false; };

    document.addEventListener('variant:changed', function (e) {
      if (!_syncActive) return;
      if (!body.parentElement || !body.children.length) return;
      var variant = e.detail && e.detail.variant;
      if (!variant) return;
      if (variant.option1 != null) _state[1] = variant.option1;
      if (variant.option2 != null) _state[2] = variant.option2;
      if (variant.option3 != null) _state[3] = variant.option3;
      Object.keys(_state).forEach(function (k) {
        if (_state[k] == null) delete _state[k];
      });
      [0, 200, 400, 600, 800].forEach(function (delay) {
        setTimeout(function () {
          if (!_syncActive || !body.parentElement || !body.children.length) return;
          syncAvailability();
        }, delay);
      });
    });

    body.addEventListener('change', function (e) {
      var target = e.target;
      if (!target) return;

      if (target.type === 'radio') {
        var name = (target.name || '').trim();
        var match = name.match(/-(\d+)$/);
        if (match) _state[parseInt(match[1])] = target.value;
      }

      if (target.tagName === 'SELECT' && (target.name || '').trim().match(/^options\[/)) {
        var fieldWrapper = target.closest('[data-picker-field]');
        var pk = target.closest('variant-picker');
        if (fieldWrapper && pk) {
          var allFields = Array.from(pk.querySelectorAll('[data-picker-field]'));
          var pos = allFields.indexOf(fieldWrapper) + 1;
          if (pos > 0) _state[pos] = target.value;
        }
      }

    }, true);

    new MutationObserver(function (mutations) {
      var pickerChanged = mutations.some(function (m) {
        return Array.from(m.addedNodes).some(function (n) {
          return n.nodeType === 1 && n.tagName === 'VARIANT-PICKER';
        });
      });
      if (pickerChanged) {
        setTimeout(function () {
          readStateFromDOM();
          syncAvailability();
        }, 200);
      }
    }).observe(body, { childList: true, subtree: true });

    syncAvailability();
    setTimeout(function () { syncAvailability(); }, 500);
  }


  // ── Quick View — fetch real product page ──────────────────────────

  var qvCache = {};

  function openQuickView(handle, triggerBtn) {
    if (triggerBtn) triggerBtn.classList.add('btn--loading');

    // Lock URL before anything else
    lockHistory();

    showModalLoading();

    ensureProductCss(function () {
      if (qvCache[handle]) {
        injectProductHTML(handle, qvCache[handle], triggerBtn);
        initProductQuickview();
        return;
      }

      fetch('/products/' + encodeURIComponent(handle), { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (html) {
          qvCache[handle] = html;
          injectProductHTML(handle, html, triggerBtn);
          initProductQuickview();
        })
        .catch(function (err) {
          console.error('[WishlistQV] fetch error:', err);
          showModalError(handle);
          if (triggerBtn) triggerBtn.classList.remove('btn--loading');
        });
    });
  }

  function injectProductHTML(handle, pageHtml, triggerBtn) {
    var parser = new DOMParser();
    var doc    = parser.parseFromString(pageHtml, 'text/html');

    var mainSection = doc.querySelector('[id*="__main"]');
    if (!mainSection) {
      mainSection = doc.querySelector('.shopify-section:has(product-info)');
    }
    if (!mainSection) {
      console.error('[WishlistQV] Could not find main product section');
      showModalError(handle);
      if (triggerBtn) triggerBtn.classList.remove('btn--loading');
      return;
    }

    mainSection.querySelectorAll('.breadcrumbs, nav[aria-label="breadcrumbs"]').forEach(function (el) { el.remove(); });
    mainSection.querySelectorAll('product-recently-viewed').forEach(function (el) { el.remove(); });
    mainSection.querySelectorAll('product-recommendations, .product-recommendations').forEach(function (el) { el.remove(); });
    mainSection.querySelectorAll('.sticky-atc, [data-sticky-atc]').forEach(function (el) { el.remove(); });
    mainSection.querySelectorAll('modal-dialog').forEach(function (el) { el.remove(); });
    mainSection.querySelectorAll('.sticky-element, [data-sticky]').forEach(function (el) {
      el.style.position = 'relative';
      el.style.top = 'auto';
    });
    mainSection.querySelectorAll('media-gallery').forEach(function (el) {
      el.style.maxHeight = '70vh';
    });

    var body = document.getElementById('wl-qv-body');
    if (body._qvDeactivateSync) body._qvDeactivateSync();
    body.innerHTML = '';
    body.appendChild(mainSection);

    function upgradeCustomElements(root) {
      if (!window.customElements || !customElements.upgrade) return;
      try { customElements.upgrade(root); } catch (e) {}
      root.querySelectorAll('*').forEach(function (el) {
        if (el.tagName && el.tagName.includes('-')) {
          try { customElements.upgrade(el); } catch (e) {}
        }
      });
    }

    loadAssets(
      [
        FoxThemeScripts.productInfo,
        FoxThemeScripts.productMedia,
        FoxThemeScripts.variantsPicker,
        FoxThemeScripts.volumePricing
      ],
      'wl-variants-picker',
      function () {
        upgradeCustomElements(body);

        body.querySelectorAll('product-info').forEach(function (pi) {
          try {
            var pa = pi.pickupAvailability;
            if (!pa) {
              Object.defineProperty(pi, 'pickupAvailability', {
                configurable: true,
                get: function () { return { update: function () {} }; }
              });
            } else if (typeof pa.update !== 'function') {
              pa.update = function () {};
            }
          } catch (e) {}
        });

        var sectionEl = body.querySelector('[id*="template--"]');
        var templateMatch = sectionEl ? sectionEl.id.match(/template--(\d+)/) : null;
        var templateId = templateMatch ? templateMatch[1] : '';

        var SYNCED_TEMPLATES = ['27013200838980', '26930237145412', '26930237079876'];
        var needsVariantSync = SYNCED_TEMPLATES.indexOf(templateId) !== -1;

        body.querySelectorAll('product-info').forEach(function (pi) {
          pi.updateURL = function () {};
          pi.updateShareUrl = function () {};

          if (needsVariantSync) {
            var _optionValueIds = {};

            body.querySelectorAll('variant-picker').forEach(function (picker) {
              picker.querySelectorAll('input[type="radio"]:checked').forEach(function (r) {
                var name = (r.name || '').trim();
                var match = name.match(/-(\d+)$/);
                if (!match) return;
                var valueId = r.dataset.optionValueId || r.getAttribute('data-option-value-id');
                if (valueId) _optionValueIds[parseInt(match[1])] = valueId;
              });
              picker.querySelectorAll('select').forEach(function (sel) {
                var selName = (sel.name || '').trim();
                if (!selName.match(/^options\[/)) return;
                var selectedOpt = sel.options[sel.selectedIndex];
                if (selectedOpt) {
                  var valueId = selectedOpt.dataset.optionValueId || selectedOpt.getAttribute('data-option-value-id');
                  var fieldWrapper = sel.closest('[data-picker-field]');
                  var pk = sel.closest('variant-picker');
                  if (!fieldWrapper || !pk) return;
                  var allFields = Array.from(pk.querySelectorAll('[data-picker-field]'));
                  var pos = allFields.indexOf(fieldWrapper) + 1;
                  if (valueId && pos > 0) _optionValueIds[pos] = valueId;
                }
              });
            });

            body.addEventListener('change', function (e) {
              var target = e.target;
              if (!target) return;
              if (target.type === 'radio') {
                var name = (target.name || '').trim();
                var match = name.match(/-(\d+)$/);
                if (!match) return;
                var valueId = target.dataset.optionValueId || target.getAttribute('data-option-value-id');
                if (valueId) _optionValueIds[parseInt(match[1])] = valueId;
              }
              if (target.tagName === 'SELECT' && (target.name || '').trim().match(/^options\[/)) {
                var selectedOpt = target.options[target.selectedIndex];
                if (selectedOpt) {
                  var valueId = selectedOpt.dataset.optionValueId || selectedOpt.getAttribute('data-option-value-id');
                  var fieldWrapper = target.closest('[data-picker-field]');
                  var pk = target.closest('variant-picker');
                  if (fieldWrapper && pk) {
                    var allFields = Array.from(pk.querySelectorAll('[data-picker-field]'));
                    var pos = allFields.indexOf(fieldWrapper) + 1;
                    if (valueId && pos > 0) _optionValueIds[pos] = valueId;
                  }
                }
              }
            }, true);

            pi.buildRequestUrlWithParams = function (productUrl) {
              var allIds = [];
              Object.keys(_optionValueIds).sort().forEach(function (pos) {
                allIds.push(_optionValueIds[pos]);
              });
              return productUrl + '?section_id=' + pi.sectionId + '&option_values=' + allIds.join(',');
            };
          }
        });

        if (needsVariantSync) {
          initQVVariantSync(body);
        }

        if (window.Shopify && Shopify.PaymentButton) {
          Shopify.PaymentButton.init();
        }

        document.dispatchEvent(new CustomEvent('quick-view:loaded', {
          detail: { productUrl: '/products/' + handle }
        }));

        if (triggerBtn) triggerBtn.classList.remove('btn--loading');
      }
    );
  }

  // ── Bind quickview buttons ────────────────────────────────────────

  function bindQuickViewButtons(container) {
    (container || document).querySelectorAll('[data-product-quickview]:not([data-wl-qv-bound])').forEach(function (btn) {
      btn.setAttribute('data-wl-qv-bound', '1');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var handle = this.getAttribute('data-product-quickview');
        if (handle) openQuickView(handle, this);
      });
    });
  }

  // ── Storefront API ────────────────────────────────────────────────

  var PRODUCT_FIELDS = [
    'id handle title vendor availableForSale',
    'featuredImage { url altText width height }',
    'images(first: 2) { edges { node { url altText width height } } }',
    'priceRange { minVariantPrice { amount currencyCode } }',
    'compareAtPriceRange { minVariantPrice { amount currencyCode } }',
    'options(first: 10) { name values optionValues { name swatch { color image { previewImage { url } } } } }',
    'variants(first: 100) { edges { node {',
    '  id title availableForSale',
    '  price { amount currencyCode }',
    '  compareAtPrice { amount currencyCode }',
    '  selectedOptions { name value }',
    '  image { url altText width height }',
    '} } }'
  ].join('\n');

function fetchProducts(handles, callback) {
  if (!handles.length) { callback([]); return; }
  window.WishlistProducts.fetch(handles)
    .then(callback)
    .catch(function () { callback([]); });
}

  // ── Card builder ──────────────────────────────────────────────────

  function buildCardHTML(product) {
    var handle    = product.handle;
    var title     = product.title;
    var vendor    = product.vendor;
    var available = product.availableForSale;
    var url       = '/products/' + handle;

    var images      = (product.images.edges || []).map(function (e) { return e.node; });
    var mainImg     = images[0] || product.featuredImage || null;
    var secondImg   = images[1] || null;

    var variants     = (product.variants.edges || []).map(function (e) { return e.node; });
    var firstVariant = variants[0] || {};
    var price        = firstVariant.price ? firstVariant.price.amount : product.priceRange.minVariantPrice.amount;
    var currency     = firstVariant.price ? firstVariant.price.currencyCode : product.priceRange.minVariantPrice.currencyCode;
    var compareAt    = firstVariant.compareAtPrice ? firstVariant.compareAtPrice.amount : null;
    var onSale       = compareAt && parseFloat(compareAt) > parseFloat(price);

    var imgAspect = mainImg && mainImg.width && mainImg.height
      ? (mainImg.width / mainImg.height).toFixed(4) : '0.75';

    function makeImg(img, classes) {
      return '<responsive-image class="f-image ' + classes + '" style="--aspect-ratio:' + imgAspect + '" intersecting="true">'
        + '<img src="' + esc(img.url) + '" alt="' + esc(img.altText || title) + '"'
        + ' class="motion-reduce f-img-loaded" loading="lazy" fetchpriority="low"'
        + ' width="' + (img.width || 533) + '" height="' + (img.height || 711) + '">'
        + '</responsive-image>';
    }

    var mainImgHTML   = mainImg   ? makeImg(mainImg,   'product-card__image product-card__image--main') : '';
    var secondImgHTML = secondImg ? makeImg(secondImg, 'f-image--no-zoom product-card__image product-card__image--second inset-full hidden md:block') : '';

    var priceClasses = 'f-price f-price--left'
      + (!available ? ' f-price--sold-out' : '')
      + (onSale ? ' f-price--on-sale' : '');

    var priceHTML = '<div class="' + priceClasses + '">'
      + '<div class="f-price__regular">'
      + '<span class="visually-hidden visually-hidden--inline">Regular price</span>'
      + '<span class="f-price-item f-price-item--regular">' + esc(formatMoney(price, currency)) + '</span>'
      + '</div>'
      + '<div class="f-price__sale">'
      + '<span class="visually-hidden visually-hidden--inline">Sale price</span>'
      + '<span class="f-price-item f-price-item--sale">' + esc(formatMoney(price, currency)) + '</span>'
      + '<span class="visually-hidden visually-hidden--inline">Regular price</span>'
      + '<s class="f-price-item f-price-item--regular">' + (onSale ? esc(formatMoney(compareAt, currency)) : '') + '</s>'
      + '</div>'
      + '<div class="f-price__unit-wrapper hidden">'
      + '<span class="visually-hidden">Unit price</span>'
      + '<div class="f-price__unit"><span data-unit-price=""></span><span aria-hidden="true">/</span>'
      + '<span class="visually-hidden">per&nbsp;</span><span data-unit-price-base-unit=""></span></div>'
      + '</div></div>';

    var quickviewHTML = '<div class="product-card__actions">'
      + '<button type="button"'
      + ' class="btn btn--white no-color-schema product-card__atc product-card__action-button no-js-hidden"'
      + ' aria-label="Add ' + esc(title) + ' to cart"'
      + ' data-product-quickview="' + esc(handle) + '">'
      + '<span class="product-card__atc-icon" aria-hidden="true">'
      + '<svg width="17" height="20" viewBox="0 0 17 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.82715 2.75L2.30695 3.29027C2.4467 3.42483 2.63315 3.5 2.82715 3.5V2.75ZM16.25 2.75L16.9776 2.9319C17.0336 2.70785 16.9833 2.47048 16.8412 2.28844C16.699 2.1064 16.481 2 16.25 2V2.75ZM14.25 10.75V11.5C14.5942 11.5 14.8941 11.2658 14.9776 10.9319L14.25 10.75ZM11.1348 10.75V10C10.8288 10 10.5536 10.1858 10.4392 10.4695C10.3248 10.7533 10.3942 11.078 10.6145 11.2902L11.1348 10.75ZM14.25 13.75V14.5C14.5559 14.5 14.8312 14.3142 14.9456 14.0305C15.06 13.7467 14.9906 13.422 14.7702 13.2098L14.25 13.75ZM3.25 10.75V11.5C3.48095 11.5 3.69902 11.3936 3.84115 11.2116C3.98328 11.0295 4.03362 10.7922 3.97761 10.5681L3.25 10.75ZM0.75 0.75L1.2702 0.209732C1.02926 -0.0222642 0.66381 -0.0666687 0.374318 0.100875C0.0848265 0.268419 -0.0587301 0.607409 0.0223931 0.931902L0.75 0.75ZM3.25 16.75V17.5C3.38807 17.5 3.5 17.6119 3.5 17.75H4.25H5C5 16.7835 4.2165 16 3.25 16V16.75ZM4.25 17.75H3.5C3.5 17.8881 3.38807 18 3.25 18V18.75V19.5C4.2165 19.5 5 18.7165 5 17.75H4.25ZM3.25 18.75V18C3.11193 18 3 17.8881 3 17.75H2.25H1.5C1.5 18.7165 2.2835 19.5 3.25 19.5V18.75ZM2.25 17.75H3C3 17.6119 3.11193 17.5 3.25 17.5V16.75V16C2.2835 16 1.5 16.7835 1.5 17.75H2.25ZM13.25 16.75V17.5C13.3881 17.5 13.5 17.6119 13.5 17.75H14.25H15C15 16.7835 14.2165 16 13.25 16V16.75ZM14.25 17.75H13.5C13.5 17.8881 13.3881 18 13.25 18V18.75V19.5C14.2165 19.5 15 18.7165 15 17.75H14.25ZM13.25 18.75V18C13.1119 18 13 17.8881 13 17.75H12.25H11.5C11.5 18.7165 12.2835 19.5 13.25 19.5V18.75ZM12.25 17.75H13C13 17.6119 13.1119 17.5 13.25 17.5V16.75V16C12.2835 16 11.5 16.7835 11.5 17.75H12.25ZM2.82715 2.75V3.5H16.25V2.75V2H2.82715V2.75ZM16.25 2.75L15.5224 2.5681L13.5224 10.5681L14.25 10.75L14.9776 10.9319L16.9776 2.9319L16.25 2.75ZM14.25 10.75V10H11.1348V10.75V11.5H14.25V10.75ZM11.1348 10.75L10.6145 11.2902L13.7298 14.2902L14.25 13.75L14.7702 13.2098L11.655 10.2098L11.1348 10.75ZM14.25 13.75V13H2.75V13.75V14.5H14.25V13.75ZM2.75 13.75V13C2.33579 13 2 12.6642 2 12.25H1.25H0.5C0.5 13.4926 1.50736 14.5 2.75 14.5V13.75ZM1.25 12.25H2C2 11.8358 2.33579 11.5 2.75 11.5V10.75V10C1.50736 10 0.5 11.0074 0.5 12.25H1.25ZM2.75 10.75V11.5H3.25V10.75V10H2.75V10.75ZM3.25 10.75L3.97761 10.5681L1.47761 0.568098L0.75 0.75L0.0223931 0.931902L2.52239 10.9319L3.25 10.75ZM0.75 0.75L0.229798 1.29027L2.30695 3.29027L2.82715 2.75L3.34735 2.20973L1.2702 0.209732L0.75 0.75Z" fill="white"/></svg>'
      + '</span>'
      + '<span class="product-card__atc-text">Add to cart</span>'
      + '<span class="product-card__action-icon-loading f-spinner-icon" aria-hidden="true" hidden>'
      + '<svg class="f-icon-svg f-icon-svg--medium" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">'
      + '<circle fill="none" cx="33" cy="33" r="30"/></svg></span>'
      + '</button></div>';

    var wishlisted = isWishlisted(handle);
    var wishlistHTML = '<button type="button"'
      + ' class="add-to-wishlist' + (wishlisted ? ' active' : '') + '"'
      + ' data-product-handle="' + esc(handle) + '"'
      + ' data-product-id="' + esc(handle) + '/null"'
      + ' data-variant-id=""'
      + ' aria-label="' + esc((wishlisted ? 'Remove ' : 'Add ') + title + (wishlisted ? ' from' : ' to') + ' wishlist') + '"'
      + ' onclick="window.addToWishlistByHandle(this)">'
      + '<svg viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"'
      + ' class="f-icon-svg f-icon-svg--medium" aria-hidden="true">'
      + '<path fill-rule="evenodd" clip-rule="evenodd"'
      + ' d="M21.0002 8.97903C21.0002 15.2234 12.0006 20.479 12.0006 20.479C12.0006 20.479'
      + ' 3.00024 15.1457 3.00024 8.99169C3.00024 6.47903 5.00024 4.47903 7.50024 4.47903'
      + ' C10.0002 4.47903 12.0002 7.47903 12.0002 7.47903C12.0002 7.47903 14.0002 4.47903'
      + ' 16.5002 4.47903C19.0002 4.47903 21.0002 6.47903 21.0002 8.97903Z"'
      + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '</button>'
      + '<div id="wishlist-tooltip-' + esc(handle) + '" class="tooltip-advice wishlist"'
      + ' role="alert" aria-live="assertive"></div>';

    var colorOption = product.options.find(function (o) { return /colou?r/i.test(o.name); })
      || (product.options.length > 1 ? product.options.find(function (o) { return o.values.length > 1; }) : null)
      || product.options[0] || null;

    var swatchHTML = '';
    if (colorOption) {
      var swatchPos  = product.options.indexOf(colorOption) + 1;
      var swatchName = colorOption.name;

      var variantsJson = variants.map(function (v) {
        var numId = v.id.split('/').pop();
        var opts  = v.selectedOptions || [];
        return {
          id: parseInt(numId, 10), title: v.title,
          option1: opts[0] ? opts[0].value : null,
          option2: opts[1] ? opts[1].value : null,
          option3: opts[2] ? opts[2].value : null,
          available: v.availableForSale,
          price: Math.round(parseFloat(v.price.amount) * 100),
          compare_at_price: v.compareAtPrice ? Math.round(parseFloat(v.compareAtPrice.amount) * 100) : null,
          featured_image: v.image
            ? { src: v.image.url, alt: v.image.altText, width: v.image.width, height: v.image.height }
            : null
        };
      });

      var seen = {};
      var swatchItems = variants.reduce(function (acc, v) {
        var opts = v.selectedOptions || [];
        var co   = opts.find(function (o) { return o.name === swatchName; });
        if (!co || seen[co.value]) return acc;
        seen[co.value] = true;
        var numId  = v.id.split('/').pop();
        var imgSrc = v.image ? v.image.url : (mainImg ? mainImg.url : '');

        var swatchData = colorOption.optionValues
          ? colorOption.optionValues.find(function (ov) { return ov.name === co.value; })
          : null;
        var swatchColor = (swatchData && swatchData.swatch && swatchData.swatch.color)
          ? swatchData.swatch.color
          : shopifyHandle(String(co.value).trim().split(/\s+/).pop() || co.value);
        var swatchImage = (swatchData && swatchData.swatch && swatchData.swatch.image
          && swatchData.swatch.image.previewImage)
          ? swatchData.swatch.image.previewImage.url
          : '';
        var swatchStyle = '--swatch-background: ' + swatchColor + ';'
          + (swatchImage ? ' background-image: url(' + swatchImage + ');' : '');

        acc.push(
          '<a href="/products/' + esc(handle) + '?variant=' + esc(numId) + '"'
          + ' class="color-swatch__item focus-inset"'
          + ' data-option-position="' + swatchPos + '"'
          + ' data-tippy-content="' + esc(co.value) + '" data-tippy-placement="top"'
          + ' data-value="' + esc(co.value) + '"'
          + ' title="' + esc(title + ' - ' + co.value) + '"'
          + ' style="' + esc(swatchStyle) + '"'
          + ' data-src="' + esc(imgSrc) + '"'
          + ' data-srcset="' + [360,533,720,940,1066].map(function(w){return imgSrc+' '+w+'w';}).join(', ') + '">'
          + '<span class="visually-hidden">' + esc(co.value) + '</span>'
          + '</a>'
        );
        return acc;
      }, []);

      swatchHTML = '<div class="product-card__options relative text-left">'
        + '<color-swatch class="product-card__swatch color-swatch no-js-hidden" tabin="">'
        + swatchItems.join('')
        + '</color-swatch>'
        + '<script type="application/json">{"variants":' + JSON.stringify(variantsJson) + '}<\/script>'
        + '</div>';
    }

    var hasSecond = !!secondImg;
    return '<div class="f-column">'
      + '<div class="product-card grid-list__column quick-view-enabled">'
      + '<div class="product-card__wrapper' + (hasSecond ? '' : ' image-hover-effect__zoom') + '">'
      + '<a href="' + esc(url) + '" class="full-width-link product-card__link">'
      + '<span class="visually-hidden">' + esc(title) + '</span></a>'
      + '<div class="product-card__image-wrapper f-card' + (hasSecond ? '' : ' product-card__image-wrapper--main-only') + '">'
      + mainImgHTML + secondImgHTML + quickviewHTML
      + '</div>'
      + wishlistHTML
      + '<div class="product-card__info text-left">'
      + '<div class="product-card__information">'
      + '<h3 class="product-card__title text-product-title font-heading">' + esc(title) + '</h3>'
      + '</div>'
      + (vendor ? '<span class="product-card__vendor">' + esc(vendor) + '</span>' : '')
      + priceHTML
      + '</div>'
      + '</div>'
      + swatchHTML
      + '</div></div>';
  }

  // ── Counter + button state ────────────────────────────────────────

  function updateCounters() {
    var count = getWishlist().length;
    document.querySelectorAll('.wishlist-counter').forEach(function (el) { el.textContent = count; });
  }

  function updateButtonStyles() {
    document.querySelectorAll('.add-to-wishlist').forEach(function (btn) {
      var handle = btn.getAttribute('data-product-handle')
        || normaliseHandle(btn.getAttribute('data-product-id') || '');
      if (!handle) return;
      var active = isWishlisted(handle);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-label',
        (active ? 'Remove ' : 'Add ') + handle + (active ? ' from' : ' to') + ' wishlist');
    });
    updateCounters();
  }

  // ── Render wishlist page ──────────────────────────────────────────

  function updateWishlistPage() {
    var container = document.getElementById('wishlist-products');
    if (!container) return;

    var handles = getWishlist().map(normaliseHandle).filter(Boolean);

    if (!handles.length) {
      container.innerHTML = '<p class="wishlist-empty-message" style="padding:2rem 0;text-align:center;">Your wishlist is empty.</p>';
      updateCounters();
      return;
    }

    container.innerHTML = '<div style="padding:2rem 0;text-align:center;color:#9CA3AF;">Loading your wishlist…</div>';

    fetchProducts(handles, function (products) {
      container.innerHTML = '';

      if (!products.length) {
        container.innerHTML = '<p style="padding:2rem 0;text-align:center;">Could not load wishlist items.</p>';
        updateCounters();
        return;
      }

      var fragment = document.createDocumentFragment();
      products.forEach(function (product) {
        var tmp = document.createElement('div');
        tmp.innerHTML = buildCardHTML(product);
        while (tmp.firstChild) fragment.appendChild(tmp.firstChild);
      });
      container.appendChild(fragment);

      updateButtonStyles();
      bindQuickViewButtons(container);
    });
  }

  // ── Global: addToWishlistByHandle ─────────────────────────────────

  window.addToWishlistByHandle = function (btn) {
    var handle = btn.getAttribute('data-product-handle')
      || normaliseHandle(btn.getAttribute('data-product-id') || '');
    if (!handle) return;

    var tooltip = document.getElementById('wishlist-tooltip-' + handle);

    if (isWishlisted(handle)) {
      removeHandle(handle);
      updateButtonStyles();
      updateWishlistPage();
    } else {
      addHandle(handle);
      updateButtonStyles();
      if (tooltip) {
        tooltip.innerHTML = '<p>Added to your Wishlist!</p>';
        tooltip.classList.add('active');
        setTimeout(function () {
          tooltip.classList.remove('active');
          tooltip.innerHTML = '';
        }, 2000);
      }
    }
  };

  // ── Init ──────────────────────────────────────────────────────────

  var inited = false;
  function safeInit() {
    if (inited) return;
    inited = true;

    ensureModalShell();
    ensureButtonStyles();

    document.querySelectorAll('.add-to-wishlist:not([onclick])').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.addToWishlistByHandle(this);
      });
    });

    updateWishlistPage();
    updateButtonStyles();
  }

  document.addEventListener('page:loaded', safeInit);

  if (document.readyState === 'complete') {
    setTimeout(safeInit, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(safeInit, 1000);
    });
  }

  window.wishlistOpenQuickView = openQuickView;

}());

window.initProductQuickview = function(rootEl) {
  rootEl = rootEl || document;

  function qs(selector)  { return rootEl.querySelector(selector); }
  function qsa(selector) { return rootEl.querySelectorAll(selector); }

  function toHandle(str) {
    return (str ?? '')
      .toString()
      .normalize('NFKD')
      .replace(/\u00A0/g, ' ')
      .toLowerCase()
      .replace(/[''']s\b/gi, 's')
      .replace(/['''"""´`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getCookieVal(name) {
    const decoded = decodeURIComponent(document.cookie);
    for (let c of decoded.split(';')) {
      c = c.trim();
      if (c.startsWith(name + '=')) return c.substring(name.length + 1);
    }
    return '';
  }

  // ─── MODULE 1: CustomSelect (Club/Course) ──────────────────
  class CustomSelect {
    constructor(element, originalSelect) {
      this.element = element;
      this.originalSelect = originalSelect;
      this.options = [];
      this.selectedValue = null;
      this.favorites = [];
      this.isOpen = false;
      this.trigger = element.querySelector('.select-trigger');
      this.dropdown = element.querySelector('.select-dropdown');
      this.init();
    }

    init() {
      this.loadOptionsFromSelect();
      this.loadFavorites();
      this.renderOptions();
      this.setInitialValue();
      this.renderOptions();
      this.bindEvents();
      rootEl.dispatchEvent(new CustomEvent('customSelectInitialized', { bubbles: true }));
    }

    loadOptionsFromSelect() {
      this.originalSelect.querySelectorAll('option').forEach(option => {
        if (option.value) {
          this.options.push({
            value: option.value,
            label: option.textContent.trim(),
            slug: option.dataset.slug || slugify(option.value),
            selected: option.selected,
          });
        }
      });
    }

    loadFavorites() {
      try {
        this.favorites = (typeof CookieManager !== 'undefined' && CookieManager.getFavoriteClubs?.())
          || [];
        this.favorites.sort((a, b) => a.localeCompare(b));
      } catch (e) {
        this.favorites = [];
      }
    }

    saveFavorites() {
      try {
        if (typeof CookieManager !== 'undefined') CookieManager.setFavoriteClubs?.(this.favorites);
      } catch (e) {}
    }

    setInitialValue() {
      const clubHandleCookie = getCookieVal('club_handle');
      if (clubHandleCookie) {
        const cookieOption = this.options.find(opt =>
          opt.slug === clubHandleCookie || slugify(opt.value) === clubHandleCookie
        );
        if (cookieOption) { this.selectOptionInternal(cookieOption.value); return; }
      }

      let firstOption = this.favorites.length > 0
        ? this.options.find(opt => opt.slug === this.favorites[0])
        : null;
      if (!firstOption && this.options.length > 0) firstOption = this.options[0];
      if (firstOption) this.selectOptionInternal(firstOption.value);
    }

    selectOptionInternal(value) {
      this.options.forEach(opt => opt.selected = false);
      this.originalSelect.querySelectorAll('option').forEach(opt => opt.removeAttribute('selected'));

      const option = this.options.find(opt => opt.value === value);
      if (option) {
        option.selected = true;
        this.selectedValue = value;
        this.originalSelect.value = value;
        const origOpt = Array.from(this.originalSelect.options).find(o => o.value === value);
        if (origOpt) origOpt.setAttribute('selected', 'selected');

        const triggerText = this.trigger.querySelector('span:first-child');
        if (triggerText) { triggerText.textContent = option.label; triggerText.classList.remove('placeholder'); }

        setTimeout(() => {
          this.originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }, 0);
      }
    }

    toggleFavorite(slug, event) {
      event.stopPropagation();
      const i = this.favorites.indexOf(slug);
      i > -1 ? this.favorites.splice(i, 1) : this.favorites.push(slug);
      this.saveFavorites();
      this.renderOptions();
    }

    renderOptions() {
      const favOpts = this.options.filter(o => this.favorites.includes(o.slug))
        .sort((a,b) => a.label.localeCompare(b.label));
      const regOpts = this.options.filter(o => !this.favorites.includes(o.slug))
        .sort((a,b) => a.label.localeCompare(b.label));

      let html = '';
      favOpts.forEach(o => { html += this._optionHTML(o, true); });
      if (favOpts.length && regOpts.length) html += '<div class="favorites-separator"></div>';
      regOpts.forEach(o => { html += this._optionHTML(o, false); });
      this.dropdown.innerHTML = html;
    }

    _optionHTML(option, isFavorite) {
      const sel = this.selectedValue === option.value ? 'selected' : '';
      return `<div class="select-option ${sel}" data-value="${this._escape(option.value)}">
        <div class="favorite-icon ${isFavorite ? 'favorited' : ''}" data-slug="${option.slug}">
          <svg viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" class="f-icon-svg f-icon-svg--medium">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M21.0002 8.97903C21.0002 15.2234 12.0006 20.479 12.0006 20.479C12.0006 20.479 3.00024 15.1457 3.00024 8.99169C3.00024 6.47903 5.00024 4.47903 7.50024 4.47903C10.0002 4.47903 12.0002 7.47903 12.0002 7.47903C12.0002 7.47903 14.0002 4.47903 16.5002 4.47903C19.0002 4.47903 21.0002 6.47903 21.0002 8.97903Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="option-text">${this._escape(option.label)}</span>
      </div>`;
    }

    _escape(t) {
      return t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }

    bindEvents() {
      this.trigger.addEventListener('click', e => { e.stopPropagation(); this.toggleDropdown(); });
      this.dropdown.addEventListener('click', e => {
        const fav = e.target.closest('.favorite-icon');
        const opt = e.target.closest('.select-option');
        if (fav) this.toggleFavorite(fav.dataset.slug, e);
        else if (opt) this.selectOption(opt.dataset.value);
      });
      rootEl.addEventListener('click', e => {
        if (!this.element.contains(e.target)) this.closeDropdown();
      });
      this.element.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.isOpen) this.closeDropdown();
      });
    }

    toggleDropdown() { this.isOpen ? this.closeDropdown() : this.openDropdown(); }
    openDropdown()   { this.isOpen = true;  this.trigger.classList.add('open');    this.dropdown.classList.add('open'); }
    closeDropdown()  { this.isOpen = false; this.trigger.classList.remove('open'); this.dropdown.classList.remove('open'); }
    selectOption(value) { this.selectOptionInternal(value); this.renderOptions(); this.closeDropdown(); }
  }

  // ─── MODULE 2: Form Validation ─────────────────────────────
  function initFormValidation() {
    const addToCartBtn = qs('.btn-add-to-cart');
    const clubSelect   = qs('#course-select');
    const productForm  = qs('form[action^="/cart"]');
    if (!addToCartBtn || !clubSelect) return;

    let errorEl = qs('.qv-field-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'field-error qv-field-error';
      errorEl.style.cssText = 'margin-top:8px;display:none;';
      addToCartBtn.insertAdjacentElement('afterend', errorEl);
    }

    const isValid  = () => clubSelect.value && clubSelect.value.trim() !== '';
    const toggleBtn = () => {
      addToCartBtn.classList.toggle('disabled', !isValid());
      addToCartBtn.toggleAttribute('disabled', !isValid());
    };

    const validate = (e) => {
      errorEl.style.display = 'none'; errorEl.textContent = '';
      clubSelect.classList.remove('error-border');
      if (!isValid()) {
        e.preventDefault();
        errorEl.textContent = 'Please select a club';
        clubSelect.classList.add('error-border');
        errorEl.style.display = 'block';
      }
      toggleBtn();
    };

    clubSelect.addEventListener('change', toggleBtn);
    addToCartBtn.addEventListener('click', validate);
    productForm?.addEventListener('submit', validate);
    toggleBtn();
  }

  // ─── MODULE 3: Logo Sync ────────────────────────────────────
  function initLogoSync() {
    const courseSelect   = qs('#course-select');
    const courseInput    = qs('#selected-course-input');
    const logoInput      = qs('#selected-logo-input');
    const logoUrlInput   = qs('#logo-url-input');
    const productForm    = qs('form[action^="/cart"]');
    const logoContainers = qsa('.course-logos');

    function updateSelectedValue(container) {
      const radios    = container.querySelectorAll('input[type="radio"]');
      const labelSpan = container.querySelector('.selected-value');
      let sel = container.querySelector('input[type="radio"]:checked');
      if (!sel && radios.length) { radios[0].checked = true; sel = radios[0]; }
      if (labelSpan && sel) labelSpan.textContent = sel.value;
      if (sel && logoInput && logoUrlInput) {
        logoInput.value = sel.value;
        const label = sel.closest('.variant-picker__option')?.querySelector('label');
        const bg    = label?.style?.getPropertyValue('--swatch-background');
        const match = bg?.match(/url\(["']?(.*?)["']?\)/);
        if (match?.[1]) logoUrlInput.value = match[1];
      }
    }

    function updateLogos() {
      const selectedHandle = toHandle(courseSelect?.value || '');
      if (courseInput) courseInput.value = courseSelect?.value || '';
      logoContainers.forEach(container => {
        const isMatch = container.dataset.course === selectedHandle;
        container.style.display = isMatch ? 'block' : 'none';
        container.setAttribute('aria-hidden', String(!isMatch));
        if (isMatch) { container.classList.add('selected-logo'); updateSelectedValue(container); }
        else container.classList.remove('selected-logo');
      });
    }

    function selectInitialLogo() {
      const sel = qs('.selected-logo input[name="properties[Logo]"]');
      if (sel) {
        sel.checked = true;
        const container = sel.closest('.course-logos');
        if (container) updateSelectedValue(container);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    setTimeout(() => { updateLogos(); selectInitialLogo(); }, 500);
    courseSelect?.addEventListener('change', updateLogos);
    qsa('input[name="properties[Logo]"]').forEach(radio => {
      radio.addEventListener('change', () => updateSelectedValue(radio.closest('.course-logos')));
    });
    productForm?.addEventListener('submit', updateLogos);
  }

  // ─── MODULE 4: SVG Logo Image Updater ──────────────────────
  function initSvgLogoUpdater() {
    function handleLogoChange(e) {
      const url = e.target.dataset.courseLogo;
      rootEl.querySelectorAll('image[id="course-logo"]').forEach(img => {
        img.setAttribute('href', url);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
      });
    }
    qsa('input[name="properties[Logo]"]').forEach(radio => {
      radio.addEventListener('change', handleLogoChange);
      radio.addEventListener('click',  handleLogoChange);
    });
  }

  // ─── MODULE 5: Logo Position (Embroidered) Dropdown ────────
  function initLogoPositions() {
    const courseSelect      = qs('#course-select');
    const embroideredSelect = qs('#select-embroidered');
    if (!courseSelect || !embroideredSelect || !window.logoPositionMapping) return;

    function decodeEntities(str) {
      const t = document.createElement('textarea'); t.innerHTML = str; return t.value;
    }

    function updatePositions() {
      const handle    = toHandle(courseSelect.options[courseSelect.selectedIndex]?.value || '');
      const positions = (window.logoPositionMapping[handle] || []).map(decodeEntities);
      const current   = embroideredSelect.value;
      embroideredSelect.innerHTML = '';
      const list = positions.length ? positions : ['Left Chest', 'Right Chest'];
      list.forEach(pos => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = pos;
        embroideredSelect.appendChild(opt);
      });
      embroideredSelect.value = Array.from(embroideredSelect.options).some(o => o.value === current) ? current : '';
      if (!embroideredSelect.value && embroideredSelect.options.length) embroideredSelect.selectedIndex = 0;
      embroideredSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    courseSelect.addEventListener('change', updatePositions);
    updatePositions();
  }

  // ─── MODULE 6: Filter Logos by Position ────────────────────
  function initLogoFilter() {
    const embroideredSelect = qs('#select-embroidered');
    const courseSelect      = qs('#course-select');
    if (!embroideredSelect) return;

    function filterLogos() {
      const pos            = embroideredSelect.value.toLowerCase();
      const isSleeveChest  = pos.includes('sleeve') && pos.includes('chest');
      const visible        = qs('.course-logos[aria-hidden="false"]');
      if (!visible) return;
      visible.querySelectorAll('.variant-picker__option').forEach(option => {
        const alt = (
          option.querySelector('.variant-picker__option-button--course')?.getAttribute('data-alt') ||
          option.querySelector('input[type="radio"]')?.getAttribute('data-logo-alt') || ''
        ).toLowerCase().trim();
        option.style.display = (!isSleeveChest || (alt.includes('sleeve') && alt.includes('chest'))) ? '' : 'none';
      });
    }

    embroideredSelect.addEventListener('change', () => setTimeout(filterLogos, 50));
    courseSelect?.addEventListener('change',      () => setTimeout(filterLogos, 100));
    setTimeout(filterLogos, 300);
  }

  // ─── MODULE 7: Disclaimer ───────────────────────────────────
  function initDisclaimer() {
    const select     = qs('#select-embroidered');
    const disclaimer = qs('.logo-disclaimer');
    if (!select || !disclaimer) return;
    function update() {
      const v = select.value.toLowerCase();
      disclaimer.textContent = (v.includes('sleeve') && v.includes('chest'))
        ? 'Preview shows left chest only - club name will display on left sleeve'
        : 'Preview shows left chest only';
    }
    select.addEventListener('change', update);
    update();
  }

  // ─── MODULE 8: CustomEmbroideredSelect ─────────────────────
  class CustomEmbroideredSelect {
    constructor(originalSelect) {
      this.originalSelect = originalSelect;
      this.element  = null;
      this.trigger  = null;
      this.dropdown = null;
      this.isOpen   = false;
      this.observer = null;
      this.init();
    }

    init() {
      if (rootEl.querySelector('#custom-embroidered-select')) return;
      this._createUI();
      this._bindEvents();
      this._updateTriggerText();
      this._observeChanges();
    }

    _createUI() {
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select custom-embroidered-select';
      wrapper.id = 'custom-embroidered-select';

      const origLabel = this.originalSelect.previousElementSibling;
      if (origLabel?.tagName === 'LABEL') origLabel.style.display = 'none';

      wrapper.innerHTML = `
        <label>Logo Placement</label>
        <div class="select-trigger">
          <span class="placeholder">Please select</span>
          <span class="arrow"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></span>
        </div>
        <div class="select-dropdown"></div>
        <p class="logo-disclaimer" style="margin-top:6px;font-size:0.85rem;color:#6b7280;">Preview shows left chest only</p>`;

      const col = rootEl.querySelector('#placement-select-col');
      (col || this.originalSelect.parentNode).insertBefore(wrapper, col ? null : this.originalSelect);

      Object.assign(this.originalSelect.style, {
        display: 'none', visibility: 'hidden', position: 'absolute', opacity: '0', pointerEvents: 'none'
      });

      this.element  = wrapper;
      this.trigger  = wrapper.querySelector('.select-trigger');
      this.dropdown = wrapper.querySelector('.select-dropdown');
      this._renderOptions();
    }

    _observeChanges() {
      this.observer = new MutationObserver(() => { this._renderOptions(); this._updateTriggerText(); });
      this.observer.observe(this.originalSelect, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['selected']
      });
    }

    _renderOptions() {
      let html = '';
      Array.from(this.originalSelect.options).forEach(opt => {
        if (opt.value) html += `<div class="select-option ${opt.selected ? 'selected' : ''}" data-value="${opt.value}"><span class="option-text">${opt.textContent.trim()}</span></div>`;
      });
      if (this.dropdown) this.dropdown.innerHTML = html;
    }

    _updateTriggerText() {
      if (!this.trigger) return;
      const sel  = this.originalSelect.options[this.originalSelect.selectedIndex];
      const span = this.trigger.querySelector('span:first-child');
      if (sel?.value) { span.textContent = sel.textContent.trim(); span.classList.remove('placeholder'); }
      else { span.textContent = 'Please select'; span.classList.add('placeholder'); }
    }

    _updateSelectedState() {
      const val = this.originalSelect.value;
      this.dropdown?.querySelectorAll('.select-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.value === val);
      });
    }

    _bindEvents() {
      this.trigger.addEventListener('click', e => { e.stopPropagation(); this.toggleDropdown(); });
      this.dropdown.addEventListener('click', e => {
        const opt = e.target.closest('.select-option');
        if (opt) this.selectOption(opt.dataset.value);
      });
      rootEl.addEventListener('click', e => {
        if (this.element && !this.element.contains(e.target)) this.closeDropdown();
      });
      this.element?.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeDropdown(); });
      this.originalSelect.addEventListener('change', () => { this._updateTriggerText(); this._updateSelectedState(); });
    }

    toggleDropdown() { this.isOpen ? this.closeDropdown() : this.openDropdown(); }
    openDropdown()   { this.isOpen = true;  this.trigger.classList.add('open');    this.dropdown.classList.add('open'); }
    closeDropdown()  { this.isOpen = false; this.trigger.classList.remove('open'); this.dropdown.classList.remove('open'); }
    selectOption(value) {
      this.originalSelect.value = value;
      this.originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this._updateTriggerText(); this._updateSelectedState(); this.closeDropdown();
    }
    destroy() { this.observer?.disconnect(); }
  }

  // ─── BOOT ───────────────────────────────────────────────────
  const courseSelectEl = qs('#course-select');
  const customSelectEl = qs('#custom-course-select');
  if (courseSelectEl && customSelectEl) {
    setTimeout(() => new CustomSelect(customSelectEl, courseSelectEl), 10);
  }

  initFormValidation();
  initLogoSync();
  initSvgLogoUpdater();
  initLogoPositions();
  initLogoFilter();
  initDisclaimer();

  const embroideredEl = qs('#select-embroidered');
  if (embroideredEl) setTimeout(() => new CustomEmbroideredSelect(embroideredEl), 300);

};
