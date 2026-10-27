export default class Confetti {
  constructor(container) {
    this.confettiInterval = null;
    this.containerEl = null;

    this.confettiColors = ["#EF2964", "#00C09D", "#2D87B0", "#48485E", "#EFFF1D"];
    this.confettiAnimations = ["slow", "medium", "fast"];
    this.timeRun = 0;

    this.container = container;

    this.setupElement();
    this.render();
  }

  setupElement() {
    const containerEl = document.createElement("div");
    const elPosition = this.container.style.position;

    if (elPosition !== "relative" || elPosition !== "absolute") {
      this.container.style.position = "relative";
    }

    containerEl.classList.add("f-confetti-container");

    this.container.appendChild(containerEl);

    this.containerEl = containerEl;
  };

  stopConfetti() {
    clearInterval(this.confettiInterval);
    setTimeout(() => this.containerEl.remove(), 1500);
  };

  render() {
    this.confettiInterval = setInterval(() => {
      this.timeRun += 1;

      if (this.timeRun >= 160) this.stopConfetti();

      const confettiEl = document.createElement("div");
      const confettiSize = Math.floor(Math.random() * 3) + 7 + "px";
      const confettiBackground =
        this.confettiColors[
          Math.floor(Math.random() * this.confettiColors.length)
        ];
      const confettiLeft =
        Math.floor(Math.random() * this.container.offsetWidth) + "px";
      const confettiAnimation =
        this.confettiAnimations[
          Math.floor(Math.random() * this.confettiAnimations.length)
        ];

      confettiEl.classList.add(
        "f-confetti",
        "f-confetti--animation-" + confettiAnimation
      );
      confettiEl.style.left = confettiLeft;
      confettiEl.style.width = confettiSize;
      confettiEl.style.height = confettiSize;
      confettiEl.style.backgroundColor = confettiBackground;

      confettiEl.removeTimeout = setTimeout(function () {
        confettiEl.parentNode.removeChild(confettiEl);
      }, 3000);

      this.containerEl.appendChild(confettiEl);
    }, 20);
  };
}
