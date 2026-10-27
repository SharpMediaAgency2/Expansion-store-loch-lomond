class ResponsiveImage extends HTMLElement {
	get intersecting() {
		return this.hasAttribute('intersecting')
	}
	constructor() {
		super()
		this.img = this.querySelector('img')
		this.observerCallback = this.observerCallback.bind(this)
		this.loadImage = this.loadImage.bind(this)
		this.img.onload = this.onLoad.bind(this)
		if (this.img.complete) {
			this.removeAttribute('data-image-loading')
			this.img.classList.add('f-img-loaded')
		}
	}
	connectedCallback() {
		if ('IntersectionObserver' in window) this.initIntersectionObserver()
		else this.loadImage()
	}
	disconnectedCallback() {
		this.disconnectObserver()
	}
	loadImage() {
		this.setAttribute('intersecting', 'true')
		this.img.width = this.clientWidth
		this.img.height = this.clientHeight
		this.img.sizes = this.clientWidth + 'px'
	}
	onLoad() {
		this.removeAttribute('data-image-loading')
		this.img.classList.add('f-img-loaded')
	}
	observerCallback(entries, observer) {
		if (!entries[0].isIntersecting) return;
		observer.unobserve(this);
		this.loadImage()
	}
	initIntersectionObserver() {
		if (this.observer) return
		const rootMargin = '10px';
		this.observer = new IntersectionObserver(this.observerCallback, {rootMargin})
		this.observer.observe(this)
	}
	disconnectObserver() {
		if (!this.observer) return
		this.observer.disconnect()
		this.observer = null
		delete this.observer
	}
}
customElements.define('responsive-image', ResponsiveImage)
