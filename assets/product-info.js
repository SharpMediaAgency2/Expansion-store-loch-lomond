if (!customElements.get("product-info")) {
  customElements.define(
    "product-info",
    class ProductInfo extends HTMLElement {
      abortController = undefined;
      onVariantChangeUnsubscriber = undefined;
      cartUpdateUnsubscriber = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];

      constructor() {
        super();
      }

      get variantSelectors() {
        return this.querySelector("variant-picker");
      }

      get productMedia() {
        return this.querySelector(
          `[id^="MediaGallery-${this.dataset.section}"]`
        );
      }

      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }

      get productUrl() {
        return this.dataset.url;
      }

      get productId() {
        return this.getAttribute("data-product-id");
      }

      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }

      get inventoryStatus() {
        return this.querySelector(`#Inventory-${this.dataset.section}`);
      }

      get sku() {
        return this.querySelector(`#Sku-${this.dataset.section}`);
      }

      get availability() {
        return this.querySelector(`#Availability-${this.dataset.section}`);
      }

      get enableVariantGroupImages() {
        return this.dataset.enableVariantGroupImages === "true" || false;
      }

      get disableDefaultSelectVariant() {
        return this.dataset.disableDefaultSelectVariant === "true" || false;
      }

      get productForm() {
        return this.querySelector("product-form");
      }

      get quantityInput() {
        return this.querySelector("quantity-input input");
      }

      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode.querySelector(
          "variant-picker [data-selected-variant]"
        )?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      getVariantGroupImages() {
        return (
          JSON.parse(
            this.querySelector('#VariantGroupImages[type="application/json"]')
              .textContent
          ) || {}
        );
      }

      getProductOptionByName(optionName, productData) {
        for (var i = 0; i < productData.options.length; i++) {
          var option = productData.options[i];
          if (option["name"] === optionName) {
            return option;
          }
        }
        return null;
      }

      async getProductData() {
        try {
          const response = await fetch(this.dataset.productUrl + ".js");
          if (!response.ok) {
            throw new Error(
              `Bad HTTP status of the request (${response.status}).`
            );
          }
          const data = await response.json();
          return data;
        } catch (err) {
          console.log(
            `An error occurred while processing the request. Error message: ${err.message}`
          );
        }
      }

      async init() {
        this.onVariantChangeUnsubscriber = window.FoxThemeEvents.subscribe(
          PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this)
        );

        if (this.enableVariantGroupImages) {
          this.variantGroupImages = this.getVariantGroupImages();
        }

        this.addEventListener("product-media:loaded", (evt) => {
          if (this.enableVariantGroupImages && this.variantGroupImages.enable) {
            this.updateMedia(evt.detail.currentVariant);
          }
        });

        this.productData = await this.getProductData();
        this.Notification = window.FoxTheme.Notification;

        if (this.productData && this.disableDefaultSelectVariant) {
          this.handleDisableDefaultSelectVariant();
        }
      }

      initializeProductSwapUtility() {
        this.postProcessHtmlCallbacks.push((newNode) => {
          __reInitTooltip(newNode);
          window?.Shopify?.PaymentButton?.init();
          console.log("init");
          overrideCourseChange();
          window?.ProductModel?.loadShopifyXR();
        });
      }

      connectedCallback() {
        this.initializeProductSwapUtility();
        this.init();

        this.initQuantityHandlers();
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber();
        this.cartUpdateUnsubscriber?.();
      }

      handleDisableDefaultSelectVariant() {
        const stickyAtc = document.querySelector(".sticky-atc-bar");
        let urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("variant")) return;

        if (stickyAtc) {
          stickyAtc.classList.add("f-hidden");
        }

        this.inventoryStatus && this.inventoryStatus.setAttribute("hidden", "");
        this.sku && this.sku.classList.add("hidden");
        this.availability && this.availability.classList.add("hidden");

        let isVariantChange = false;
        this.pickerFields = this.querySelectorAll("[data-picker-field]");

        this.pickerFields &&
          this.pickerFields.forEach((field) => {
            let optionName = field.dataset.optionName;
            let optionInfo = this.getProductOptionByName(
              optionName,
              this.productData
            );

            if (optionInfo && optionInfo.values.length > 1) {
              isVariantChange = true;
              let pickerType = field.dataset.pickerField;
              switch (pickerType) {
                case "select":
                  let selectBox = field.querySelector("select");
                  let option = document.createElement("option");
                  option.text = this.dataset.variantOptionNoneText;
                  option.setAttribute("disabled", "");
                  option.setAttribute("selected", "");

                  selectBox.add(option, 0);
                  break;
                default:
                  let checkedInputs = field.querySelectorAll("input:checked");
                  checkedInputs &&
                    checkedInputs.forEach(function (input) {
                      input.removeAttribute("checked");
                    });
                  break;
              }

              field.dataset.selectedValue = "";
              if (field.querySelector(".selected-value")) {
                field.querySelector(".selected-value").textContent = "";
              }
            }
          });

        if (isVariantChange) {
          document
            .querySelectorAll(
              `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
            )
            .forEach((productForm) => {
              const input = productForm.querySelector('input[name="id"]');
              input.value = "";
            });

          const atcButton = this.querySelector('[name="add"]');
          const buyNowButton = this.querySelector(
            ".shopify-payment-button__button"
          );

          atcButton.addEventListener(
            "click",
            this.handleDisableDefaultSelectVariantMessage.bind(this)
          );
          buyNowButton &&
            buyNowButton.addEventListener(
              "click",
              this.handleDisableDefaultSelectVariantMessage.bind(this)
            );
        }
      }

      handleDisableDefaultSelectVariantMessage(evt) {
        if (!this.currentVariant) {
          evt.preventDefault();
          this.pickerFields &&
            this.pickerFields.forEach((pickerField) => {
              if ("" === pickerField.dataset.selectedValue) {
                pickerField
                  .closest(".variant-picker__field-wrapper")
                  .classList.add("is-error");
              }
            });

          this.Notification.show({
            target: this.productForm,
            method: "appendChild",
            type: "warning",
            last: 3000,
            message: this.dataset.variantSelectionNeededText,
          });
        }
      }

      handleOptionValueChange({
        data: { event, target, selectedOptionValues },
      }) {
        if (!this.contains(event.target)) return;
        const productUrl =
          target.dataset.productUrl ||
          this.pendingRequestUrl ||
          this.dataset.productUrl;
        const shouldSwapProduct = this.dataset.productUrl !== productUrl;
        const shouldFetchFullPage =
          this.dataset.updateUrl === "true" && shouldSwapProduct;

        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(
            productUrl,
            selectedOptionValues,
            shouldFetchFullPage
          ),
          targetId: target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
            : this.handleUpdateProductInfo(productUrl),
        });
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          const selector = updateFullPage
            ? "product-info[id^='MainProduct']"
            : "product-info";

          const variant = this.getSelectedVariant(html.querySelector(selector));

          this.updateURL(productUrl, variant?.id);

          if (updateFullPage) {
            const currentShareModal = document.getElementById(
              `PopupModal-Sharing-${this.sectionId}`
            );
            document.querySelector("head title").innerHTML =
              html.querySelector("head title").innerHTML;
            if (currentShareModal) document.body.removeChild(currentShareModal);

            HTMLUpdateUtility.viewTransition(
              document.querySelector("main"),
              html.querySelector("main"),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
            HTMLUpdateUtility.viewTransition(
              document.getElementById("shopify-section-sticky-atc-bar"),
              html.getElementById("shopify-section-sticky-atc-bar"),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector("product-info"),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }
        };
      }

      handleUpdateProductInfo(productUrl) {
        return (html) => {
          const variant = this.getSelectedVariant(html);

          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateShareUrl(variant?.id);
          this.updateVariantInputs(variant?.id);
          this.toolTip = __reInitTooltip(this);

          if (!variant) {
            this.setUnavailable();
            return;
          }

          this.updateMedia(variant);

          const updateSourceFromDestination = (id) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(`#${id}-${this.sectionId}`);
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.removeAttribute("hidden");
            }
          };

          updateSourceFromDestination("Price");
          updateSourceFromDestination("Volume");
          updateSourceFromDestination("PricePerItem");
          updateSourceFromDestination("Inventory");
          updateSourceFromDestination("Sku");
          updateSourceFromDestination("Availability");

          this.updateQuantityRules(this.sectionId, this.productId, html);
          updateSourceFromDestination("QuantityRules");
          updateSourceFromDestination("QuantityRulesCart");
          updateSourceFromDestination("VolumeNote");

          const addButtonUpdated = html.getElementById(
            `ProductSubmitButton-${this.sectionId}`
          );
          this.updateButton(
            addButtonUpdated ? addButtonUpdated.hasAttribute("disabled") : true,
            window.FoxThemeStrings.soldOut
          );
          this.currentVariant = variant;

          window.FoxThemeEvents.emit(PUB_SUB_EVENTS.variantChange, {
            data: { variant, sectionId: this.sectionId, html },
          });

          document.dispatchEvent(
            new CustomEvent("variant:changed", {
              detail: {
                variant: this.currentVariant,
              },
            })
          );
        };
      }

      buildRequestUrlWithParams(
        url,
        optionValues,
        shouldFetchFullPage = false
      ) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (optionValues.length) {
          params.push(`option_values=${optionValues.join(",")}`);
        }

        return `${url}?${params.join("&")}`;
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();
        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );
            callback(html);
          })
          .then(() => {
            // set focus to last clicked option value
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name === "AbortError") {
              console.log("Fetch aborted by user");
            } else {
              console.error(error);
            }
          });
      }

      updateOptionValues(html) {
        const variantSelects = html.querySelector("variant-picker");
        if (variantSelects) {
          HTMLUpdateUtility.viewTransition(
            this.variantSelectors,
            variantSelects,
            this.preProcessHtmlCallbacks
          );
        }
      }

      updateURL(url, variantId) {
        if (this.dataset.updateUrl === "false") return;
        window.history.replaceState(
          {},
          "",
          `${url}${variantId ? `?variant=${variantId}` : ""}`
        );
      }

      updateShareUrl(variantId) {
        if (!variantId) return;
        const shareButton = document.getElementById(
          `ShareButton-${this.dataset.section}`
        );
        if (!shareButton || !shareButton.updateUrl) return;
        shareButton.updateUrl(
          `${window.shopUrl}${this.dataset.url}?variant=${variantId}`
        );
      }

      updateVariantInputs(variantId) {
        document
          .querySelectorAll(
            `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
          )
          .forEach((productForm) => {
            const input = productForm.querySelector('input[name="id"]');
            input.value = variantId ?? "";
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });
      }

      updateButton(disable = true, text) {
        const productForm = document.getElementById(
          `product-form-${this.sectionId}`
        );
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        const addButtonText = productForm.querySelector(
          '[name="add"] > span:not(.f-icon)'
        );

        if (!addButton) return;
        if (disable) {
          addButton.setAttribute("disabled", "disabled");
          if (text) addButtonText.textContent = text;
        } else {
          addButton.removeAttribute("disabled");
          addButtonText.textContent = window.FoxThemeStrings.addToCart;
        }
      }

      updateMedia(variant) {
        if (!this.productMedia) return;

        if (this.variantGroupImages && this.variantGroupImages.enable) {
          const isCarousel = this.productMedia.querySelector(".flickity-slider")
            ? true
            : false;
          const initalMediaIds = this.productMedia?.domNodes?.medias.map(
            (item) => item.dataset.mediaId
          );
          const groupImages = this.variantGroupImages.mapping.find(
            (item) => Number(item.id) === variant.id
          );
          const currentVariantMedia = groupImages
            ? groupImages.media
            : this.allMediaIds;

          if (!this.areArraysEquivalent(currentVariantMedia, initalMediaIds)) {
            const mainMedia = this.productMedia.querySelector(
              ".f-product__media-list"
            );
            const thumbMedia = this.productMedia.querySelector(
              ".f-product__media-thumbnails"
            );
            if (isCarousel) {
              const mainFlickity = window.FoxTheme.Flickity.data(mainMedia);

              let mediaToRemove =
                mainMedia.querySelectorAll(".f-product__media");
              mediaToRemove &&
                mediaToRemove.forEach(function (slide) {
                  mainFlickity.remove(slide);
                });
              let mediaToShow = this.filteredMediaForSelectedVariant(
                this.productMedia.domNodes.medias,
                currentVariantMedia
              );

              mediaToShow.forEach(function (slide, index) {
                const zoomButton = slide.querySelector(".js-photoswipe--zoom");
                if (zoomButton) {
                  zoomButton.setAttribute("data-media-index", index);
                }
                slide.setAttribute("data-media-index", index);
                slide.setAttribute("data-index", index);
                mainFlickity.append(slide);
              });

              if (thumbMedia && this.productMedia.domNodes.thumbnailItems) {
                const thumbnailsFlickity =
                  window.FoxTheme.Flickity.data(thumbMedia);

                let thumbsToRemove = thumbMedia.querySelectorAll(
                  ".f-product__media-thumbnails-item"
                );
                thumbsToRemove &&
                  thumbsToRemove.forEach(function (slide) {
                    thumbnailsFlickity.remove(slide);
                  });

                let thumbsToShow = this.filteredMediaForSelectedVariant(
                  this.productMedia.domNodes.thumbnailItems,
                  currentVariantMedia
                );
                thumbsToShow.forEach(function (slide, index) {
                  slide.setAttribute("data-thumbnail-index", index);
                  slide.setAttribute("data-index", index);
                  thumbnailsFlickity.append(slide);
                });

                thumbMedia.classList.remove(
                  "disable-transition",
                  "md:disable-transition"
                );
                if (thumbsToShow.length < 5) {
                  thumbMedia.classList.add("disable-transition");
                }
                if (thumbsToShow.length < 6) {
                  thumbMedia.classList.add("md:disable-transition");
                }
                thumbnailsFlickity.option({
                  wrapAround: thumbsToShow.length > 5,
                });
                thumbnailsFlickity.reloadCells();
                thumbnailsFlickity.reposition();
              }

              mainFlickity.select(0, false, false);
            } else {
              let mediaToShow = this.filteredMediaForSelectedVariant(
                this.productMedia.domNodes.medias,
                currentVariantMedia
              );
              mainMedia.innerHTML = "";
              mediaToShow.forEach((item, index) => {
                const zoomButton = item.querySelector(".js-photoswipe--zoom");
                if (zoomButton) {
                  zoomButton.setAttribute("data-media-index", index);
                }
                item.setAttribute("data-media-index", index);
                item.setAttribute("data-index", index);
                mainMedia.append(item);
              });
            }

            // Re-init Photoswipe
            if (this.productMedia && this.productMedia.enableZoom) {
              this.productMedia.lightbox &&
                this.productMedia.lightbox.destroy();
              this.productMedia.initImageZoom();
            }
          }

          this.productMedia.removeAttribute("data-media-loading");
        } else {
          if (!variant.featured_media) return;
          if (typeof this.productMedia.setActiveMedia === "function") {
            this.productMedia.setActiveMedia(variant.featured_media.id);
          }
        }
      }

      setUnavailable() {
        this.updateButton(true, window.FoxThemeStrings.unavailable);

        const selectors = [
          "Price",
          "Inventory",
          "Sku",
          "PricePerItem",
          "VolumeNote",
          "Volume",
          "QuantityRules",
          "QuantityRulesCart",
        ]
          .map((id) => `#${id}-${this.sectionId}`)
          .join(", ");
        document
          .querySelectorAll(selectors)
          .forEach((selector) => selector.setAttribute("hidden", ""));
      }

      areArraysEquivalent(firstArray, secondArray) {
        if (!Array.isArray(firstArray) || !Array.isArray(secondArray)) {
          return false;
        }

        if (firstArray.length !== secondArray.length) {
          return false;
        }

        const sortedFirstArray = [...firstArray].sort();
        const sortedSecondArray = [...secondArray].sort();

        return sortedFirstArray.every(
          (value, index) => value === sortedSecondArray[index]
        );
      }

      filteredMediaForSelectedVariant(items, currentVariantMedia) {
        let index = 0;
        let prioritizedResults = [];
        let otherResults = [];
        items.forEach((item) => {
          const dataIdMedia = item.dataset.mediaId;
          if (currentVariantMedia && currentVariantMedia.length > 0) {
            if (currentVariantMedia.includes(dataIdMedia)) {
              item.dataset.index = index++;
              prioritizedResults.push(item);
            }

            if (item.dataset.mediaType !== "image") {
              item.dataset.index = index++;
              otherResults.push(item);
            }
          } else {
            item.dataset.index = index++;
            prioritizedResults.push(item);
          }
        });

        const sortByVariantOrder = (a, b) => {
          const indexA = currentVariantMedia.indexOf(a.dataset.mediaId);
          const indexB = currentVariantMedia.indexOf(b.dataset.mediaId);
          return indexA - indexB;
        };

        prioritizedResults.sort(sortByVariantOrder);

        const results = [...prioritizedResults, ...otherResults];

        return results;
      }

      initQuantityHandlers() {
        if (!this.quantityInput) return;

        this.setQuantityBoundries();
        if (!this.hasAttribute("data-original-section-id")) {
          this.cartUpdateUnsubscriber = FoxThemeEvents.subscribe(
            PUB_SUB_EVENTS.cartUpdate,
            this.fetchQuantityRules.bind(this)
          );
        }
      }

      setQuantityBoundries() {
        FoxThemeEvents.emit(PUB_SUB_EVENTS.quantityBoundries, {
          data: {
            sectionId: this.sectionId,
            productId: this.productId,
          },
        });
      }

      fetchQuantityRules() {
        const currentVariantId = this.productForm?.variantIdInput?.value;
        if (!currentVariantId) return;

        fetch(
          `${this.getAttribute(
            "data-product-url"
          )}?variant=${currentVariantId}&section_id=${this.sectionId}`
        )
          .then((response) => response.text())
          .then((responseText) => {
            const parsedHTML = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );
            this.updateQuantityRules(
              this.sectionId,
              this.productId,
              parsedHTML
            );
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {});
      }

      updateQuantityRules(sectionId, productId, parsedHTML) {
        if (!this.quantityInput) return;

        FoxThemeEvents.emit(PUB_SUB_EVENTS.quantityRules, {
          data: {
            sectionId,
            productId,
            parsedHTML,
          },
        });

        this.setQuantityBoundries();
      }
    }
  );
}
