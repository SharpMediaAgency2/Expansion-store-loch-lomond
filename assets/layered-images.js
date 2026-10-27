if (!customElements.get("layered-images")) {
  class LayeredImages extends HTMLElement {
    constructor() {
      super();

      this.selectors = {
        row: ".layered-images__row",
        image: ".layered-images__image",
        content: ".layered-images__content",
        nav: ".layered-images__nav",
      };

      this.classes = {
        bulletActive: "is-active",
      };
    }

    connectedCallback() {
      this.rows = Array.from(this.querySelectorAll(this.selectors.row));
      this.images = Array.from(this.querySelectorAll(this.selectors.image));
      this.contents = Array.from(this.querySelectorAll(this.selectors.content));
      this.navEl = this.querySelector(this.selectors.nav);
      this.bullets = Array.from(this.navEl.querySelectorAll("span"));

      this.onBulletClickHandler = this.onBulletClick.bind(this);
      this.bullets &&
        this.bullets.forEach((bullet) =>
          bullet.addEventListener("click", this.onBulletClickHandler)
        );

      this.totalRows = this.rows.length;

      !window.FoxThemeSettings.isMobile && this.initScroll();
      this.unmatchMobileHandler = this.initScroll.bind(this);
      this.matchMobileHandler = this.destroyScroll.bind(this);
      document.addEventListener("unmatchMobile", this.unmatchMobileHandler);
      document.addEventListener("matchMobile", this.matchMobileHandler);
    }

    disconnectedCallback() {
      document.removeEventListener("unmatchMobile", this.unmatchMobileHandler);
      document.removeEventListener("matchMobile", this.matchMobileHandler);

      this.bullets &&
        this.bullets.forEach((bullet) =>
          bullet.removeEventListener("click", this.onBulletClickHandler)
        );
    }

    initScroll() {
      gsap.registerPlugin(ScrollTrigger);

      this.initImageTimeline();
      this.initContentTimeline();
      this.initNavTimeline();
      this.initNavBulletsTimeline();
    }

    initImageTimeline() {
      this.images.forEach((imageEl, index) => {
        const itemRect = imageEl.getBoundingClientRect();
        const lastItem = this.images[this.totalRows - 1];
        const lastItemRect = lastItem.getBoundingClientRect();

        const translateX = (this.totalRows - (index + 1)) * 20;

        // const sectionGap = 100;
        // const sectionHeight = this.offsetHeight;
        // const translateY =
        // sectionHeight -
        // sectionGap - (imageEl.offsetTop + imageEl.offsetHeight) - extraY

        const extraY = (this.totalRows - (index + 1)) * -20;
        const translateY = lastItemRect.top - itemRect.top + extraY;

        gsap
          .timeline({
            scrollTrigger: {
              trigger: imageEl,
              start: "center center",
              endTrigger: lastItem,
              end: "center center",
              scrub: 1,
            },
          })
          .to(imageEl, {
            x: translateX,
            y: translateY,
            ease: "none",
          });
      });
    }

    initContentTimeline() {
      const animationSettings = {
        opacity: 0,
        ease: "power1.inOut",
      };
      this.contents.forEach((contentEl, index) => {
        // Fade-in.
        if (index > 0) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: contentEl,
                start: "center bottom", // bottom 66%
                end: "center center", // bottom top
                scrub: 1,
              },
            })
            .from(contentEl, { ...animationSettings });
        }

        // Fade-out.
        if (index < this.totalRows - 1) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: contentEl,
                start: "center center",
                end: "center top",
                scrub: 1,
              },
            })
            .to(contentEl, { ...animationSettings });
        }
      });
    }

    initNavTimeline() {
      const firstImageRect = this.images[0].getBoundingClientRect();
      this.style.setProperty("--img-height", firstImageRect.height + "px");

      const firstRow = this.rows[0],
        lastRow = this.rows[this.totalRows - 1],
        translateY =
          lastRow.getBoundingClientRect().top -
          firstRow.getBoundingClientRect().top;

      gsap
        .timeline({
          scrollTrigger: {
            trigger: firstRow,
            start: "center center",
            endTrigger: lastRow,
            end: "center center",
            scrub: 1,
          },
        })
        .to(this.navEl, {
          y: translateY,
          ease: "none",
        });
    }

    initNavBulletsTimeline() {
      for (let i = 0, l = this.rows.length; i < l; i++) {
        gsap.timeline({
          scrollTrigger: {
            trigger: this.rows[i],
            start: "top ".concat(i === 0 ? "bottom" : "center"),
            endTrigger: this.rows[i + (i === l ? 0 : 1)],
            end: i === l - 1 ? "bottom top" : "top center",
            onToggle: () => {
              this.bullets[i].classList.toggle(this.classes.bulletActive);
            },
          },
        });
      }
    }

    onBulletClick(event) {
      event.preventDefault();
      const { target } = event;

      const index = Number(target.dataset.index);
      const rowEl = this.rows[index];
      const clientRect = rowEl.getBoundingClientRect();
      const scrollTop =
        window.scrollY +
        clientRect.top -
        (window.innerHeight - clientRect.height) / 2;

      window.scrollTo({ top: scrollTop, behavior: "smooth" });
    }

    destroyScroll() {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill()); // Remove events

      this.images.forEach((imageEl) => imageEl.removeAttribute("style"));
      this.contents.forEach((imageEl) => imageEl.removeAttribute("style"));
      this.navEl && this.navEl.removeAttribute("style");
    }
  }
  customElements.define("layered-images", LayeredImages);
}
