/**
 * Generate favicon files from the master SVG logo
 * 
 * This script requires sharp to be installed:
 * npm install --save-dev sharp
 * 
 * Usage: node scripts/generate-favicons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('❌ Error: sharp is not installed.');
  console.log('📦 Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

const publicDir = path.join(__dirname, '..', 'public');
const logoSvgPath = path.join(publicDir, 'logo.svg');

// Check if logo.svg exists
if (!fs.existsSync(logoSvgPath)) {
  console.error(`❌ Error: ${logoSvgPath} not found.`);
  process.exit(1);
}

console.log('🎨 Generating favicon files from logo.svg...\n');

// Favicon sizes to generate
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'logo.png', size: 600 }, // For structured data
];

try {
  for (const { name, size } of sizes) {
    const outputPath = path.join(publicDir, name);
    
    await sharp(logoSvgPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Generated: ${name} (${size}x${size})`);
  }
  
  console.log('\n🎉 All favicon files generated successfully!');
  console.log('📁 Files are in the /public directory');
} catch (error) {
  console.error('❌ Error generating favicons:', error.message);
  process.exit(1);
}

