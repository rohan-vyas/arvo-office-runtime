import { createHash } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export function makeOfficeWasmParts(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8 || bytes.length > 192 * 1024 * 1024)
    throw new Error('Invalid bounded Office engine bytes.');
  const hash = data => createHash('sha256').update(data).digest('hex');
  const assets = [];
  const manifest = { bytes: bytes.length, sha256: hash(bytes), parts: [] };
  for (let offset = 0; offset < bytes.length; offset += 16 * 1024 * 1024) {
    const chunk = bytes.subarray(offset, offset + 16 * 1024 * 1024);
    const sha256 = hash(chunk);
    const name = `wasm-${sha256}.part.br`;
    const compressed = brotliCompressSync(chunk, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });
    if (compressed.length > 25 * 1024 * 1024) throw new Error('Runtime part exceeds the static-host asset limit.');
    assets.push({ name, bytes: compressed });
    manifest.parts.push({ path: name, bytes: chunk.length, sha256 });
  }
  return { manifest, assets };
}
export async function writeOfficeWasmParts(bytes, destination) {
  const result = makeOfficeWasmParts(bytes);
  for (const asset of result.assets) await writeFile(path.join(destination, asset.name), asset.bytes);
  return result.manifest;
}
