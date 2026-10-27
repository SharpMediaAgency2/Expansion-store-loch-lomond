if (!customElements.get("media-gallery")) {
  customElements.define(
    "media-gallery",
    class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.selectors = {
          mediaGallery: "[id^=Media-Gallery]",
          liveRegion: '[id^="GalleryStatus"]',
          viewer: '[id^="GalleryViewer"]',
          thumbnailsWrapper: ".f-product__media-thumbnails-wrapper",
          thumbnails: '[id^="GalleryThumbnails"]',
          thumbnailItems: ['[id^="GalleryThumbnailItem"]'],
          videos: [".f-video__embed"],
          models: ["product-model"],
          medias: [".f-product__media"],
          xrButton: "[data-first-xr-button]",
          sliderCounter: ".flickity-counter--current",
          toggleZoom: [".js-photoswipe--zoom"],
        };

        let touchingCarousel = false;
        let startXCoordinate;

        document.body.addEventListener(
          "touchstart",
          (e) => {
            if (e.target.closest(".flickity-slider")) {
              touchingCarousel = true;
            } else {
              touchingCarousel = false;
              return;
            }
            startXCoordinate = e.touches[0].pageX;
          },
          { passive: true }
        );

        document.body.addEventListener(
          "touchmove",
          (e) => {
            if (touchingCarousel && e.cancelable) {
              if (Math.abs(e.touches[0].pageX - startXCoordinate) > 10) {
                e.preventDefault();
              }
            }
          },
          { passive: false }
        );
      }

      connectedCallback() {
        this.init();
      }

      disconnectedCallback() {
        clearInterval(this.check);
      }

      getSelectedVariant() {
        const selectedVariant = this.querySelector(
          "[data-selected-variant]"
        )?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      init() {
        this.domNodes = queryDomNodes(this.selectors, this);
        this.mediaLayout = this.domNodes.mediaGallery.dataset.mediaLayout;
        this.onlyImage = this.dataset.onlyImage === "true";
        this.sectionId = this.dataset.sectionId;
        this.section = this.closest("product-info");
        this.enableZoom = this.dataset.enableZoom === "true";
        this.enableVariantGroupImages =
          this.dataset.enableVariantGroupImages === "true";
        this.showFeaturedMedia = this.dataset.showFeaturedMedia === "true";
        this.variantPickers = this.section.querySelector(
          "[data-variant-picker]"
        );
        this.disableDefaultVariant =
          this.variantPickers &&
          this.variantPickers.dataset.disableDefaultVariant === "true";
        this.variantData = this.getVariantData();
        const selectedVariantId =
          (this.section &&
            this.section.querySelector('input[name="id"]')?.value) ||
          this.getSelectedVariant();
        this.currentVariant = this.variantData.find(
          (variant) => variant.id === Number(selectedVariantId)
        );

        if (!this.enableVariantGroupImages || this.onlyImage) {
          setTimeout(() => {
            this.removeAttribute("data-media-loading");
          }, 100);
        }
        if (this.mediaLayout === "carousel") {
          setTimeout(() => {
            this.domNodes.thumbnails && this.domNodes.thumbnails.initSlider();
          });
          this.initGallerySlider();
        } else {
          const initSliders = () => {
            this.domNodes.mediaGallery &&
              this.domNodes.mediaGallery.initSlider();
            this.domNodes.thumbnails && this.domNodes.thumbnails.initSlider();
            this.mediaGallery = this.domNodes.mediaGallery.slider.instance;
            this.thumbnails =
              this.domNodes.thumbnails &&
              this.domNodes.thumbnails.slider.instance;
            this.mediaGallery.on("change", this.onSlideChanged.bind(this));
            if (
              this.currentVariant &&
              this.currentVariant.featured_media &&
              !this.disableDefaultVariant &&
              !this.showFeaturedMedia
            ) {
              this.setActiveMedia(this.currentVariant.featured_media.id);
            }
          };
          if (FoxThemeSettings.isMobile) {
            initSliders();
          }
          document.addEventListener("matchMobile", initSliders);
          document.addEventListener("unmatchMobile", () => {
            this.domNodes.mediaGallery && this.domNodes.mediaGallery.destroy();
            this.domNodes.thumbnails && this.domNodes.thumbnails.destroy();
            if (
              this.currentVariant &&
              this.currentVariant.featured_media &&
              !this.disableDefaultVariant &&
              !this.showFeaturedMedia
            ) {
              this.setActiveMedia(this.currentVariant.featured_media.id);
            }
          });
          if (this.enableZoom) this.initImageZoom();
        }
        if (this.onlyImage && this.enableZoom) this.initImageZoom();

        setTimeout(() => {
          this.dispatchEvent(
            new CustomEvent("product-media:loaded", {
              bubbles: true,
              detail: {
                currentVariant: this.currentVariant,
              },
            })
          );
        }, 100);
      }

      update() {
        if (this.domNodes.mediaGallery) this.domNodes.mediaGallery.update();
        if (this.domNodes.thumbnails) this.domNodes.thumbnails.update();
      }

      initGallerySlider() {
        if (!this.domNodes.medias.length) return;
        this.selectedSlide = null;
        this.selectedMediaType = "";
        this.check = setInterval(() => {
          this.mediaGallery =
            this.domNodes.mediaGallery.slider &&
            this.domNodes.mediaGallery.slider.instance;
          this.thumbnails =
            this.domNodes.thumbnails &&
            this.domNodes.thumbnails.slider &&
            this.domNodes.thumbnails.slider.instance;

          if (this.mediaGallery && typeof this.mediaGallery == "object") {
            clearInterval(this.check);
            this.mediaGallery.on("change", this.onSlideChanged.bind(this));

            if (this.thumbnails) {
              if (this.thumbnails.cells && this.thumbnails.cells[0]) {
                this.thumbnails.select(0);
                this.handleScreenChange();
              }
            }
            if (this.enableZoom) this.initImageZoom();
            if (
              this.currentVariant &&
              this.currentVariant.featured_media &&
              !this.disableDefaultVariant &&
              !this.showFeaturedMedia
            ) {
              this.setActiveMedia(this.currentVariant.featured_media.id);
            }
          }
        }, 100);
      }

      getVariantData() {
        this.variantData =
          this.variantData ||
          JSON.parse(
            this.querySelector('[type="application/json"]').textContent
          );
        return this.variantData;
      }

      initImageZoom() {
        let dataSource = [];
        const allMedia = this.querySelectorAll(".f-product__media");
        if (allMedia) {
          allMedia.forEach((media) => {
            if (media.dataset.mediaType === "image") {
              dataSource.push({
                id: media.dataset.mediaIndex,
                src: media.dataset.src,
                width: media.dataset.pswpWidth,
                height: media.dataset.pswpHeight,
                mediaType: media.dataset.mediaType,
              });
            }
            if (media.dataset.mediaType === "model") {
              const html = `<div class="pswp__item--${
                media.dataset.mediaType
              }">${media.querySelector("product-model").outerHTML}</div>`;
              dataSource.push({
                id: media.dataset.mediaIndex,
                html: html,
                mediaType: media.dataset.mediaType,
              });
            }

            if (
              media.dataset.mediaType === "video" ||
              media.dataset.mediaType == "external_video"
            ) {
              const html = `<div class="pswp__item--${
                media.dataset.mediaType
              }">${media.querySelector("deferred-media").outerHTML}</div>`;
              dataSource.push({
                id: media.dataset.mediaIndex,
                html: html,
                mediaType: media.dataset.mediaType,
              });
            }
          });
        }

        const options = {
          dataSource: dataSource,
          pswpModule: window.FoxTheme.PhotoSwipe,
          bgOpacity: 1,
          arrowPrev: false,
          arrowNext: false,
          zoom: false,
          close: false,
          counter: false,
          preloader: false,
        };

        this.lightbox = new window.FoxTheme.PhotoSwipeLightbox(options);

        this.lightbox.addFilter("thumbEl", (thumbEl, data, index) => {
          const el = this.querySelector(
            '[data-media-index="' + data.id + '"] img'
          );
          if (el) {
            return el;
          }
          return thumbEl;
        });

        this.lightbox.addFilter("placeholderSrc", (placeholderSrc, slide) => {
          const el = this.querySelector(
            '[data-media-index="' + slide.data.id + '"] img'
          );
          if (el) {
            return el.src;
          }
          return placeholderSrc;
        });

        this.lightbox.on("change", () => {
          const currIndex = this.lightbox.pswp.currIndex;
          if (!this.onlyImage) {
            const slider =
              this.domNodes.mediaGallery.slider &&
              this.domNodes.mediaGallery.slider.instance;
            if (slider) {
              setTimeout(() => {
                slider.select(currIndex, false, true);
              }, 300);
            }
          }
        });

        this.lightbox.on("pointerDown", (e) => {
          const currSlide = this.lightbox.pswp.currSlide.data;
          if (
            currSlide.mediaType === "video" ||
            currSlide.mediaType === "model" ||
            currSlide.mediaType === "external_video"
          ) {
            e.preventDefault();
          }
        });

        this.lightbox.on("uiRegister", () => {
          if (!this.onlyImage) {
            this.lightbox.pswp.ui.registerElement({
              name: "next",
              ariaLabel: "Next slide",
              order: 3,
              isButton: true,
              html: '<svg class="pswp-icon-next" viewBox="0 0 100 100"><path d="M 10,50 L 60,100 L 65,90 L 25,50  L 65,10 L 60,0 Z" class="arrow" transform="translate(100, 100) rotate(180) "></path></svg>',
              onClick: (event, el) => {
                this.lightbox.pswp.next();
              },
            });
            this.lightbox.pswp.ui.registerElement({
              name: "prev",
              ariaLabel: "Previous slide",
              order: 1,
              isButton: true,
              html: '<svg class="pswp-icon-prev" viewBox="0 0 100 100"><path d="M 10,50 L 60,100 L 65,90 L 25,50  L 65,10 L 60,0 Z" class="arrow"></path></svg>',
              onClick: (event, el) => {
                this.lightbox.pswp.prev();
              },
            });
          }

          this.lightbox.pswp.ui.registerElement({
            name: "close-zoom",
            ariaLabel: "Close zoom image",
            order: 2,
            isButton: true,
            html: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="f-icon-svg f-icon--medium  f-icon-close"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
            onClick: (event, el) => {
              this.lightbox.pswp.close();
            },
          });
        });

        this.lightbox.init();

        addEventDelegate({
          selector: this.selectors.toggleZoom[0],
          context: this,
          handler: (e, media) => {
            const isImage = media.dataset.mediaType === "image";
            if (isImage) {
              const index = Number(media.dataset.mediaIndex) || 0;
              this.lightbox.loadAndOpen(index);
            }
          },
        });
      }

      onSlideChanged(index) {
        this.draggable = true;
        this.selectedSlide = this.mediaGallery.selectedElement;
        this.selectedMediaType = this.selectedSlide.dataset.mediaType;
        this.selectedMediaId = this.selectedSlide.dataset.mediaId;

        const mediaAspectRatio = this.selectedSlide.dataset.aspectRatio;
        this.domNodes.viewer.style.setProperty(
          "--media-aspect-ratio",
          mediaAspectRatio
        );

        if (
          "model,external_video,video".includes(this.selectedMediaType) &&
          this.draggable
        ) {
          this.toggleDraggable();
        } else {
          this.toggleDraggable(true);
        }

        if (this.selectedMediaType === "model") {
          this.domNodes.xrButton &&
            this.domNodes.xrButton.setAttribute(
              "data-shopify-model3d-id",
              this.selectedMediaId
            );
        }

        if (this.thumbnails) {
          this.thumbnails.select(index);
        }

        if (this.domNodes.sliderCounter) {
          this.domNodes.sliderCounter.textContent = index + 1;
        }

        this.domNodes.mediaGallery.classList.remove("pointer-move");

        this.playActiveMedia(this.selectedSlide);
      }

      handleScreenChange() {
        document.addEventListener("matchMobile", () => {
          this.domNodes.thumbnails.update();
          if (this.thumbnails.cells.length > 4) {
            this.thumbnails.options.wrapAround = true;
            this.domNodes.thumbnails.update();
          }
        });
        document.addEventListener("unmatchMobile", () => {
          this.domNodes.thumbnails.update();
          if (this.thumbnails.cells.length < 6) {
            this.thumbnails.options.wrapAround = false;
            this.domNodes.thumbnails.update();
          }
        });
        if (this.thumbnails.cells.length > 5) {
          this.domNodes.thumbnails.update();
          this.thumbnails.options.wrapAround = true;
          this.domNodes.thumbnails.update();
        }
      }

      toggleDraggable(status = false) {
        this.draggable = status;
        this.mediaGallery.options.draggable = status;
        this.mediaGallery.updateDraggable();
      }
      playActiveMedia(selected) {
        window.pauseAllMedia();
        const deferredMedia = selected.querySelector(".deferred-media");
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      setActiveMedia(mediaId) {
        const selectedMedia = this.domNodes.mediaGallery.querySelector(
          `[data-media-id="${mediaId}"]`
        );
        if (!selectedMedia) return;
        const mediaIndex = Number(selectedMedia.dataset.mediaIndex);

        if (this.mediaLayout === "carousel") {
          this.mediaGallery &&
            this.mediaGallery.select(mediaIndex, false, true);
        } else {
          this.scrollIntoView(selectedMedia);
        }
      }

      scrollIntoView(selectedMedia) {
        if (FoxThemeSettings.isMobile) return;
        selectedMedia.scrollIntoView({
          behavior: "smooth",
        });
      }
    }
  );
}
