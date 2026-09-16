import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  readImageDimensions,
  validateImageFile,
} from '../image-limits.mjs';

function png(width, height, type = 'image/png') {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([bytes], {type});
}

function jpeg(width, height) {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x01, 0x01, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xd9,
  ]);
  return new Blob([bytes], {type: 'image/jpeg'});
}

function webpExtended(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set(new TextEncoder().encode('WEBPVP8X'), 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  const set24 = (offset, value) => bytes.set([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff], offset);
  set24(24, width - 1);
  set24(27, height - 1);
  return new Blob([bytes], {type: 'image/webp'});
}

test('reads dimensions from PNG, JPEG with an APP segment, and WebP', async () => {
  assert.deepEqual(await readImageDimensions(png(1200, 800)), {width: 1200, height: 800});
  assert.deepEqual(await readImageDimensions(jpeg(4032, 3024)), {width: 4032, height: 3024});
  assert.deepEqual(await readImageDimensions(webpExtended(1600, 1600)), {width: 1600, height: 1600});
});

test('accepts the pixel and edge boundaries', async () => {
  assert.deepEqual(await validateImageFile(png(4000, 4000)), {width: 4000, height: 4000});
  assert.deepEqual(await validateImageFile(png(8192, 1953)), {width: 8192, height: 1953});
});

test('rejects dimensions beyond the pixel or edge limits', async () => {
  await assert.rejects(validateImageFile(png(4001, 4000)), RangeError);
  await assert.rejects(validateImageFile(png(8193, 1)), RangeError);
  await assert.rejects(validateImageFile(png(1, 8193)), RangeError);
});

test('rejects unsupported types, empty files, and malformed image headers', async () => {
  await assert.rejects(validateImageFile(png(100, 100, 'image/gif')), TypeError);
  await assert.rejects(validateImageFile(new Blob([], {type: 'image/png'})), TypeError);
  await assert.rejects(validateImageFile(new Blob([new Uint8Array(24)], {type: 'image/png'})), TypeError);
  await assert.rejects(validateImageFile(png(0, 100)), RangeError);
});

test('rejects files over 25 MiB before reading their contents', async () => {
  let read = false;
  const oversized = new Proxy(new Blob([], {type: 'image/png'}), {
    get(target, property) {
      if (property === 'size') return MAX_IMAGE_BYTES + 1;
      if (property === 'arrayBuffer') return async () => { read = true; return new ArrayBuffer(0); };
      return Reflect.get(target, property, target);
    },
  });

  await assert.rejects(validateImageFile(oversized), RangeError);
  assert.equal(read, false);
});
