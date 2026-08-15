import { deflateSync, crc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ---- minimal PNG encoder (RGBA, no deps) ----
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = rowStart + 1 + x * 4
      raw[dst] = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- drawing helpers ----
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function drawIcon(size, { rounded = false, maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const green = [47, 107, 58]
  const white = [255, 255, 255]
  const radius = size * (maskable ? 0 : 0.18)
  const t = size * (maskable ? 0.075 : 0.09) // stroke width
  const segs = [
    [size * 0.30, size * 0.53, size * 0.45, size * 0.67],
    [size * 0.45, size * 0.67, size * 0.72, size * 0.35],
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      let r = green[0]
      let g = green[1]
      let b = green[2]
      let a = 255
      if (rounded) {
        const cx = Math.min(x, size - 1 - x)
        const cy = Math.min(y, size - 1 - y)
        const dx = Math.max(0, cx - (size / 2 - radius))
        const dy = Math.max(0, cy - (size / 2 - radius))
        if (Math.hypot(dx, dy) > radius + 0.5) {
          a = 0
          pixels[idx] = r
          pixels[idx + 1] = g
          pixels[idx + 2] = b
          pixels[idx + 3] = a
          continue
        }
      }
      let on = false
      for (const s of segs) {
        if (distToSegment(x + 0.5, y + 0.5, s[0], s[1], s[2], s[3]) < t / 2) {
          on = true
          break
        }
      }
      if (on) {
        r = white[0]
        g = white[1]
        b = white[2]
      }
      pixels[idx] = r
      pixels[idx + 1] = g
      pixels[idx + 2] = b
      pixels[idx + 3] = a
    }
  }
  return encodePNG(size, pixels)
}

mkdirSync(outDir, { recursive: true })
const files = [
  ['pwa/icon-192.png', drawIcon(192)],
  ['pwa/icon-512.png', drawIcon(512)],
  ['pwa/icon-512-maskable.png', drawIcon(512, { maskable: true })],
  ['apple-touch-icon.png', drawIcon(180, { rounded: true })],
]
for (const [rel, buf] of files) {
  const p = join(outDir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, buf)
  console.log('generated', rel, buf.length, 'bytes')
}