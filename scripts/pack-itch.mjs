/**
 * PACKAGE THE ITCH.IO BUILD.
 *
 * WHY THIS EXISTS (owner, 2026-08-14: "I just uploaded the zip and nothing is
 * happened when I click play on itch.io").
 *
 * The build was fine and the zip looked fine. What was wrong was invisible
 * from Windows: PowerShell's `Compress-Archive` writes every entry with
 * `external_attr = 0` — no Unix permission bits at all. itch.io unpacks on
 * Linux, and a file extracted with mode 0000 is not readable by the web
 * server, so every asset came back 404 while `index.html` (which itch serves
 * through its own path) loaded fine. The page loaded and nothing happened.
 *
 * The zip that shipped and WORKED at v163 carried `0x81b60000` — regular
 * file, mode 666 — because it was written by a Unix-style zipper. This does
 * the same thing deliberately, so the packaging can never silently regress to
 * a zip that only works on the machine that made it.
 *
 * Run it with `node scripts/pack-itch.mjs` after `npm run build`.
 */

import { createWriteStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { deflateRawSync } from 'node:zlib'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'apps', 'web', 'dist')
const OUT = join(ROOT, 'the-life-simulator-itch.zip')

/** Regular file, mode 666 — exactly what the build that worked carried. */
const UNIX_FILE_MODE = 0o100666
// `<<` yields a SIGNED 32-bit result and this value overflows into the
// negative; the unsigned shift is what the header actually wants.
const EXTERNAL_ATTR = (UNIX_FILE_MODE << 16) >>> 0
/** 3 = Unix. Windows-made zips say 0, which is how the permissions went missing. */
const MADE_BY_UNIX = 3 << 8

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0 ^ -1
  for (let i = 0; i < buffer.length; i += 1) {
    c = (c >>> 8) ^ (CRC_TABLE[(c ^ buffer[i]) & 0xff] ?? 0)
  }
  return (c ^ -1) >>> 0
}

/** Every file under a directory, deepest paths included, in a stable order. */
async function filesUnder(dir) {
  const found = []
  for (const entry of (await readdir(dir)).sort()) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) found.push(...(await filesUnder(full)))
    else found.push(full)
  }
  return found
}

const files = await filesUnder(DIST)
/**
 * index.html FIRST, matching the archive that shipped and worked. Nothing is
 * known to depend on the order; it costs nothing to keep it identical.
 */
files.sort((a, b) => {
  const an = relative(DIST, a)
  const bn = relative(DIST, b)
  if (an === 'index.html') return -1
  if (bn === 'index.html') return 1
  return an < bn ? -1 : 1
})

const out = createWriteStream(OUT)
const chunks = []
const write = (buf) => {
  chunks.push(buf)
}
let offset = 0
const central = []

for (const file of files) {
  // ZIP paths are FORWARD slashes on every platform, always.
  const name = relative(DIST, file).split(sep).join('/')
  const raw = await readFile(file)
  const deflated = deflateRawSync(raw, { level: 9 })
  const useStored = deflated.length >= raw.length
  const body = useStored ? raw : deflated
  const method = useStored ? 0 : 8
  const crc = crc32(raw)
  const nameBuf = Buffer.from(name, 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0, 6) // flags
  local.writeUInt16LE(method, 8)
  local.writeUInt16LE(0, 10) // time
  local.writeUInt16LE(0x21, 12) // date — fixed, so the archive is reproducible
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(body.length, 18)
  local.writeUInt32LE(raw.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)
  write(local)
  write(nameBuf)
  write(body)

  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20 | MADE_BY_UNIX, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(method, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt16LE(0x21, 14)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(body.length, 20)
  header.writeUInt32LE(raw.length, 24)
  header.writeUInt16LE(nameBuf.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(EXTERNAL_ATTR, 38)
  header.writeUInt32LE(offset, 42)
  central.push(Buffer.concat([header, nameBuf]))

  offset += local.length + nameBuf.length + body.length
}

const centralBuf = Buffer.concat(central)
write(centralBuf)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(0, 4)
end.writeUInt16LE(0, 6)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(centralBuf.length, 12)
end.writeUInt32LE(offset, 16)
end.writeUInt16LE(0, 20)
write(end)

out.write(Buffer.concat(chunks))
out.end()
await new Promise((resolve) => out.on('close', resolve))
console.log(`packed ${String(files.length)} files → ${OUT}`)
for (const file of files) console.log('  ', relative(DIST, file).split(sep).join('/'))
