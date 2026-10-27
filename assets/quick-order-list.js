if (!customElements.get("quick-order-list")) {
  customElements.define(
    "quick-order-list",
    class QuickOrderList extends HTMLFormElement {
      static DEBOUNCE_TIME = 300;
      static LOADING_CLASS = "btn--loading";

      constructor() {
        super();
        this.cartUpdateUnsubscriber = undefined;
        this.changeEvent = new Event("change", { bubbles: true });
        this.initializeComponent();
      }

      /**
       * Initialize the component with necessary event listeners and data
       */
      initializeComponent() {
        this.addEventListener(
          "change",
          debounce(
            this.handleQuantityChange.bind(this),
            QuickOrderList.DEBOUNCE_TIME
          )
        );

        this.cartUpdateUnsubscriber = window.FoxThemeEvents.subscribe(
          PUB_SUB_EVENTS.cartUpdate,
          this.handleCartUpdate.bind(this)
        );

        this.sectionId = this.getAttribute("data-section-id");
        this.variantIds = this.querySelectorAll("[data-quantity-variant-id]");
        this.cartDrawer = document.querySelector("cart-drawer");
      }

      /**
       * Clean up event listeners when component is removed
       */
      disconnectedCallback() {
        if (this.cartUpdateUnsubscriber) {
          this.cartUpdateUnsubscriber();
          this.cartUpdateUnsubscriber = null;
        }
      }

      /**
       * Handle quantity change events
       * @param {Event} event - Change event
       */
      handleQuantityChange(event) {
        const { target } = event;
        const inputValue = parseInt(target.value);
        const index = target.getAttribute("data-index");

        if (inputValue === 0) {
          this.updateItemQuantity(
            index,
            inputValue,
            document.activeElement.getAttribute("name"),
            target
          );
        } else {
          this.validateQuantityInput(event);
        }
      }

      /**
       * Validate quantity input against min, max, and step constraints
       * @param {Event} event - Change event
       */
      validateQuantityInput(event) {
        const { target } = event;
        const inputValue = parseInt(target.value);
        const index = target.getAttribute("data-index");
        const minValue = parseInt(target.getAttribute("data-min"));
        const maxValue = parseInt(target.max);
        const stepValue = parseInt(target.step);

        const validationRules = [
          {
            isInvalid: inputValue < minValue,
            message: window.quickOrderListStrings.min_error.replace(
              "[min]",
              minValue
            ),
          },
          {
            isInvalid: inputValue > maxValue,
            message: window.quickOrderListStrings.max_error.replace(
              "[max]",
              maxValue
            ),
          },
          {
            isInvalid: inputValue % stepValue !== 0,
            message: window.quickOrderListStrings.step_error.replace(
              "[step]",
              stepValue
            ),
          },
        ];

        const failedValidation = validationRules.find((rule) => rule.isInvalid);

        if (failedValidation) {
          this.setInputValidity(target, failedValidation.message);
          return;
        }

        target.setCustomValidity("");
        target.reportValidity();
        this.updateItemQuantity(
          index,
          inputValue,
          document.activeElement.getAttribute("name"),
          target
        );
      }

      /**
       * Set input validity and show error message
       * @param {HTMLElement} input - Input element
       * @param {string} message - Error message
       */
      setInputValidity(input, message) {
        input.setCustomValidity(message);
        input.reportValidity();
        input.value = input.defaultValue;
        input.select();
        input.dispatchEvent(this.changeEvent);
      }

      /**
       * Update single item quantity
       * @param {string} line - Line item index
       * @param {number} quantity - New quantity
       * @param {string} name - Input name
       * @param {HTMLElement} target - Target element
       */
      updateItemQuantity(line, quantity, name, target) {
        const items = {};
        items[line] = quantity;
        this.updateCartItems(items, line, name, target);
      }

      /**
       * Update multiple cart items
       * @param {Object} items - Items to update
       * @param {string} line - Line item index
       * @param {string} name - Input name
       * @param {HTMLElement} target - Target element
       */
      updateCartItems(items, line, name, target) {
        this.toggleLoadingState(line, true);
        this.showErrorMessage();

        const sectionsToUpdate = [];

        document.documentElement.dispatchEvent(
          new CustomEvent("cart:grouped-sections", {
            bubbles: true,
            detail: { sections: sectionsToUpdate },
          })
        );

        const body = {
          updates: items,
          sections_url: this.getAttribute("data-product-url"),
        };

        if (this.cartDrawer) {
          body.sections = this.cartDrawer
            .getSectionsToRender()
            .map((section) => section.id);
        }

        body.sections.push(...sectionsToUpdate);

        const requestBody = JSON.stringify(body);

        fetch(`${FoxThemeSettings.routes.cart_update_url}`, {
          ...fetchConfig(),
          body: requestBody,
        })
          .then((response) => response.json())
          .then((data) =>
            this.handleCartUpdateSuccess(data, target, line, name)
          )
          .catch((error) => this.handleCartUpdateError(error))
          .finally(() => this.toggleLoadingState(line, false));
      }

      /**
       * Handle successful cart update
       * @param {Object} data - Cart data
       * @param {HTMLElement} target - Target element
       * @param {string} line - Line item index
       * @param {string} name - Input name
       */
      handleCartUpdateSuccess(data, target, line, name) {
        window.FoxThemeEvents.emit(PUB_SUB_EVENTS.cartUpdate, {
          source: "quick-order-list",
          cart: data,
          target,
          sections: data.sections,
          errors: data.errors,
          item_count: data.item_count,
          line,
          name,
        });
      }

      /**
       * Handle cart update errors
       * @param {Error} error - Error object
       */
      handleCartUpdateError(error) {
        if (error.name === "AbortError") {
          console.log("Request cancelled");
        } else {
          console.error("Cart update error:", error);
          this.showErrorMessage(FoxThemeStrings.cartError);
        }
      }

      /**
       * Handle cart update event
       * @param {CustomEvent} event - Cart update event
       */
      handleCartUpdate(event) {
        const cart = event || event.cart;

        if (cart.errors) {
          this.handleCartError(cart.errors, event.target);
          return;
        }

        const sectionContent = new DOMParser().parseFromString(
          cart.sections[this.sectionId],
          "text/html"
        );

        this.updateCartSections(sectionContent, event);
        this.updateFocus(event);
        this.dispatchCartUpdateEvent(event.cart);
      }

      /**
       * Update cart sections in DOM
       * @param {Document} sectionContent - Parsed section content
       * @param {CustomEvent} event - Cart update event
       */
      updateCartSections(sectionContent, event) {
        const cartDrawer = document.querySelector(`#Drawer-Cart`);
        const mainQuickOrderList = document.querySelector(
          `#MainQuickOrderList-${this.sectionId}`
        );

        if (cartDrawer) {
          const newDrawerContent = sectionContent.querySelector(`#Drawer-Cart`);
          if (newDrawerContent) {
            cartDrawer.innerHTML = newDrawerContent.innerHTML;
          }
        }

        if (mainQuickOrderList) {
          const newListContent = sectionContent.querySelector(
            `#MainQuickOrderList-${this.sectionId}`
          );
          if (newListContent) {
            mainQuickOrderList.innerHTML = newListContent.innerHTML;
          }
        }
      }

      /**
       * Update focus after cart update
       * @param {CustomEvent} event - Cart update event
       */
      updateFocus(event) {
        const mainQuickOrderList = document.querySelector(
          `#MainQuickOrderList-${this.sectionId}`
        );
        const lineItem = document.getElementById(
          `VariantItem-${this.sectionId}-${event.line}`
        );

        if (lineItem && lineItem.querySelector(`[name="${event.name}"]`)) {
          trapFocus(
            mainQuickOrderList,
            lineItem.querySelector(`[name="${event.name}"]`)
          );
        } else {
          trapFocus(
            mainQuickOrderList,
            mainQuickOrderList.querySelector(".variant-item__title")
          );
        }
      }

      /**
       * Dispatch cart updated event
       * @param {Object} cart - Cart data
       */
      dispatchCartUpdateEvent(cart) {
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: { cart },
          })
        );
      }

      /**
       * Handle cart errors
       * @param {string} errors - Error message
       * @param {HTMLElement} target - Target element
       */
      handleCartError(errors, target) {
        if (!target) {
          window.location.href = FoxTheme.routes.cart_url;
          return;
        }

        this.toggleLoadingState(target.getAttribute("data-index"), false);
        this.setInputValidity(target, errors);
      }

      /**
       * Toggle loading state for elements
       * @param {string} line - Line item index
       * @param {boolean} isLoading - Loading state
       */
      toggleLoadingState(line, isLoading) {
        const loaders = document.querySelectorAll(
          `#Loader-${this.sectionId}-${line}`
        );
        const allLoader = document.getElementById(
          `Loader-${this.sectionId}-all`
        );

        const updateLoader = (element) => {
          if (!element) return;
          element.classList[isLoading ? "add" : "remove"](
            QuickOrderList.LOADING_CLASS
          );
          element.hidden = !isLoading;
        };

        if (loaders) {
          loaders.forEach(updateLoader);
        }

        if (allLoader) {
          updateLoader(allLoader);
        }
      }

      /**
       * Show/hide error message
       * @param {string|null} message - Error message
       */
      showErrorMessage(message = null) {
        const errorElement = this.querySelector(".quick-order-list__error");
        if (!errorElement) return;

        if (message) {
          const messageElement = errorElement.querySelector(
            ".quick-order-list-error__message"
          );
          if (messageElement) {
            messageElement.textContent = message;
          }
          errorElement.removeAttribute("hidden");
        } else {
          errorElement.setAttribute("hidden", "");
        }
      }
    },
    { extends: "form" }
  );
}

if (!customElements.get("quick-order-list-wrapper")) {
  customElements.define(
    "quick-order-list-wrapper",
    class QuickOrderList extends HTMLElement {
      constructor() {
        super();
        this._sectionId = this.getAttribute("data-section-id");
        this.bindEvents();
      }

      bindEvents() {
        this._handleGroupedSections = (event) => this.getSectionToBundle(event);
        document.addEventListener(
          "cart:grouped-sections",
          this._handleGroupedSections
        );
      }

      getSectionToBundle(event) {
        if (event.detail && Array.isArray(event.detail.sections)) {
          event.detail.sections.push(this._sectionId);
        }
      }

      disconnectedCallback() {
        if (this._handleGroupedSections) {
          document.removeEventListener(
            "cart:grouped-sections",
            this._handleGroupedSections
          );
          this._handleGroupedSections = null;
        }
      }
    }
  );
}

if (!customElements.get("quick-order-list-remove")) {
  customElements.define(
    "quick-order-list-remove",
    class QuickOrderListRemove extends HTMLAnchorElement {
      constructor() {
        super();
        this.initializeComponent();
      }

      /**
       * Initialize the remove button component
       */
      initializeComponent() {
        try {
          this.bindEvents();
          this.findParentForm();
        } catch (error) {
          console.error("Error initializing QuickOrderListRemove:", error);
        }
      }

      /**
       * Bind necessary event listeners
       */
      bindEvents() {
        this.handleClick = this.handleClick.bind(this);
        this.addEventListener("click", this.handleClick);
      }

      /**
       * Find and store reference to parent quick order list form
       */
      findParentForm() {
        this.quickOrderList = this.closest('form[is="quick-order-list"]');

        if (!this.quickOrderList) {
          throw new Error(
            "QuickOrderListRemove must be inside a quick-order-list form"
          );
        }
      }

      /**
       * Handle remove button click
       * @param {Event} event - Click event
       */
      handleClick(event) {
        try {
          event.preventDefault();

          const itemIndex = this.getAttribute("data-index");
          if (!itemIndex) {
            throw new Error("Missing data-index attribute");
          }

          this.removeItem(itemIndex);
        } catch (error) {
          console.error("Error handling remove click:", error);
        }
      }

      /**
       * Remove item from cart
       * @param {string} itemIndex - Index of item to remove
       */
      removeItem(itemIndex) {
        const REMOVE_QUANTITY = 0;
        this.quickOrderList.updateItemQuantity(itemIndex, REMOVE_QUANTITY);
      }

      /**
       * Clean up when element is removed
       */
      disconnectedCallback() {
        this.removeEventListener("click", this.handleClick);
        this.quickOrderList = null;
      }
    },
    { extends: "a" }
  );
}

if (!customElements.get("quick-order-list-remove-all")) {
  customElements.define(
    "quick-order-list-remove-all",
    class QuickOrderListRemoveAll extends HTMLElement {
      static ACTIONS = {
        CONFIRM: "confirm",
        REMOVE: "remove",
        CANCEL: "cancel",
      };

      static SELECTORS = {
        CONFIRMATION: ".quick-order-list-total__confirmation",
        INFO: ".quick-order-list-total__info",
        VARIANT_QTY: "[data-quantity-variant-id]",
      };

      constructor() {
        super();
        this.handleClick = this.handleClick.bind(this);
        this.initializeComponent();
      }

      /**
       * Initialize the component
       */
      initializeComponent() {
        try {
          this.bindEvents();
          this.findParentForm();
          this.initializeCartItems();
        } catch (error) {
          console.error("Error initializing QuickOrderListRemoveAll:", error);
        }
      }

      /**
       * Bind event listeners
       */
      bindEvents() {
        this.addEventListener("click", this.handleClick);
      }

      /**
       * Find and store parent quick order list form
       */
      findParentForm() {
        this.quickOrderList = this.closest('form[is="quick-order-list"]');

        if (!this.quickOrderList) {
          throw new Error(
            "QuickOrderListRemoveAll must be inside a quick-order-list form"
          );
        }
      }

      /**
       * Initialize cart items data
       */
      initializeCartItems() {
        this.items = {};
        this.hasVariantsInCart = false;

        const variants = this.quickOrderList.querySelectorAll(
          QuickOrderListRemoveAll.SELECTORS.VARIANT_QTY
        );

        variants.forEach(this.processVariant.bind(this));
      }

      /**
       * Process each variant element
       * @param {HTMLElement} variant - Variant element
       */
      processVariant(variant) {
        const cartQuantity = parseInt(
          variant.getAttribute("data-cart-quantity")
        );
        const variantId = parseInt(
          variant.getAttribute("data-quantity-variant-id")
        );

        if (cartQuantity > 0 && !isNaN(variantId)) {
          this.hasVariantsInCart = true;
          this.items[variantId] = 0;
        }
      }

      /**
       * Handle button click events
       * @param {Event} event - Click event
       */
      handleClick(event) {
        try {
          event.preventDefault();
          const action = this.getAttribute("data-action");

          if (!action) {
            throw new Error("Missing data-action attribute");
          }

          this.handleAction(action);
        } catch (error) {
          console.error("Error handling click:", error);
        }
      }

      /**
       * Handle different button actions
       * @param {string} action - Action to perform
       */
      handleAction(action) {
        const actionHandlers = {
          [QuickOrderListRemoveAll.ACTIONS.CONFIRM]: () => {
            this.updateVisibility(false, true);
          },
          [QuickOrderListRemoveAll.ACTIONS.REMOVE]: () => {
            this.removeAllItems();
            this.updateVisibility(true, false);
          },
          [QuickOrderListRemoveAll.ACTIONS.CANCEL]: () => {
            this.updateVisibility(true, false);
          },
        };

        const handler = actionHandlers[action];
        if (handler) {
          handler();
        }
      }

      /**
       * Remove all items from cart
       */
      removeAllItems() {
        if (Object.keys(this.items).length > 0) {
          this.quickOrderList.updateCartItems(this.items);
        }
      }

      /**
       * Update visibility of confirmation and info sections
       * @param {boolean} showConfirmation - Show confirmation section
       * @param {boolean} showInfo - Show info section
       */
      updateVisibility(showConfirmation, showInfo) {
        const confirmation = this.quickOrderList.querySelector(
          QuickOrderListRemoveAll.SELECTORS.CONFIRMATION
        );
        const info = this.quickOrderList.querySelector(
          QuickOrderListRemoveAll.SELECTORS.INFO
        );

        if (confirmation && info) {
          confirmation.toggleAttribute("hidden", showConfirmation);
          info.toggleAttribute("hidden", showInfo);
        }
      }

      /**
       * Clean up when element is removed
       */
      disconnectedCallback() {
        this.removeEventListener("click", this.handleClick);
        this.quickOrderList = null;
        this.items = null;
      }
    }
  );
}
