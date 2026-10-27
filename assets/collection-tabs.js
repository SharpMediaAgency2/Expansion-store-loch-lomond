if ( ! customElements.get('collection-tabs') ) {
	class CollectionTabs extends HTMLElement {
		constructor() {
			super()
			this.selectors = {
				images: [ '.f-collection-tab__image' ],
				collapsibleTabs: [ 'collapsible-tab' ]
			}
		}

		init() {
			this.domNodes = queryDomNodes(this.selectors, this)
			this.isPausing = false
			this.autoplay = this.dataset.autoplay && this.dataset.autoplay === 'true' ? true : false
			// Duration in secs.
			this.autoplayDuration = this.dataset.autoplayDuration ? parseInt(this.dataset.autoplayDuration) : 5
			this.autoplayTimer = null
			this.tabActiveIndex = 0
			this.totalTabs = this.domNodes.collapsibleTabs.length
			this.hoverToOpen = this.dataset.triggerBehavior && this.dataset.triggerBehavior === 'hover' && window.matchMedia("(hover: hover)").matches ? true : false
		}

		connectedCallback() {
			this.init()

			if( this.autoplay ) {
				this.style.setProperty( '--autoplay-duration', this.autoplayDuration + 's' )
				this.initAutoplay()

				window.FoxThemeEvents.subscribe('ON_COLLAPSIBLE_TAB_OPENED', (collapsibleTab) => {
					if( collapsibleTab.classList.contains('collection-tab') ) {
						const collectionTabs = collapsibleTab.closest('collection-tabs')
						collectionTabs && collectionTabs.onTabOpened( collapsibleTab )
					}
				})
				
				this.observer = new IntersectionObserver((entries, observer) => {
					entries.forEach(entry => {
						if (entry.isIntersecting) {
							this.isPausing = false
							this.openNextTab()
						} else {
							this.isPausing = true
							clearTimeout(this.autoplayTimer)
						}
					});
				})
				this.observer.observe(this)
			}
			
			window.FoxThemeEvents.subscribe('ON_COLLAPSIBLE_TAB_SELECTED', (collapsibleTab) => {
				if( collapsibleTab.classList.contains('collection-tab') ) {
					const collectionTabs = collapsibleTab.closest('collection-tabs')
					collectionTabs && collectionTabs.onElementSelected( collapsibleTab )
				}
			})

			if ( this.hoverToOpen ) {
				this.domNodes.collapsibleTabs.forEach( (collapsibleTab) => {
					collapsibleTab.addEventListener( 'mouseenter', this.onMouseEnterCollapsibleTabs.bind(this) )	
				})
			}
		}

		onElementSelected( collapsibleTab ) {
			this.domNodes.images && this.domNodes.images.forEach((image, index) => {
				if( collapsibleTab.dataset.blockId === image.dataset.blockId ) {
					this.tabActiveIndex = index
					image.classList.add( 'is-active' )
				} else {
					image.classList.remove( 'is-active' )
				}
			})
		}

		onTabOpened( collapsibleTab ) {
			if( ! this.isPausing ) {	
				this.initAutoplay()
			}
		}

		initAutoplay() {
			clearTimeout(this.autoplayTimer)
			this.autoplayTimer = setTimeout(() => {
				this.openNextTab()
			}, this.autoplayDuration * 1000 )
		}

		openNextTab() {
			this.tabActiveIndex = this.totalTabs <= this.tabActiveIndex + 1 ? 0 : this.tabActiveIndex + 1
			this.domNodes.collapsibleTabs[this.tabActiveIndex].toggle()
		}

		onMouseEnterCollapsibleTabs(event) {
			event.target.toggle(event)
		}

		disconnectedCallback() {
			this.observer && this.observer.disconnect()
			if ( this.hoverToOpen ) {
				this.domNodes.collapsibleTabs.forEach( (collapsibleTab) => {
					collapsibleTab.removeEventListener( 'mouseenter', this.onMouseEnterCollapsibleTabs.bind(this) )	
				})
			}
		}
	}
	customElements.define('collection-tabs', CollectionTabs)
}
