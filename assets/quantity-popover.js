if (!customElements.get("quantity-popover")) {
  customElements.define(
    "quantity-popover",
    class QuantityPopover extends HTMLElement {
      constructor() {
        super();
        this.mql = window.matchMedia("(min-width: 990px)");
        this.mqlTablet = window.matchMedia("(min-width: 750px)");

        // Initialize elements after they're available
        this.initializeElements();
      }

      initializeElements() {
        this.popoverInfoButton = this.querySelector(
          ".quantity-popover__info-button"
        );
        this.popoverInfo = this.querySelector(".quantity-popover__info");
        this.closeButton = this.querySelector(".button-close");

        // Only set up event listeners if elements exist
        if (this.popoverInfoButton && this.popoverInfo) {
          this.eventMouseEnterHappened = false;

          if (this.closeButton) {
            this.closeButton.addEventListener(
              "click",
              this.closePopover.bind(this)
            );
          }

          this.popoverInfoButton.addEventListener(
            "click",
            this.togglePopover.bind(this)
          );

          // Add click outside handler
          this.handleClickOutside = this.handleClickOutside.bind(this);
          document.addEventListener("click", this.handleClickOutside);
        }
      }

      togglePopover(event) {
        event.preventDefault();
        const isExpanded =
          this.popoverInfoButton.getAttribute("aria-expanded") === "true";

        if ((this.mql.matches && !isExpanded) || event.type === "click") {
          this.popoverInfoButton.setAttribute("aria-expanded", !isExpanded);

          this.popoverInfo.toggleAttribute("hidden");

          this.popoverInfoButton.classList.toggle(
            "quantity-popover__info-button--open"
          );
        }

        const isOpen =
          this.popoverInfoButton.getAttribute("aria-expanded") === "true";

        if (isOpen && event.type !== "mouseenter") {
          this.popoverInfoButton.focus();
          this.popoverInfoButton.addEventListener("keyup", (e) => {
            if (e.key === "Escape") {
              this.closePopover(e);
            }
          });
        }
      }

      closePopover(event) {
        if (event) {
          event.preventDefault();
          // Only check for relatedTarget if it's a regular close button event
          if (event.relatedTarget) {
            const isPopoverChild = this.popoverInfo.contains(
              event.relatedTarget
            );
            if (isPopoverChild) return;
          }
        }

        this.popoverInfoButton.setAttribute("aria-expanded", "false");
        this.popoverInfoButton.classList.remove(
          "quantity-popover__info-button--open"
        );
        this.popoverInfo.setAttribute("hidden", "");
      }

      // Add new method to handle clicks outside
      handleClickOutside(event) {
        if (
          !this.contains(event.target) &&
          this.popoverInfoButton.getAttribute("aria-expanded") === "true"
        ) {
          this.closePopover(event);
        }
      }
    }
  );
}
