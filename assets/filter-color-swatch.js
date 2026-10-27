if (!customElements.get('filter-color-swatch')) {
	class FilterColorSwatch extends HTMLElement {
		constructor() {
			super()
		}

		connectedCallback() {
			this.init()
		}

		init() {
			const {colorSwatches = []} = window.FoxThemeSettings
			const optionValue = this.dataset.value
			const customColor = colorSwatches.find(c => c.key.toLowerCase() === optionValue.toLowerCase())

			this.style.setProperty('--color-option', `${customColor ? customColor.value : optionValue.split(' ').pop().toLowerCase()}`)
		}
	}
	customElements.define('filter-color-swatch', FilterColorSwatch)
}
