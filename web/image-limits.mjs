export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_EDGE = 8192;

const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('图片尺寸无效');
  }
  return {width, height};
}

function parsePng(bytes, view) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') {
    throw new TypeError('PNG 缺少 IHDR 尺寸信息');
  }
  return dimensions(view.getUint32(16), view.getUint32(20));
}

function parseJpeg(bytes, view) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new TypeError('JPEG 标记无效');
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new TypeError('JPEG 段长度缺失');
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) throw new TypeError('JPEG 段已截断');
    if (JPEG_START_OF_FRAME.has(marker)) {
      if (length < 7) throw new TypeError('JPEG 尺寸段无效');
      return dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset += length;
  }
  throw new TypeError('JPEG 缺少尺寸信息');
}

function uint24le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseWebp(bytes, view) {
  if (bytes.length < 20) return null;
  const text = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  if (text(0, 4) !== 'RIFF' || text(8, 12) !== 'WEBP') return null;
  if (view.getUint32(4, true) + 8 > bytes.length) throw new TypeError('WebP 文件已截断');

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = text(offset, offset + 4);
    const length = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (data + length > bytes.length) throw new TypeError('WebP 数据块已截断');

    if (kind === 'VP8X') {
      if (length < 10) throw new TypeError('WebP VP8X 尺寸块无效');
      return dimensions(uint24le(bytes, data + 4) + 1, uint24le(bytes, data + 7) + 1);
    }
    if (kind === 'VP8L') {
      if (length < 5 || bytes[data] !== 0x2f) throw new TypeError('WebP VP8L 尺寸块无效');
      const b0 = bytes[data + 1], b1 = bytes[data + 2], b2 = bytes[data + 3], b3 = bytes[data + 4];
      return dimensions(1 + b0 + ((b1 & 0x3f) << 8), 1 + (b1 >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10));
    }
    if (kind === 'VP8 ') {
      if (length < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        throw new TypeError('WebP VP8 尺寸块无效');
      }
      return dimensions(view.getUint16(data + 6, true) & 0x3fff, view.getUint16(data + 8, true) & 0x3fff);
    }
    offset = data + length + (length & 1);
  }
  throw new TypeError('WebP 缺少尺寸信息');
}

function requireBlob(file) {
  if (!(file instanceof Blob)) throw new TypeError('图片必须是 File 或 Blob');
  if (file.size === 0) throw new TypeError('图片文件为空');
  if (file.size > MAX_IMAGE_BYTES) throw new RangeError('图片超过 25 MiB');
}

export async function readImageDimensions(file) {
  requireBlob(file);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  return parsePng(bytes, view) ?? parseJpeg(bytes, view) ?? parseWebp(bytes, view)
    ?? (() => { throw new TypeError('无法解析图片尺寸'); })();
}

export async function validateImageFile(file) {
  requireBlob(file);
  if (!SUPPORTED_TYPES.has(file.type.toLowerCase())) {
    throw new TypeError('仅支持 PNG、JPEG 和 WebP');
  }
  const result = await readImageDimensions(file);
  if (result.width > MAX_IMAGE_EDGE || result.height > MAX_IMAGE_EDGE) {
    throw new RangeError(`图片任一边不能超过 ${MAX_IMAGE_EDGE} 像素`);
  }
  if (result.width > MAX_IMAGE_PIXELS / result.height) {
    throw new RangeError('图片不能超过 1600 万像素');
  }
  return result;
}
