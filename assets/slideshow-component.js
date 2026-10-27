if (!customElements.get("slideshow-component")) {
  class SlideshowComponent extends HTMLElement {
    constructor() {
      super()
      this.selectors = {
        contents: ['.f-slideshow__content-wrapper'],
        selected: '.selected',
        flickity: 'flickity-component',
        pageDots: '.flickity-page-dots',
        pageCounter: '.flickity-page-counter'
      }
      this.domNodes = queryDomNodes(this.selectors, this)
      this.prevIndex = 0
      this.init()
    }
    
    disconnectedCallback() {
      clearInterval(this.check)
    }

    init() {
      this.check = setInterval(() => {
        this.slider = this.domNodes.flickity.slider && this.domNodes.flickity.slider.instance
        if (this.slider && typeof this.slider == 'object') {
          clearInterval(this.check)
          this.removeAttribute('data-media-loading')
          this.slider.on('change', this.handleChange.bind(this))
          this.domNodes.contents[0].classList.add('selected')
          this.handleScreenChange()
          this.playVideo()
          if (this.domNodes.pageCounter) {
            this.domNodes.flickity.insertBefore(this.domNodes.pageCounter, null)
          }
        }
      }, 100)
    }

    handleChange(index) {
      const sliderCounterCurrent = this.querySelector('.flickity-counter--current')
      const slideContentCurrent = this.domNodes.contents[index];
      const currentTextColor = slideContentCurrent.dataset.textColor;
      this.style.setProperty('--slider-controls-color', currentTextColor);

      this.domNodes.contents.forEach(item => item.classList.remove('selected'))
      this.domNodes.contents[this.prevIndex].classList.add('f-slideshow__content--out')
      this.domNodes.contents[index].classList.add('selected')
      setTimeout(() => {
        this.domNodes.contents[this.prevIndex].classList.remove('f-slideshow__content--out')
        this.prevIndex = index
      }, 300)

      // Handle page counter
      if (this.domNodes.pageCounter && sliderCounterCurrent) {
        sliderCounterCurrent.textContent = index + 1
      }
      
      this.playVideo()
    }

    playVideo() {
      this.pauseAllMedia()
      const selectedElm = this.slider.selectedElement
      const deferredMedia = selectedElm.querySelector('deferred-media')
      if (deferredMedia) {
        deferredMedia.loadContent()
        const youtube = deferredMedia.querySelector('.js-youtube')
        const vimeo = deferredMedia.querySelector('.js-vimeo')
        const video = deferredMedia.querySelector('video')
        if (video) video.play()
        if (youtube) youtube.contentWindow.postMessage('{"event":"command","func":"' + 'playVideo' + '","args":""}', '*')
        if (vimeo) vimeo.contentWindow.postMessage('{"method":"play"}', '*')
      }
    }

    pauseAllMedia() {
      this.querySelectorAll(".js-youtube").forEach((video) => {
        video.contentWindow.postMessage(
          '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
          "*"
        );
      });
      this.querySelectorAll(".js-vimeo").forEach((video) => {
        video.contentWindow.postMessage('{"method":"pause"}', "*");
      });
      this.querySelectorAll("video").forEach((video) => video.pause());
    }

    handleScreenChange() {
      if (FoxThemeSettings.isMobile) {
        // this.domNodes.flickity.toggleFade()
      }
      document.addEventListener('matchMobile', () => {
        // this.domNodes.flickity.toggleFade()
      })
      document.addEventListener('unmatchMobile', () => {
        // this.domNodes.flickity.toggleFade(true)
      })
    }
  }

  customElements.define('slideshow-component', SlideshowComponent)
}