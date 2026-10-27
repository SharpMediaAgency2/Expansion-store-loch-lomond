(function () {
  'use strict';
 
  var CURRENCY = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD';
  var cache = {};
  var SWATCH_SECTION = 'wishlist-swatches';
 
  function money(cents) {
    return { amount: (cents / 100).toFixed(2), currencyCode: CURRENCY };
  }
 
  function img(src, alt) {
    if (!src) return null;
    var u = String(src);
    return { url: u.indexOf('//') === 0 ? 'https:' + u : u, altText: alt || '', width: null, height: null };
  }
 
  function map(p, swatches) {
    var prices = p.variants.map(function (v) { return v.price; });
    var cmps   = p.variants.map(function (v) { return v.compare_at_price || 0; });
 
    return {
      id:               'gid://shopify/Product/' + p.id,
      handle:           p.handle,
      title:            p.title,
      vendor:           p.vendor,
      availableForSale: !!p.available,
      featuredImage:    img(p.featured_image, p.title),
      images: {
        edges: (p.images || []).slice(0, 2).map(function (s) { return { node: img(s, p.title) }; })
      },
      priceRange:          { minVariantPrice: money(Math.min.apply(null, prices)) },
      compareAtPriceRange: { minVariantPrice: money(Math.max.apply(null, cmps)) },

      options: (p.options || []).map(function (o) {
        var optMap = (swatches && swatches[o.name]) || {};
        return {
          name: o.name,
          values: o.values,
          optionValues: o.values.map(function (v) {
            var s = optMap[v];
            if (!s || (!s.color && !s.image)) return { name: v, swatch: null };
            return {
              name: v,
              swatch: {
                color: s.color || null,
                image: s.image ? { previewImage: { url: s.image } } : null
              }
            };
          })
        };
      }),
      variants: {
        edges: p.variants.map(function (v) {
          return { node: {
            id:               'gid://shopify/ProductVariant/' + v.id,
            title:            v.title,
            availableForSale: !!v.available,
            price:            money(v.price),
            compareAtPrice:   v.compare_at_price ? money(v.compare_at_price) : null,
            selectedOptions:  (p.options || []).map(function (o, i) {
              return { name: o.name, value: v.options[i] };
            }),
            image: img(v.featured_image && v.featured_image.src, p.title)
          } };
        })
      }
    };
  }
 

  function swatchMap(handle) {
    return fetch('/products/' + encodeURIComponent(handle) + '?section_id=' + SWATCH_SECTION,
                 { headers: { Accept: 'text/html' } })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        if (!html) return null;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var el = doc.getElementById('wl-swatch-map');
        if (!el) return null;
        
        var raw = el.textContent.replace(/Liquid error \([^)]*\)[^,}]*/g, '""');
        return JSON.parse(raw);
      })
      .catch(function () { return null; });
  }
 
  function one(handle) {
    if (cache[handle]) return Promise.resolve(cache[handle]);
    return Promise.all([
      fetch('/products/' + encodeURIComponent(handle) + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
      swatchMap(handle)
    ]).then(function (res) {
      var m = res[0] ? map(res[0], res[1]) : null;
      if (m) cache[handle] = m;
      return m;
    }).catch(function () { return null; });
  }
 
  window.WishlistProducts = {
    fetch: function (handles) {
      if (!handles || !handles.length) return Promise.resolve([]);
      return Promise.all(handles.map(one)).then(function (list) {
        return list.filter(Boolean);
      });
    }
  };
})();