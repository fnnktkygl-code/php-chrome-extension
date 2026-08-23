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

// 3. Move popup.html from dist/src/popup/popup.html to dist/popup.html if needed
const nestedPopup = path.join(distDir, 'src', 'popup', 'popup.html');
const targetPopup = path.join(distDir, 'popup.html');
if (fs.existsSync(nestedPopup)) {
  let content = fs.readFileSync(nestedPopup, 'utf8');
  // Adjust relative paths
  content = content.replace(/\.\.\/\.\.\/assets\//g, 'assets/');
  content = content.replace(/\.\.\/\.\.\/icons\//g, 'icons/');
  fs.writeFileSync(targetPopup, content, 'utf8');
  console.log('✅ Normalized dist/popup.html with root-relative paths');
}
