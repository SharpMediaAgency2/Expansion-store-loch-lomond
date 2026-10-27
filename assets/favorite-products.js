class FavoriteProducts extends HTMLElement {
	constructor() {
		super()
		this.selectors = {
			images: ['.f-favorite-products__image'],
			selected: '.is-selected',
			flickity: 'flickity-component'
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
				this.slider.on('change', this.handleChange.bind(this))
				this.domNodes.images[0].classList.add('is-selected')
			}
		}, 100)
	}

	handleChange(index) {
		const selected = this.querySelectorAll(this.selectors.selected)
		selected.forEach(item => item.classList.remove('is-selected'))
		this.domNodes.images[this.prevIndex].classList.add('fade-out')
		setTimeout(() => {
			this.domNodes.images[index].classList.add('is-selected')
			this.domNodes.images[this.prevIndex].classList.remove('fade-out')
			this.prevIndex = index
		}, 50)
	}
}

customElements.define('favorite-products', FavoriteProducts)
