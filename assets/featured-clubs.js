/**
 * featured-clubs.js
 * =================
 * Single source of truth for:
 *   1. CookieManager         — get/set/remove favorites + custom logos
 *   2. LogoSources           — resolves window.logoSources via priority chain
 *   3. FeaturedClubs.init()  — section UI (hearts, favorites strip, carousel)
 *
 * Load once in theme.liquid before </body>:
 *   {{ 'featured-clubs.js' | asset_url | script_tag }}
 *
 * Each section instance calls:
 *   FeaturedClubs.init(sectionId)
 *
 * Data bridge from Liquid (set by featured-clubs.liquid inline <script>):
 *   window['fcCourses_' + sectionId]  — course objects for that section
 *   window.coursesData                — merged global used by getLogoByHandle()
 *   window.fcServerLogos              — server-rendered fallback logo URLs
 *   window.fcOverrideAllowed          — true = favorites fully replace server logos
 *   window.fcAnimationInterval        — ms between logo rotations (default 4500)
 */

(function(w) {
  'use strict';

  // ============================================================
  // 1. COOKIE MANAGER
  // ============================================================
  // Exposed as window.CookieManager so existing theme.liquid
  // references keep working without changes.

  w.CookieManager = w.CookieManager || {

    setCookie: function(name, value, days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = name + '=' + value + ';expires=' + date.toUTCString() + ';path=/';
    },

    getCookie: function(name) {
      var nameEQ = name + '=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
      }
      return null;
    },

    deleteCookie: function(name) {
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
    },

    // ── Favorite clubs ─────────────────────────────────────

    getFavoriteClubs: function() {
      var raw = this.getCookie('favorite_clubs');
      if (!raw) return [];
      try { return JSON.parse(decodeURIComponent(raw)); }
      catch(e) { console.error('[CookieManager] favorite_clubs parse error:', e); return []; }
    },

    setFavoriteClubs: function(clubs) {
      this.setCookie('favorite_clubs', encodeURIComponent(JSON.stringify(clubs)), 365);
    },

    addFavoriteClub: function(handle) {
      var clubs = this.getFavoriteClubs();
      if (clubs.indexOf(handle) === -1) {
        clubs.push(handle);
        this.setFavoriteClubs(clubs);
        return true;
      }
      return false;
    },

    removeFavoriteClub: function(handle) {
      var clubs = this.getFavoriteClubs();
      var next  = clubs.filter(function(h) { return h !== handle; });
      if (next.length !== clubs.length) { this.setFavoriteClubs(next); return true; }
      return false;
    },

    isFavoriteClub: function(handle) {
      return this.getFavoriteClubs().indexOf(handle) !== -1;
    },

    clearFavoriteClubs: function() { this.deleteCookie('favorite_clubs'); },

    // ── Custom logo sources ────────────────────────────────

    getCustomLogos: function() {
      var raw = this.getCookie('customLogoSources');
      if (!raw || raw === '') return null;
      try {
        var parsed = JSON.parse(raw);
        return (Array.isArray(parsed) && parsed.length > 0) ? parsed : null;
      } catch(e) { console.error('[CookieManager] customLogoSources parse error:', e); return null; }
    },

    setCustomLogos: function(logoArray, days) {
      try { this.setCookie('customLogoSources', JSON.stringify(logoArray), days || 7); return true; }
      catch(e) { console.error('[CookieManager] setCustomLogos error:', e); return false; }
    },

    clearCustomLogos: function() { this.deleteCookie('customLogoSources'); }
  };

  // Legacy aliases — theme.liquid scripts call these directly
  w.setCookie        = function(n, v, d) { w.CookieManager.setCookie(n, v, d); };
  w.getCookie        = function(n)       { return w.CookieManager.getCookie(n); };
  w.setCustomLogos   = function(a, d)    { return w.CookieManager.setCustomLogos(a, d); };
  w.clearCachedLogos = function()        { return w.CookieManager.clearCustomLogos(); };


  // ============================================================
  // 2. LOGO SOURCES — priority resolution
  // ============================================================
  //
  //  P1a  customLogoSources cookie     explicit URLs from course page visit
  //  P1b  favorite_clubs cookie        handles → logos via window.coursesData
  //  P2   window.fcServerLogos         server-rendered Liquid fallback
  //
  //  window.fcOverrideAllowed = true  → P1b fully replaces P2
  //  window.fcOverrideAllowed = false → P1b prepended to P2 (deduped)
  //
  //  Result written to window.logoSources — read by initLogoAnimation()

  w.getLogoByHandle = function(handle) {
    var data   = w.coursesData || [];
    var course = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i].handle === handle) { course = data[i]; break; }
    }
    if (!course || !course.logo) return null;
    // Normalise protocol-relative URLs
    return course.logo.indexOf('//') === 0 ? 'https:' + course.logo : course.logo;
  };

  w.resolveLogoSources = function() {
    var overrideAllowed = w.fcOverrideAllowed !== undefined ? w.fcOverrideAllowed : true;
    var serverLogos     = w.fcServerLogos || [];

    // P1a — explicit custom logos cookie
    var customLogos = w.CookieManager.getCustomLogos();
    if (customLogos) {
      console.log('[LogoSources] P1a customLogoSources:', customLogos);
      w.logoSources = customLogos;
      return customLogos;
    }

    // P1b — favorites cookie → logo URLs
    var handles  = w.CookieManager.getFavoriteClubs();
    var favLogos = handles.map(function(h) { return w.getLogoByHandle(h); }).filter(Boolean);

    if (favLogos.length > 0) {
      var resolved = overrideAllowed
        ? favLogos
        : favLogos.concat(serverLogos.filter(function(l) { return favLogos.indexOf(l) === -1; }));
      console.log('[LogoSources] P1b favorite_clubs:', resolved);
      w.logoSources = resolved;
      return resolved;
    }

    // P2 — server fallback
    console.log('[LogoSources] P2 server fallback:', serverLogos);
    w.logoSources = serverLogos;
    return serverLogos;
  };

  // Restart logo animation after any favorite change
  w.reinitLogoAnimation = function() {
    try {
      if (w.logoAnimationInterval) clearInterval(w.logoAnimationInterval);

      w.resolveLogoSources();

      if (!w.logoSources || w.logoSources.length === 0) {
        console.warn('[LogoSources] No sources after reinit');
        return false;
      }

      var interval = w.fcAnimationInterval || 4500;
      var idx      = 0;

      function updateOverlays() {
        var overlays = document.querySelectorAll('.logo-overlay');
        overlays.forEach(function(overlay, i) {
          setTimeout(function() {
            overlay.innerHTML = '';
            var img = document.createElement('img');
            img.src = w.logoSources[idx];
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            overlay.appendChild(img);
          }, i * 200);
        });
        idx = (idx + 1) % w.logoSources.length;
      }

      updateOverlays(); // show immediately
      w.logoAnimationInterval = setInterval(updateOverlays, interval);
      console.log('[LogoSources] Animation restarted');
      return true;
    } catch(e) {
      console.error('[LogoSources] reinitLogoAnimation error:', e);
      return false;
    }
  };


  // ============================================================
  // 3. FEATURED CLUBS SECTION UI
  // ============================================================

  w.FeaturedClubs = w.FeaturedClubs || {

    init: function(sectionId) {
      var courses   = w['fcCourses_' + sectionId] || [];
      var grid      = document.getElementById('fc-grid-'    + sectionId);
      var dotsEl    = document.getElementById('fc-dots-'    + sectionId);
      var emptyEl   = document.getElementById('fc-empty-'   + sectionId);
      var filledEl  = document.getElementById('fc-filled-'  + sectionId);
      var favScroll = document.getElementById('fc-fav-scroll-' + sectionId);

      if (!grid) return;

      function isMobile() {
        return w.matchMedia('(max-width: 768px)').matches;
      }

      // Called after any favorite change to keep logo animation in sync
      function refreshLogos() {
        w.resolveLogoSources();
        if (typeof w.reinitLogoAnimation === 'function') w.reinitLogoAnimation();
      }

      // ── Heart buttons (card grid) ─────────────────────────

      function syncHearts() {
        var favs = w.CookieManager.getFavoriteClubs();
        grid.querySelectorAll('.fc-card__heart').forEach(function(btn) {
          btn.classList.toggle('is-favorited', favs.indexOf(btn.dataset.handle) !== -1);
        });
      }

      function attachHeartListeners() {
        grid.querySelectorAll('.fc-card__heart').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var handle = btn.dataset.handle;
            if (w.CookieManager.isFavoriteClub(handle)) {
              w.CookieManager.removeFavoriteClub(handle);
            } else {
              w.CookieManager.addFavoriteClub(handle);
            }
            syncHearts();
            renderFavorites();
            refreshLogos();
          });
        });
      }

      // ── Favorites strip ───────────────────────────────────

      function renderFavorites() {
        var favs       = w.CookieManager.getFavoriteClubs();
        var favCourses = courses.filter(function(c) {
          return favs.indexOf(c.handle) !== -1;
        });

        if (favCourses.length === 0) {
          emptyEl.style.display  = '';
          filledEl.style.display = 'none';
          return;
        }

        emptyEl.style.display  = 'none';
        filledEl.style.display = '';
        favScroll.innerHTML    = '';

        favCourses.forEach(function(course) {
          var item = document.createElement('div');
          item.className = 'fc-fav-item';
          item.innerHTML =
            '<div class="fc-fav-item__box">' +
              (course.logo
                ? '<img src="' + course.logo + '" alt="' + course.title + '" loading="lazy" width="180" height="180">'
                : '') +
              '<button class="fc-fav-item__heart" aria-label="Remove from favorites" type="button">' +
                '<svg viewBox="0 0 24 25" fill="#f1e2cb" xmlns="http://www.w3.org/2000/svg">' +
                  '<path fill-rule="evenodd" clip-rule="evenodd" d="M21.0002 8.97903C21.0002 15.2234 12.0006 20.479 12.0006 20.479C12.0006 20.479 3.00024 15.1457 3.00024 8.99169C3.00024 6.47903 5.00024 4.47903 7.50024 4.47903C10.0002 4.47903 12.0002 7.47903 12.0002 7.47903C12.0002 7.47903 14.0002 4.47903 16.5002 4.47903C19.0002 4.47903 21.0002 6.47903 21.0002 8.97903Z" stroke="#c58a30" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
            '<span class="fc-fav-item__name">' + course.title + '</span>';

          item.querySelector('.fc-fav-item__heart').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            w.CookieManager.removeFavoriteClub(course.handle);
            syncHearts();
            renderFavorites();
            refreshLogos();
          });

          favScroll.appendChild(item);
        });
      }

      // ── Mobile 2×2 Carousel ───────────────────────────────

      var currentPage    = 0;
      var cards          = Array.from(grid.querySelectorAll('.fc-card'));
      var CARDS_PER_PAGE = 4;

      function totalPages() {
        return Math.ceil(cards.length / CARDS_PER_PAGE);
      }

      function buildDots() {
        dotsEl.innerHTML = '';
        if (!isMobile()) return;
        for (var i = 0; i < totalPages(); i++) {
          var dot = document.createElement('button');
          dot.className  = 'fc-dot' + (i === currentPage ? ' active' : '');
          dot.setAttribute('aria-label', 'Page ' + (i + 1));
          dot.dataset.page = i;
          dot.addEventListener('click', function() {
            goToPage(parseInt(this.dataset.page));
          });
          dotsEl.appendChild(dot);
        }
      }

      function goToPage(page) {
        currentPage = page;
        cards.forEach(function(card, idx) {
          card.style.display = (Math.floor(idx / CARDS_PER_PAGE) === currentPage) ? '' : 'none';
        });
        dotsEl.querySelectorAll('.fc-dot').forEach(function(dot, i) {
          dot.classList.toggle('active', i === currentPage);
        });
      }

      function applyCarousel() {
        if (isMobile()) {
          buildDots();
          goToPage(currentPage);
        } else {
          cards.forEach(function(card) { card.style.display = ''; });
          dotsEl.innerHTML = '';
        }
      }

      // Touch swipe
      var touchStartX = 0;
      grid.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].clientX;
      }, { passive: true });

      grid.addEventListener('touchend', function(e) {
        if (!isMobile()) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0 && currentPage < totalPages() - 1) goToPage(currentPage + 1);
        if (dx > 0 && currentPage > 0) goToPage(currentPage - 1);
      }, { passive: true });

      var resizeTimer;
      w.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() { currentPage = 0; applyCarousel(); }, 200);
      });

      // ── Init ─────────────────────────────────────────────
      attachHeartListeners();
      syncHearts();
      renderFavorites();
      applyCarousel();
      // Resolve logos now that window.coursesData is populated
      w.resolveLogoSources();
    }
  };

}(window));
