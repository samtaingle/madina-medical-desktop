/**
 * Creates a simple 256x256 ICO file for the Madina Medical app.
 * Uses only Node.js built-ins — no extra dependencies needed.
 * Run with: node scripts/create-icon.js
 */

const fs = require('fs');
const path = require('path');

// We'll create a minimal valid ICO file with a 256x256 green cross icon
// ICO format: ICONDIR header + ICONDIRENTRY + BMP or PNG data
// Easiest: embed a 256x256 PNG inside the ICO (Windows Vista+ supports this)

// Generate a simple 256x256 PNG with a green medical cross using raw pixel data
// Since we can't use canvas without native modules, we'll use a pre-encoded tiny PNG

// A 256x256 PNG with white background and a green cross (+) shape
// We'll create a valid minimal PNG from scratch

function createMinimalPng(width, height) {
  // Use the 'zlib' module to compress pixel data
  const zlib = require('zlib');
  
  // Create RGBA pixel data: white bg, green cross
  const pixels = Buffer.alloc(width * height * 4);
  
  const bgR = 37, bgG = 99, bgB = 235; // blue-600 background
  const fgR = 255, fgG = 255, fgB = 255; // white cross
  
  // Fill background
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = bgR;
    pixels[i * 4 + 1] = bgG;
    pixels[i * 4 + 2] = bgB;
    pixels[i * 4 + 3] = 255;
  }
  
  // Draw a white cross
  const crossThickness = Math.floor(width * 0.2);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  
  // Horizontal bar
  for (let y = centerY - Math.floor(crossThickness/2); y < centerY + Math.ceil(crossThickness/2); y++) {
    for (let x = Math.floor(width * 0.15); x < Math.ceil(width * 0.85); x++) {
      const idx = (y * width + x) * 4;
      pixels[idx + 0] = fgR;
      pixels[idx + 1] = fgG;
      pixels[idx + 2] = fgB;
      pixels[idx + 3] = 255;
    }
  }
  
  // Vertical bar
  for (let x = centerX - Math.floor(crossThickness/2); x < centerX + Math.ceil(crossThickness/2); x++) {
    for (let y = Math.floor(height * 0.15); y < Math.ceil(height * 0.85); y++) {
      const idx = (y * width + x) * 4;
      pixels[idx + 0] = fgR;
      pixels[idx + 1] = fgG;
      pixels[idx + 2] = fgB;
      pixels[idx + 3] = 255;
    }
  }
  
  // Build PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = require('zlib').crc32
      ? require('zlib').crc32(Buffer.concat([typeBuffer, data]))
      : computeCRC32(Buffer.concat([typeBuffer, data]));
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }
  
  // CRC32 implementation
  function computeCRC32(buf) {
    let crc = 0xFFFFFFFF;
    const table = makeCRCTable();
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  function makeCRCTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    return table;
  }
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (no alpha for simplicity — use 6 for RGBA)
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  // IDAT chunk: filter + pixel rows
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter type: None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawRows.push(pixels[idx], pixels[idx+1], pixels[idx+2], pixels[idx+3]);
    }
  }
  const rawData = Buffer.from(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 6 });
  
  const pngData = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  
  return pngData;
}

// Create the PNG
const pngData = createMinimalPng(256, 256);
const pngPath = path.join(__dirname, '../assets/icon.png');
fs.writeFileSync(pngPath, pngData);
console.log('PNG icon created at:', pngPath, '(', pngData.length, 'bytes)');

// Create ICO by embedding the PNG (ICO with PNG data is valid on Win Vista+)
// ICO format:
//   ICONDIR: 6 bytes (reserved=0, type=1, count=1)
//   ICONDIRENTRY: 16 bytes per image
//   Image data

const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);  // reserved
iconDir.writeUInt16LE(1, 2);  // type = 1 (icon)
iconDir.writeUInt16LE(1, 4);  // count = 1

const iconDirEntry = Buffer.alloc(16);
iconDirEntry[0] = 0;    // width (0 means 256)
iconDirEntry[1] = 0;    // height (0 means 256)
iconDirEntry[2] = 0;    // color count (0 for true color)
iconDirEntry[3] = 0;    // reserved
iconDirEntry.writeUInt16LE(1, 4);  // planes
iconDirEntry.writeUInt16LE(32, 6); // bit count
iconDirEntry.writeUInt32LE(pngData.length, 8);  // size of image data
iconDirEntry.writeUInt32LE(6 + 16, 12);          // offset to image data

const icoData = Buffer.concat([iconDir, iconDirEntry, pngData]);
const icoPath = path.join(__dirname, '../assets/icon.ico');
fs.writeFileSync(icoPath, icoData);
console.log('ICO icon created at:', icoPath, '(', icoData.length, 'bytes)');
