class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();

    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);

    const facetForm = this.querySelector("form");
    facetForm.addEventListener("input", (evt) => {
      FacetFiltersForm.loading.start();
      this.debouncedOnSubmit(evt);
    });
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state
        ? event.state.searchParams
        : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    };
    window.addEventListener("popstate", onHistoryChange);
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = (element) => element.url === url;

      FacetFiltersForm.filterData.some(filterDataUrl)
        ? FacetFiltersForm.renderSectionFromCache(filterDataUrl, event)
        : FacetFiltersForm.renderSectionFromFetch(url, event);
    });

    window.scroll({
      top: FacetFiltersForm.section.offsetTop - 100,
      left: 0,
      behavior: "smooth",
    });
    FacetFiltersForm.loading.finish();

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersForm.filterData = [
          ...FacetFiltersForm.filterData,
          { html, url },
        ];
        FacetFiltersForm.renderFilters(html, event);
        FacetFiltersForm.renderElements(
          html,
          "[data-product-container]",
          FacetFiltersForm.selectors.productGrid
        );
        FacetFiltersForm.renderElements(
          html,
          "[data-facet-form]",
          FacetFiltersForm.selectors.filtersForm
        );
        FacetFiltersForm.renderProductCount(html);

        document.dispatchEvent(new CustomEvent("collection:rerendered"));
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderElements(
      html,
      "[data-product-container]",
      FacetFiltersForm.selectors.productGrid
    );
    FacetFiltersForm.renderElements(
      html,
      "[data-facet-form]",
      FacetFiltersForm.selectors.filtersForm
    );
    FacetFiltersForm.renderProductCount(html);

    document.dispatchEvent(new CustomEvent("collection:rerendered"));
  }

  static renderElements(html, el, selector) {
    const elementContainer = document.querySelector(el);
    elementContainer.innerHTML = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(el).innerHTML;
    FacetFiltersForm.loading = new window.FoxTheme.AnimateLoading(
      document.body,
      { overlay: document.querySelector(selector) }
    );
    __reInitTooltip(elementContainer);
  }

  static renderProductCount(html) {
    const count = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(FacetFiltersForm.selectors.productCount).innerHTML;
    const container = document.querySelector(
      FacetFiltersForm.selectors.productCount
    );
    container.innerHTML = count;
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, "text/html");

    const facetDetailsElements = parsedHTML.querySelectorAll(
      "#FacetFiltersForm .js-filter"
    );
    const matchesIndex = (element) => {
      const jsFilter = event ? event.target.closest(".js-filter") : undefined;
      return jsFilter
        ? element.dataset.index === jsFilter.dataset.index
        : false;
    };
    const facetsToRender = Array.from(facetDetailsElements).filter(
      (element) => !matchesIndex(element)
    );

    facetsToRender.forEach((element) => {
      const target = document.querySelector(
        `.f-facets__block[data-index="${element.dataset.index}"]`
      );
      if (!target) return;
      target.textContent = "";
      const child =
        element.querySelector("collapsible-tab") ||
        element.querySelector("#Mobile-SortBy-Block");
      if (child) target.appendChild(child);
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = [".active-facets"];

    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      document.querySelector(selector).innerHTML =
        activeFacetsElement.innerHTML;
    });
  }

  static updateURLHash(searchParams) {
    history.pushState(
      { searchParams },
      "",
      `${window.location.pathname}${searchParams && "?".concat(searchParams)}`
    );
  }

  static getSections() {
    return [
      {
        section: FacetFiltersForm.sectionId,
      },
    ];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    if (form.id === "FacetFiltersForm" && !FoxThemeSettings.isMobile) {
      formData.delete("sort_by");
    }
    return new URLSearchParams(formData).toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    const sortFilterForms = document.querySelectorAll(
      "facet-filters-form form"
    );
    if (FoxThemeSettings.isMobile) {
      const searchParams = this.createSearchParams(
        event.target.closest("form")
      );
      this.onSubmitForm(searchParams, event);
    } else {
      const forms = [];
      sortFilterForms.forEach((form) => {
        forms.push(this.createSearchParams(form));
      });
      this.onSubmitForm(forms.join("&"), event);
    }
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    const url =
      event.currentTarget.href.indexOf("?") === -1
        ? ""
        : event.currentTarget.href.slice(
            event.currentTarget.href.indexOf("?") + 1
          );
    FacetFiltersForm.renderPage(url);
  }
}
FacetFiltersForm.selectors = {
  container: ".f-facets__container",
  productGrid: "[data-products-grid]",
  productCount: "[data-product-count]",
  filtersForm: "[data-facet-form]",
  facetWrapper: "[data-facets-wrapper]",
  facetBlock: ".f-facets__block",
};

FacetFiltersForm.section = document.querySelector("#ProductGridContainer");
FacetFiltersForm.sectionId =
  FacetFiltersForm.section && FacetFiltersForm.section.dataset.sectionId;
FacetFiltersForm.domNodes = queryDomNodes(
  FacetFiltersForm.selectors,
  FacetFiltersForm.section
);
FacetFiltersForm.loading = new window.FoxTheme.AnimateLoading(document.body, {
  overlay: document.querySelector(FacetFiltersForm.selectors.productGrid),
});

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define("facet-filters-form", FacetFiltersForm);
FacetFiltersForm.setListeners();

// customElements.define('facet-filters-form', FacetFiltersForm)

class PriceRange extends HTMLElement {
  constructor() {
    super();
    this.selectors = {
      inputs: ['input[type="number"]'],
      ranges: ['input[type="range"]'],
      minRange: '[data-type="min-range"]',
      maxRange: '[data-type="max-range"]',
      minInput: '[data-type="min-input"]',
      maxInput: '[data-type="max-input"]',
    };
    this.domNodes = queryDomNodes(this.selectors, this);
    this.priceGap = parseInt(this.dataset.priceGap);
    this.priceMax = parseInt(this.dataset.priceMax);

    this.domNodes.inputs.forEach((el) =>
      el.addEventListener("change", this.onInputChange.bind(this))
    );
    this.domNodes.ranges.forEach((el) =>
      el.addEventListener("input", this.onSliderChange.bind(this))
    );

    this.setMinAndMaxValues();
  }

  onSliderChange(event) {
    const input = event.currentTarget;
    const type = input.dataset.type;
    const value = Number(input.value);
    const { minInput, maxInput, minRange, maxRange } = this.domNodes;
    if (type === "min-range") {
      if (maxRange.value - input.value >= this.priceGap) {
        minInput.value = input.value;
      } else {
        input.value = maxRange.value - this.priceGap;
      }
    }
    if (type === "max-range") {
      if (input.value - minRange.value >= this.priceGap) {
        maxInput.value = input.value;
      } else {
        input.value = Number(minRange.value) + Number(this.priceGap);
      }
    }
    this.style.setProperty(
      "--price-min",
      (100 * minRange.value) / this.priceMax + "%"
    );
    this.style.setProperty(
      "--price-max",
      (100 * maxRange.value) / this.priceMax + "%"
    );
  }

  onInputChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  setMinAndMaxValues() {
    const { minInput, maxInput } = this.domNodes;
    if (maxInput.value)
      minInput.setAttribute("max", Number(maxInput.value) - this.priceGap);
    if (minInput.value)
      maxInput.setAttribute("min", Number(minInput.value) + this.priceGap);
    if (minInput.value === "") maxInput.setAttribute("min", 0);
    if (maxInput.value === "")
      minInput.setAttribute("max", maxInput.getAttribute("max"));
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute("min"));
    const max = Number(input.getAttribute("max"));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }
}

customElements.define("price-range", PriceRange);

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    this.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      const form =
        this.closest("facet-filters-form") ||
        document.querySelector("facet-filters-form");
      form.onActiveFilterClick(e);
    });
  }
}

customElements.define("facet-remove", FacetRemove);

class ApplyButton extends HTMLElement {
  constructor() {
    super();
    const drawer = this.closest("drawer-component");
    this.querySelector("button").addEventListener("click", (e) => {
      e.preventDefault();
      drawer && drawer.closeDrawer(false);
    });
  }
}

customElements.define("facet-apply", ApplyButton);
