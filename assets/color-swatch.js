if (!customElements.get("color-swatch")) {
  class ColorSwatch extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.optionNodes = this.querySelectorAll("[data-value]");
      this.init();
    }

    disconnectedCallback() {
      this.optionNodes.forEach((button) =>
        button.removeEventListener("mouseenter", this.onMouseEnter.bind(this))
      );
    }

    init() {
      const productCard = this.closest(".product-card");
      this.mainImage = productCard.querySelector(
        ".product-card__image--main img"
      );
      this.logoOverlay = productCard.querySelector(".logo-overlay");
      
      this.optionNodes.forEach((button) =>
        button.addEventListener("mouseenter", this.onMouseEnter.bind(this))
      );

      this.selected = this.querySelector('a[aria-selected="true"]');

      this.getVariantData();
      this.initOptionSwatches();
    }

    initOptionSwatches() {
      this.optionNodes.forEach((optNode) => {
        let variantImage;
        const { optionPosition, value: optionValue } = optNode.dataset;
        const variant = this.variantData.find(
          (v) =>
            v[`option${optionPosition}`] &&
            v[`option${optionPosition}`].toLowerCase() ===
              optionValue.toLowerCase()
        );
        if (variant) {
          variantImage = variant.featured_image
            ? variant.featured_image.src
            : "";
          optNode.href = `${optNode.href}?variant=${variant.id}`;
          if (variantImage) {
            optNode.setAttribute(
              "data-src",
              getSizedImageUrl(variantImage, "900x")
            );
            optNode.setAttribute("data-srcset", getSrcset(variantImage));
          }
          
          // Add logo data attributes
          if (variant.logo_position) {
            optNode.setAttribute("data-logo-position", variant.logo_position);
          }
          if (variant.logo_size) {
            optNode.setAttribute("data-logo-size", variant.logo_size);
          }
        }
      });
    }

    onMouseEnter(e) {
      const { target } = e;
      this.selected && this.selected.removeAttribute("aria-selected");
      target.setAttribute("aria-selected", true);

      const { src, srcset } = target.dataset;
      if (this.mainImage && srcset) {
        // Fade out logo
        if (this.logoOverlay) {
          this.logoOverlay.style.transition = 'opacity 0.2s ease';
          this.logoOverlay.style.opacity = '0';
        }
        
        // Update image
        this.mainImage.src = src;
        this.mainImage.srcset = srcset;
        
        // Wait for image to load before updating logo
        this.waitForImageLoad(target);
      } else {
        // No image update, just update logo
        this.updateLogoOverlay(target);
      }

      this.selected = target;
    }

    waitForImageLoad(swatchElement) {
      if (this.mainImage.complete && this.mainImage.naturalHeight !== 0) {
        // Image already loaded (cached)
        this.updateLogoOverlay(swatchElement);
      } else {
        // Image still loading - wait for it with timeout fallback
        let loaded = false;
        
        const handleImageLoad = () => {
          if (!loaded) {
            loaded = true;
            this.updateLogoOverlay(swatchElement);
            this.mainImage.removeEventListener('load', handleImageLoad);
            this.mainImage.removeEventListener('error', handleImageLoad);
          }
        };
        
        this.mainImage.addEventListener('load', handleImageLoad);
        this.mainImage.addEventListener('error', handleImageLoad);
        
        // Fallback: Update logo after 400ms even if load event doesn't fire
        setTimeout(() => {
          if (!loaded) {
            loaded = true;
            this.updateLogoOverlay(swatchElement);
            this.mainImage.removeEventListener('load', handleImageLoad);
            this.mainImage.removeEventListener('error', handleImageLoad);
          }
        }, 400);
      }
    }

    fadeInLogo() {
      if (this.logoOverlay) {
        // Small delay to ensure position is updated first
        requestAnimationFrame(() => {
          this.logoOverlay.style.opacity = '1';
        });
      }
    }

    hideLogo() {
      if (this.logoOverlay) {
        // Keep it faded out and hide with display
        this.logoOverlay.style.opacity = '0';
        // Small delay to let fade complete before hiding
        setTimeout(() => {
          this.logoOverlay.style.display = 'none';
        }, 200);
      }
    }

    showLogo() {
      if (this.logoOverlay) {
        this.logoOverlay.style.display = 'block';
        this.fadeInLogo();
      }
    }

    updateLogoOverlay(swatchElement) {
      // Exit if no logo overlay exists on this product card
      if (!this.logoOverlay) return;

      // Get logo data from the swatch element's data attributes
      const logoPosition = swatchElement.dataset.logoPosition;
      const logoSize = swatchElement.dataset.logoSize;

      // Check if logo data exists
      if (logoPosition && logoSize) {
        // Parse logo position (format: "x:59.01%;y:21.32%")
        const parts = logoPosition.split(';');
        const xPart = parts[0]; // "x:59.01%"
        const yPart = parts[1]; // "y:21.32%"
        
        const xValue = xPart.split(':')[1]; // "59.01%"
        const yValue = yPart.split(':')[1]; // "21.32%"

        // Update logo overlay styles
        this.logoOverlay.style.left = xValue;
        this.logoOverlay.style.top = yValue;
        this.logoOverlay.style.height = logoSize;
        this.logoOverlay.style.maxWidth = logoSize;
        
        // Show and fade in logo
        this.showLogo();
      } else {
        // No logo data - hide the logo
        this.hideLogo();
      }
    }

    getVariantData() {
      if (!this.variantData) {
        const data = JSON.parse(this.nextElementSibling.textContent);
        this.variantData = data.variants;
        this.logoData = data.logo_data;
        
        // Merge logo data into variants for easy access
        this.variantData = this.variantData.map(variant => ({
          ...variant,
          logo_position: this.logoData[variant.id]?.logo_position || null,
          logo_size: this.logoData[variant.id]?.logo_size || null
        }));
      }
    }
  }
  customElements.define("color-swatch", ColorSwatch);
}