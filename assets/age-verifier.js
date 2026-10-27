class AgeVerifierPopup extends ModalDialog {
	constructor() {
		super()
		this.cookieName = `Foxtheme:age-verifier-${this.id}`
		this.cookie = getCookie(this.cookieName)

		this.declineButton = this.querySelector('[data-age-verifier-decline-button]')
		this.declineContent = this.querySelector('[data-age-verifier-decline-content]')
		this.content = this.querySelector('[data-age-verifier-content]')
		this.agreeButton = this.querySelector('[data-age-verifier-agree-button]')
		this.returnButton = this.querySelector('[data-age-verifier-return-button]')

		if (this.cookie === "" && this.dataset.enable === 'true') {
			if (Shopify && Shopify.designMode) return;
			this.show()
			// Check session storage if user was editing on the second view
			const secondViewVisited = sessionStorage.getItem(this.id);
			if (!secondViewVisited) return;

			this.showDeclineContent();
		}
	}

	connectedCallback() {
		if (this.declineButton) {
			this.declineButton.addEventListener('click', (e) => {
				e.preventDefault()
				this.showDeclineContent()
				sessionStorage.setItem(this.id, 'age-second-view');
			})
		}

		if (this.returnButton) {
			this.returnButton.addEventListener('click', (e) => {
				e.preventDefault()
				this.hideDeclineContent()

				const secondViewVisited = sessionStorage.getItem(this.id);

				if (secondViewVisited) {
					sessionStorage.removeItem(this.id);
				}
			})
		}

		if (this.agreeButton) {
			this.agreeButton.addEventListener('click', (e) => {
				e.preventDefault()
				this.hideDeclineContent()
				window.scrollTo(0, 0);
				// Set cookie when enabled
				if (this.dataset.enable === 'true') {
					setCookie(this.cookieName, 'agreed', 30)
				}
				this.hide()
			})
		}

		if (Shopify.designMode) {
			document.addEventListener('shopify:section:select', this.__shopifySectionSelect.bind(this))
			document.addEventListener('shopify:section:load', this.__shopifySectionLoad.bind(this))
		}
	}

	disconnectedCallback() {
		if (Shopify.designMode) {
			document.removeEventListener('shopify:section:select', this.__shopifySectionSelect.bind(this))
			document.removeEventListener('shopify:section:load', this.__shopifySectionLoad.bind(this))
		}
	}

	__shopifySectionLoad(event) {
		if (event.detail.sectionId === this.dataset.sectionId && this.dataset.designMode === 'true') {
			this.show();

			const secondViewVisited = sessionStorage.getItem(this.id);

			if (!secondViewVisited) return;

			this.showDeclineContent(event);
		}
	}

	__shopifySectionSelect(event) {
		if (event.detail.sectionId === this.dataset.sectionId && this.dataset.designMode === 'true') {
			this.show();
		} else {
			this.hide();
		}
	}

	showDeclineContent() {
		this.declineContent.classList.remove('hidden');
		this.content.classList.add('hidden');
	}

	hideDeclineContent() {
		this.declineContent.classList.add('hidden');
		this.content.classList.remove('hidden');
	}
}

customElements.define('age-verifier-popup', AgeVerifierPopup)