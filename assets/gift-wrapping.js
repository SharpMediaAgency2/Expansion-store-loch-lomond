class GiftWrappingComponent extends HTMLElement {
  constructor() {
    super();

    this.cartDrawer = document.querySelector("cart-drawer");
    this.mainCart = document.querySelector("cart-items");
    this.giftWrapId = this.dataset.giftWrapId;
    this.giftWrapping = this.dataset.giftWrapping;
    this.cartItemsSize = parseInt(this.getAttribute("cart-items-size"));
    this.giftWrapsInCart = parseInt(this.getAttribute("gift-wraps-in-cart"));
    this.loadingIcon = this.querySelector(".f-gift-wrapping--loading");

    // When the gift-wrapping checkbox is checked or unchecked.
    this.querySelector('[name="attributes[gift-wrapping]"]').addEventListener(
      "change",
      (event) => {
        this.updateGiftWrapping(!event.target.checked);
      }
    );

    if (this.cartDrawer) return;

    // If we have nothing but gift-wrap items in the cart.
    if (this.cartItemsSize === 1 && this.giftWrapsInCart > 0) {
      this.updateGiftWrapping(true);
    }
  }

  updateGiftWrapping(remove = false) {
    this.loadingIcon.classList.add("show");
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
    });

    const body = !remove
      ? {
          updates: {
            [this.giftWrapId]: 1,
          },
          attributes: { "gift-wrapping": true },
        }
      : {
          updates: {
            [this.giftWrapId]: 0,
          },
          attributes: { "gift-wrapping": "", "gift-note": "" },
        };
    if (this.cartDrawer) {
      body.sections = this.cartDrawer
        .getSectionsToRender()
        .map((section) => section.id);
      body.sections_url = window.location.pathname;
    }

    if (this.mainCart) {
      body.sections_url = window.location.pathname;
      body.sections = this.mainCart
        .getSectionsToRender()
        .map((section) => section.section);
    }

    const request = {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    };
    fetch(`${window.FoxThemeSettings.routes.cart_update_url}`, request)
      .then((response) => response.json())
      .then((cart) => {
        window.FoxThemeEvents.emit(PUB_SUB_EVENTS.cartUpdate, cart);
        if (this.cartDrawer) this.cartDrawer.renderContents(cart);
        if (this.mainCart) this.mainCart.renderContents(cart);
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => this.loadingIcon.classList.remove("show"));
  }
}
customElements.define("gift-wrapping-component", GiftWrappingComponent);

class GiftNoteComponent extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "change",
      debounce((event) => {
        const headers = new Headers({
          "Content-Type": "application/json",
          Accept: "application/json",
        });
        let request = {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            attributes: { "gift-note": event.target.value },
          }),
        };
        fetch(`${window.FoxThemeSettings.routes.cart_update_url}`, request);
      }, 300)
    );
  }
}
customElements.define("gift-note-component", GiftNoteComponent);
