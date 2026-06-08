// ==UserScript==
// @name         Herosaver
// @namespace    https://github.com/mungeondaster/Herosaver
// @version      1.1.0
// @description  Save Configuration and STLs from websites using the THREE.JS framework
// @author       reformagus
// @homepageURL  https://github.com/mungeondaster/Herosaver
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/mungeondaster/Herosaver/master/dist/herosaver.user.js
// @updateURL    https://raw.githubusercontent.com/mungeondaster/Herosaver/master/dist/herosaver.user.js
// ==/UserScript==

(function () {
  'use strict'

  const SRC = 'https://raw.githubusercontent.com/mungeondaster/Herosaver/master/dist/herosaver.js'

  // Change this to match wherever you host stl-cube-remover.html
  const HERO_CLEANER_URL = 'https://mungeondaster.github.io/Herosaver/stl-cube-remover.html'

  // Inject into the page context so the loaded code can reach window.CK, THREE, etc.
  const run = (fn) => {
    const s = document.createElement('script')
    s.textContent = `fetch('${SRC}').then(r => r.text()).then(eval).then(() => ${fn}())`
    document.body.appendChild(s)
    s.remove()
  }

  GM_registerMenuCommand('Herosaver: Save STL', () => run('saveStl'))
  GM_registerMenuCommand('Herosaver: Save OBJ', () => run('saveObj'))
  GM_registerMenuCommand('Herosaver: Save JSON', () => run('saveJson'))

  // ─── Hero Cleaner integration ─────────────────────────────────────────────
  // Intercepts the STL blob before FileSaver writes it to disk and pushes it
  // directly into Hero Cleaner via postMessage.
  //
  // Three overlapping intercept points are used because different versions /
  // build configurations of FileSaver.js take different code paths:
  //   1. document.createElement patch   - catches a.click() on new elements
  //   2. HTMLElement.prototype.click    - catches a.click() on any element
  //   3. EventTarget.prototype.dispatchEvent - catches dispatchEvent('click')
  // The first one to fire wins; the others are restored immediately.
  GM_registerMenuCommand('Herosaver: Send to Hero Cleaner', () => {
    const heroUrl = HERO_CLEANER_URL
    const src = SRC
    const s = document.createElement('script')
    s.textContent = `
(function () {
  var intercepted = false

  function sendToHeroCleaner(buffer, filename) {
    var heroWindow = window.open('${heroUrl}', '_blank')
    var data = Array.from(new Uint8Array(buffer))
    var done = false, attempts = 0
    var iv = setInterval(function () {
      attempts++
      if (done || heroWindow.closed || attempts > 100) { clearInterval(iv); return }
      try { heroWindow.postMessage({ type: 'herosaver-stl', data: data, filename: filename }, '*') }
      catch (e) {}
    }, 300)
    window.addEventListener('message', function ack(e) {
      if (e.source === heroWindow && e.data && e.data.type === 'herosaver-ack') {
        done = true; clearInterval(iv); window.removeEventListener('message', ack)
      }
    })
  }

  function intercept(href, filename) {
    if (intercepted) return
    intercepted = true
    restore()
    fetch(href).then(function (r) { return r.arrayBuffer() }).then(function (buf) {
      URL.revokeObjectURL(href)
      sendToHeroCleaner(buf, filename || 'heroforge_model.stl')
    })
  }

  function restore() {
    document.createElement = _origCE
    HTMLElement.prototype.click = _origProtoClick
    EventTarget.prototype.dispatchEvent = _origDE
  }

  // Method 1: patch document.createElement
  var _origCE = document.createElement.bind(document)
  document.createElement = function (tag) {
    var el = _origCE(tag)
    if (tag.toLowerCase() === 'a') {
      Object.defineProperty(el, 'click', {
        configurable: true, writable: true,
        value: function () {
          if (el.download && el.href && el.href.startsWith('blob:')) {
            intercept(el.href, el.download)
          } else { _origProtoClick.call(el) }
        }
      })
    }
    return el
  }

  // Method 2: patch HTMLElement.prototype.click
  var _origProtoClick = HTMLElement.prototype.click
  HTMLElement.prototype.click = function () {
    if (!intercepted && this.tagName === 'A' &&
        this.download && this.href && this.href.startsWith('blob:')) {
      intercept(this.href, this.download)
    } else { _origProtoClick.call(this) }
  }

  // Method 3: patch EventTarget.prototype.dispatchEvent
  var _origDE = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function (event) {
    if (!intercepted && event.type === 'click' &&
        this.tagName === 'A' && this.download &&
        this.href && this.href.startsWith('blob:')) {
      intercept(this.href, this.download)
      return true
    }
    return _origDE.call(this, event)
  }

  fetch('${src}')
    .then(function (r) { return r.text() })
    .then(eval)
    .then(function () { window.saveStl() })
})()
`
    document.body.appendChild(s)
    s.remove()
  })
})()
