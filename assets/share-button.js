if (!customElements.get('share-button')) {
  customElements.define(
    'share-button',
    class ProductShare extends HTMLElement {
      constructor() {
        super();

        this.elements = {
          urlInput: this.querySelector('input'),
        };

        this.urlToShare = this.elements.urlInput ? this.elements.urlInput.value : document.location.href;
      }

      connectedCallback() {
        // Initialize the AbortController
        this.abortController = new AbortController();

        this.btnCopy = this.querySelector('.btn-copy');
        if (this.btnCopy) {
          this.btnCopy.addEventListener('click', this.copyToClipboard.bind(this), {
            signal: this.abortController.signal,
          });
        }
      }

      copyToClipboard(evt) {
        evt.preventDefault();

        navigator.clipboard.writeText(evt.target.previousElementSibling.value);
        this.btnCopy.classList.add('copied');
        this.btnCopy.innerText = evt.target.dataset.copiedText;
      }

      updateUrl(url) {
        this.urlToShare = url;
        this.elements.urlInput.value = url;
      }

      disconnectedCallback() {
        this.abortController.abort();
      }
    }
  );
}