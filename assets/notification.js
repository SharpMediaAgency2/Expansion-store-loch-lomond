export default class Notification {

  constructor() {
    this.noti = null
    this.removeTimeoutId = null
    this.hideTimeoutId = null
    this.transitionDuration = 300
  }

  setNoti(type, message, isSticky) {
    let svg
    if (type === 'warning') {
      svg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    } else if (type === 'success') {
      svg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    }
    this.noti = document.createElement('div')
    this.noti.classList.add('f-notification')
    this.noti.classList.add(type)
    if (isSticky) {
      this.noti.classList.add('f-notification--sticky')
    }
    this.noti.innerHTML = `${svg}<div class="ml-3">${message}</div>`
  }

  show({ target, type, message, method = 'after', last = 3000, delay = 0, debug = false, sticky = false }) {
    this.clearTimeout()
    this.removeNoti()
    this.setNoti(type, message, sticky)
    setTimeout(() => {
      target?.[method](this.noti)
      requestAnimationFrame(() => this.noti.classList.add('show'))
      if (!debug) {
        this.hideTimeoutId = setTimeout(() => {
          this.noti.classList.add('hide')
          this.removeTimeoutId = setTimeout(this.removeNoti, this.transitionDuration * 2)
        }, last)
      }
    }, delay)
  }

  handleClick = () => {
    clearTimeout(this.removeTimeoutId)
    this.noti.classList.add('f-hidden')
    setTimeout(this.removeNoti, this.transitionDuration * 2)
  }

  clearTimeout() {
    clearTimeout(this.removeTimeoutId)
    clearTimeout(this.hideTimeoutId)
  }

  removeNoti() {
    if (this.noti) {
      this.noti.remove()
    }
  }
}
