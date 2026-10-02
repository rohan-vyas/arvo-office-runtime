/* Arvo pinned static engine loader. Every decoded part and the final binary
 * must match its build manifest before any Office engine code starts. */
'use strict';
async function loadOfficeWasmParts(manifest) {
  var maximumBytes = 192 * 1024 * 1024;
  var maximumPartBytes = 16 * 1024 * 1024;
  var hex = /^[a-f0-9]{64}$/;
  if (!manifest || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 8 ||
    manifest.bytes > maximumBytes || !hex.test(manifest.sha256) ||
    !Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length > 16)
    throw new Error('Invalid pinned engine manifest.');
  var expected = 0;
  for (var part of manifest.parts) {
    if (!part || !Number.isSafeInteger(part.bytes) || part.bytes < 1 || part.bytes > maximumPartBytes ||
      !hex.test(part.sha256) || part.path !== 'wasm-' + part.sha256 + '.part.br')
      throw new Error('Invalid pinned engine part.');
    expected += part.bytes;
  }
  if (expected !== manifest.bytes) throw new Error('Invalid pinned engine length.');
  var deadline = AbortSignal.timeout(90_000);
  var bytes = new Uint8Array(manifest.bytes);
  var offset = 0;
  async function digest(value) {
    var result = new Uint8Array(await crypto.subtle.digest('SHA-256', value));
    return Array.from(result, function(value) { return value.toString(16).padStart(2, '0'); }).join('');
  }
  for (var selected of manifest.parts) {
    var response = await fetch('./' + selected.path, { redirect: 'error', credentials: 'omit',
      cache: 'force-cache', signal: AbortSignal.any([deadline, AbortSignal.timeout(30_000)]) });
    if (!response.ok || !response.body) throw new Error('Pinned engine part unavailable.');
    var reader = response.body.getReader();
    var count = 0;
    try {
      for (;;) {
        var next = await reader.read();
        if (next.done) break;
        if (count + next.value.byteLength > selected.bytes) throw new Error('Pinned engine part exceeds its size.');
        bytes.set(next.value, offset + count); count += next.value.byteLength;
      }
    } finally { await reader.cancel().catch(function() {}); reader.releaseLock(); }
    if (count !== selected.bytes || await digest(bytes.subarray(offset, offset + count)) !== selected.sha256)
      throw new Error('Pinned engine part integrity check failed.');
    offset += count;
  }
  if (await digest(bytes) !== manifest.sha256) throw new Error('Pinned engine integrity check failed.');
  return bytes;
}

window.ARVO_LOAD_OFFICE_WASM_PARTS = loadOfficeWasmParts;
