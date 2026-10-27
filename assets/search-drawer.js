class PredictiveSearch extends HTMLElement {
	constructor() {
		super()

		this.selectors = {
			input: '[data-predictive-search-input]',
			form: 'form',
			formStatus: '[data-predictive-search-status]',
			predictiveSearchResults: '[data-predictive-search]',
			closeBtn: '.f-drawer__close'
		}

		this.domNodes = queryDomNodes(this.selectors, this)
		this.drawer = this.closest('drawer-component')
		this.input = this.domNodes.input
		this.form = this.domNodes.form
		this.formStatus = this.domNodes.formStatus
		this.predictiveSearchResults = this.domNodes.predictiveSearchResults
		this.cachedResults = {}
		this.isOpen = false
		this.predictive_search_url = window.FoxThemeSettings.routes.predictive_search_url
		this.allPredictiveSearchInstances = document.querySelectorAll('predictive-search');
		this.searchTerm = '';

		this.setupEventListeners()
	}

	setupEventListeners() {
		this.form.addEventListener('submit', this.onFormSubmit.bind(this))

		this.input.addEventListener('input', debounce((event) => {
			this.onChange(event)
		}, 300).bind(this))
		this.input.addEventListener('focus', this.onFocus.bind(this))
		this.addEventListener('focusout', this.onFocusOut.bind(this))
		this.addEventListener('keyup', this.onKeyup.bind(this))
		this.addEventListener('keydown', this.onKeydown.bind(this))
		this.domNodes.closeBtn && this.domNodes.closeBtn.addEventListener('click', this.onClose.bind(this))
	}

	getQuery() {
		return this.input.value.trim()
	}

	onChange() {
		const newSearchTerm = this.getQuery();

		if (!this.searchTerm || !newSearchTerm.startsWith(this.searchTerm)) {
      // Remove the results when they are no longer relevant for the new search term
      // so they don't show up when the dropdown opens again
      this.querySelector("#f-predictive-search-results")?.remove();
    }

		// Update the term asap, don't wait for the predictive search query to finish loading
    this.updateSearchForTerm(this.searchTerm, newSearchTerm);

		this.searchTerm = newSearchTerm;

    if (!this.searchTerm.length) {
      this.close(true);
      return;
    }

    this.getSearchResults(this.searchTerm);
	}

	onFormSubmit(e) {
		if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) e.preventDefault()
	}

	onFocus() {    
		const currentSearchTerm = this.getQuery();

		if (!currentSearchTerm.length) return;

		if (this.searchTerm !== currentSearchTerm) {
			this.onChange();
		} else if (this.getAttribute('results') === 'true') {
      this.open();
    } else {
      this.getSearchResults(this.searchTerm);
    }
	}

	onFocusOut(e) {
		setTimeout(() => {
			if (!this.contains(document.activeElement)) this.close();
		})
	}

	onClose(e) {
		this.close(true)
	}

	onKeyup(event) {
		if (!this.getQuery().length) this.close(true)
		event.preventDefault()

		switch (event.code) {
			case 'ArrowUp':
				this.switchOption('up')
				break
			case 'ArrowDown':
				this.switchOption('down')
				break
			case 'Enter':
				this.selectOption()
				break
		}
	}

	onKeydown(e) {
		if (
			e.code === 'ArrowUp' ||
			e.code === 'ArrowDown'
		) {
			e.preventDefault()
		}
	}

	switchOption(direction) {
		if (!this.getAttribute('open')) return

		const moveUp = direction === 'up'
		const selectedElement = this.querySelector('[aria-selected="true"]')
		const allElements = this.querySelectorAll('li')
		let activeElement = this.querySelector('li')

		if (moveUp && !selectedElement) return

		this.formStatus.textContent = ''

		if (!moveUp && selectedElement) {
			activeElement = selectedElement.nextElementSibling || allElements[0]
		} else if (moveUp) {
			activeElement = selectedElement.previousElementSibling || allElements[allElements.length - 1]
		}

		if (activeElement === selectedElement) return

		activeElement.setAttribute('aria-selected', true)
		if (selectedElement) selectedElement.setAttribute('aria-selected', false)

		this.setLiveRegionText(activeElement.textContent)
		this.input.setAttribute('aria-activedescendant', activeElement.id)
	}

	selectOption() {
		const selectedProduct = this.querySelector('[aria-selected="true"] a, [aria-selected="true"] button')

		if (selectedProduct) selectedProduct.click()
	}

	getSearchResults(searchTerm) {
		const queryKey = searchTerm.replace(" ", "-").toLowerCase()
		this.setLiveRegionLoadingState()

		if (this.cachedResults[queryKey]) {
			this.renderSearchResults(this.cachedResults[queryKey])
			return
		}
		const url = `${this.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&section_id=predictive-search`
		fetch(url)
			.then((res) => {
				if (!res.ok) {
					var error = new Error(res.status)
					this.close()
					throw error
				}

				return res.text()
			})
			.then((text) => {
				const resultsMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-predictive-search').innerHTML

				// Save bandwidth keeping the cache in all instances synced
        this.allPredictiveSearchInstances.forEach(
          (predictiveSearchInstance) => {
            predictiveSearchInstance.cachedResults[queryKey] = resultsMarkup;
          }
        );

				this.renderSearchResults(resultsMarkup)
			})
			.catch((error) => {
				this.close()
				throw error
			})
	}

	setLiveRegionLoadingState() {
		this.loadingText = this.loadingText || this.getAttribute('data-loading-text')

		this.setLiveRegionText(this.loadingText)
		this.setAttribute('loading', true)
	}

	setLiveRegionText(statusText) {
		this.formStatus.setAttribute('aria-hidden', 'false')
		this.formStatus.textContent = statusText

		setTimeout(() => {
			this.formStatus.setAttribute('aria-hidden', 'true')
		}, 1000)
	}

	renderSearchResults(resultsMarkup) {
		this.predictiveSearchResults.innerHTML = resultsMarkup
		this.setAttribute('results', true)

		this.setLiveRegionResults()
		this.open()
	}

	setLiveRegionResults() {
		this.removeAttribute('loading')
		this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent)
	}

	updateSearchForTerm(previousTerm, newTerm) {
    const searchForTextElement = this.querySelector(
      "[data-predictive-search-search-for-text]"
    );
    const currentButtonText = searchForTextElement?.innerText;
    if (currentButtonText) {
      if (currentButtonText.match(new RegExp(previousTerm, "g")).length > 1) {
        // The new term matches part of the button text and not just the search term, do not replace to avoid mistakes
        return;
      }
      const newButtonText = currentButtonText.replace(previousTerm, newTerm);
      searchForTextElement.innerText = newButtonText;
    }
  }

	open() {
		this.setAttribute('open', true)
		this.input.setAttribute('aria-expanded', true)
		this.isOpen = true
	}

	close(clearSearchTerm = false) {
		if (clearSearchTerm) {
			this.input.value = ''
			this.removeAttribute('results')
		}

		const selected = this.querySelector('[aria-selected="true"]')

		if (selected) selected.setAttribute('aria-selected', false)

		this.input.setAttribute('aria-activedescendant', '')
		this.removeAttribute('open')
		this.input.setAttribute('aria-expanded', false)
		this.predictiveSearchResults.removeAttribute('style')

		this.isOpen = false
	}
}

customElements.define('predictive-search', PredictiveSearch)
