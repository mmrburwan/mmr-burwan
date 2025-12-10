# Favicon Generation Guide

## Required Favicon Sizes

Create the following favicon files and place them in the `/public` directory:

1. **favicon-16x16.png** - 16x16 pixels
2. **favicon-32x32.png** - 32x32 pixels
3. **apple-touch-icon.png** - 180x180 pixels
4. **icon-192x192.png** - 192x192 pixels (for PWA)
5. **icon-512x512.png** - 512x512 pixels (for PWA)

## Tools to Generate Favicons

### Online Tools:
1. **Favicon.io** - https://favicon.io/
   - Upload your logo or use text
   - Generates all sizes automatically
   - Download and extract to `/public`

2. **RealFaviconGenerator** - https://realfavicongenerator.net/
   - Most comprehensive tool
   - Generates all formats and sizes
   - Provides HTML code (already in index.html)

3. **Favicon Generator** - https://www.favicon-generator.org/
   - Simple and fast
   - Generates multiple sizes

### Design Guidelines:
- Use the MMR Burwan logo or emblem
- Keep it simple and recognizable at small sizes
- Use high contrast colors (gold/rose theme)
- Ensure it works on both light and dark backgrounds
- Test visibility at 16x16 size

## Quick Generation Steps:

1. Create a 512x512px master image (square, centered logo)
2. Use one of the online tools above
3. Download the generated files
4. Place all files in `/public` directory
5. Verify they're accessible at:
   - `https://yourdomain.com/favicon-16x16.png`
   - `https://yourdomain.com/favicon-32x32.png`
   - etc.

## OG Image (Open Graph)

Create `og-image.jpg` (1200x630px) for social media sharing:
- Should include: MMR Burwan logo, tagline, and key visual
- Use high-quality image
- Text should be readable at small sizes
- Follow brand colors (rose/gold theme)
- Place in `/public` directory

## Logo for Structured Data

Create `logo.png` (at least 600x60px or square):
- Official MMR Burwan logo
- Transparent background preferred
- High resolution
- Place in `/public` directory

