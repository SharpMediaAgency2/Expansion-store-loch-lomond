if (!customElements.get("collections-showcase")) {
  class CollectionsShowcase extends HTMLElement {
    constructor() {
      super();

      this.selectors = {
        titles: [".collections-showcase__title"],
        contents: [".collections-showcase__content"],
      };

      this.classes = {
        isActive: "is-active",
      };

      this.elements = queryDomNodes(this.selectors, this);

      this.currentIndex = 0;
      this.hoverTracker = null;
    }

    connectedCallback() {
      if (this.elements.titles) {
        this.elements.titles.forEach((item) => {
          item.addEventListener("click", this.onClick.bind(this));
          item.addEventListener("mouseover", this.onMouseOver.bind(this));
          item.addEventListener("focus", this.onMouseOver.bind(this));
        });
      }

      if (Shopify.designMode) {
        document.addEventListener("shopify:block:select", (event) => {
          if (event.detail.sectionId != this.dataset.sectionId) return;
          const { target } = event;
          const index = Number(target.dataset.index);
          this.setActiveTab(index);
        });
      }
    }

    isSelected(el) {
      return el.classList.contains(this.classes.isActive);
    }

    onMouseOver(event) {
      const target = event.currentTarget;
      const index = Number(target.dataset.index);

      clearTimeout(this.hoverTracker);
      this.hoverTracker = setTimeout(() => {
        if (target.classList.contains(this.classes.isActive)) return;

        this.setActiveTab(index);
      }, 100);
    }

    onClick(event) {
      const target = event.currentTarget;
      const index = Number(target.dataset.index);

      if ("ontouchstart" in window) {
        if (target.classList.contains(this.classes.isActive)) return;
        this.setActiveTab(index);
      } else {
        const url = target.dataset.url;
        if (url) {
          window.location.href = url;
        }
      }
    }

    setActiveTab(newIndex) {
      if (this.currentIndex == newIndex) {
        return;
      }

      const newTitle = this.elements.titles[newIndex];
      const newContent = this.elements.contents[newIndex];

      this.elements.titles.forEach((el) => {
        el.setAttribute("aria-selected", el === newTitle);
        el.classList.remove(this.classes.isActive);
      });

      this.elements.contents.forEach((el) => {
        el.hidden = el !== newContent;
        el.classList.remove(this.classes.isActive);
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newTitle.classList.add(this.classes.isActive);
          newContent.classList.add(this.classes.isActive);
        });
      });

      this.currentIndex = newIndex;
    }

    disconnectedCallback() {}
  }
  customElements.define("collections-showcase", CollectionsShowcase);
}
