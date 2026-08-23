import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy manifest.json to dist
const manifestSrc = path.join(rootDir, 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('✅ Copied manifest.json to dist/');
}

// 2. Copy icons directory to dist
const iconsSrc = path.join(rootDir, 'icons');
const iconsDest = path.join(distDir, 'icons');
copyDir(iconsSrc, iconsDest);
console.log('✅ Copied icons to dist/icons/');

// 3. Copy clean standalone root runtime scripts (avoiding Vite module chunk splitting issues in content scripts)
const standaloneFiles = [
  'content.js',
  'background.js',
  'popup.js',
  'popup.css',
  'popup.html',
  'i18n.js'
];

for (const file of standaloneFiles) {
  const src = path.join(rootDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied ${file} to dist/`);
  }
}
