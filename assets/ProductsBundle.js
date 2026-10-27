class ProductsBundle extends HTMLElement {
  constructor() {
    super();
    this.cartDrawer = document.querySelector("cart-drawer");
    this.button = this.querySelector("button");
    if (this.button)
      this.button.addEventListener("click", this.onButtonClick.bind(this));
  }

  onButtonClick(event) {
    event.preventDefault();

    const ids = this.querySelectorAll('[name="id"]');
    const items = {
      items: [...ids]
        .map((e) => e.value)
        .map((e) => ({
          id: e,
          quantity: 1,
        })),
    };

    this.button.classList.add("btn--loading");
    const sections = this.miniCart
      ? this.cartDrawer.getSectionsToRender().map((section) => section.id)
      : [];

    const body = JSON.stringify({
      ...items,
      sections: sections,
      sections_url: window.location.pathname,
    });
    const config = {
      method: "POST",
      headers: {
        Accept: "application/javascript",
        "X-Requested-With": "XMLHttpRequest",
      },
    };
    fetch(`${window.FoxThemeSettings.routes.cart_add_url}`, { config, body })
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          // this.handleErrorMessage(response.description);
          return;
        }

        if (response.status === 422) {
          // document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
          //   detail: {
          //     errorMessage: response.description
          //   }
          // }));
        } else {
          this.cartDrawer && this.cartDrawer.renderContents(response);

          // document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
          //   detail: {
          //     product: response
          //   }
          // }));
        }
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        this.button.classList.remove("btn--loading");
        this.button.removeAttribute("disabled");
      });
  }
}
