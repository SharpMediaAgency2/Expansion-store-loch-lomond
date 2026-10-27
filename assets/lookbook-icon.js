if (!customElements.get('lookbook-icon')) {
	class LookbookIcon extends HTMLElement {
		constructor() {
			super();

			this.selectors = {
				cardProduct: '.f-lookbook-card__product',
				cardInner: '.f-lookbook-card__inner',
				cardContainer: '.f-lookbook-card'
			}

			this.domNodes = queryDomNodes(this.selectors, this)
			this.cardContainer = this.closest(this.selectors.cardContainer)
			this.cardInner = this.closest(this.selectors.cardInner)
			this.init()
			this.addEventListener('mouseover', this.init.bind(this))
		}

		disconnectedCallback() {
			this.removeEventListener('mouseover', this.init.bind(this))
		}

		init() {
			const { cardProduct } = this.domNodes

			if (cardProduct) {
				this.cardInnerOffsetX = this.cardInner.getBoundingClientRect().left
				this.cardInnerOffsetY = this.cardInner.getBoundingClientRect().top

				this.offsetX = this.getBoundingClientRect().left - this.cardInnerOffsetX
				this.offsetY = this.getBoundingClientRect().top - this.cardInnerOffsetY

				this.cardProductWidth = cardProduct.clientWidth
				this.cardProductHeight = cardProduct.clientHeight
				this.cardInnerWidth = this.cardInner.clientWidth
				
				if (this.offsetX > this.cardProductWidth) {
					cardProduct.style.left = 'auto'
					if ((this.cardInnerWidth - this.offsetY) < 15) {
						cardProduct.style.right = 'calc(-100% + 2rem)'
					} else {
						cardProduct.style.right = '-100%'
					}
				} else {
					cardProduct.style.right = 'auto'
					if ((this.cardInnerWidth - this.offsetX) > this.cardProductWidth) {
						if (this.offsetX < 15) {
							cardProduct.style.left = 'calc(-100% + 2rem)'
						} else {
							cardProduct.style.left = '-100%'
						}
					} else {
						cardProduct.style.left = this.cardInnerWidth - this.cardProductWidth - this.offsetX + 'px'
					}
				}

				if (this.offsetY > this.cardProductHeight) {
					cardProduct.style.top = 'auto'
					cardProduct.style.bottom = '100%'
				} else {
					cardProduct.style.bottom = 'auto'
					cardProduct.style.top = '100%'
				}
			}
		}
	}
	customElements.define('lookbook-icon', LookbookIcon);
}
if (!customElements.get('lookbook-card-slider')) {
	class LookbookCardSlider extends HTMLElement {

		constructor() {
			super();

			this.lookbookIcons = this.querySelectorAll('lookbook-icon')
			this.productCards = this.querySelectorAll('.product-card')
			this.slider = this.querySelector('flickity-component')
			this.currentActive = -1
			this.maxLength = this.productCards.length
			this.visibleIndex = [0,1]
			this.selectedIndex = 0
			this.itemsPerRow = parseInt(this.dataset.itemsPerRow);

			Array.from(this.lookbookIcons).forEach(icon => {
				icon.addEventListener('mouseover', this.onMouseOver.bind(this))
				icon.addEventListener('mouseleave', this.onMouseLeave.bind(this))
			})

			if (this.slider.slider) {
				this.slider.slider.instance.on('change', this.onSlideChange.bind(this))
			}
		}

		disconnectedCallback() {
			Array.from(this.lookbookIcons).forEach(icon => {
				icon.removeEventListener('mouseover', this.onMouseOver.bind(this))
				icon.removeEventListener('mouseleave', this.onMouseLeave.bind(this))
			})
		}

		onSlideChange(index) {
			this.selectedIndex = index
			Array.from(this.lookbookIcons).forEach(icon => icon.classList.remove('is-active'))
			this.lookbookIcons[index] && this.lookbookIcons[index].classList.add('is-active')
			this.slider.handlePaginateCounter(index)
		}

		onMouseOver(event) {
			event.target && event.target.classList.add('is-active')
			const index = Number(event.target.dataset.index)
			if (FoxThemeSettings.isMobile) {
				this.slider.select(index, false)
			} else {
				if (event.target.dataset.index && this.slider.slider && this.currentActive !== index && !this.visibleIndex.includes(index)) {
					this.slider.select(index, false)
				}
				const selectedIndex = this.slider.slider ? this.selectedIndex : index
				const product = this.productCards[index]
				product && product.classList.add('is-active')
				this.currentActive = selectedIndex
				this.classList.add('is-hovering')
				const secondIndex = selectedIndex + 1 >= this.maxLength ? 0 : selectedIndex + 1
				if (this.itemsPerRow > 1) {
					this.visibleIndex = [selectedIndex, secondIndex]
				} else {
					this.visibleIndex = [selectedIndex]
				}
			}
		}

		onMouseLeave(event) {
			Array.from(this.productCards).forEach(card => card.classList.remove('is-active'))
			Array.from(this.lookbookIcons).forEach(icon => icon.classList.remove('is-active'))
			this.classList.remove('is-hovering')
		}

	}
	customElements.define('lookbook-card-slider', LookbookCardSlider);
}
