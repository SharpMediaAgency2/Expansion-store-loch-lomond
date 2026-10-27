if (!customElements.get("recently-viewed-products")) {
  customElements.define(
    "recently-viewed-products",
    class RecentlyViewedProducts extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.section = this.closest(".f-recently-viewed");

        const handleIntersection = (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this.section);

          this.init();
        };

        new IntersectionObserver(handleIntersection.bind(this.section), {
          rootMargin: "0px 0px 400px 0px",
        }).observe(this.section);
      }

      init() {
        fetch(this.dataset.url + this.getQueryString())
          .then((response) => response.text())
          .then((text) => {
            const html = document.createElement("div");
            html.innerHTML = text;
            const recommendations = html.querySelector(
              "recently-viewed-products"
            );
            this.productsCount =
              recommendations.querySelectorAll(".product-card").length;

            if (this.productsCount <= 0) {
              this.classList.add("f-hidden");
            }

            if (recommendations && recommendations.innerHTML.trim().length) {
              this.innerHTML = recommendations.innerHTML;
              const productContainer = this.querySelector(
                ".f-recently-viewed-flickity"
              );

              const { enableSlider, sliderColumns, sliderColumnsTablet } =
                productContainer.dataset;

              let activeColumns =
                FoxThemeSettings.isTablet && sliderColumnsTablet
                  ? sliderColumnsTablet
                  : sliderColumns;

              activeColumns = parseInt(activeColumns);

              if (enableSlider === "true" && !FoxThemeSettings.isMobile) {
                if (activeColumns > this.productsCount) {
                  this.slider = new window.FoxTheme.Slider(productContainer);
                } else {
                  productContainer.classList.remove("md:flickity-enable");
                  productContainer.classList.add("flickity-destroyed");
                }
              }

              this.sendTrekkieEvent(this.productsCount);
              __reInitTooltip(productContainer);
            }
          })
          .catch((e) => {
            console.error(e);
          });
      }

      getQueryString() {
        const cookieName = "zest-recently-viewed";
        const items = JSON.parse(
          window.localStorage.getItem(cookieName) || "[]"
        );
        if (
          this.dataset.productId &&
          items.includes(parseInt(this.dataset.productId))
        ) {
          items.splice(items.indexOf(parseInt(this.dataset.productId)), 1);
        }
        return items
          .map((item) => "id:" + item)
          .slice(0, this.productsToshow)
          .join(" OR ");
      }

      sendTrekkieEvent(numberProducts) {
        if (
          !window.ShopifyAnalytics ||
          !window.ShopifyAnalytics.lib ||
          !window.ShopifyAnalytics.lib.track
        ) {
          return;
        }
        let didPageJumpOccur =
          this.getBoundingClientRect().top <= window.innerHeight;

        window.ShopifyAnalytics.lib.track(
          "Recently Viewed Products Displayed",
          {
            theme: Shopify.theme.name,
            didPageJumpOccur: didPageJumpOccur,
            numberOfRecommendationsDisplayed: numberProducts,
          }
        );
      }
    }
  );
}
