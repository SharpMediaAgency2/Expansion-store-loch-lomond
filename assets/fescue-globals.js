/**
 * fescue-globals.js
 * =================
 * Central JS for Fescue & Dunes logo overlay system.
 *
 * Load ONCE in theme.liquid <head> with defer:
 *   <script src="{{ 'fescue-globals.js' | asset_url }}" defer></script>
 *
 * ── PRIORITY CHAIN ───────────────────────────────────────────
 *
 *  PC  Collection club branding          ← NEW (2026-07-17)
 *      - Only on collection pages that have custom.selected_course set
 *      - Handle from window.fcCollectionClub; logos resolve live from
 *        window.fcClubLogos (ALL logos for that club, not just 3)
 *      - Falls back to window.fcCollectionLogos (the collection's own
 *        course_logo_1/2/3 metafields) if the handle isn't in fcClubLogos
 *      - EPHEMERAL: never written to a cookie, never clears the override.
 *        Leaving the collection restores whatever the chain said before.
 *      - Position controlled by COLLECTION_PRIORITY below:
 *          'top'    (default) → beats OVERRIDE / P1 / P2 / P3 / P4
 *                               (facet P0 still wins — live user action)
 *          'sticky'           → sits below OVERRIDE / P1 / P2, above P3
 *
 *  OVERRIDE  utm_campaign_club URL param (or LogoEngine.setOverride)
 *      - Beats everything below it (incl. the facet filter)
 *      - Cookie stores ONLY the club handle (logoOverrideClub)
 *      - Logos resolve live from window.fcClubLogos at read time
 *        (never stale; full club-page fidelity)
 *      - Cleared only when a club/metaobject page is visited (P1).
 *        A COLLECTION page does NOT clear it.
 *
 *  P0  Facet filter override
 *      - window.fcFacetLogos set by facets.liquid on club filter select
 *      - Cleared when filter removed, restoring the normal chain
 *      - Wins over PC in BOTH collection modes (deliberate in-page action)
 *
 *  P1  Club/metaobject page visited
 *      - Logos sourced from metaobject / page metafields
 *      - Written to customLogoSources cookie
 *      - Club handle written to customLogoClub cookie (if provided)
 *      - Also CLEARS any active OVERRIDE (a deliberate club nav wins)
 *      - Persists across full user journey until another club page visited
 *
 *  P2  customLogoSources cookie already set (journey persistence)
 *      - User visited a club page previously in this session
 *      - Keep showing those logos on all non-club pages
 *
 *  P3  favorite_clubs cookie set (no club page visited)
 *      - User has favorited clubs via heart icon
 *      - Show logos from all favorited courses (1 logo per club)
 *
 *  P4  Theme defaults (nothing else applies)
 *      - window.fcDefaultLogos set by Liquid in fescue-data-bridge.liquid
 *      - Static fallback defined in theme customizer
 *
 * ── DATA BRIDGE FROM LIQUID ──────────────────────────────────
 *
 *  Set these globals via fescue-data-bridge.liquid BEFORE init() runs:
 *
 *  window.fcDefaultLogos     {string[]}  — P4 fallback logo URLs
 *  window.fcPageLogos        {string[]}  — P1 logos from current page metaobject
 *                                          (set only on club/metaobject pages)
 *  window.fcPageHandle       {string}    — P1 handle of current club (optional)
 *  window.fcCollectionClub   {string}    — PC handle of the collection's club
 *                                          (null on non-collection pages)
 *  window.fcCollectionLogos  {string[]}  — PC fallback logos from the collection's
 *                                          own course_logo_1/2/3 metafields
 *  window.fcClubLogos        {object}    — { handle: [url, ...], ... } map rendered
 *                                          ONCE in theme.liquid. MUST be present on
 *                                          every page (OVERRIDE + PC both read it).
 *  window.coursesData        {object[]}  — all courses with handle + logo (P3)
 *  window.fcAnimationMs      {number}    — ms between logo rotations (default 4500)
 *
 * ── PUBLIC API ───────────────────────────────────────────────
 *
 *  window.CookieManager                — cookie read/write for favorites + logos
 *  window.LogoEngine.resolve()         — run priority chain, return logo array
 *  window.LogoEngine.init()            — resolve + start animation
 *  window.LogoEngine.restart()         — stop existing interval, re-resolve, restart
 *  window.LogoEngine.setOverride(h)    — set override to club handle h, restart
 *  window.LogoEngine.clearOverride()   — clear override, restart
 *  window.LogoEngine.tagProductLinks() — install delegated ?club=<handle> tagger
 *  window.getLogoByHandle(handle)      — lookup logo URL from window.coursesData
 *
 *  Inbound override param name is editable via OVERRIDE_PARAM below.
 *  Collection tier position is editable via COLLECTION_PRIORITY below.
 *
 *  (See CHANGE LOG at the very bottom of this file.)
 */

(function (w) {
  'use strict';

  // ── Config ────────────────────────────────────────────────

  // Inbound URL param that triggers a logo override. Edit here.
  var OVERRIDE_PARAM = 'utm_campaign_club';

  // Where the collection tier (PC) sits in the priority chain.
  //
  //   'top'    → DEFAULT. On a branded collection page the collection's own
  //              club logos ALWAYS win. Beats the utm override, a previously
  //              visited club page, favorites and defaults. A Royal Birkdale
  //              collection can never show another club's mark.
  //
  //   'sticky' → Campaign/journey logos survive onto collection pages.
  //              Collection logos only show when OVERRIDE / P1 / P2 are all
  //              empty (i.e. above favorites, below everything sticky).
  //
  // Facet (P0) beats PC in both modes — it's a live, deliberate user action.
  var COLLECTION_PRIORITY = 'top';


  // ============================================================
  // SECTION 1 — COOKIE MANAGER
  // ============================================================
  // Handles all cookie read/write for:
  //   - favorite_clubs      : JSON array of course handles
  //   - customLogoSources   : JSON array of logo URLs (P1/P2 persistence)
  //   - customLogoClub      : handle of the persisted club (P1/P2 persistence)
  //   - logoOverrideClub    : handle driving the OVERRIDE tier
  //
  // NOTE: the collection tier (PC) intentionally writes NOTHING here.

  w.CookieManager = w.CookieManager || {

    // ── Core cookie helpers ───────────────────────────────────

    set: function (name, value, days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = name + '=' + value + ';expires=' + date.toUTCString() + ';path=/';
    },

    get: function (name) {
      var nameEQ = name + '=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
      }
      return null;
    },

    remove: function (name) {
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
    },

    // ── Favorite clubs ────────────────────────────────────────
    // Stored as: favorite_clubs = encodeURIComponent(JSON.stringify([handle, ...]))

    getFavoriteClubs: function () {
      var raw = this.get('favorite_clubs');
      if (!raw) return [];
      try { return JSON.parse(decodeURIComponent(raw)); }
      catch (e) { console.warn('[CookieManager] Could not parse favorite_clubs:', e); return []; }
    },

    setFavoriteClubs: function (clubs) {
      this.set('favorite_clubs', encodeURIComponent(JSON.stringify(clubs)), 365);
    },

    addFavoriteClub: function (handle) {
      var clubs = this.getFavoriteClubs();
      if (clubs.indexOf(handle) === -1) {
        clubs.push(handle);
        this.setFavoriteClubs(clubs);
        return true;
      }
      return false;
    },

    removeFavoriteClub: function (handle) {
      var clubs = this.getFavoriteClubs();
      var next = clubs.filter(function (h) { return h !== handle; });
      if (next.length !== clubs.length) {
        this.setFavoriteClubs(next);
        return true;
      }
      return false;
    },

    isFavoriteClub: function (handle) {
      return this.getFavoriteClubs().indexOf(handle) !== -1;
    },

    clearFavoriteClubs: function () {
      this.remove('favorite_clubs');
    },

    // ── Club logo persistence (P1 → P2 journey) ──────────────
    // Stored as: customLogoSources = JSON.stringify([url, url, url])
    // Written when user visits a club/metaobject page (P1)
    // Read back on all subsequent pages (P2)

    getPersistedLogos: function () {
      var raw = this.get('customLogoSources');
      if (!raw || raw === '') return null;
      try {
        var parsed = JSON.parse(raw);
        return (Array.isArray(parsed) && parsed.length > 0) ? parsed : null;
      }
      catch (e) { console.warn('[CookieManager] Could not parse customLogoSources:', e); return null; }
    },

    setPersistedLogos: function (logoArray) {
      // Store for 1 day — refreshed on every club page visit
      this.set('customLogoSources', JSON.stringify(logoArray), 1);
    },

    clearPersistedLogos: function () {
      this.remove('customLogoSources');
    },

    // ── Club handle persistence (mirrors logo persistence) ────
    // Stored as: customLogoClub = encodeURIComponent(handle)
    // Written alongside the logos when user visits a club page (P1)
    // Tells you WHICH club is currently driving the persisted logos.

    getPersistedClub: function () {
      var raw = this.get('customLogoClub');
      return (raw && raw !== '') ? decodeURIComponent(raw) : null;
    },

    setPersistedClub: function (handle) {
      // Same 1-day expiry as logos so they stay in sync
      this.set('customLogoClub', encodeURIComponent(handle), 1);
    },

    clearPersistedClub: function () {
      this.remove('customLogoClub');
    },

    // ── Logo override (OVERRIDE tier) ─────────────────────────
    // Stores ONLY the club handle. Logos resolve live from
    // window.fcClubLogos at read time → never stale. Cleared on a
    // club page visit (P1) — NOT on a collection page visit.
    // 30-day expiry is just a backstop, not the intended clear path.

    getOverrideClub: function () {
      var raw = this.get('logoOverrideClub');
      return (raw && raw !== '') ? decodeURIComponent(raw) : null;
    },

    setOverrideClub: function (handle, days) {
      this.set('logoOverrideClub', encodeURIComponent(handle), days || 30);
    },

    clearOverrideClub: function () {
      this.remove('logoOverrideClub');
    }
  };

  // ── Legacy aliases ────────────────────────────────────────
  // Keep these so any existing theme.liquid inline scripts don't break

  w.setCookie        = function (n, v, d) { w.CookieManager.set(n, v, d); };
  w.getCookie        = function (n)       { return w.CookieManager.get(n); };
  w.setCustomLogos   = function (a, d)    { w.CookieManager.setPersistedLogos(a); };
  w.clearCachedLogos = function ()        { w.CookieManager.clearPersistedLogos(); };


  // ============================================================
  // SECTION 2 — COURSE LOGO LOOKUP
  // ============================================================
  // Looks up a logo URL by course handle from window.coursesData.
  // window.coursesData is populated on every page by fescue-data-bridge.liquid,
  // and merged into by featured-clubs.liquid / header-courses.liquid sections.

  w.getLogoByHandle = function (handle) {
    var data = w.coursesData || [];
    for (var i = 0; i < data.length; i++) {
      if (data[i].handle === handle && data[i].logo) {
        var logo = data[i].logo;
        // Normalise protocol-relative URLs (//cdn.shopify.com/...)
        return logo.indexOf('//') === 0 ? 'https:' + logo : logo;
      }
    }
    return null;
  };


  // ============================================================
  // SECTION 3 — LOGO ENGINE (priority resolver + animation)
  // ============================================================

  w.LogoEngine = {

    // ── _collectionLogos() ───────────────────────────────────
    // PC tier resolver. Returns the collection's club logos, or null if
    // this isn't a branded collection page.
    //
    // Preferred source: window.fcClubLogos[window.fcCollectionClub] — the
    // same map the OVERRIDE tier uses, so a branded collection shows the
    // full club logo set at full fidelity with zero data duplication.
    //
    // Fallback: window.fcCollectionLogos — the collection's own
    // course_logo_1/2/3 metafields. Only used when the handle is missing
    // from fcClubLogos (e.g. a course metaobject with no course_logos list).

    _collectionLogos: function () {
      var h = w.fcCollectionClub;
      if (h) {
        var mapped = (w.fcClubLogos || {})[h];
        if (mapped && mapped.length) return mapped;
        console.warn('[LogoEngine] PC — handle not found in fcClubLogos:', h,
                     '— falling back to collection metafields.');
      }
      var fb = w.fcCollectionLogos || [];
      return fb.length ? fb : null;
    },

    // ── resolve() ────────────────────────────────────────────
    // Runs the full priority chain.
    // Returns the resolved logo URL array and writes it to window.logoSources.

    resolve: function () {
      var logos = null;
      var facetActive = !!(w.fcFacetLogos && w.fcFacetLogos.length > 0);

      // ── Club page visit cancels any active override ─────────
      // A deliberate club navigation (P1) always clears the override so
      // the freshly-visited club takes over. MUST run before the override
      // read below — otherwise the override would shadow the new club.
      //
      // NOTE: a COLLECTION page deliberately does NOT do this. The PC tier
      // is ephemeral — it outranks the override for display while you're on
      // the collection, but leaving restores the campaign logos intact.
      if (w.fcPageLogos && w.fcPageLogos.length > 0) {
        w.CookieManager.clearOverrideClub();
      }

      // ── PC ('top' mode): collection branding beats everything ───
      // A branded collection is that club's territory — it can never show
      // another club's mark. Facet (P0) still wins: it's a live user action.
      if (COLLECTION_PRIORITY === 'top' && !facetActive) {
        var pcTop = this._collectionLogos();
        if (pcTop) {
          console.log('[LogoEngine] PC — collection club logos:', w.fcCollectionClub, pcTop);
          w.logoSources = pcTop;
          return pcTop;
        }
      }

      // ── OVERRIDE: manual club override ──────────────────────
      // Handle from cookie; logos resolved live from window.fcClubLogos.
      // Set via utm_campaign_club URL param or LogoEngine.setOverride().
      var overrideHandle = w.CookieManager.getOverrideClub();
      if (overrideHandle) {
        var ovLogos = (w.fcClubLogos || {})[overrideHandle];
        if (ovLogos && ovLogos.length) {
          console.log('[LogoEngine] OVERRIDE —', overrideHandle, ovLogos);
          w.logoSources = ovLogos;
          return ovLogos;
        }
        console.warn('[LogoEngine] OVERRIDE handle not in fcClubLogos:', overrideHandle);
      }

      // ── P0: Facet filter override ───────────────────────────
      // Set by facets.liquid when user selects a club filter.
      // Overrides P1–P4 but NOT the OVERRIDE tier.
      // Cleared when filter is removed, restoring normal priority chain.
      if (facetActive) {
        console.log('[LogoEngine] P0 — facet filter logos:', w.fcFacetLogos);
        w.logoSources = w.fcFacetLogos;
        return w.fcFacetLogos;
      }

      // ── P1: Club/metaobject page ────────────────────────────
      // window.fcPageLogos is set by fescue-data-bridge.liquid ONLY on
      // club pages / metaobject template pages.
      // If present, write to cookie so it persists (becomes P2).
      // Also persist the club handle (window.fcPageHandle) if provided.
      if (w.fcPageLogos && w.fcPageLogos.length > 0) {
        console.log('[LogoEngine] P1 — club page logos:', w.fcPageLogos);
        w.CookieManager.setPersistedLogos(w.fcPageLogos);
        if (w.fcPageHandle) w.CookieManager.setPersistedClub(w.fcPageHandle);
        logos = w.fcPageLogos;
      }

      // ── P2: Persisted logos from prior club page visit ──────
      // customLogoSources cookie was written by a previous P1 visit.
      // User is now on a non-club page but the logo should follow them.
      if (!logos) {
        var persisted = w.CookieManager.getPersistedLogos();
        if (persisted) {
          console.log('[LogoEngine] P2 — persisted club logos from cookie:', persisted);
          logos = persisted;
        }
      }

      // ── PC ('sticky' mode): collection sits below OVERRIDE/P1/P2 ──
      // Campaign + journey logos survive onto collection pages; the
      // collection only brands itself when nothing sticky is active.
      if (!logos && COLLECTION_PRIORITY === 'sticky') {
        var pcLow = this._collectionLogos();
        if (pcLow) {
          console.log('[LogoEngine] PC — collection club logos (sticky mode):',
                      w.fcCollectionClub, pcLow);
          logos = pcLow;
        }
      }

      // ── P3: Favorite clubs ──────────────────────────────────
      // No club page visited — use logos from the user's favorited courses.
      // Requires window.coursesData (set on every page by the data bridge).
      if (!logos) {
        var handles = w.CookieManager.getFavoriteClubs();
        if (handles.length > 0) {
          var favLogos = handles
            .map(function (h) { return w.getLogoByHandle(h); })
            .filter(Boolean);
          if (favLogos.length > 0) {
            console.log('[LogoEngine] P3 — favorite club logos:', favLogos);
            logos = favLogos;
          }
        }
      }

      // ── P4: Theme defaults ──────────────────────────────────
      // Nothing else matched. Use the static logo set from theme customizer.
      if (!logos) {
        var defaults = w.fcDefaultLogos || [];
        if (defaults.length > 0) {
          console.log('[LogoEngine] P4 — theme default logos:', defaults);
          logos = defaults;
        }
      }

      // Fallback to empty array so animation doesn't crash
      logos = logos || [];

      w.logoSources = logos;
      return logos;
    },

    // ── _applyUrlOverride() ──────────────────────────────────
    // Read OVERRIDE_PARAM once on landing; if it names a known club in
    // window.fcClubLogos, store the handle in the override cookie.
    // Validated against the map so junk/expired campaign values are ignored.

    _applyUrlOverride: function () {
      try {
        var val = new URL(w.location.href).searchParams.get(OVERRIDE_PARAM);
        if (!val) return;
        var handle = val.trim().toLowerCase();
        if ((w.fcClubLogos || {})[handle]) {
          w.CookieManager.setOverrideClub(handle);
          console.log('[LogoEngine] URL override:', handle);
        } else {
          console.warn('[LogoEngine] URL override not found in fcClubLogos:', handle);
        }
      } catch (e) { console.warn('[LogoEngine] _applyUrlOverride failed:', e); }
    },

    // ── _animate() ───────────────────────────────────────────
    // Internal: display logos on all .logo-overlay elements with
    // staggered animation between each overlay instance.

    _currentIndex: 0,
    _isFirstRun: true,

    _updateOverlays: function () {
      var self = w.LogoEngine;
      var overlays = document.querySelectorAll('.logo-overlay');
      if (!overlays.length || !w.logoSources || !w.logoSources.length) return;

      var src = w.logoSources[self._currentIndex];

      overlays.forEach(function (overlay, i) {
        // First run: show immediately. Subsequent: stagger by 200ms per overlay
        var delay = self._isFirstRun ? 0 : i * 200;
        setTimeout(function () {
          overlay.innerHTML = '';
          var img = document.createElement('img');
          img.src = src;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          overlay.appendChild(img);
        }, delay);
      });

      self._currentIndex = (self._currentIndex + 1) % w.logoSources.length;
      self._isFirstRun = false;
    },

    // ── init() ───────────────────────────────────────────────
    // Resolve priority chain then start animation.
    // Called on DOMContentLoaded from fescue-data-bridge.liquid.
    //
    // GUARDED against double-boot: theme.liquid historically had its own
    // DOMContentLoaded → init() alongside the data bridge's. Two intervals
    // sharing one _currentIndex made logos rotate at double speed and skip
    // entries. Clearing any existing interval here makes a second init()
    // harmless.

    init: function () {
      var self = this;

      if (w.logoAnimationInterval) {
        clearInterval(w.logoAnimationInterval);
        w.logoAnimationInterval = null;
      }

      // Capture any inbound override param BEFORE resolving the chain.
      self._applyUrlOverride();

      var logos = self.resolve();

      if (!logos.length) {
        console.warn('[LogoEngine] No logo sources found across all priorities.');
        return;
      }

      self._currentIndex = 0;
      self._isFirstRun = true;
      self._updateOverlays();

      var ms = w.fcAnimationMs || 4500;
      w.logoAnimationInterval = setInterval(function () {
        self._updateOverlays();
      }, ms);

      console.log('[LogoEngine] Animation started —', logos.length, 'logo(s),', ms, 'ms interval');

      // Install the delegated club-link tagger (no-op if already installed)
      self.tagProductLinks();
    },

    // ── restart() ────────────────────────────────────────────
    // Stop existing animation, re-resolve priority chain, restart.
    // Call this after any favorite add/remove or cookie change.

    restart: function () {
      var self = this;

      if (w.logoAnimationInterval) {
        clearInterval(w.logoAnimationInterval);
        w.logoAnimationInterval = null;
      }

      self._currentIndex = 0;
      self._isFirstRun = true;

      var logos = self.resolve();

      if (!logos.length) {
        console.warn('[LogoEngine] No logo sources found after restart.');
        return;
      }

      var ms = w.fcAnimationMs || 4500;
      self._updateOverlays();
      w.logoAnimationInterval = setInterval(function () {
        self._updateOverlays();
      }, ms);

      console.log('[LogoEngine] Animation restarted —', logos.length, 'logo(s)');

      // Ensure the delegated tagger is installed (no-op if already installed).
      // Because tagging happens at click time, cards re-rendered after a
      // favorite change are covered automatically — no re-scan needed.
      self.tagProductLinks();
    },

    // ── setOverride() / clearOverride() ──────────────────────
    // Programmatic control of the OVERRIDE tier. Handle must exist in
    // window.fcClubLogos. Both restart animation.
    // NOTE: calling setOverride() while ON a club page is a no-op effect —
    // resolve() sees fcPageLogos and clears the override immediately. This
    // is intentional ("a club visit cancels the override").
    // On a branded COLLECTION page in 'top' mode the override cookie IS set
    // but PC outranks it for display; it takes effect as soon as the user
    // leaves the collection.

    setOverride: function (handle) {
      if (!handle || !(w.fcClubLogos || {})[handle]) {
        console.warn('[LogoEngine] setOverride — invalid/unknown handle:', handle);
        return;
      }
      w.CookieManager.setOverrideClub(handle);
      this.restart();
    },

    clearOverride: function () {
      w.CookieManager.clearOverrideClub();
      this.restart();
    }
  };


  // ============================================================
  // SECTION 3b — CLUB LINK TAGGING (click-time, delegated)
  // ============================================================
  // ONE delegated listener on the document. When any link is activated we
  // tag it — at that moment — with ?club=<handle>, matching on the URL's
  // *pathname* (not a wrapper class). This catches every product link
  // regardless of markup or when it entered the DOM.
  //
  // Handle source mirrors the display chain:
  //   'top' mode    → collection club wins (branded collection = that club's
  //                   territory, so its product links carry its handle)
  //   'sticky' mode → override → persisted → collection
  //
  // Existing params are preserved: searchParams.set('club', …) only touches
  // the `club` key and leaves variant/ref/utm/etc. and the #hash intact.
  // Idempotent: links already carrying a `club` param are never overwritten.
  //
  // NOTE: the internal tag param is `club` and is DISTINCT from the inbound
  // override param `utm_campaign_club`. They do not collide — by design.

  w.LogoEngine._linkInterceptorAttached = false;

  // Resolve which club handle should be stamped on outgoing product links.
  w.LogoEngine._tagHandle = function () {
    if (COLLECTION_PRIORITY === 'top' && w.fcCollectionClub) {
      return w.fcCollectionClub;
    }
    return w.CookieManager.getOverrideClub()
        || w.CookieManager.getPersistedClub()
        || w.fcCollectionClub
        || null;
  };

  // Tag a single anchor in place. Safe to call on any anchor — it
  // self-filters to same-origin /products/ links only.
  w.LogoEngine._tagAnchor = function (a) {
    var handle = w.LogoEngine._tagHandle();
    if (!handle) return;                                  // no club context → leave links alone
    if (!a) return;

    var raw = a.getAttribute('href');
    if (!raw) return;
    if (raw.indexOf('/products/') === -1) return;         // cheap pre-filter

    var url;
    try { url = new URL(raw, w.location.origin); }
    catch (e) { return; }                                 // unparseable → skip

    if (url.host !== w.location.host) return;             // same-origin only
    if (url.pathname.indexOf('/products/') === -1) return; // authoritative: real product path
    if (url.searchParams.has('club')) return;             // already tagged → never overwrite

    // Append ONLY the club param — every other existing param is preserved.
    url.searchParams.set('club', handle);

    // Preserve the original href style (relative vs absolute) and the hash.
    var isAbsolute = /^https?:\/\//i.test(raw);
    a.setAttribute('href', isAbsolute ? url.href : url.pathname + url.search + url.hash);
  };

  // Install the single delegated listener (only once per page).
  w.LogoEngine.attachClubLinkInterceptor = function () {
    var self = this;
    if (self._linkInterceptorAttached) return;            // guard double install
    self._linkInterceptorAttached = true;

    function handler(e) {
      var t = e.target;
      if (!t || !t.closest) return;                       // walk up from clicked img/span to the <a>
      var a = t.closest('a[href]');
      if (a) self._tagAnchor(a);
    }

    // Capture phase = run BEFORE navigation and before any card-level
    // handler that might call stopPropagation().
    //  - pointerdown fires for left/middle/right buttons, so the href is
    //    already tagged when the context menu builds ("open in new tab" /
    //    "copy link address" get the tagged URL too).
    //  - click covers keyboard (Enter) activation and acts as a backstop.
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);

    console.log('[LogoEngine] Club link interceptor installed (click-time tagging).');
  };

  // ── tagProductLinks() ──────────────────────────────────────
  // Public API kept for backward compatibility. Ensures the delegated
  // click-time interceptor is installed. All existing call sites
  // (init / restart / reinitLogoAnimation / DOMContentLoaded) keep working.
  w.LogoEngine.tagProductLinks = function () {
    w.LogoEngine.attachClubLinkInterceptor();
  };

  // Legacy alias — product-card.liquid calls reinitLogoAnimation()
  w.reinitLogoAnimation = function () { w.LogoEngine.restart(); };

  // Safety net: install the interceptor on DOMContentLoaded independent of
  // init(). Runs even when animation is disabled; idempotent so double-runs
  // (this + init) are harmless.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      w.LogoEngine.tagProductLinks();
    });
  } else {
    w.LogoEngine.tagProductLinks();
  }


  // ============================================================
  // SECTION 4 — FEATURED CLUBS SECTION UI
  // ============================================================
  // Handles card grid hearts, favorites strip, and mobile carousel.
  // Called per-section via: FeaturedClubs.init(sectionId)
  // Data passed via:        window['fcCourses_' + sectionId]

  w.FeaturedClubs = w.FeaturedClubs || {

    init: function (sectionId) {
      var courses   = w['fcCourses_' + sectionId] || [];
      var grid      = document.getElementById('fc-grid-'       + sectionId);
      var dotsEl    = document.getElementById('fc-dots-'       + sectionId);
      var emptyEl   = document.getElementById('fc-empty-'      + sectionId);
      var filledEl  = document.getElementById('fc-filled-'     + sectionId);
      var favScroll = document.getElementById('fc-fav-scroll-' + sectionId);

      if (!grid) return;

      // ── Helpers ──────────────────────────────────────────

      function isMobile() {
        return w.matchMedia('(max-width: 768px)').matches;
      }

      // After any favorite change: re-render strip + restart logo animation
      function onFavoritesChanged() {
        syncHearts();
        renderFavorites();
        w.LogoEngine.restart();
      }

      // ── Heart buttons on cards ────────────────────────────

      function syncHearts() {
        var favs = w.CookieManager.getFavoriteClubs();
        grid.querySelectorAll('.fc-card__heart').forEach(function (btn) {
          btn.classList.toggle('is-favorited', favs.indexOf(btn.dataset.handle) !== -1);
        });
      }

      function attachHeartListeners() {
        grid.querySelectorAll('.fc-card__heart').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var handle = btn.dataset.handle;
            if (w.CookieManager.isFavoriteClub(handle)) {
              w.CookieManager.removeFavoriteClub(handle);
            } else {
              w.CookieManager.addFavoriteClub(handle);
            }
            onFavoritesChanged();
          });
        });
      }

      // ── Favorites strip ───────────────────────────────────

      function renderFavorites() {
        var favs = w.CookieManager.getFavoriteClubs();
        var favCourses = courses.filter(function (c) {
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

        favCourses.forEach(function (course) {
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

          // Remove from favorites when heart in strip is clicked
          item.querySelector('.fc-fav-item__heart').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            w.CookieManager.removeFavoriteClub(course.handle);
            onFavoritesChanged();
          });

          favScroll.appendChild(item);
        });
      }

      // ── Mobile 2×2 carousel ───────────────────────────────

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
          dot.className = 'fc-dot' + (i === currentPage ? ' active' : '');
          dot.setAttribute('aria-label', 'Page ' + (i + 1));
          dot.dataset.page = i;
          dot.addEventListener('click', function () {
            goToPage(parseInt(this.dataset.page));
          });
          dotsEl.appendChild(dot);
        }
      }

      function goToPage(page) {
        currentPage = page;
        cards.forEach(function (card, idx) {
          card.style.display = (Math.floor(idx / CARDS_PER_PAGE) === currentPage) ? '' : 'none';
        });
        dotsEl.querySelectorAll('.fc-dot').forEach(function (dot, i) {
          dot.classList.toggle('active', i === currentPage);
        });
      }

      function applyCarousel() {
        if (isMobile()) {
          buildDots();
          goToPage(currentPage);
        } else {
          cards.forEach(function (card) { card.style.display = ''; });
          dotsEl.innerHTML = '';
        }
      }

      // Touch swipe for carousel
      var touchStartX = 0;
      grid.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].clientX;
      }, { passive: true });

      grid.addEventListener('touchend', function (e) {
        if (!isMobile()) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0 && currentPage < totalPages() - 1) goToPage(currentPage + 1);
        if (dx > 0 && currentPage > 0) goToPage(currentPage - 1);
      }, { passive: true });

      // Reapply carousel on resize
      var resizeTimer;
      w.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          currentPage = 0;
          applyCarousel();
        }, 200);
      });

      // ── Init this section instance ────────────────────────
      attachHeartListeners();
      syncHearts();
      renderFavorites();
      applyCarousel();
    }
  };

}(window));


/**
 * ════════════════════════════════════════════════════════════
 * CHANGE LOG
 * ════════════════════════════════════════════════════════════
 *
 * [2026-07-17] PC tier — collection club branding
 *
 *   Problem: collection pages had NO tier in the chain. A Royal Birkdale
 *   collection fell through to whatever was sticky — the utm override, a
 *   previously visited club page, favorites, or the 12 theme defaults —
 *   and rotated other clubs' logos on a club-branded page.
 *
 *   Design decisions (as agreed):
 *     • Handle-driven. window.fcCollectionClub comes from the collection's
 *       custom.selected_course metaobject reference (the same field already
 *       used for product-link URL params). Logos resolve from
 *       window.fcClubLogos[handle] → ALL logos for that club, not just 3.
 *     • Metafield fallback. window.fcCollectionLogos (course_logo_1/2/3 on
 *       the collection) is used ONLY if the handle isn't in fcClubLogos.
 *       Admin has 38 courses; fcClubLogos has 36 keys (it skips courses with
 *       an empty course_logos list) — this covers that gap.
 *     • EPHEMERAL. PC writes no cookie and does NOT clear the override.
 *       Leaving a collection restores the previous chain exactly. Only club
 *       pages persist (P1 → P2), unchanged.
 *     • Position: COLLECTION_PRIORITY constant at the top of the IIFE.
 *         'top'    (default) → PC beats OVERRIDE / P1 / P2 / P3 / P4
 *         'sticky'           → PC sits below OVERRIDE / P1 / P2, above P3
 *       Facet (P0) beats PC in both modes — it's a live user action.
 *
 *   Added:
 *     • COLLECTION_PRIORITY config constant.
 *     • LogoEngine._collectionLogos() — PC resolver w/ metafield fallback.
 *     • resolve(): PC 'top' block before OVERRIDE; PC 'sticky' block between
 *       P2 and P3. facetActive hoisted so PC can defer to it.
 *     • LogoEngine._tagHandle() — single source of truth for link tagging.
 *       In 'top' mode the collection club wins, so products clicked from a
 *       branded collection carry ?club=<that collection's club>.
 *
 *   Fixed (required — would have made PC look broken):
 *     • init() now clears any existing logoAnimationInterval before starting.
 *       theme.liquid <head> and fescue-data-bridge.liquid each had their own
 *       DOMContentLoaded → init(). Two intervals shared one _currentIndex, so
 *       logos rotated at double speed and skipped entries.
 *
 *   REQUIRES (Liquid, not in this file):
 *     • fescue-data-bridge.liquid must set window.fcCollectionClub and
 *       window.fcCollectionLogos (null / [] on non-collection pages).
 *     • window.fcClubLogos must remain present on every page.
 *
 * ── [2026-06-22] OVERRIDE tier — utm_campaign_club URL param override ──
 *
 *   Override sits above the facet filter; cleared only on a club page visit;
 *   cookie stores ONLY the club handle (logoOverrideClub) so logos resolve
 *   live from window.fcClubLogos and never go stale. Inbound param is
 *   utm_campaign_club, distinct from the internal `club` link-tag param.
 *   Added CookieManager.get/set/clearOverrideClub, _applyUrlOverride(),
 *   setOverride()/clearOverride().
 *
 * ── PRE-EXISTING ITEMS STILL NOT ADDRESSED ──────────────────
 *   • theme.liquid <head> duplicates fescue-data-bridge.liquid entirely
 *     (fcAnimationMs, fcDefaultLogos, coursesData, fcPageLogos). Harmless
 *     today because values match, but it's a drift risk. Deleting the head
 *     block requires moving window.fcPageHandle into the bridge FIRST —
 *     the bridge does not currently set it, and link tagging on club pages
 *     depends on it.
 *   • The body-bottom legacy scripts in theme.liquid (club_page + courses
 *     templates) write the SAME logos to the cookie again at width:100 with
 *     no limit:3, and write a `club_handle` cookie nothing reads. They
 *     duplicate what resolve() already does at P1. Candidates for deletion.
 *   • restart() doesn't cancel in-flight staggered setTimeouts from
 *     _updateOverlays — a repaint from the old cycle can land after the new
 *     one starts.
 *   • _applyUrlOverride() only runs inside init(), so with animation
 *     disabled the utm param is never captured and link tagging falls back
 *     to the persisted club.
 *   • P3 gives 1 logo per club (getLogoByHandle) while PC/OVERRIDE/P1 give
 *     the full set — rotation fidelity differs by tier.
 *   • customLogoSources is written un-encoded while favorite_clubs uses
 *     encodeURIComponent — inconsistent.
 *   • renderFavorites() builds HTML by string concat with course.title —
 *     a title containing " or < breaks the markup.
 *   • FeaturedClubs.init only null-checks `grid`.
 * ════════════════════════════════════════════════════════════
 */