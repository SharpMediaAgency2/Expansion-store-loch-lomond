if (!customElements.get("select-wrapper")) {
  customElements.define(
    "select-wrapper",
    class SelectWrapper extends HTMLElement {
      constructor() {
        super();

        intersecting({
          element: this,
          callback: this.init.bind(this),
          threshold: 200,
        });

        if (Shopify.designMode) {
          setTimeout(() => {
            this.init();
          }, 200);
        }

        this.select = this.querySelector("select");
        if (this.select) {
          this.select.addEventListener(
            "change",
            this.handleSelectChange.bind(this)
          );
        }
      }

      init() {
        const style = window.getComputedStyle(this.select);
        const value = this.select.options[this.select.selectedIndex].text;

        const text = document.createElement("span");
        text.style.fontFamily = style.fontFamily;
        text.style.fontSize = style.fontSize;
        text.style.fontWeight = style.fontWeight;
        text.style.visibility = "hidden";
        text.style.position = "absolute";
        text.innerHTML = value;

        document.body.appendChild(text);
        const width = text.clientWidth;

        this.style.setProperty("--width", `${width}px`);
        text.remove();
      }

      handleSelectChange() {
        this.init();
      }
    }
  );
}

if (!customElements.get("product-bundle")) {
  customElements.define(
    "product-bundle",
    class ProductBundle extends HTMLElement {
      constructor() {
        super();

        this.classes = {
          souldout: "f-price--sold-out",
          onsale: "f-price--on-sale",
          nocompare: "f-price--no-compare",
        };

        this.price = this.querySelector(".f-price");
        this.variants = this.querySelector("select");
        if (this.variants) {
          this.variants.addEventListener(
            "change",
            this.onSelectChange.bind(this)
          );
        }
      }

      onSelectChange(event) {
        const variants = event.target;
        const variant = variants.options[variants.selectedIndex];
        const compare_at_price = parseInt(
          variant.dataset.compare_at_price || 0
        );
        const price = parseInt(variant.dataset.price || 0);
        const available = variant.dataset.available === "true";
        const price_varies = variants.dataset.price_varies === "true";
        const compare_at_price_varies =
          variants.dataset.compare_at_price_varies === "true";

        // Remove classes
        this.price.classList.remove(this.classes.souldout);
        this.price.classList.remove(this.classes.onsale);
        this.price.classList.remove(this.classes.nocompare);

        // Add classes
        if (available === false) {
          this.price.classList.add(this.classes.souldout);
        } else if (compare_at_price > price && available) {
          this.price.classList.add(this.classes.onsale);
        }
        if (price_varies == false && compare_at_price_varies) {
          this.price.classList.add(this.classes.nocompare);
        }

        // Change price
        const price__regular = this.querySelector(".f-price__regular");
        price__regular.querySelector(".f-price-item--regular").innerHTML =
          formatMoney(price, window.FoxThemeSettings.money_format);

        const price__sale = this.querySelector(".f-price__sale");
        price__sale.querySelector(".f-price-item--regular").innerHTML =
          formatMoney(compare_at_price, window.FoxThemeSettings.money_format);
        price__sale.querySelector(".f-price-item--sale").innerHTML =
          formatMoney(price, window.FoxThemeSettings.money_format);
      }
    }
  );
}

if (!customElements.get("products-bundle")) {
  customElements.define(
    "products-bundle",
    class ProductsBundle extends HTMLElement {
      constructor() {
        super();

        this.classes = {
          hover: "is-hover",
          active: "is-active",
        };

        this.cartDrawer = document.querySelector("cart-drawer");
        this.mainCart = document.querySelector("cart-items");
        this.button = this.querySelector("button");
        this.Notification = window.FoxTheme.Notification;
        this.errorWrapper = this.querySelector(".product-form__error-message");
        if (this.button)
          this.button.addEventListener("click", this.onButtonClick.bind(this));

        this.blocks = this.querySelectorAll("[data-block-id]");
        this.blocks.forEach((block) =>
          block.addEventListener("mouseenter", this.onEnterHandler.bind(this))
        );
        this.blocks.forEach((block) =>
          block.addEventListener("mouseleave", this.onLeaveHandler.bind(this))
        );
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

        this.button.setAttribute("disabled", "true");
        this.button.classList.add("btn--loading");

        let sectionToBundle = [];
        document.documentElement.dispatchEvent(
          new CustomEvent("cart:grouped-sections", {
            bubbles: true,
            detail: { sections: sectionToBundle },
          })
        );

        if (this.cartDrawer) {
          sectionToBundle = [
            ...sectionToBundle,
            ...this.cartDrawer
              .getSectionsToRender()
              .map((section) => section.id),
          ];
        }

        if (this.mainCart) {
          sectionToBundle = [
            ...sectionToBundle,
            ...this.mainCart
              .getSectionsToRender()
              .map((section) => section.section),
          ];
        }

        const body = JSON.stringify({
          ...items,
          sections: sectionToBundle,
          sections_url: window.location.pathname,
        });

        const config = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/javascript",
          },
        };
        config.body = body;
        fetch(`${FoxThemeSettings.routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              this.Notification.show({
                target: this.errorWrapper ? this.errorWrapper : document.body,
                method: "appendChild",
                type: "warning",
                message: response.description,
                last: 3000,
              });

              // Dispatch event for third-party
              document.dispatchEvent(
                new CustomEvent("product-ajax:error", {
                  detail: {
                    errorMessage: response.description,
                  },
                })
              );

              return;
            }

            if (
              !FoxThemeSettings.cart.openDrawerWhenAdded ||
              FoxThemeSettings.cart.cartType === "page"
            ) {
              this.Notification.show({
                target: this.errorWrapper ? this.errorWrapper : document.body,
                method: "appendChild",
                type: "success",
                message: FoxThemeStrings.item_added,
                last: 3000,
                sticky: this.notificationType === "toast",
              });
            }

            if (FoxThemeSettings.cart.cartType === "page") {
              FoxThemeCartHelpers.getState().then((state) => {
                FoxThemeCartHelpers.updateCartCount(state.item_count);
              });
            }
            window.FoxThemeEvents.emit(PUB_SUB_EVENTS.cartUpdate, response);

            // DispatchEvent for third-party
            document.dispatchEvent(
              new CustomEvent("product-ajax:added", {
                detail: {
                  product: response,
                },
              })
            );
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.button.classList.remove("btn--loading");
            this.button.removeAttribute("disabled");
          });
      }

      onEnterHandler(event) {
        this.classList.add(this.classes.hover);

        const target = event.target;
        const blockId = target.dataset.blockId;
        this.blocks.forEach((block) => {
          if (target.nodeName === "PRODUCT-BUNDLE") {
            if (block.nodeName === "PRODUCT-BUNDLE") {
              block.classList.add(this.classes.active);
              return;
            }
          }
          if (block.dataset.blockId === blockId) {
            block.classList.add(this.classes.active);
          }
        });
      }

      onLeaveHandler() {
        this.classList.remove(this.classes.hover);
        this.blocks.forEach((block) =>
          block.classList.remove(this.classes.active)
        );
      }
    }
  );
}
