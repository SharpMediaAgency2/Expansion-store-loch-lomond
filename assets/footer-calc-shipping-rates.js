if (!customElements.get('calc-shipping-rate-block')) {
	function calculateShipping(button, container, zipCode, country, province) {
		const Notification = window.FoxTheme.Notification
		container.innerHTML = ''
		fetch(`/cart/shipping_rates.json?shipping_address%5Bzip%5D=${zipCode}&shipping_address%5Bcountry%5D=${country}&shipping_address%5Bprovince%5D=${province}`)
			.then(res => res.json())
			.then(res => {
				if (res && res.shipping_rates) {
					const { shipping_rates } = res
					const { shippingRatesResult, noShippingRate } = window.FoxThemeStrings
					if (shipping_rates.length > 0) {
						const html = `${shippingRatesResult.replace('{{count}}', shipping_rates.length)}:`
						const text = generateDomFromString(html, 'p')
						text.classList.add('font-bold')

						container.appendChild(text)
						shipping_rates.map(rate => {
							const html = `${rate.name}: <strong>${formatMoney(rate.price, window.FoxThemeSettings.money_format)}</strong>`
							const message = generateDomFromString(html, 'p')
							container.appendChild(message)
						})
					} else {
						container.innerHTML = `<p>${noShippingRate}</p>`
					}
				} else {
					Object.entries(res).map(error => {
						Notification.show({
							target: container,
							method: 'appendChild',
							type: 'warning',
							message: error[1][0],
							last: 3000
						})
					})
				}
			})
			.catch(console.error)
			.finally(() => button.classList.remove('btn--loading'))
	}

	customElements.define('calc-shipping-rate-block', class FooterCalcShippingRates extends HTMLElement {
		constructor() {
			super()
			this.selectors = {
				button: '.btn-calc',
				zipCode: '[name="address[zip]"]',
				province: '[name="address[province]"]',
				country: '[name="address[country]"]',
				shippingRates: '.f-cart-drawer__shipping-message',
				countries: 'template'
			}
			this.initAddress = false
			this.domNodes = queryDomNodes(this.selectors, this)
			this.collapsibleTab = this.querySelector('collapsible-tab')

			this.domNodes.button.addEventListener('click', this.fetchRates.bind(this))
			if (this.collapsibleTab) {
				setTimeout(() => {
					this.collapsibleTab.on('tabOpened', this.setupCountries.bind(this))
				}, 1000)
			}
			this.querySelector('.btn-cancel').addEventListener('click', this.handleClose.bind(this))
		}

		fetchRates(e) {
			e.preventDefault()
			this.domNodes.button.classList.add('btn--loading')
			const {zipCode, country, province} = this.domNodes
			calculateShipping(this.domNodes.button, this.domNodes.shippingRates, zipCode.value.trim(), country.value, province.value)
		}

		setupCountries() {
			if (this.initAddress) return false;
			this.domNodes.country.innerHTML = this.domNodes.countries.innerHTML
			if (Shopify && Shopify.CountryProvinceSelector) {
				// eslint-disable-next-line no-new
				new Shopify.CountryProvinceSelector(
					"AddressCountry",
					"AddressProvince",
					{
						hideElement: "AddressProvinceContainer",
					}
				);
				this.initAddress = true
			}
		}

		handleClose(e) {
			e.preventDefault()
			if (this.collapsibleTab) this.collapsibleTab.close()
		}
	})
}
