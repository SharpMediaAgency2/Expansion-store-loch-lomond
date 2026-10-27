document.addEventListener('shopify:section:load', function(event) {
	const {target} = event

  target.querySelectorAll('script[src]').forEach((script) => {
    const s = document.createElement('script');
    s.src = script.src;
    document.body.appendChild(s);
  });

	const sliders = target.querySelectorAll('flickity-component')
	const pressNavs = target.querySelectorAll('press-nav-component')
	const slideshowComponent = target.querySelectorAll('slideshow-component')
	const imageWithTextSlider = target.querySelectorAll('image-with-text-slider')
	const collectionListSlider = target.querySelector('.collection-list-slider')

	sliders.forEach(slider => {
		setTimeout(() => {
			slider.update()
		}, 500)
	})

	if( collectionListSlider ) {
		sliders.forEach(slider => {
			setTimeout(() => {
				slider.update()
			}, 1200)
		})
	}

	pressNavs.forEach(nav => {
		setTimeout(() => {
			nav.update()
		}, 800)
	})

  slideshowComponent.forEach(slider => {
		setTimeout(() => {
      const currentIndex = slider.querySelector('.is-selected').dataset.index
			slider.removeAttribute('data-media-loading')
      slider.handleChange(parseInt(currentIndex))
		}, 500)
	})

  imageWithTextSlider.forEach(slider => {
		setTimeout(() => {
      const mainSlider = slider.querySelector('.f-slider__text')
      const currentIndex = mainSlider.querySelector('.is-selected').dataset.index
			slider.removeAttribute('data-media-loading')
      slider.handleChange(parseInt(currentIndex))
		}, 500)
	})

	__reInitTooltip(target);
});

document.addEventListener('shopify:block:select', function(event) {
	const {target} = event

	const slideClasses = [
		'f-press__text',
		'f-slideshow__slide',
		'f-slideshow__content',
		'f-favorite-products__block',
		'f-slider__content-wrapper',
		'collection-list-slider__slide'
	];
	slideClasses.some((slide) => {
		if (target.classList.contains( slide )) {
			const slider = target.closest('flickity-component')
			if (slider) {
				const index = Number(target.dataset.index)
				slider.select(index, true, false)
			}

			return true; // Break.
		}
	});
	
	const blockSelectedIsTab = target.classList.contains('f-tabs__content');
	if (blockSelectedIsTab) {
		const tabs = target.closest('tabs-component')
		tabs.setActiveTab(target.dataset.index)
	}

	const blockSelectedLookbook = target.classList.contains('f-lookbook-card');
	if (blockSelectedLookbook) {
		const lookbookIcons = target.querySelectorAll('lookbook-icon')
		lookbookIcons.forEach(lookbookIcon => {
			lookbookIcon.init()
		});
	}

	/**
	 * Selected on collapsible tab, collection tab.
	 */
	if ( target.classList.contains('collapsible__item') ) {
		target.open()
	}
});

// function initMobileSwiper() {
// 	const sliders = document.querySelectorAll('flickity-component')
// 	sliders.forEach(slider => {
// 		if (!slider.initialized) new window.FoxTheme.Slider(slider)
// 	})
// }
// if (FoxThemeSettings.isMobile) initMobileSwiper()

// document.addEventListener('matchMobile', initMobileSwiper)
