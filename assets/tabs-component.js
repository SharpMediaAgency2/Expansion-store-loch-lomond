if (!customElements.get("tabs-component")) {
  class Tabs extends HTMLElement {
    constructor() {
      super();
      this.selectors = {
        tabHeader: '[role="tablist"]',
        tabPanels: ['[role="tabpanel"]'],
        tabNavs: ['[role="tab"]'],
        tabSelect: "tab-selector",
      };
      this.domNodes = queryDomNodes(this.selectors, this);

      this.Collapsible = null;
      this.selectedIndex = 0;
      this.selectedTab = this.domNodes.tabPanels[this.selectedIndex];
    }

    connectedCallback() {
      this.init();
      this.setActiveTab(0);

      this.tabChange = new CustomEvent("tabChange", {
        bubbles: true,
        detail: { selectedTab: this.selectedTab },
      });
    }

    init = () => {
      this.domNodes.tabNavs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
          e.preventDefault();
          const index = e.target ? Number(e.target.dataset.index) : -1;
          this.setActiveTab(index);
        });
      });

      this.domNodes.tabHeader &&
        this.domNodes.tabHeader.addEventListener(
          "keydown",
          this.handleKeyDown.bind(this)
        );
      this.setAccessible();
    };

    setActiveTab = (tabIndex) => {
      const { tabNavs, tabPanels, tabSelect } = this.domNodes;
      if (tabIndex !== -1) {
        const newHeader = tabNavs && tabNavs[tabIndex];
        const newTab = tabPanels && tabPanels[tabIndex];
        this.setAttribute("data-selected", tabIndex);

        tabNavs.forEach((nav) => nav.setAttribute("aria-selected", false));
        this.selectedTab && this.selectedTab.setAttribute("hidden", "");

        if (newHeader) {
          newHeader.setAttribute("aria-selected", true);
        }

        newTab && newTab.removeAttribute("hidden");

        this.selectedIndex = tabIndex;
        this.selectedTab = newTab;

        this.dispatchEvent(
          new CustomEvent("tabChange", {
            bubbles: true,
            detail: { selectedIndex: tabIndex, selectedTab: newTab },
          })
        );

        if (this.isMobile && this.isMobile.matches && this.Collapsible) {
          this.Collapsible.toggle(this.Collapsible.els[tabIndex]);
        }

        if (tabSelect) {
          tabSelect.querySelector("select").value = tabIndex;
        }

        const motionEls = newTab.querySelectorAll("motion-element");
        motionEls.forEach((motionEl) => {
          typeof motionEl.refreshAnimation === "function" &&
            motionEl.refreshAnimation();
        });

        const gridListEls = newTab.querySelectorAll("grid-list");
        gridListEls.forEach((gridList) => {
          typeof gridList.showGridItems === "function" &&
            gridList.showGridItems();
        });

        const sliderEls = newTab.querySelectorAll("flickity-component");
        sliderEls &&
          sliderEls.forEach((sliderEl) => {
            /**
             * Because we set groupCells: true so we need to destroy & re-init instead of call update
             * To avoid slide can't draggable on hidden tab.
             */
            if (tabIndex != 0 && sliderEl.isReInitSliderInTab !== true) {
              typeof sliderEl.destroy === "function" && sliderEl.destroy();
              typeof sliderEl.init === "function" && sliderEl.init();
            } else {
              typeof sliderEl.update === "function" && sliderEl.update();
              if (sliderEl.slider) {
                sliderEl.slider.calcArrowsPos();
              }
            }

            sliderEl.isReInitSliderInTab = true;
          });
      }
    };

    setAccessible() {
      const { tabNavs, tabPanels } = this.domNodes;

      tabNavs &&
        tabNavs.forEach((tab, index) => {
          if (tab.id) tabPanels[index].setAttribute("aria-labelledby", tab.id);
          tab.setAttribute("aria-selected", index === 0);
          tab.setAttribute("data-index", index);
          if (index !== 0) {
            tab.setAttribute("tabindex", -1);
          }
        });
      tabPanels.forEach((panel, index) => {
        if (panel.id && tabNavs.length > 0) {
          tabNavs[index].setAttribute("aria-controls", panel.id);
        }

        panel.setAttribute("tabindex", 0);
      });
    }

    handleKeyDown(e) {
      const { tabNavs } = this.domNodes;
      if (e.keyCode === 39 || e.keyCode === 37) {
        tabNavs[this.selectedIndex].setAttribute("tabindex", -1);
        if (e.keyCode === 39) {
          this.selectedIndex++;
          // If we're at the end, go to the start
          if (this.selectedIndex >= tabNavs.length) {
            this.selectedIndex = 0;
          }
          // Move left
        } else if (e.keyCode === 37) {
          this.selectedIndex--;
          // If we're at the start, move to the end
          if (this.selectedIndex < 0) {
            this.selectedIndex = tabNavs.length - 1;
          }
        }

        tabNavs[this.selectedIndex].setAttribute("tabindex", 0);
        tabNavs[this.selectedIndex].focus();
      }
    }

    getSelected() {
      return {
        index: this.selectedIndex,
        element: this.selectedTab,
      };
    }
  }

  customElements.define("tabs-component", Tabs);
}

if (!customElements.get("tab-selector")) {
  class TabSelector extends HTMLElement {
    constructor() {
      super();

      this.tabs = this.closest("tabs-component");

      this.querySelector("select").addEventListener("change", (e) => {
        this.tabs.setActiveTab(e.target.value);
      });
    }
  }
  customElements.define("tab-selector", TabSelector);
}
