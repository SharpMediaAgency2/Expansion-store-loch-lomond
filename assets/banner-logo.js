if (!customElements.get("banner-logo")) {
  class BannerLogo extends HTMLElement {
    constructor() {
      super();

      this.logoWrapper = this.querySelector(".banner-logo__logo-inner");
      this.logo = this.querySelector(".banner-logo__logo");
      this.header = document.querySelector(".site-header");

      this.classes = {
        scaling: "header-logo-scaling",
      };
      this.initialized = false;
    }

    connectedCallback() {
      if (!this.logoWrapper) {
        return;
      }

      this.init();
      window.addEventListener("resize", debounce(this.init.bind(this), 100));
      // window.addEventListener("scroll", () => {
      //   window.requestAnimationFrame(() => this.scrollAnimation());
      // });
    }

    calculateMaxScale() {
      const headerEl = document.querySelector(".site-header"),
        computedStyle = window.getComputedStyle(headerEl);

      let logoWidth = computedStyle.getPropertyValue("--logo-mobile-width"),
        ratio = 0.83;

      if (!window.FoxThemeSettings.isMobile) {
        logoWidth = computedStyle.getPropertyValue("--logo-width");
        ratio = 0.58;
      }

      logoWidth = parseInt(logoWidth.trim());

      return (document.body.clientWidth / logoWidth) * ratio; // maxScale.
    }

    init() {
      this.maxScale = this.calculateMaxScale();
      // this.scrollAnimation();

      if (!this.initialized) {
        this.logoWrapper.classList.remove("invisible");
        typeof this.logoWrapper.refreshAnimation === "function" &&
          this.logoWrapper.refreshAnimation();
        this.initialized = true;
      }
    }

    scrollAnimation() {
      const scrollTop = window.scrollY;
      const scrollTarget = this.offsetTop + this.logoWrapper.offsetTop + 70;
      const scaleRatio = scrollTop / scrollTarget;
      const scaleValue = Math.max(
        1,
        this.maxScale - scaleRatio * this.maxScale
      );

      if (this.logo) {
        this.logo.style.transform = `scale(${scaleValue})`;
      }

      if (scaleValue <= 1) {
        this.header.headerSection.classList.remove(this.classes.scaling);
        this.logo.style.setProperty("opacity", 0);
      } else {
        this.header.headerSection.classList.add(this.classes.scaling);
        this.logo.style.setProperty("opacity", 1);
      }
    }
  }
  customElements.define("banner-logo", BannerLogo);
}
