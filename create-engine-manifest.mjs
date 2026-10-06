import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [directory] = process.argv.slice(2);
if (!directory || process.argv.length !== 3) throw Error('Usage: node create-engine-manifest.mjs <raw-engine-directory>');
// Only the recorded corrected build is supported by this publication helper.
// This verifies retained outputs; it cannot certify a new compilation.
const provenance = JSON.parse(await readFile(new URL('./engine-provenance.json', import.meta.url), 'utf8'));
const names = ['soffice.js', 'soffice.wasm', 'soffice.data', 'soffice.data.js.metadata'];
if (provenance.sourceBuildReceipt?.exit !== 0 || provenance.sourceBuildReceipt?.stopReason !== null ||
    provenance.assets.length !== names.length || names.some(name => !provenance.assets.some(asset => asset.name === name)))
  throw Error('The recorded completed-build provenance is incomplete.');
for (const name of names) {
  const asset = provenance.assets.find(item => item.name === name);
  const bytes = await readFile(path.join(directory, name));
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
    throw Error(`Pinned raw engine output differs: ${name}`);
}
const manifest = { ...provenance, status: 'Verified retained outputs from the completed 2 October 2026 build; no new compilation claimed' };
await writeFile(path.join(directory, 'source-engine-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log('Created source-engine-manifest.json after verifying all four pinned raw outputs.');
