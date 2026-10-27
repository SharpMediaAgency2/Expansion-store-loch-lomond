if (!customElements.get('localization-form')) {
	class LocalizationForm extends HTMLElement {
		constructor() {
			super();
			this.elements = {
				input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
				button: this.querySelector('button'),
				panel: this.querySelector('.f-disclosure-list')
			};

			this.elements.panel.removeAttribute('hidden')
			this.elements.button.addEventListener('click', this.openSelector.bind(this));
			this.elements.button.addEventListener('focusout', this.closeSelector.bind(this));
			this.addEventListener('keyup', this.onContainerKeyUp.bind(this));

			this.querySelectorAll('a').forEach(item => item.addEventListener('click', this.onItemClick.bind(this)));

			this.handleDropdownPos()
		}

		handleDropdownPos() {
			const offsetButton = this.elements.button.getBoundingClientRect().right
			if ((window.innerWidth - offsetButton) < 220) {
				this.elements.button.nextElementSibling && this.elements.button.nextElementSibling.classList.add('f-disclosure-list__right')
			}
		}

		hidePanel() {
			this.elements.button.setAttribute('aria-expanded', 'false');
			this.removeAttribute('open')
		}

		onContainerKeyUp(event) {
			if (event.code.toUpperCase() !== 'ESCAPE') return;

			this.hidePanel();
			this.elements.button.focus();
		}

		onItemClick(event) {
			event.preventDefault();
			const form = this.querySelector('form');
			this.elements.input.value = event.currentTarget.dataset.value;
			if (form) form.submit();
		}

		openSelector() {
			this.elements.button.focus();
			this.toggleAttribute('open')
			this.elements.button.setAttribute('aria-expanded', (this.elements.button.getAttribute('aria-expanded') === 'false').toString());
		}

		closeSelector(event) {
			const shouldClose = event.relatedTarget && event.relatedTarget.nodeName === 'BUTTON' || event.relatedTarget && !event.relatedTarget.classList.contains('f-disclosure-list__option')
			if (event.relatedTarget === null || shouldClose) {
				this.hidePanel(shouldClose);
			}
		}
	}
	customElements.define('localization-form', LocalizationForm);
}
