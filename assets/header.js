class BasicHeader extends HTMLElement {
  constructor() {
    super();
  }

  get headerSection() {
    return document.querySelector(".f-section-header");
  }

  connectedCallback() {
    this.classes = {
      active: "f-header__mega-active",
      headerScheme: this.dataset.headerColorScheme,
      dropdownScheme: this.dataset.dropdownColorScheme,
    };

    this.grandLinks = this.querySelectorAll(".f-site-nav__sub-item--has-child");
    this.grandLinks &&
      this.grandLinks.forEach((item) => {
        this.handleGrandLinksPosition(item);
      });
  }

  handleMegaItemActive(dropdown) {
    // Calculate backdrop height.
    const rect = dropdown.getBoundingClientRect();
    this.style.setProperty(
      "--f-dropdown-height",
      Math.ceil(rect.height) + "px"
    );

    this.classList.remove(this.classes.headerScheme);
    this.classList.add(this.classes.active, this.classes.dropdownScheme);
    document.documentElement.style.setProperty(
      "--f-header-height",
      this.clientHeight + "px"
    );
  }

  handleMegaItemDeactive() {
    this.classList.remove(this.classes.active, this.classes.dropdownScheme);
    this.classList.add(this.classes.headerScheme);
    document.documentElement.style.setProperty(
      "--f-header-height",
      this.clientHeight + "px"
    );
  }

  handleGrandLinksPosition(target) {
    const dropdownLV3 = target.querySelector(".f-site-nav__dropdown");
    if (dropdownLV3) {
      const rect = dropdownLV3.getBoundingClientRect();
      dropdownLV3.classList.remove("f-site-nav__dropdown-reversed");
      if (
        (!FoxThemeSettings.isRTL &&
          document.documentElement.clientWidth < rect.x + rect.width + 10) ||
        (FoxThemeSettings.isRTL && rect.x < 10)
      ) {
        dropdownLV3.classList.add("f-site-nav__dropdown-reversed");
      }
    }
  }
}
customElements.define("basic-header", BasicHeader, { extends: "header" });

class StickyHeader extends BasicHeader {
  constructor() {
    super();

    this.stickyClasses = {
      pinned: "header-pinned",
    };
  }

  connectedCallback() {
    super.connectedCallback();

    this.headerSection.classList.add("header-sticky");
    this.stickyType = this.dataset.stickyType;
    this.currentScrollTop = 0;

    this.headerBounds = this.headerSection
      .querySelector(".header")
      .getBoundingClientRect();

    this.onScrollHandler = this._onScroll.bind(this);
    this._onScroll();
    window.addEventListener("scroll", this.onScrollHandler, false);
  }

  disconnectedCallback() {
    window.removeEventListener("scroll", this.onScrollHandler);
  }

  get isAlwaysSticky() {
    return this.stickyType === "always";
  }

  _onScroll() {
    const scrollTop = window.scrollY;
    const headerSection = this.headerSection;

    // Avoid layout thrashing by caching values
    const headerBoundsTop = this.offsetTop + this.headerBounds.height;

    //const headerBoundsBottom =
      //this.headerBounds.top + this.headerBounds.height + 000;

    // Utilize batch CSS classes and updates
    requestAnimationFrame(() => {
      if (scrollTop > headerBoundsTop) {
        headerSection.classList.add("header-scrolled");

        if (this.isAlwaysSticky) {
          document.body.classList.add(this.stickyClasses.pinned);
        } else {
          // Sticky on scroll up.
          if (scrollTop < this.currentScrollTop) {
            document.body.classList.add(this.stickyClasses.pinned);
          } else {
            document.body.classList.remove(this.stickyClasses.pinned);
          }
        }
      } else {
        headerSection.classList.remove("header-scrolled");
        document.body.classList.remove(this.stickyClasses.pinned);
      }

      this.currentScrollTop = scrollTop;
    });
  }

  _closeMenuDisclosure() {
    this.disclosures =
      this.disclosures || this.header.querySelectorAll("header-menu");
    this.disclosures.forEach((disclosure) => disclosure.close());

    this.siteNav = this.siteNav || this.header.querySelector("site-nav");
    this.siteNav && this.siteNav.closeMegaDropdowns();
  }
}
customElements.define("sticky-header", StickyHeader, { extends: "header" });

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
  }

  connectedCallback() {
    this.header = this.closest(".site-header");
    this.classes = {
      itemActive: "f-menu__item-active",
    };
    this.header.timeoutEnter = null;
    this.header.timeoutLeave = null;
  }

  onToggle(evt) {
    const { target } = evt;
    const li = target.closest(".f-site-nav__item");
    const isOpen = this.mainDetailsToggle.open;
    const isMega = li.classList.contains("f-site-nav__item--mega");

    if (!isOpen) {
      clearTimeout(this.header.timeoutEnter);
      li.classList.remove(this.classes.itemActive);
      this.header.timeoutLeave = setTimeout(() => {
        this.header.handleMegaItemDeactive();
      }, 160);
    } else {
      if (isMega) {
        clearTimeout(this.header.timeoutLeave);
        const dropdown = li.querySelector(".f-site-nav__dropdown");
        this.header.handleMegaItemActive(dropdown);
        this.header.timeoutEnter = setTimeout(() => {
          li.classList.add(this.classes.itemActive);
        }, 160);
      } else {
        li.classList.add(this.classes.itemActive);
      }
    }
  }
}
customElements.define("header-menu", HeaderMenu);

class SiteNav extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.header = this.closest(".site-header");
    this.classes = {
      itemActive: "f-menu__item-active",
    };

    this.megaItems = this.querySelectorAll(".f-site-nav__item--mega");
    this.timeoutEnter = null;
    this.timeoutLeave = null;
    this.isHover =
      this.header &&
      this.header.classList.contains("show-dropdown-menu-on-hover");
    if (this.isHover) {
      this.megaItems &&
        this.megaItems.forEach((megaItem, index) => {
          megaItem.addEventListener("mouseenter", (evt) =>
            this.onMenuItemEnter(evt, index)
          );
          megaItem.addEventListener("mouseleave", (evt) =>
            this.onMenuItemLeave(evt, index)
          );
        });
    }
  }

  onMenuItemEnter(evt) {
    clearTimeout(this.timeoutLeave);

    const { target } = evt;

    /**
     * If hover from prev item to sibling items then need to close prev sub menu immediately.
     */
    if (!target.classList.contains(this.classes.itemActive)) {
      this.megaItems &&
        this.megaItems.forEach((megaItem) => {
          megaItem.classList.remove(this.classes.itemActive);
        });
    }

    const dropdown = target.querySelector(".f-site-nav__dropdown");

    if (dropdown) {
      this.header.handleMegaItemActive(dropdown);

      this.timeoutEnter = setTimeout(() => {
        target.classList.add(this.classes.itemActive);
      }, 160);
    }
  }

  onMenuItemLeave(evt) {
    const { target } = evt;

    clearTimeout(this.timeoutEnter);

    this.timeoutLeave = setTimeout(() => {
      target.classList.remove(this.classes.itemActive);
      this.header.handleMegaItemDeactive();
    }, 160);
  }

  closeMegaDropdowns() {
    clearTimeout(this.timeoutEnter);
    this.megaItems &&
      this.megaItems.forEach((megaItem) => {
        megaItem.classList.remove(this.classes.itemActive);
      });
    this.timeoutLeave = setTimeout(() => {
      this.header.handleMegaItemDeactive();
    }, 80);
  }

  disconnectedCallback() {
    this.megaItems &&
      this.megaItems.forEach((megaItem, index) => {
        megaItem.removeEventListener("mouseenter", (evt) =>
          this.onMenuItemEnter(evt, index)
        );
        megaItem.removeEventListener("mouseleave", (evt) =>
          this.onMenuItemLeave(evt, index)
        );
      });
  }
}
customElements.define("site-nav", SiteNav);
