class MobileNavToggle extends HTMLElement {
	constructor() {
		super()
		this.menuDrawer = document.querySelector('.f-drawer-mobile-nav')
		this.addEventListener('click', this.openNav.bind(this))

		if (this.menuDrawer) {
			this.menuDrawer.addEventListener('close', () => {
				this.setAttribute('aria-expanded', 'false')
			})
		}
	}

	disconnectedCallback() {
		this.removeEventListener('click', this.openNav.bind(this))
	}

	openNav() {
		if (this.menuDrawer) {
			this.menuDrawer.openDrawer()
			this.setAttribute('aria-expanded', 'true')
		}
	}
}
customElements.define('mobile-nav-toggle', MobileNavToggle)

document.addEventListener('click', function (event) {
  var label = event.target.closest('.f-mobile-nav__link, .f-mobile-nav__sub-link');
  if (!label) return;

  var item = label.closest('[data-collapsible-parent]');
  if (!item) return; // not a parent row, let it behave normally

  var tab = item.querySelector(':scope > collapsible-tab');
  if (!tab) return; // this row has no submenu

  var href = label.getAttribute('href');
  if (href && href !== '#') return; // real link (e.g. "Women") -> keep normal navigation

  event.preventDefault();

  var trigger = tab.querySelector('[data-trigger]');
  if (trigger) trigger.click(); // reuses collapsible-tab's own toggle logic
});