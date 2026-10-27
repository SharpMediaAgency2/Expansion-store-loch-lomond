function triggerAfterScroll(offset = 500, trigger) {
  let opened = false;
  const start = scrollY;
  window.addEventListener("scroll", (e) => {
    let scrollTop =
      window.pageYOffset ||
      (document.documentElement || document.body.parentNode || document.body)
        .scrollTop;
    if (scrollTop - start > offset && !opened) {
      trigger();
      opened = true;
      return;
    }
  });
}

function triggerAfterDelay(delay = 5, trigger) {
  setTimeout(() => trigger(), parseInt(delay) * 1000);
}

function exitIntent(trigger) {
  function onMouseOut(event) {
    // If the mouse is near the top of the window, show the popup
    // Also, do NOT trigger when hovering or clicking on selects
    const shouldShowExitIntent =
      !event.toElement &&
      !event.relatedTarget &&
      event.clientY < 50 &&
      event.target.nodeName.toLowerCase() !== "select";

    if (shouldShowExitIntent) {
      // Remove this event listener
      document.removeEventListener("mouseout", onMouseOut);
      // Show the popup
      trigger();
    }
  }

  document.addEventListener("mouseout", onMouseOut);
}

function setRepeatOpen(saveKey, saveValue, repeat) {
  let expires;
  switch (repeat) {
    case "no_repeat":
      expires = 365;
      break;
    case "every_3_mins":
      expires = 3 / 60 / 24;
      break;
    case "every_5_mins":
      expires = 5 / 60 / 24;
      break;
    case "every_10_mins":
      expires = 1 / 6 / 24;
      break;
    case "every_15_mins":
      expires = 15 / 60 / 24;
      break;
    case "every_30_mins":
      expires = 1 / 2 / 24;
      break;
    case "every_1_hr":
      expires = 1 / 24;
      break;
    case "every_6_hrs":
      expires = 6 / 24;
      break;
    case "every_12_hrs":
      expires = 1 / 2;
      break;
    case "every_day":
      expires = 1;
      break;
    case "every_3_days":
      expires = 3;
      break;
    case "every_week":
      expires = 7;
      break;
    case "every_2_week":
      expires = 14;
      break;
    case "every_month":
      expires = 30;
      break;
    default:
      expires = 7;
      break;
  }
  setCookie(saveKey, JSON.stringify(saveValue), expires);
}

function copyToClipboard(value, button, text) {
  navigator.clipboard.writeText(value);
  if (button) {
    button.classList.add("copied");
    if (text) button.innerText = text;
  }
}

class Popup extends HTMLElement {
  static get observedAttributes() {
    return ["data-trigger-open", "data-repeat-open"];
  }
  constructor() {
    super();

    this.triggerOpen = this.dataset.triggerOpen;
    this.repeatOpen = this.dataset.repeatOpen;
    this.saveKey = "__foxtheme_popup";

    this.handleOpen();
    this.handleClose();
    this.handleCopy();

    this.addEventListener("keyup", (e) => {
      if (e.code.toUpperCase() === "ESCAPE") {
        this.close();
      }
    });

    this.elementToFocus = this.querySelector('[role="dialog"]');
  }

  reset() {
    if (window.FoxThemeSettings.designMode) {
      let cookieData = getCookie(this.saveKey);
      if (cookieData) {
        setCookie(this.saveKey, "");
      }
    }
  }

  open(opener) {
    this.openedBy = opener;
    this.setAttribute("open", "true");
    this.removeAttribute("hidden");

    document.body.classList.add("prevent-scroll");
    document.body.style.paddingRight = getScrollbarWidth() + "px";
    trapFocus(this, this.elementToFocus);
    if (!window.FoxThemeSettings.designMode) {
      setRepeatOpen(this.saveKey, { opened: true }, this.repeatOpen);
    }
  }

  close(e) {
    if (e) {
      e.preventDefault();
    }
    removeTrapFocus(this.openedBy);
    this.setAttribute("closing", "true");
    this.setAttribute("hidden", "");
    setTimeout(() => {
      this.removeAttribute("open");
      this.removeAttribute("closing");
      document.body.classList.remove("prevent-scroll");
      document.body.style.paddingRight = "";
    }, 300);
  }

  handleOpen() {
    if (window.FoxThemeSettings.designMode) return;
    let cookieData = getCookie(this.saveKey);
    if (cookieData) cookieData = JSON.parse(cookieData);

    // Don't show popup
    if (cookieData && cookieData.opened) {
      return false;
    }

    if (this.triggerOpen === "delay") {
      triggerAfterDelay(10, this.open.bind(this));
    } else if (this.triggerOpen === "scroll_down") {
      triggerAfterScroll(700, this.open.bind(this));
    } else if (
      this.triggerOpen === "exit_intent" &&
      !FoxThemeSettings.isMobile
    ) {
      exitIntent(this.open.bind(this));
    } else {
      this.open();
    }
  }

  handleClose() {
    addEventDelegate({
      selector: "popup-component",
      handler: (e) => {
        if (!e) return false;
        if (e.target === this || e.target.closest(".f-popup__close")) {
          this.close(e);
        }
      },
    });
  }

  handleCopy() {
    addEventDelegate({
      context: this,
      selector: ".btn-apply",
      handler: async (e, target) => {
        e.preventDefault();
        const code = target.dataset.code;
        if (code) copyToClipboard(code, target);
      },
    });
  }
}

customElements.define("popup-component", Popup);

class TeaserButton extends HTMLElement {
  constructor() {
    super();
    const popup = document.querySelector("popup-component");
    if (popup) {
      this.querySelector("button").addEventListener("click", () =>
        popup.open(this.querySelector("button"))
      );
    }
  }
}
customElements.define("teaser-button", TeaserButton);
