import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST_DIR = path.resolve('dist');

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const EXTENSIONS = new Set(['.js', '.css', '.html', '.svg', '.json']);

function precompress() {
  if (!fs.existsSync(DIST_DIR)) {
    console.log('[precompress] dist directory not found, skipping.');
    return;
  }

  const files = getFiles(DIST_DIR);
  let compressedCount = 0;
  let totalSavedBytes = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTENSIONS.has(ext)) continue;
    if (file.endsWith('.gz') || file.endsWith('.br')) continue;

    const content = fs.readFileSync(file);
    if (content.length < 1024) continue; // Skip files < 1KB

    // Gzip (level 9)
    const gz = zlib.gzipSync(content, { level: 9 });
    fs.writeFileSync(`${file}.gz`, gz);

    // Brotli (quality 11)
    const br = zlib.brotliCompressSync(content, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    });
    fs.writeFileSync(`${file}.br`, br);

    compressedCount++;
    totalSavedBytes += (content.length - br.length);
  }

  console.log(`[precompress] Generated .gz and .br for ${compressedCount} assets. Bandwidth saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
}

precompress();

