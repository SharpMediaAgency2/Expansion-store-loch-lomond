if (!customElements.get("product-form")) {
  customElements.define(
    "product-form",
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.selectors = {
          form: "form",
          inputId: "[name=id]",
          submitButton: '[name="add"]',
          errorWrapper: ".f-product-form__error-message-wrapper",
          customFields: ["[data-product-custom-field]"],
        };

        this.domNodes = queryDomNodes(this.selectors, this);

        this.form = this.domNodes.form;
        this.submitButton = this.domNodes.submitButton;
        this.domNodes.inputId.disabled = false;
        this.Notification = window.FoxTheme.Notification;
        this.notificationType = this.dataset.notificationType;
        this.customFields = document.querySelectorAll(
          this.selectors.customFields
        );
        this.cartDrawer = document.querySelector("cart-drawer");
        this.mainCart = document.querySelector("cart-items");
        this.type = this.dataset.type;

        this.variantIdInput = this.domNodes.inputId;

        this.errorWrapper =
          this.type === "product-card"
            ? this.closest(".product-card")
            : this.domNodes.errorWrapper;

        this.form &&
          this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
      }

      validateForm(form) {
        const missingFields = [];
        if (!form) return missingFields;
        const fieldSelectors =
          '[data-product-custom-field] [name][required]:not([hidden]):not([type="hidden"])';
        const requiredFields = form.querySelectorAll(fieldSelectors);
        requiredFields.forEach((field) => {
          field.classList.remove("form-control--warning");
          if (field.type === "radio") {
            const buttons = form.querySelectorAll(
              `input[name="${field.name}"]`
            );
            const selected = Array.from(buttons).some((btn) => btn.checked);
            if (!selected) {
              missingFields.push(field);
              field.classList.add("form-control--warning");
            }
          } else if (!field.value) {
            missingFields.push(field);
            field.classList.add("form-control--warning");
          }
        });
        return missingFields;
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        const missing = this.validateForm(
          this.form.closest(".f-product-single__blocks")
        );

        if (missing && missing.length > 0) {
          return this.Notification.show({
            target: this.domNodes.errorWrapper,
            method: "appendChild",
            type: "warning",
            message: window.FoxThemeStrings.requiredField,
          });
        }

        if (this.submitButton.classList.contains("btn--loading")) return;

        this.submitButton.setAttribute("aria-disabled", true);
        this.submitButton.classList.add("btn--loading");

        const config = {
          method: "POST",
          headers: {
            Accept: "application/javascript",
            "X-Requested-With": "XMLHttpRequest",
          },
        };

        const formData = new FormData(this.form);

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

        formData.append("sections", sectionToBundle);

        if (this.mainCart || this.cartDrawer) {
          formData.append("sections_url", window.location.pathname);
        }

        config.body = formData;
        const { FoxThemeSettings, FoxThemeStrings } = window;
        fetch(`${FoxThemeSettings.routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              window.FoxThemeEvents.emit(PUB_SUB_EVENTS.cartError, {
                source: "product-form",
                productVariantId: formData.get("id"),
                errors: response.description,
                message: response.message,
              });

              // Dispatch event for third-party
              document.dispatchEvent(
                new CustomEvent("product-ajax:error", {
                  detail: {
                    errorMessage: response.description,
                  },
                })
              );

              this.error = true;
              return this.Notification.show({
                target:
                  this.notificationType === "toast"
                    ? document.body
                    : this.errorWrapper,
                method: "appendChild",
                type: "warning",
                message: response.description || response.message,
                last: 3000,
                sticky: this.notificationType === "toast",
              });
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

            this.error = false;
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
            this.submitButton.classList.remove("btn--loading");
            this.submitButton.removeAttribute("aria-disabled");
          });
      }
    }
  );
}
