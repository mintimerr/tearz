// One-off: remove edge-connected white background from an RGB PNG, output RGBA,
// then autocrop to alpha bbox. Node-only (zlib), no deps.
import fs from 'node:fs';
import zlib from 'node:zlib';

const SRC = process.argv[2];
const OUT = process.argv[3] ?? SRC;
const PAD = Number(process.argv[4] ?? 6);
const WHITE = 236; // all channels >= WHITE => background candidate

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
};
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const buf = fs.readFileSync(SRC);
let off = 8;
let width = 0;
let height = 0;
let bitDepth = 0;
let colorType = 0;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  off += 12 + len;
}
if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
  throw new Error(`unsupported (bd=${bitDepth} ct=${colorType})`);
}
const inBpp = colorType === 6 ? 4 : 3;
const inStride = width * inBpp;
const raw = zlib.inflateSync(Buffer.concat(idat));
const src = Buffer.alloc(height * inStride);
for (let y = 0; y < height; y++) {
  const f = raw[y * (inStride + 1)];
  const inR = raw.subarray(y * (inStride + 1) + 1, y * (inStride + 1) + 1 + inStride);
  const outR = src.subarray(y * inStride, y * inStride + inStride);
  const pr = y > 0 ? src.subarray((y - 1) * inStride, (y - 1) * inStride + inStride) : null;
  for (let x = 0; x < inStride; x++) {
    const a = x >= inBpp ? outR[x - inBpp] : 0;
    const b = pr ? pr[x] : 0;
    const c = pr && x >= inBpp ? pr[x - inBpp] : 0;
    let v = inR[x];
    if (f === 1) v = (v + a) & 0xff;
    else if (f === 2) v = (v + b) & 0xff;
    else if (f === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (f === 4) v = (v + paeth(a, b, c)) & 0xff;
    outR[x] = v;
  }
}

// RGBA buffer, opaque to start
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  rgba[i * 4] = src[i * inBpp];
  rgba[i * 4 + 1] = src[i * inBpp + 1];
  rgba[i * 4 + 2] = src[i * inBpp + 2];
  rgba[i * 4 + 3] = 255;
}

const isWhite = (i) => rgba[i * 4] >= WHITE && rgba[i * 4 + 1] >= WHITE && rgba[i * 4 + 2] >= WHITE;
const bg = new Uint8Array(width * height); // 1 = background
const stack = [];
for (let x = 0; x < width; x++) {
  stack.push(x, (height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  stack.push(y * width, y * width + (width - 1));
}
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !isWhite(i)) continue;
  bg[i] = 1;
  rgba[i * 4 + 3] = 0;
  const x = i % width;
  const y = (i - x) / width;
  if (x > 0) stack.push(i - 1);
  if (x < width - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - width);
  if (y < height - 1) stack.push(i + width);
}

// Erode the near-white halo ring: opaque near-white pixels touching transparency -> transparent
const erodeWhite = 224;
const toClear = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (bg[i]) continue;
    if (!(rgba[i * 4] >= erodeWhite && rgba[i * 4 + 1] >= erodeWhite && rgba[i * 4 + 2] >= erodeWhite)) continue;
    const near =
      (x > 0 && bg[i - 1]) ||
      (x < width - 1 && bg[i + 1]) ||
      (y > 0 && bg[i - width]) ||
      (y < height - 1 && bg[i + width]);
    if (near) toClear.push(i);
  }
}
for (const i of toClear) {
  rgba[i * 4 + 3] = 0;
  bg[i] = 1;
}

// bbox of opaque
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
minX = Math.max(0, minX - PAD);
minY = Math.max(0, minY - PAD);
maxX = Math.min(width - 1, maxX + PAD);
maxY = Math.min(height - 1, maxY + PAD);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const cropStride = cw * 4;
const cropRaw = Buffer.alloc(ch * (cropStride + 1));
for (let y = 0; y < ch; y++) {
  cropRaw[y * (cropStride + 1)] = 0;
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * width + (minX + x)) * 4;
    const di = y * (cropStride + 1) + 1 + x * 4;
    cropRaw[di] = rgba[si];
    cropRaw[di + 1] = rgba[si + 1];
    cropRaw[di + 2] = rgba[si + 2];
    cropRaw[di + 3] = rgba[si + 3];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(cw, 0);
ihdr.writeUInt32BE(ch, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const outPng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(cropRaw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, outPng);
console.log(`white-keyed ${width}x${height} -> ${cw}x${ch}`);
