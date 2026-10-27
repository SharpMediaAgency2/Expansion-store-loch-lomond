if (!customElements.get("variant-picker")) {
  class VariantPicker extends HTMLElement {
    constructor() {
      super();
    }

    // Values from THIS picker only (original logic, unchanged)
    get ownSelectedOptionValues() {
      const options = this.querySelectorAll(
        "select, .variant-picker__field input[type='radio']"
      );
      const selectedValues = new Map();

      options.forEach((field) => {
        const fieldName = field.name || field.dataset.fieldName;

        if (field.tagName.toLowerCase() === "select") {
          const selectedOption = Array.from(field.options).find(
            (opt) => opt.selected && !opt.disabled
          );
          if (selectedOption) {
            selectedValues.set(fieldName, selectedOption.dataset.optionValueId);
          }
        } else if (
          field.tagName.toLowerCase() === "input" &&
          field.type === "radio"
        ) {
          const checkedInput = field.checked ? field : null;
          if (checkedInput) {
            selectedValues.set(fieldName, checkedInput.dataset.optionValueId);
          }
        }
      });

      options.forEach((field) => {
        const fieldName = field.name || field.dataset.fieldName;

        if (!selectedValues.has(fieldName)) {
          if (field.tagName.toLowerCase() === "select") {
            const firstValidOption = Array.from(field.options).find(
              (opt) => !opt.disabled
            );
            if (firstValidOption) {
              selectedValues.set(
                fieldName,
                firstValidOption.dataset.optionValueId
              );
            }
          } else if (
            field.tagName.toLowerCase() === "input" &&
            field.type === "radio"
          ) {
            const firstInput = field;
            if (firstInput) {
              selectedValues.set(fieldName, firstInput.dataset.optionValueId);
            }
          }
        }
      });

      const result = [];
      options.forEach((field) => {
        const fieldName = field.name || field.dataset.fieldName;
        if (selectedValues.has(fieldName)) {
          const optionValueId = selectedValues.get(fieldName);
          if (optionValueId && !result.includes(optionValueId)) {
            result.push(optionValueId);
          }
        }
      });
      return result;
    }

    // Wishlist quickview: colour and size are separate pickers.
    // Combine them so the request always carries the full option set
    // (otherwise Shopify falls back to the first available size).
    get selectedOptionValues() {
      const quickview = this.closest("#wl-qv-modal");
      if (!quickview) return this.ownSelectedOptionValues;

      const scope = this.closest("product-info") || quickview;
      const values = [];
      scope.querySelectorAll("variant-picker").forEach((picker) => {
        picker.ownSelectedOptionValues.forEach((id) => {
          if (id && !values.includes(id)) values.push(id);
        });
      });
      return values;
    }

    getInputForEventTarget(target) {
      return target.tagName === "SELECT" ? target.selectedOptions[0] : target;
    }

    connectedCallback() {
      this.addEventListener("change", (event) => {
        const target = this.getInputForEventTarget(event.target);
        window.FoxThemeEvents.emit(PUB_SUB_EVENTS.optionValueSelectionChange, {
          data: {
            event,
            target,
            selectedOptionValues: this.selectedOptionValues,
          },
        });
      });
    }
  }

  customElements.define("variant-picker", VariantPicker);
}

// Wishlist quickview only: after a variant change, refresh ALL variant pickers
// (colour + size), not just the first one, so sold-out sizes update correctly.
customElements.whenDefined("product-info").then(() => {
  const ProductInfo = customElements.get("product-info");
  const original = ProductInfo && ProductInfo.prototype.updateOptionValues;
  if (!original || original.__qvPatched) return;

  const patched = function (html) {
    if (!this.closest("#wl-qv-modal")) return original.call(this, html);

    const fresh = [...html.querySelectorAll("variant-picker")];
    this.querySelectorAll("variant-picker").forEach((current, i) => {
      const source = fresh.find((f) => f.id === current.id) || fresh[i];
      if (source) {
        HTMLUpdateUtility.viewTransition(
          current,
          source,
          this.preProcessHtmlCallbacks
        );
      }
    });
  };

  patched.__qvPatched = true;
  ProductInfo.prototype.updateOptionValues = patched;
});