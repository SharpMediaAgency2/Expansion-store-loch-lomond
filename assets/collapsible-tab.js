if (!customElements.get('collapsible-tab')) {
	class CollapsibleTab extends HTMLElement {
		constructor() {
			super()
		}

		connectedCallback() {
			this.init()
		}

		disconnectedCallback() {
			this.destroy()
		}

		init() {
			const destroy = this.dataset.destroy === 'true'
			if (destroy) return

			this.setDefaultData();
			this.attachEvents()

			if (this.getAttribute('open') === 'true') {
				this.selected = true
				this.classList.add(this.expandedClass, this.selectedClass)
				this.setExpandedAria()
				this.fire("tabOpened")
				window.FoxThemeEvents.emit(`ON_COLLAPSIBLE_TAB_OPENED`, this)
			} else {
				this.content.style.height = this.collapsedHeight
				this.classList.add(this.collapsedClass)
				this.setCollapsedAria()
			}
			this.content.removeAttribute('hidden')
		}

		transitionendEventName() {
			let i,
				el = document.createElement('div'),
				transitions = {
					'transition': 'transitionend',
					'OTransition': 'otransitionend',
					'MozTransition': 'transitionend',
					'WebkitTransition': 'webkitTransitionEnd'
				}

			for (i in transitions) {
				if (transitions.hasOwnProperty(i) && el.style[i] !== undefined) {
					return transitions[i]
				}
			}
		}

		expand() {
			const resetHeight = (ev) => {
				if (ev.target !== this.content) return
				this.content.removeEventListener(this.transitionendevent, bindEvent)

				if (!this.isOpen) return

				requestAnimationFrame(() => {
					this.content.style.transition = '0'
					this.content.style.height = 'auto'

					requestAnimationFrame(() => {
						this.content.style.height = null
						this.content.style.transition = null

						this.setExpandedAria()
						this.classList.add(this.expandedClass)
						this.trySetTabIndex(this.content, 0)

						this.fire("tabOpened")
						window.FoxThemeEvents.emit(`ON_COLLAPSIBLE_TAB_OPENED`, this)
					})
				})
			}

			const bindEvent = resetHeight.bind(this)
			this.content.addEventListener(this.transitionendevent, bindEvent)

			this.isOpen = true
			this.classList.remove(this.collapsedClass)
			this.content.style.height = this.content.scrollHeight + "px"
		}

		collapse() {
			const endTransition = (ev) => {
				if (ev.target !== this.content) return
				this.content.removeEventListener(this.transitionendevent, bindEvent)

				if (this.isOpen) return

				this.fire("elementClosed")
				window.FoxThemeEvents.emit(`ON_COLLAPSIBLE_TAB_CLOSED`, this)
				this.setCollapsedAria()
				this.classList.add(this.collapsedClass)
				this.trySetTabIndex(this.content, -1)
			}

			const bindEvent = endTransition.bind(this)
			this.content.addEventListener(this.transitionendevent, bindEvent)

			this.isOpen = false
			this.classList.remove(this.expandedClass)

			requestAnimationFrame(() => {
				this.content.style.transition = '0'
				this.content.style.height = this.content.scrollHeight + "px"


				requestAnimationFrame(() => {
					this.content.style.transition = null
					this.content.style.height = this.collapsedHeight
				})
			})
		}

		open() {
			this.selected = true
			this.classList.add(this.selectedClass)
			this.fire("elementSelected")
			window.FoxThemeEvents.emit(`ON_COLLAPSIBLE_TAB_SELECTED`, this)
			this.expand()
			this.setAttribute('open', true)

			if (this.oneAtATime) {
				const parent = this.closest('[data-collapsible-parent]')
				if( parent ) {
					const allItems = parent.querySelectorAll('collapsible-tab')
					if (allItems.length) {
						allItems.forEach(item => {
							if (item !== this && item.selected) {
								item.close()
							}
						})
					}
				}
			}
		}

		close() {
			this.selected = false
			this.classList.remove(this.selectedClass)
			this.fire("elementUnselected")
			window.FoxThemeEvents.emit(`ON_COLLAPSIBLE_TAB_UNSELECTED`, this)
			this.collapse()
			this.removeAttribute('open')
		}

		toggle(event) {
			if(event) {
				event.preventDefault()
			}

			if (this.selected) {
				if ( this.canCloseAll ) {
					this.close()
				} else {
					const parent = this.closest('[data-collapsible-parent]')
					if( parent ) {
						const allItems = parent.querySelectorAll('collapsible-tab')
						allItems.forEach(item => {
							if (item !== this && item.selected) { // If has other selected then close this.
								this.close()
								return true
							}
						})
					}
				}
			} else {
				this.open()
			}
		}

		trySetTabIndex(el, index) {
			const tappableElements = el.querySelectorAll(this.defaultElements)
			if (tappableElements) {
				tappableElements.forEach(e => {
					e.setAttribute('tabindex', index)
				})
			}
		}

		setExpandedAria() {
			this.trigger.setAttribute('aria-expanded', 'true')
			this.content.setAttribute('aria-hidden', 'false')
		}

		setCollapsedAria(el) {
			this.trigger.setAttribute('aria-expanded', 'false')
			this.content.setAttribute('aria-hidden', 'true')
		}

		attachEvents() {
			this.trigger.addEventListener("click", event => this.toggle(event))
		}

		setDefaultData() {
			this.events = {
				'elementSelected': [],
				'tabOpened': [],
				'elementUnselected': [],
				'elementClosed': []
			}
			this.transitionendevent = this.transitionendEventName()
			this.expandedClass = "is-expanded"
			this.selectedClass = "is-selected"
			this.collapsedClass = "is-collapsed"
			this.trigger = this.querySelector('[data-trigger]')
			this.content = this.querySelector('[data-content]')
			this.collapsedHeight = '0px'
			this.defaultElements = ['a', 'button', 'input:not(.focus-none)', '[data-trigger]']
			this.oneAtATime = true
			if (this.dataset.oneOpen) {
				this.oneAtATime = this.dataset.oneOpen === 'true'
			}

			// Whether keep at least an item opened.
			this.canCloseAll = ( ! this.dataset.canCloseAll || this.dataset.canCloseAll === 'true' )
		}

		fire(eventName) {
			let callbacks = this.events[eventName] || []
			for (let i = 0; i < callbacks.length; i++) {
				callbacks[i](this)
			}
		}

		on(eventName, cb) {
			if (!this.events[eventName]) return
			this.events[eventName].push(cb)
		}

		destroy() {
			this.trigger && this.trigger.removeEventListener("click", event => this.toggle(event))
			this.content && this.content.removeAttribute('aria-hidden')
			if (this.content) this.content.style.height = 'auto'
			this.classList.remove(this.expandedClass, this.collapsedClass)
			this.removeAttribute('open')
		}
	}

	customElements.define('collapsible-tab', CollapsibleTab)
}
