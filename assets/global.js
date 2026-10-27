window.Foxtheme = window.Foxtheme || {};

const PUB_SUB_EVENTS = {
  cartError: "cart-error",
  cartUpdate: "cart-update",
  optionValueSelectionChange: "option-value-selection-change",
  variantChange: "variant-change",
  cartUpdate: "cart-update",
  quantityUpdate: "quantity-update",
  quantityBoundries: "quantity-boundries",
  quantityRules: "quantity-rules",
};

class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(
    oldNode,
    newContent,
    preProcessCallbacks = [],
    postProcessCallbacks = []
  ) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement("div");
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll("[id], [form]").forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form &&
        element.setAttribute(
          "form",
          `${element.form.getAttribute("id")}-${uniqueKey}`
        );
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = "none";

    postProcessCallbacks?.forEach((callback) => {
      callback(newNode);
    });

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll("script").forEach((oldScriptTag) => {
      const newScriptTag = document.createElement("script");
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

function generateDomFromString(value, tagName = "div") {
  const d = document.createElement(tagName);
  d.innerHTML = value;
  return d;
}

function getScrollbarWidth() {
  const outer = document.createElement("div");
  outer.style.visibility = "hidden";
  outer.style.overflow = "scroll";
  outer.style.msOverflowStyle = "scrollbar";
  document.body.appendChild(outer);
  const inner = document.createElement("div");
  outer.appendChild(inner);
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  outer.parentNode.removeChild(outer);
  return scrollbarWidth;
}

function getSectionId(element) {
  if (element.hasAttribute("data-section-id"))
    return element.getAttribute("data-section-id");

  element = element.classList.contains("shopify-section")
    ? element
    : element.closest(".shopify-section");
  return element.id.replace("shopify-section-", "");
}

const sectionCache = new Map();
function fetchSection(sectionId, options = {}) {
  const { url: _url, fromCache = false, params = {} } = options;
  return new Promise((resolve, reject) => {
    const url = new URL(_url || window.location.href);
    url.searchParams.set("section_id", sectionId);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    if (fromCache) {
      const cached = sectionCache.get(url);
      if (cached) return resolve(cached);
    }

    fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (res.ok) return res.text();
        reject(`Failed to load section: ${sectionId}`);
      })
      .then((html) => {
        const div = generateDomFromString(html);
        sectionCache.set(url, div);
        resolve(div);
      })
      .catch(reject);
  });
}

function loadAssets(files = [], id, callback = () => {}, options = {}) {
  const unique = id ? id : Math.random().toString(36).slice(2);
  if (!window.FoxTheme.loadjs.isDefined(id))
    window.FoxTheme.loadjs(files, unique);
  window.FoxTheme.loadjs.ready(unique, callback);
}

function queryDomNodes(selectors = {}, context = document) {
  const domNodes = Object.entries(selectors).reduce((acc, [name, selector]) => {
    const findOne = typeof selector === "string";
    const queryMethod = findOne ? "querySelector" : "querySelectorAll";
    const sl = findOne ? selector : selector[0];

    acc[name] = context && context[queryMethod](sl);
    if (!findOne && acc[name]) {
      acc[name] = [...acc[name]];
    }
    return acc;
  }, {});
  return domNodes;
}

function addEventDelegate({
  context = document.documentElement,
  event = "click",
  selector,
  handler,
  capture = false,
}) {
  const listener = function (e) {
    // loop parent nodes from the target to the delegation node
    for (
      let target = e.target;
      target && target !== this;
      target = target.parentNode
    ) {
      if (target.matches(selector)) {
        handler.call(target, e, target);
        break;
      }
    }
  };
  context.addEventListener(event, listener, capture);
  return () => {
    context.removeEventListener(event, listener, capture);
  };
}

function isStorageSupported(type) {
  // Return false if we are in an iframe without access to sessionStorage
  if (window.self !== window.top) {
    return false;
  }

  const testKey = "minimog:check";
  let storage;
  if (type === "session") {
    storage = window.sessionStorage;
  }
  if (type === "local") {
    storage = window.localStorage;
  }

  try {
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    // Do nothing, this may happen in Safari in incognito mode
    return false;
  }
}

const moneyFormat = "${{amount}}";
function formatMoney(cents, format) {
  if (typeof cents === "string") {
    cents = cents.replace(".", "");
  }
  let value = "";
  const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  const formatString = format || moneyFormat;

  function formatWithDelimiters(
    number,
    precision = 2,
    thousands = ",",
    decimal = "."
  ) {
    if (isNaN(number) || number == null) {
      return 0;
    }

    number = (number / 100.0).toFixed(precision);

    const parts = number.split(".");
    const dollarsAmount = parts[0].replace(
      /(\d)(?=(\d\d\d)+(?!\d))/g,
      `$1${thousands}`
    );
    const centsAmount = parts[1] ? decimal + parts[1] : "";

    return dollarsAmount + centsAmount;
  }

  switch (formatString.match(placeholderRegex)[1]) {
    case "amount":
      value = formatWithDelimiters(cents, 2);
      break;
    case "amount_no_decimals":
      value = formatWithDelimiters(cents, 0);
      break;
    case "amount_with_comma_separator":
      value = formatWithDelimiters(cents, 2, ".", ",");
      break;
    case "amount_no_decimals_with_comma_separator":
      value = formatWithDelimiters(cents, 0, ".", ",");
      break;
  }

  return formatString.replace(placeholderRegex, value);
}

function intersecting(options) {
  var threshold = options.threshold ? options.threshold : 0;
  var observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (typeof options.callback === "function") {
            options.callback();
            observer.unobserve(entry.target);
          }
        }
      });
    },
    { rootMargin: "0px 0px " + threshold + "px 0px" }
  );
  observer.observe(options.element);
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

class AnimateComponent extends HTMLElement {
  constructor() {
    super();

    intersecting({
      element: this,
      callback: this.init.bind(this),
      threshold: 0,
    });
  }

  init() {
    this.setAttribute("is-visible", true);
  }
}
customElements.define("animate-component", AnimateComponent);

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute("role", "button");
  summary.setAttribute("aria-expanded", "false");

  if (summary.nextElementSibling.getAttribute("id")) {
    summary.setAttribute("aria-controls", summary.nextElementSibling.id);
  }

  summary.addEventListener("click", (event) => {
    event.currentTarget.setAttribute(
      "aria-expanded",
      !event.currentTarget.closest("details").hasAttribute("open")
    );
  });

  summary.parentElement.addEventListener("keyup", onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== "TAB") return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  elementToFocus.focus();
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch (e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    "ARROWUP",
    "ARROWDOWN",
    "ARROWLEFT",
    "ARROWRIGHT",
    "TAB",
    "ENTER",
    "SPACE",
    "ESCAPE",
    "HOME",
    "END",
    "PAGEUP",
    "PAGEDOWN",
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener("keydown", (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener("mousedown", (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    "focus",
    () => {
      if (currentFocusedElement)
        currentFocusedElement.classList.remove("focused");

      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add("focused");
    },
    true
  );
}

function pauseAllMedia(container = document) {
  container.querySelectorAll(".js-youtube").forEach((video) => {
    if (!video.classList.contains("video-playsinline")) {
      video.contentWindow.postMessage(
        '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
        "*"
      );
    }
  });
  container.querySelectorAll(".js-vimeo").forEach((video) => {
    if (!video.classList.contains("video-playsinline")) {
      video.contentWindow.postMessage('{"method":"pause"}', "*");
    }
  });
  container.querySelectorAll("video").forEach((video) => {
    if (!video.classList.contains("video-playsinline")) {
      video.pause();
    }
  });
  container.querySelectorAll("product-model").forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== "ESCAPE") return;

  const openDetailsElement = event.target.closest("details[open]");
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector("summary");
  openDetailsElement.removeAttribute("open");
  summaryElement.setAttribute("aria-expanded", false);
  summaryElement.focus();
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function cookiesEnabled() {
  let cookieEnabled = navigator.cookieEnabled;

  if (!cookieEnabled) {
    document.cookie = "testcookie";
    cookieEnabled = document.cookie.indexOf("testcookie") !== -1;
  }
  return cookieEnabled;
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  var expires = "expires=" + d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) === " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function getSrcset(src, sizes = ["360", "533", "720", "940", "1066"]) {
  sizes = sizes.map((size) => {
    return `${getSizedImageUrl(src, size + "x")} ${size}w`;
  });
  return sizes.join(", ");
}

function removeProtocol(path) {
  return path.replace(/http(s)?:/, "");
}

function getSizedImageUrl(src, size) {
  if (size === null) {
    return src;
  }

  if (size === "master") {
    return removeProtocol(src);
  }

  const match = src.match(
    /\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif|webp)(\?v=\d+)?$/i
  );

  if (match) {
    const prefix = src.split(match[0]);
    const suffix = match[0];

    return removeProtocol(`${prefix[0]}_${size}${suffix}`);
  } else {
    return null;
  }
}

function getBaseUnit(variant) {
  if (!variant) {
    return;
  }

  if (
    !variant.unit_price_measurement ||
    !variant.unit_price_measurement.reference_value
  ) {
    return;
  }

  return variant.unit_price_measurement.reference_value === 1
    ? variant.unit_price_measurement.reference_unit
    : variant.unit_price_measurement.reference_value +
        variant.unit_price_measurement.reference_unit;
}

/*
 * Shopify Common JS
 *
 */
if (typeof window.Shopify == "undefined") {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value === option.value || value === option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent("on" + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options["method"] || "post";
  var params = options["parameters"] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.postLink2 = function (path, options) {
  options = options || {};
  const method = options["method"] || "post";
  const params = options["parameters"] || {};

  const form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (const key in params) {
    for (const index in params[key]) {
      for (const key2 in params[key][index]) {
        const hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", `${key}[${index}][${key2}]`);
        hiddenField.setAttribute("value", params[key][index][key2]);
        form.appendChild(hiddenField);
      }
    }
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (
  country_domid,
  province_domid,
  options
) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(
    options["hideElement"] || province_domid
  );

  Shopify.addListener(
    this.countryEl,
    "change",
    Shopify.bind(this.countryHandler, this)
  );

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute("data-default");
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute("data-default");
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute("data-provinces");
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length === 0) {
      this.provinceContainer.style.display = "none";
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement("option");
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement("option");
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};

class SliderComponent extends HTMLElement {
  constructor() {
    super();

    this.initialized = false;
    this.numberSlides = this.childElementCount; // Cache number items before DOM changes.
  }

  connectedCallback() {
    const { enableSlider } = this.dataset;

    if (enableSlider !== "true") return;

    this.init();
    document.addEventListener("matchTablet", this.init.bind(this));
    document.addEventListener("unmatchTablet", this.init.bind(this));
  }

  init() {
    const { sliderColumns, sliderColumnsTablet } = this.dataset;

    if (!this.initialized) {
      this.destroy(); // Make sure slider destroyed to re-init when switch devides.
    }

    let activeColumns =
      FoxThemeSettings.isTablet && sliderColumnsTablet
        ? sliderColumnsTablet
        : sliderColumns;

    activeColumns = parseInt(activeColumns);

    if (this.numberSlides > activeColumns) {
      this.classList.add("md:flickity-enable");
      this.initSlider();
    } else if (this.numberSlides <= activeColumns) {
      // Fix slider hidden.
      this.classList.remove("md:flickity-enable");
    }
  }

  initSlider() {
    this.classList.remove("flickity-destroyed");
    this.slider = new window.FoxTheme.Slider(this);
    this.disablePointerMove = this.dataset.disablePointerMove || true;
    this.paginateCounterWrapper = this.querySelector(".flickity-page-counter");

    if (
      this.slider &&
      this.slider.instance &&
      this.dataset.disablePointerMove !== "false"
    ) {
      this.classList.add("f-flickity-loaded");
      this.slider.instance.on("pointerMove", () => {
        this.classList.add("is-pointer-move");
      });
      this.slider.instance.on("pointerUp", () => {
        this.classList.remove("is-pointer-move");
      });
    }

    if (this.slider && this.slider.instance) {
      // Handle page counter
      if (this.paginateCounterWrapper) {
        let classesToRemove = [],
          classesToAdd = [];

        const isProductMedia = this.classList.contains("f-product__media-list");
        if (isProductMedia) {
          classesToRemove.push("hidden");
          classesToAdd.push("inline-flex");
        } else {
          if (this.classList.contains("md:flickity-enable")) {
            classesToRemove.push("md:hidden");
            classesToAdd.push("md:inline-flex", "hidden");
          } else {
            classesToRemove.push("hidden");
            classesToAdd.push("inline-flex");
          }
        }

        this.paginateCounterWrapper.classList.remove(...classesToRemove);
        this.paginateCounterWrapper.classList.add(...classesToAdd);

        this.slider.instance.on(
          "change",
          this.handlePaginateCounter.bind(this)
        );
      }

      if (!this.initialized) {
        window.onresize = () => {
          const flickityViewPort = this.querySelector(".flickity-viewport");
          if (flickityViewPort) flickityViewPort.style.height = null;
          this.update();
        };
        // Fix media slider not init on Safari
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 100);
      }

      this.initialized = true;
    }
  }

  update() {
    if (this.slider && this.slider.instance) {
      this.slider.instance.resize();
    }
  }

  destroy() {
    if (this.slider && typeof this.slider.instance === "object") {
      this.slider.instance.destroy();
      this.classList.add("flickity-destroyed");
      this.slider.instance.off("pointerMove");
      this.slider.instance.off("pointerUp");
    }
  }

  select(index, isWrapped = false, isInstant = false) {
    this.slider && this.slider.instance.select(index, isWrapped, isInstant);
  }

  toggleFade(isFade = false) {
    const method = isFade ? "add" : "remove";
    this.slider.instance.options.fade = isFade;
    this.classList[method]("is-fade");
    this.update();
  }

  handlePaginateCounter(index) {
    const sliderCounterCurrent = this.querySelector(
      ".flickity-counter--current"
    );
    if (sliderCounterCurrent) {
      sliderCounterCurrent.textContent = index + 1;
    }
  }
}
customElements.define("flickity-component", SliderComponent);
class PressNavComponent extends SliderComponent {
  constructor() {
    super();

    document.addEventListener("matchMobile", () =>
      this.slider.instance.resize()
    );
    document.addEventListener("unmatchMobile", () =>
      this.slider.instance.resize()
    );
  }
}
customElements.define("press-nav-component", PressNavComponent);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    const autoplay = this.dataset.autoplay === "true";
    if (poster) {
      poster.addEventListener("click", this.loadContent.bind(this));
    } else {
      this.addObserver();
    }

    if (autoplay) {
      this.addObserver();
    }
  }

  addObserver() {
    if ("IntersectionObserver" in window === false) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadContent(false, false, "observer");
            observer.unobserve(this);
          }
        });
      },
      { rootMargin: "0px 0px 0px 0px" }
    );

    observer.observe(this);
  }

  loadContent(focus = true, pause = false, loadTrigger = "click") {
    if (pause) window.pauseAllMedia();
    if (!this.getAttribute("loaded")) {
      this.loadTrigger = loadTrigger;
      const content = document.createElement("div");
      content.appendChild(
        this.querySelector("template").content.firstElementChild.cloneNode(true)
      );

      this.setAttribute("loaded", true);
      const deferredElement = this.appendChild(
        content.querySelector("video, model-viewer, iframe")
      );
      const isProductCard =
        deferredElement && deferredElement.closest(".product-card");
      if (isProductCard || deferredElement.tagName === "VIDEO")
        deferredElement.play();
      if (focus) deferredElement.focus();
    }
  }
}
customElements.define("deferred-media", DeferredMedia);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.closeEvent = new Event("close");
    this.openEvent = new Event("open");

    this.querySelector('[id^="ModalClose-"]') &&
      this.querySelector('[id^="ModalClose-"]').addEventListener(
        "click",
        this.hide.bind(this)
      );
    this.addEventListener("keyup", (e) => {
      if (e.code.toUpperCase() === "ESCAPE") this.hide();
    });
    if (this.classList.contains("media-modal")) {
      this.addEventListener("pointerup", (event) => {
        // if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide()
      });
    } else {
      this.addEventListener("click", (event) => {
        if (event.target.nodeName === "MODAL-DIALOG") this.hide();
      });
    }

    this.scrollbarWidth = getScrollbarWidth();
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    if (!this.hasAttribute("data-no-append")) {
      document.body.appendChild(this);
    }
  }

  show(opener) {
    const popup = this.querySelector(".template-popup");
    this.openedBy = opener;
    document.body.classList.add("prevent-scroll");
    this.setAttribute("open", "");
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
    this.dispatchEvent(this.openEvent);
    document.body.style.paddingRight = this.scrollbarWidth + "px";
  }

  hide() {
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
    this.setAttribute("closing", "true");
    setTimeout(() => {
      this.removeAttribute("open");
      this.removeAttribute("closing");
      document.body.classList.remove("prevent-scroll");
      this.dispatchEvent(this.closeEvent);
      document.body.style.paddingRight = "";
    }, 300);
  }
}

customElements.define("modal-dialog", ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();
    const button = this.querySelector("button");

    if (!button) return;
    button.addEventListener("click", () => {
      const modal = document.querySelector(this.dataset.modal);
      if (modal) modal.show(button);
    });
  }
}

customElements.define("modal-opener", ModalOpener);

class QuantityInput extends HTMLElement {
  quantityUpdateUnsubscriber = undefined;
  quantityBoundriesUnsubscriber = undefined;
  quantityRulesUnsubscriber = undefined;

  constructor() {
    super();
  }

  get sectionId() {
    return this.getAttribute("data-section-id");
  }

  get productId() {
    return this.getAttribute("data-product-id");
  }

  get input() {
    return this.querySelector("input");
  }

  get value() {
    return this.input.value;
  }

  connectedCallback() {
    // Prevent multiple initialization
    if (this.hasAttribute("initialized")) return;
    this.setAttribute("initialized", "");

    this.abortController = new AbortController();

    this.buttons = Array.from(this.querySelectorAll("button"));
    this.changeEvent = new Event("change", { bubbles: true });

    // Move event listeners to use the AbortController signal
    this.input.addEventListener("change", this.onInputChange.bind(this), {
      signal: this.abortController.signal,
    });

    this.input.addEventListener(
      "focus",
      () => setTimeout(() => this.input.select()),
      { signal: this.abortController.signal }
    );

    this.buttons.forEach((button) => {
      button.addEventListener("click", this.onButtonClick.bind(this), {
        signal: this.abortController.signal,
      });
    });

    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = FoxThemeEvents.subscribe(
      PUB_SUB_EVENTS.quantityUpdate,
      this.validateQtyRules.bind(this)
    );
    this.quantityBoundriesUnsubscriber = FoxThemeEvents.subscribe(
      PUB_SUB_EVENTS.quantityBoundries,
      this.setQuantityBoundries.bind(this)
    );
    this.quantityRulesUnsubscriber = FoxThemeEvents.subscribe(
      PUB_SUB_EVENTS.quantityRules,
      this.updateQuantityRules.bind(this)
    );
  }

  disconnectedCallback() {
    // Remove the initialized attribute when component is disconnected
    this.removeAttribute("initialized");

    this.abortController.abort();

    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
    if (this.quantityBoundriesUnsubscriber) {
      this.quantityBoundriesUnsubscriber();
    }
    if (this.quantityRulesUnsubscriber) {
      this.quantityRulesUnsubscriber();
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.currentTarget.name === "plus") {
      if (
        parseInt(this.input.getAttribute("data-min")) >
          parseInt(this.input.step) &&
        this.input.value == 0
      ) {
        this.input.value = this.input.getAttribute("data-min");
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value)
      this.input.dispatchEvent(this.changeEvent);

    if (
      this.input.getAttribute("data-min") === previousValue &&
      event.currentTarget.name === "minus"
    ) {
      this.input.value = parseInt(this.input.min);
    }
  }

  onInputChange() {
    if (this.input.value === "") {
      this.input.value = parseInt(this.input.min);
    }
    this.validateQtyRules();
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector('button[name="minus"]');
      if (buttonMinus)
        buttonMinus.toggleAttribute(
          "disabled",
          parseInt(value) <= parseInt(this.input.min)
        );
    }
    if (this.input.max) {
      const buttonPlus = this.querySelector('button[name="plus"]');
      if (buttonPlus)
        buttonPlus.toggleAttribute(
          "disabled",
          parseInt(value) >= parseInt(this.input.max)
        );
    } else {
      const buttonPlus = this.querySelector('button[name="plus"]');
      if (buttonPlus) buttonPlus.removeAttribute("disabled");
    }
  }

  updateQuantityRules({ data: { sectionId, productId, parsedHTML } }) {
    if (sectionId !== this.sectionId || productId !== this.productId) return;
    const selectors = [
      ".quantity__input",
      ".quantity__rules",
      ".quantity__label",
    ];
    const quantityFormUpdated = parsedHTML.getElementById(
      `QuantityForm-${sectionId}`
    );

    const quantityForm = this.closest(`#QuantityForm-${sectionId}`);
    for (let selector of selectors) {
      const current = quantityForm.querySelector(selector);
      const updated = quantityFormUpdated.querySelector(selector);

      if (!current || !updated) continue;

      if (selector === ".quantity__input") {
        const attributes = [
          "data-cart-quantity",
          "data-min",
          "data-max",
          "step",
        ];
        for (let attribute of attributes) {
          const valueUpdated = updated.getAttribute(attribute);
          if (valueUpdated !== null) {
            current.setAttribute(attribute, valueUpdated);
          } else {
            current.removeAttribute(attribute);
          }
        }
      } else {
        current.innerHTML = updated.innerHTML;
      }
    }
  }

  setQuantityBoundries({ data: { sectionId, productId } }) {
    if (sectionId !== this.sectionId || productId !== this.productId) return;
    const data = {
      cartQuantity: this.input.hasAttribute("data-cart-quantity")
        ? parseInt(this.input.getAttribute("data-cart-quantity"))
        : 0,
      min: this.input.hasAttribute("data-min")
        ? parseInt(this.input.getAttribute("data-min"))
        : 1,
      max: this.input.hasAttribute("data-max")
        ? parseInt(this.input.getAttribute("data-max"))
        : null,
      step: this.input.hasAttribute("step")
        ? parseInt(this.input.getAttribute("step"))
        : 1,
    };

    let min = data.min;
    const max = data.max === null ? data.max : data.max - data.cartQuantity;
    if (max !== null) min = Math.min(min, max);
    if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

    this.input.min = min;
    if (max) {
      this.input.max = max;
    } else {
      this.input.removeAttribute("max");
    }
    this.input.value = min;

    FoxThemeEvents.emit(PUB_SUB_EVENTS.quantityUpdate, undefined);
  }

  reset() {
    this.input.value = this.input.defaultValue;
  }
}

customElements.define("quantity-input", QuantityInput);

class Drawer extends HTMLElement {
  constructor() {
    super();
    this.closeEvent = new Event("close");
    this.openEvent = new Event("open");

    this.opened = false;

    this.querySelector('[id^="DrawerClose-"]') &&
      this.querySelector('[id^="DrawerClose-"]').addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          this.closeDrawer();
        }
      );
    this.addEventListener("keyup", (e) => {
      if (e.code.toUpperCase() === "ESCAPE") this.closeDrawer();
    });

    this.elementToFocus =
      this.querySelector('[tabindex="-1"]') ||
      this.querySelector('input:not([type="hidden"])');
    if (this.dataset.elementToFocus)
      this.elementToFocus = this.querySelector(this.dataset.elementToFocus);
    // this.scrollbarWidth = getScrollbarWidth();
  }

  connectedCallback() {
    if (this.moved) return;
    const canMove = this.dataset.canMove;
    if (!canMove || canMove !== "false") {
      this.moved = true;
      document.body.appendChild(this);
    }
  }

  isOpen() {
    return this.hasAttribute("open");
  }

  onBodyClick(e) {
    if (e.target.classList.contains("f-drawer__overlay"))
      this.closeDrawer(false);
  }

  openDrawer(opener) {
    this.openedBy = opener;
    this.onBodyClickEvent =
      this.onBodyClickEvent || this.onBodyClick.bind(this);
    document.body.addEventListener("click", this.onBodyClickEvent);
    document.body.classList.add("prevent-scroll");
    this.setAttribute("open", "");

    trapFocus(this, this.elementToFocus);
    this.dispatchEvent(this.openEvent);
    // document.body.style.paddingRight = this.scrollbarWidth + "px";
  }

  closeDrawer(focusToggle = true) {
    if (focusToggle) removeTrapFocus(this.openedBy);
    this.removeAttribute("open");
    document.body.removeEventListener("click", this.onBodyClickEvent);
    document.body.classList.remove("prevent-scroll");
    this.dispatchEvent(this.closeEvent);
    // document.body.style.paddingRight = "";
  }
}

customElements.define("drawer-component", Drawer);

customElements.define(
  "drawer-opener",
  class DrawerOpener extends HTMLElement {
    constructor() {
      super();
      if (this.dataset.disabled === "true") return;
      const button =
        this.querySelector("button") || this.querySelector("[data-opener]");
      if (!button) return;
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const drawer = document.querySelector(this.dataset.drawer);
        if (drawer) drawer.openDrawer(button);
      });
    }
  }
);

customElements.define(
  "drawer-closer",
  class DrawerCloser extends HTMLElement {
    constructor() {
      super();
      const drawer = this.closest("drawer-component");

      if (drawer) {
        this.addEventListener("click", (e) => {
          e.preventDefault();
          drawer.closeDrawer();
        });
      }
    }
  }
);

customElements.define(
  "cart-note",
  class CartNote extends HTMLElement {
    constructor() {
      super();
      this.addEventListener(
        "change",
        debounce((event) => {
          const body = JSON.stringify({ note: event.target.value });
          fetch(`${FoxThemeSettings.routes.cart_update_url}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: `application/json`,
            },
            ...{ body },
          });
        }, 300)
      );
      this.collapsible = this.querySelector("collapsible-tab");
      this.querySelector(".btn-cancel").addEventListener(
        "click",
        this.handleClose.bind(this)
      );
    }

    handleClose(e) {
      e.preventDefault();
      if (this.collapsible) this.collapsible.close();
    }
  }
);

customElements.define(
  "cart-delivery-time",
  class CartDeliveryTime extends HTMLElement {
    constructor() {
      super();
      this.collapsible = this.querySelector("collapsible-tab");
      this.deliveryTimeElm = this.querySelector(
        "[name='attributes[Delivery time]']"
      );
      this.errorWrapper = this.querySelector(".f-cart-block-message-error");
      this.deliveryCodeKey = "zest-delivery-code";
      this.querySelector(".btn-cancel").addEventListener(
        "click",
        this.handleClose.bind(this)
      );
      this.querySelector(".btn-save").addEventListener(
        "click",
        this.handleSave.bind(this)
      );
      const today = new Date().toISOString().slice(0, 16);
      if (this.deliveryTimeElm) this.deliveryTimeElm.min = today;
    }
    handleSave(e) {
      e.preventDefault();
      const time = this.deliveryTimeElm.value;
      const currentTime = Date.parse(time);
      if (currentTime > Date.now()) {
        localStorage.setItem(this.deliveryCodeKey, time);
        const body = JSON.stringify({ attributes: { "Delivery time": time } });
        fetch(`${FoxThemeSettings.routes.cart_update_url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: `application/json`,
          },
          ...{ body },
        });
        this.handleClose(e);
      } else if (time == "") {
        localStorage.removeItem(this.deliveryCodeKey);
        window.FoxTheme.Notification.show({
          target: this.errorWrapper,
          method: "appendChild",
          type: "warning",
          message: window.FoxThemeStrings.noSelectDeliveryTime,
        });
      } else {
        localStorage.removeItem(this.deliveryCodeKey);
        window.FoxTheme.Notification.show({
          target: this.errorWrapper,
          method: "appendChild",
          type: "warning",
          message: window.FoxThemeStrings.invalidDeliveryTime,
        });
      }
    }
    handleClose(e) {
      e.preventDefault();
      if (this.collapsible) this.collapsible.close();
    }
  }
);

customElements.define(
  "product-modal",
  class ProductModal extends ModalDialog {
    constructor() {
      super();
    }

    connectedCallback() {
      this.slider = this.querySelector("flickity-component");
      this.mediaContent = this.querySelector(".media-modal__content");
    }

    hide() {
      super.hide();
      this.mediaContent.setAttribute("data-media-loading", "");
    }

    show(opener) {
      super.show(opener);
      if (this.slider) {
        setTimeout(() => {
          this.slider.update();
          this.showActiveMedia();
          this.slider.focus();
        }, 300);
      }
    }

    showActiveMedia() {
      const activeMedia = this.querySelector(
        `[data-media-id="${this.openedBy.getAttribute("data-media-id")}"]`
      );
      if (activeMedia) {
        const activeIndex = Number(activeMedia.dataset.index);
        this.slider.select(activeIndex, false, true);
        this.mediaContent.removeAttribute("data-media-loading");
      }
    }
  }
);

class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector("details");
    this.content =
      this.mainDetailsToggle.querySelector("summary").nextElementSibling;

    this.mainDetailsToggle.addEventListener(
      "focusout",
      this.onFocusOut.bind(this)
    );
    this.mainDetailsToggle.addEventListener("toggle", this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute("open")) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute("open");
    this.mainDetailsToggle
      .querySelector("summary")
      .setAttribute("aria-expanded", false);
  }

  open() {
    this.mainDetailsToggle.setAttribute("open", "");
    this.mainDetailsToggle
      .querySelector("summary")
      .setAttribute("aria-expanded", true);
  }
}

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then((response) => response.text())
        .then((text) => {
          const html = generateDomFromString(text);
          const recommendations = html.querySelector("product-recommendations");

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
            __reInitTooltip(this);
          }

          if (html.querySelector(".product-card")) {
            this.classList.add("product-recommendations--loaded");
          } else {
            this.classList.add("f-hidden");
          }
        })
        .catch((e) => {
          console.error(e);
        });
    };

    new IntersectionObserver(handleIntersection.bind(this), {
      rootMargin: "0px 0px 400px 0px",
    }).observe(this);
  }
}

customElements.define("product-recommendations", ProductRecommendations);

class FProgressBar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.init();
  }

  init() {
    setTimeout(() => {
      const quantity = parseInt(this.dataset.quantity);
      this.style.setProperty(
        "--progress-bar-width",
        `${(quantity * 100) / 50}%`
      );
    });
  }
}
customElements.define("f-progress-bar", FProgressBar);
class VideoComponent extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.init();
  }

  init() {
    this.parentSelector = this.dataset.parent || ".f-video-wrapper";
    this.parent = this.closest(this.parentSelector);

    switch (this.dataset.type) {
      case "youtube":
        this.initYoutubeVideo();
        break;

      case "vimeo":
        this.initVimeoVideo();
        break;

      case "mp4":
        this.initMp4Video();
        break;
    }
  }

  initYoutubeVideo() {
    this.setAsLoading();
    this.loadScript("youtube").then(this.setupYoutubePlayer.bind(this));
  }

  initVimeoVideo() {
    this.setAsLoading();
    this.loadScript("vimeo").then(this.setupVimeoPlayer.bind(this));
  }

  initMp4Video() {
    const player = this.querySelector("video");

    if (player) {
      const promise = player.play();

      // Edge does not return a promise (video still plays)
      if (typeof promise !== "undefined") {
        promise
          .then(function () {
            // playback normal
          })
          .catch(function () {
            player.setAttribute("controls", "");
          });
      }
    }
  }

  loadScript(videoType) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      document.body.appendChild(script);
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
      script.src =
        videoType === "youtube"
          ? "//www.youtube.com/iframe_api"
          : "//player.vimeo.com/api/player.js";
    });
  }

  setAsLoading() {
    this.parent.setAttribute("loading", true);
  }

  setAsLoaded() {
    this.parent.removeAttribute("loading");
    this.parent.setAttribute("loaded", true);
  }

  setupYoutubePlayer() {
    const videoId = this.dataset.videoId;
    const playerInterval = setInterval(() => {
      if (window.YT) {
        window.YT.ready(() => {
          const element = document.createElement("div");
          this.appendChild(element);

          this.player = new YT.Player(element, {
            videoId: videoId,
            playerVars: {
              showinfo: 0,
              controls: false,
              fs: 0,
              rel: 0,
              height: "100%",
              width: "100%",
              iv_load_policy: 3,
              html5: 1,
              loop: 1,
              playsinline: 1,
              modestbranding: 1,
              disablekb: 1,
            },
            events: {
              onReady: this.onYoutubeReady.bind(this),
              onStateChange: this.onYoutubeStateChange.bind(this),
            },
          });
          clearInterval(playerInterval);
        });
      }
    }, 50);
  }

  onYoutubeReady() {
    this.iframe = this.querySelector("iframe"); // iframe once YT loads
    this.iframe.setAttribute("tabindex", "-1");

    if (typeof this.player.mute === "function") this.player.mute();
    if (typeof this.player.playVideo === "function") this.player.playVideo();

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver(
      (entries, _observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.youtubePlay();
          } else {
            this.youtubePause();
          }
        });
      },
      { rootMargin: "0px 0px 50px 0px" }
    );

    observer.observe(this.iframe);
  }

  onYoutubeStateChange(event) {
    switch (event.data) {
      case -1: // unstarted
        // Handle low power state on iOS by checking if
        // video is reset to unplayed after attempting to buffer
        if (this.attemptedToPlay) {
          this.setAsLoaded();
          // this.closest('.banner').classList.add('video-interactable');
        }
        break;
      case 0: // ended, loop it
        this.youtubePlay();
        break;
      case 1: // playing
        this.setAsLoaded();
        break;
      case 3: // buffering
        this.attemptedToPlay = true;
        break;
    }
  }

  youtubePlay() {
    if (this.player && typeof this.player.playVideo === "function") {
      this.player.playVideo();
    }
  }

  youtubePause() {
    if (this.player && typeof this.player.pauseVideo === "function") {
      this.player.pauseVideo();
    }
  }

  setupVimeoPlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.Vimeo) {
        this.player = new Vimeo.Player(this, {
          id: videoId,
          autoplay: true,
          autopause: false,
          background: false,
          controls: false,
          loop: true,
          height: "100%",
          width: "100%",
        });
        this.player.ready().then(this.onVimeoReady.bind(this));
        clearInterval(playerInterval);
      }
    }, 50);
  }

  onVimeoReady() {
    this.iframe = this.querySelector("iframe");
    this.iframe.setAttribute("tabindex", "-1");

    this.player.setMuted(true);

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver(
      (entries, _observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.vimeoPlay();
          } else {
            this.vimeoPause();
          }
        });
      },
      { rootMargin: "0px 0px 50px 0px" }
    );

    observer.observe(this.iframe);
  }

  vimeoPlay() {
    if (this.player && typeof this.player.play === "function") {
      this.player.play();
    }
  }

  vimeoPause() {
    if (this.player && typeof this.player.pause === "function") {
      this.player.pause();
    }
  }
}
customElements.define("video-component", VideoComponent);

if (!customElements.get("f-scrolling-promotion")) {
  class FScrollingPromotion extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.promotion = this.querySelector(".f-promotion");
      this.init();
    }

    init() {
      if (this.childElementCount === 1) {
        this.promotion.classList.add("f-promotion--animated");

        for (let index = 0; index < 10; index++) {
          this.clone = this.promotion.cloneNode(true);
          this.clone.setAttribute("aria-hidden", true);
          this.appendChild(this.clone);
        }

        // pause when out of view
        const observer = new IntersectionObserver(
          (entries, _observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.scrollingPlay();
              } else {
                this.scrollingPause();
              }
            });
          },
          { rootMargin: "0px 0px 50px 0px" }
        );

        observer.observe(this);
      }
    }

    scrollingPlay() {
      this.classList.remove("f-scrolling-promotion--paused");
    }

    scrollingPause() {
      this.classList.add("f-scrolling-promotion--paused");
    }
  }

  customElements.define("f-scrolling-promotion", FScrollingPromotion);
}

class ImageComparisonSlider extends HTMLElement {
  constructor() {
    super();
    this.active = false;
    this.button = this.querySelector("button");
    this.horizontal = this.dataset.layout === "horizontal";
    this.customContent = this.closest('[data-section-type="f-custom-content"]');

    if (this.hasAttribute("data-animation")) {
      intersecting({
        element: this.querySelector(".f-image-comparison-slider__animation"),
        callback: this.animation.bind(this),
        threshold: 0,
      });
    } else {
      this.init();
    }
  }

  init() {
    this.button.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: true }
    );
    document.body.addEventListener("touchend", this.handleTouchEnd.bind(this));
    document.body.addEventListener(
      "touchmove",
      this.handleMouseMove.bind(this)
    );

    this.button.addEventListener("mousedown", this.handleTouchStart.bind(this));
    document.body.addEventListener("mouseup", this.handleTouchEnd.bind(this));
    document.body.addEventListener(
      "mousemove",
      this.handleMouseMove.bind(this)
    );
  }

  animation() {
    const animation = this.hasAttribute("data-animation");
    if (!animation) return;
    this.setAttribute("is-visible", "");
    this.classList.add("f-animating");
    setTimeout(() => {
      this.classList.remove("f-animating");
    }, 1e3);
    this.init();
  }

  handleTouchStart() {
    const scrollBarWidth = getScrollbarWidth();
    this.customContent && this.customContent.classList.remove("relative");
    document.body.style.setProperty("padding-right", `${scrollBarWidth}px`);
    document.body.style.overflow = "hidden";
    this.active = true;
    this.classList.add("dragging");
  }

  handleTouchEnd() {
    document.body.style.removeProperty("padding-right");
    this.customContent && this.customContent.classList.add("relative");
    this.active = false;
    this.classList.remove("dragging");
    document.body.style.overflow = "";
  }

  handleMouseMove(e) {
    if (!this.active) return;

    const event = (e.touches && e.touches[0]) || e;
    const x = this.horizontal
      ? event.pageX - this.offsetLeft
      : event.pageY - this.offsetTop;

    this.handleChange(x);
  }

  handleChange(x) {
    const distance = this.horizontal ? this.clientWidth : this.clientHeight;

    const max = distance - 20;
    const min = 20;
    const mouseX = Math.max(min, Math.min(x, max));
    const mousePercent = (mouseX * 100) / distance;
    this.style.setProperty("--percent", mousePercent + "%");
  }
}
customElements.define("f-image-comparison-slider", ImageComparisonSlider);

class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();

    // Save product Id
    if (isStorageSupported("local")) {
      const productId = parseInt(this.dataset.productId);
      const cookieName = "zest-recently-viewed";
      const items = JSON.parse(window.localStorage.getItem(cookieName) || "[]");

      // Check current product already exists, if not push to array
      if (!items.includes(productId)) {
        items.unshift(productId);
      }

      // Save to localStorage
      window.localStorage.setItem(
        cookieName,
        JSON.stringify(items.slice(0, 20))
      );
    }
  }
}
customElements.define("product-recently-viewed", ProductRecentlyViewed);

class HighlightText extends HTMLElement {
  constructor() {
    super();
    intersecting({
      element: this,
      callback: this.init.bind(this),
      threshold: 0,
    });
  }
  init() {
    this.classList.add("animate");
  }
}
customElements.define("highlight-text", HighlightText, { extends: "em" });

if (!customElements.get("show-more-button")) {
  customElements.define(
    "show-more-button",
    class ShowMoreButton extends HTMLElement {
      constructor() {
        super();
        const button = this.querySelector("button");
        button.addEventListener("click", (event) => {
          this.expandShowMore(event);
          const nextElementToFocus = event.target
            .closest(".parent-display")
            .querySelector(".show-more-item");
          if (
            nextElementToFocus &&
            !nextElementToFocus.classList.contains("hidden") &&
            nextElementToFocus.querySelector("input")
          ) {
            nextElementToFocus.querySelector("input").focus();
          }
        });
      }
      expandShowMore(event) {
        const parentDisplay = event.target
          .closest('[id^="Show-More-"]')
          .closest(".parent-display");
        const parentWrap = parentDisplay.querySelector(".parent-wrap");
        this.querySelectorAll(".label-text").forEach((element) =>
          element.classList.toggle("hidden")
        );
        parentDisplay
          .querySelectorAll(".show-more-item")
          .forEach((item) => item.classList.toggle("hidden"));
        if (!this.querySelector(".label-show-less")) {
          this.classList.add("hidden");
        }
      }
    }
  );
}

class MediaHero extends HTMLDivElement {
  constructor() {
    super();

    this.selectors = {
      contentWrapper: ".f-hero__content-wrapper",
      content: ".f-hero__content",
    };

    this.elements = queryDomNodes(this.selectors, this);

    this.init();
    window.addEventListener("resize", debounce(this.init.bind(this), 100));
  }

  init() {
    const isAdapt = FoxThemeSettings.isMobile
      ? this.dataset.mobileHeight == "adapt"
      : this.dataset.desktopHeight == "adapt";

    if (isAdapt) {
      const contentHeight = this.elements.content.offsetHeight;
      const contentWrapperStyle = window.getComputedStyle(
        this.elements.contentWrapper
      );

      const minHeight =
        contentHeight +
        parseInt(contentWrapperStyle.paddingTop) +
        parseInt(contentWrapperStyle.paddingBottom);

      this.style.setProperty("--hero-height", minHeight + "px");
    }
  }
}
customElements.define("media-hero", MediaHero, { extends: "div" });
