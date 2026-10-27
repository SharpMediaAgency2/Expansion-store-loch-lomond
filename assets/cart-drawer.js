class CartDrawer extends HTMLElement {
  constructor() {
    super();
    window.FoxTheme = window.FoxTheme || {};
    window.FoxTheme.Cart = this;
    this.drawer = this.closest("drawer-component");
    window.FoxTheme.CartDrawer = this.drawer;
    this.openWhenAdded = this.dataset.openWhenAdded === "true";

    this.onCartRefreshListener = this.onCartRefresh.bind(this);
  }

  connectedCallback() {
    window.FoxThemeEvents.subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      async (state) => {
        if (state.item_count !== 0) {
          this.renderContents(
            state,
            true,
            state.source === "quick-order-list" ? false : true
          );
        }
      }
    );

    document.addEventListener("cart:refresh", this.onCartRefreshListener);
  }

  disconnectedCallback() {
    document.removeEventListener("cart:refresh", this.onCartRefreshListener);
  }

  async onCartRefresh(event) {
    const cartDrawer = document.getElementById("cart-drawer");
    if (!cartDrawer) return;

    try {
      const response = await fetch(
        `${FoxThemeSettings.routes.root}?section_id=cart-drawer`
      );
      const responseText = await response.text();

      const parser = new DOMParser();
      const parsedHTML = parser.parseFromString(responseText, "text/html");

      const newCartContent = parsedHTML.getElementById("cart-drawer").innerHTML;
      cartDrawer.innerHTML = newCartContent;

      if (event.detail.open === true && !this.drawer.isOpen()) {
        this.drawer.openDrawer();
      }
    } catch (error) {
      console.error("Error refreshing cart:", error);
    }
  }

  renderContents(parsedState, renderFooter = true, isOpen = true) {
    if (parsedState.errors) return;
    this.classList.contains("is-empty") && this.classList.remove("is-empty");
    this.getSectionsToRender(renderFooter).forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);
      sectionElement.innerHTML = this.getSectionInnerHTML(
        parsedState.sections[section.id],
        section.selector
      );
    });

    setTimeout(() => {
      if (this.openWhenAdded && !this.drawer.isOpen() && isOpen) {
        this.drawer.openDrawer();
        document.body.classList.add("prevent-scroll");
        window.FoxThemeEvents.emit(`ON_CART_DRAWER_OPEN`, parsedState);
      }
    });
  }

  getSectionInnerHTML(html, selector = ".shopify-section") {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }

  getSectionsToRender(renderFooter = false) {
    const sections = [
      {
        id: "cart-drawer",
        selector: ".f-cart-drawer__items",
      },
    ];

    if (renderFooter) {
      sections.push({
        id: "cart-drawer",
        selector: ".f-drawer__footer",
      });
    }

    return sections;
  }
}
customElements.define("cart-drawer", CartDrawer);

class CartDrawerItems extends CartItems {
  initLoading() {
    this.loading = new window.FoxTheme.AnimateLoading(
      document.querySelector("cart-drawer"),
      { overlay: document.querySelector("cart-drawer") }
    );
  }
  getSectionsToRender() {
    return [
      {
        id: "Drawer-Cart",
        section: "cart-drawer",
        selector: ".f-cart-drawer__items",
      },
      {
        id: "Drawer-Cart",
        section: "cart-drawer",
        selector: ".f-cart-drawer__block-subtotal",
      },
    ];
  }
}

customElements.define("cart-drawer-items", CartDrawerItems);
