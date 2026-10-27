class CartRecommendationsComponent extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    fetch(this.dataset.url)
      .then((response) => response.text())
      .then((text) => {
        const html = document.createElement("div");
        html.innerHTML = text;
        const recommendations = html.querySelector(
          "#shopify-section-cart-recommendations"
        );
        if (
          recommendations &&
          recommendations.querySelectorAll(".f-cart-recommendations__item")
            .length
        ) {
          this.innerHTML = recommendations.innerHTML;
        }
      })
      .catch((err) => console.error(err));
  }
}

customElements.define(
  "cart-recommendations-component",
  CartRecommendationsComponent
);

if (!customElements.get("add-to-cart-component")) {
  class AddToCartComponent extends HTMLElement {
    constructor() {
      super();

      this.cartDrawer = document.querySelector("cart-drawer");
      this.addToCartButton = this.querySelector(
        ".f-cart-recommendations__item-add-to-cart"
      );
      this.addEventListener("click", this.onSubmitHandler.bind(this));
    }

    onSubmitHandler() {
      this.addToCartButton.classList.add("btn--loading");
      const variantId = this.dataset.variantId;

      if (!variantId) return;

      const config = {
        method: "POST",
        headers: {
          Accept: "application/javascript",
          "X-Requested-With": "XMLHttpRequest",
        },
      };

      const formData = new FormData();
      formData.append("id", variantId);
      formData.append("quantity", 1);

      if (this.cartDrawer) {
        formData.append(
          "sections",
          this.cartDrawer.getSectionsToRender().map((section) => section.id)
        );
        formData.append("sections_url", window.location.pathname);
      }

      config.body = formData;

      fetch(`${FoxThemeSettings.routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            return this.Notification.show({
              target: document.body,
              method: "appendChild",
              type: "warning",
              message: response.description,
              last: 3000,
              sticky: true,
            });
          }
          window.FoxThemeEvents.emit(PUB_SUB_EVENTS.cartUpdate, response);
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.addToCartButton.classList.remove("btn--loading");
        });
    }
  }
  customElements.define("add-to-cart-button", AddToCartComponent);
}
