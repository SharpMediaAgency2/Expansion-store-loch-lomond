class ProductGridContainer extends HTMLElement {
	constructor() {
		super()
		this.selectors = {
			container: '#ProductGridContainer',
			paginate: '[data-paginate]',
			btnLoadmore: '[data-load-more]',
			productGrid: '[data-products-grid]',
			columnSelector: '.column-switcher button',
		}
	}

	connectedCallback() {
		this.init()
	}

	init() {
		this.container = this.closest(this.selectors.container)
		this.sectionId = this.dataset.sectionId
		this.domNodes = queryDomNodes(this.selectors, this)
		this.infiniteLoadingObserver = null
		this.currentPage = 1
		this.save_key = 'foxtheme:grid-columns'

		this.initLoadMore()
		this.columnSwitcher()
	}

	initLoadMore() {
		const {paginate} = this.domNodes
		if (!paginate) return
		this.paginateType = paginate.dataset.paginate
		this.totalPages = Number(paginate.dataset.totalPages)

		if (this.paginateType === 'number' || this.totalPages <= 1) return

		const { btnLoadmore } = this.domNodes
		addEventDelegate({
			selector: this.selectors.btnLoadmore,
			handler: e => {
				e.preventDefault()
				this.loadMoreProducts()
			}
		})

		if (this.paginateType === 'infinite') {
			this.infiniteLoadingObserver = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					if (entry.intersectionRatio === 1) this.loadMoreProducts()
				});
			}, { threshold: 1 });

			this.infiniteLoadingObserver.observe(btnLoadmore)
		}
	}

	//TODO: Re-check after filter
	loadMoreProducts() {
		const productGrid = document.querySelector(this.selectors.productGrid)
		const btnLoadmore = document.querySelector(this.selectors.btnLoadmore)
		const nextPage = this.currentPage + 1
		if (nextPage > this.totalPages) return

		this.toggleLoading(true, btnLoadmore)
		fetchSection(this.sectionId, { fromCache: true, params: { page: nextPage } })
			.then(html => {
				const productNodes = html.querySelectorAll('[data-products-grid] .f-column')
				productNodes.forEach(prodNode => productGrid.appendChild(prodNode))
			})
			.catch(err => console.error(`Failed to load more products.`, err))
			.finally(() => {
				this.toggleLoading(false, btnLoadmore)
				this.currentPage = nextPage
				if (nextPage >= this.totalPages) {
					btnLoadmore.parentNode.remove()
					if (this.infiniteLoadingObserver) {
						this.infiniteLoadingObserver.unobserve(btnLoadmore)
					}
				}
			})
	}

	toggleLoading(loading, btnLoadmore) {
		if (btnLoadmore) {
			const method = loading ? 'add' : 'remove'
			btnLoadmore.classList[method]('btn--loading')
		}
	}

	columnSwitcher() {
		const data = localStorage.getItem(this.save_key)
		if (!window.FoxThemeSettings.designMode && '1,2'.includes(data)) this.setColumn(data)

		addEventDelegate({
			selector: this.selectors.columnSelector,
			context: this,
			handler: (e, target) => {
				e.preventDefault()
				const {column} = target.dataset
				this.setColumn(column)
			}
		})

	}

	setColumn(column) {
		const productGrid = document.querySelector(this.selectors.productGrid)
		if (!productGrid) return
		const target = this.querySelector('.column-switcher button[data-column="'+ column +'"]')
		const selected = this.querySelector('.column-switcher button[aria-selected="true"]')
		if (selected) {
			selected.removeAttribute('aria-selected')
		}
		target.setAttribute('aria-selected', true)

		if (column === '2') {
			productGrid.classList.add('f-grid-2-cols');
			productGrid.classList.remove('f-grid-1-cols');
		} else {
			productGrid.classList.remove('f-grid-2-cols');
			productGrid.classList.add('f-grid-1-cols');
		}

		localStorage.setItem(this.save_key, column)
	}
}

customElements.define('product-grid-container', ProductGridContainer)
