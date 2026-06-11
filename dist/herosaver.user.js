// ==UserScript==
// @name         Herosaver
// @namespace    https://github.com/reformagus/Herosaver
// @version      1.3.1
// @description  Save Configuration and STLs from websites using the THREE.JS framework
// @author       reformagus
// @homepageURL  https://github.com/reformagus/Herosaver
// @match        *://*.heroforge.com/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/reformagus/Herosaver/master/dist/herosaver.user.js
// @updateURL    https://raw.githubusercontent.com/reformagus/Herosaver/master/dist/herosaver.user.js
// ==/UserScript==

(function () {
  'use strict'

  const SRC = 'https://raw.githubusercontent.com/reformagus/Herosaver/master/dist/herosaver.js'

  // Inject into the page context so the loaded code can reach window.CK, THREE, etc.
  // A cache-busting query is appended so the freshest published bundle always
  // runs (GitHub raw and the browser otherwise cache the bundle for minutes).
  const run = (fn) => {
    const s = document.createElement('script')
    s.textContent = `fetch('${SRC}?_=' + Date.now()).then(r => r.text()).then(eval).then(() => ${fn}())`
    document.body.appendChild(s)
    s.remove()
  }

  // ─── Tampermonkey menu commands ───────────────────────────────────────────
  // "Save STL" exports the model with the surrounding cube/shell automatically
  // removed (cube removal runs locally in the bundle, no external page needed).
  GM_registerMenuCommand('Herosaver: Save STL', () => run('saveCleanStl'))
  GM_registerMenuCommand('Herosaver: Save OBJ', () => run('saveObj'))
  GM_registerMenuCommand('Herosaver: Save JSON', () => run('saveJson'))

  // ─── Remove any foreign "Save STL" button ─────────────────────────────────
  // Drop any other on-page control labelled exactly "Save STL" that this script
  // did not create (e.g. a leftover button from another tool), so only the
  // Herosaver panel button remains.
  function removeForeignSaveStlButtons () {
    const panel = document.getElementById('herosaver-panel')
    document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
      if (panel && panel.contains(el)) return
      const label = (el.textContent || el.value || '').trim()
      if (label === 'Save STL') el.remove()
    })
  }

  // ─── On-page button panel ─────────────────────────────────────────────────
  // A small floating panel with the same actions, so they are reachable without
  // opening the userscript-manager menu.
  function injectPanel () {
    if (document.getElementById('herosaver-panel')) return

    const panel = document.createElement('div')
    panel.id = 'herosaver-panel'
    panel.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647',
      'display:flex', 'flex-direction:column', 'gap:6px',
      'padding:10px', 'border-radius:10px',
      'background:rgba(17,24,39,0.92)', 'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
      'font-family:system-ui,-apple-system,sans-serif', 'font-size:13px'
    ].join(';')

    const title = document.createElement('div')
    title.textContent = 'Herosaver'
    title.style.cssText = 'color:#9ca3af;font-weight:600;font-size:11px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px'
    panel.appendChild(title)

    const makeBtn = (label, fn, primary) => {
      const b = document.createElement('button')
      b.textContent = label
      b.style.cssText = [
        'cursor:pointer', 'border:0', 'border-radius:6px',
        'padding:7px 12px', 'font-size:13px', 'font-weight:600', 'text-align:left',
        primary ? 'background:#2563eb' : 'background:#374151', 'color:#fff'
      ].join(';')
      b.addEventListener('click', () => run(fn))
      return b
    }

    // "Save STL" runs the cube-removing export (saveCleanStl).
    panel.appendChild(makeBtn('Save STL', 'saveCleanStl', true))
    panel.appendChild(makeBtn('Save OBJ', 'saveObj', false))
    panel.appendChild(makeBtn('Save JSON', 'saveJson', false))

    document.body.appendChild(panel)
  }

  function init () {
    injectPanel()
    // Sweep now and a few more times, since a foreign button may render late.
    removeForeignSaveStlButtons()
    ;[1000, 2500, 5000].forEach(ms => setTimeout(removeForeignSaveStlButtons, ms))
  }

  if (document.body) init()
  else window.addEventListener('DOMContentLoaded', init)
})()
