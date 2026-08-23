import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const uncompressedDir = path.join(rootDir, 'php-chrome-extension-v2.0.0');
const zipPath = path.join(rootDir, 'php-chrome-extension-v2.0.0.zip');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// 1. Sync uncompressed folder for local Chrome "Load unpacked"
if (fs.existsSync(uncompressedDir)) {
  fs.rmSync(uncompressedDir, { recursive: true, force: true });
}
fs.cpSync(distDir, uncompressedDir, { recursive: true });
console.log(`📁 Uncompressed folder updated: ${uncompressedDir}`);

// 2. Package .zip archive for Chrome Web Store submission
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKb = (archive.pointer() / 1024).toFixed(2);
  console.log(`🎉 Extension packaged successfully!`);
  console.log(`📦 Zip Archive: ${zipPath} (${sizeKb} KB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
