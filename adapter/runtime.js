/* Arvo isolated Office bridge. Adapted from allotropia/zetajs web-office,
 * SPDX-License-Identifier: MIT. See LICENSE.zetajs and README.md. */
'use strict';
var canvas = document.getElementById('qtcanvas');
var loading = document.getElementById('loading');
var Module = { canvas: canvas, uno_scripts: ['./zeta.js', './office-thread.js'],
  locateFile: function(path, prefix) { return (prefix || './') + path; } };
var binding = null;
var thrPort = null;
var engineReady = false;
var startupFailed = false;
var opened = false;
var filename = null;
var exportRequest = null;
var maxBytes = 4194304;
var documentLoaded = false;
var resizeQueued = false;
function resizeSelectedWindow() {
  if (!documentLoaded || startupFailed || !thrPort || resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(function() {
    resizeQueued = false;
    if (!documentLoaded || startupFailed || !thrPort) return;
    var rect = canvas.getBoundingClientRect();
    // UNO window bounds use device pixels; DOM geometry uses CSS pixels.
    var ratio = window.devicePixelRatio || 1;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 4) return;
    var width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 16777216)
      thrPort.postMessage({ cmd: 'resize', width: width, height: height });
  });
}
window.addEventListener('resize', resizeSelectedWindow);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeSelectedWindow).observe(canvas);
function reply(data, transfer) {
  if (!binding) return;
  parent.postMessage(Object.assign({ protocol: 'arvo-office-v1', nonce: binding.nonce }, data),
    binding.origin, transfer || []);
}
function failStartup() {
  startupFailed = true;
  engineReady = false;
  reply({ type: 'error' });
}
window.addEventListener('message', function(event) {
  var data = event.data;
  if (event.source !== parent || event.origin !== window.ARVO_OFFICE_PARENT_ORIGIN ||
    !data || typeof data !== 'object' || data.protocol !== 'arvo-office-v1') return;
  if (data.type === 'initialise') {
    if (!binding && typeof data.nonce === 'string' && data.nonce.length > 0 && data.nonce.length <= 128)
      binding = { origin: event.origin, nonce: data.nonce };
    if (binding && binding.nonce === data.nonce) {
      if (startupFailed) reply({ type: 'error' });
      else if (engineReady) reply({ type: 'ready' });
    }
    return;
  }
  if (!binding || data.nonce !== binding.nonce || !engineReady || !thrPort) return;
  if (data.type === 'view' && documentLoaded && !exportRequest && typeof data.requestId === 'string' &&
      data.requestId.length > 0 && data.requestId.length <= 128 && (data.mode === 'fit' ||
      (data.mode === 'zoom' && Number.isInteger(data.zoom) && data.zoom >= 20 && data.zoom <= 200))) {
    thrPort.postMessage({ cmd: 'view', requestId: data.requestId, mode: data.mode,
      ...(data.mode === 'zoom' ? { zoom: data.zoom } : {}) });
  }
  if (data.type === 'open' && !opened && typeof data.name === 'string' && data.name.length <= 2000 &&
    data.bytes instanceof ArrayBuffer && data.bytes.byteLength > 0 && data.bytes.byteLength <= maxBytes) {
    var extension = data.name.split('.').pop().toLowerCase();
    if (!['docx', 'xlsx', 'pptx'].includes(extension)) return;
    filename = 'selected.' + extension;
    try {
      FS.mkdir('/tmp/arvo-office');
      FS.writeFile('/tmp/arvo-office/' + filename, new Uint8Array(data.bytes));
      opened = true;
      thrPort.postMessage({ cmd: 'open', filename: filename });
    } catch { reply({ type: 'error' }); }
  }
  if (data.type === 'export' && opened && !exportRequest && typeof data.requestId === 'string' &&
    data.requestId.length > 0 && data.requestId.length <= 128) {
    exportRequest = data.requestId;
    thrPort.postMessage({ cmd: 'export', requestId: exportRequest });
  }
});
canvas.addEventListener('contextmenu', function(event) { event.preventDefault(); });
canvas.addEventListener('keydown', function(event) { event.preventDefault(); });
canvas.addEventListener('wheel', function(event) { event.preventDefault(); }, { passive: false });
var engine = document.createElement('script');
engine.src = './soffice.js';
engine.onerror = function() { loading.textContent = 'The Office runtime could not be loaded.'; failStartup(); };
engine.onload = function() {
  Module.uno_main.then(function(port) {
    thrPort = port;
    thrPort.onmessage = function(event) {
      if (startupFailed) return;
      var data = event.data;
      if (data.cmd === 'engine_ready') { engineReady = true; reply({ type: 'ready' }); }
      if (data.cmd === 'loaded') {
        documentLoaded = true;
        loading.style.display = 'none'; canvas.style.visibility = 'visible';
        window.dispatchEvent(new Event('resize')); reply({ type: 'loaded' });
      }
      if (data.cmd === 'modified') reply({ type: 'modified', modified: data.modified === true });
      if (data.cmd === 'view_ready' && documentLoaded && ['docx', 'xlsx', 'pptx'].includes(data.format) &&
          Number.isInteger(data.zoom) && data.zoom >= 1 && data.zoom <= 400)
        reply({ type: 'view-ready', format: data.format, zoom: data.zoom });
      if (data.cmd === 'view_result' && typeof data.requestId === 'string' && data.requestId.length > 0 &&
          data.requestId.length <= 128 && (data.ok === false || (data.ok === true &&
          Number.isInteger(data.zoom) && data.zoom >= 1 && data.zoom <= 400)))
        reply({ type: 'view-result', requestId: data.requestId, ok: data.ok,
          ...(data.ok ? { zoom: data.zoom } : {}) });
      if (data.cmd === 'exported' && exportRequest && data.requestId === exportRequest) {
        var id = exportRequest; exportRequest = null;
        try {
          var bytes = Uint8Array.from(FS.readFile('/tmp/arvo-office/' + filename));
          if (!bytes.length || bytes.length > maxBytes) throw new Error('package_size');
          reply({ type: 'exported', requestId: id, bytes: bytes.buffer }, [bytes.buffer]);
        } catch { reply({ type: 'error', requestId: id }); }
      }
      if (data.cmd === 'error') { var requestId = exportRequest; exportRequest = null;
        reply(Object.assign({ type: 'error' }, requestId ? { requestId: requestId } : {})); }
    };
  }).catch(failStartup);
};
if (window.ARVO_OFFICE_WASM_PARTS) {
  window.ARVO_LOAD_OFFICE_WASM_PARTS(window.ARVO_OFFICE_WASM_PARTS).then(function(bytes) {
    Module.wasmBinary = bytes;
    document.body.appendChild(engine);
  }).catch(function() {
    loading.textContent = 'The pinned Office runtime could not be verified.';
    failStartup();
  });
} else { document.body.appendChild(engine); }
