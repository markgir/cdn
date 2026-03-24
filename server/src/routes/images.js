/**
 * Image generation routes for the Admin Backoffice.
 *
 * Generates placeholder and banner images as SVG or PNG (base64).
 * Useful for e-commerce stores that need placeholder product images,
 * social media banners, or promotional graphics.
 *
 * Endpoints:
 *   POST /api/images/generate  – generate a placeholder/banner image
 *   GET  /api/images/preview   – preview an image with query params
 *
 * Credits: Developed by iddigital.pt
 */

const express = require('express');
const router = express.Router();

/**
 * Build an SVG image string from the provided options.
 */
function buildSvg({ width, height, bgColor, textColor, text, fontSize }) {
  const w = Math.min(Math.max(parseInt(width, 10) || 600, 1), 4096);
  const h = Math.min(Math.max(parseInt(height, 10) || 400, 1), 4096);
  const bg = sanitizeColor(bgColor) || '#cccccc';
  const tc = sanitizeColor(textColor) || '#333333';
  const fs = Math.min(Math.max(parseInt(fontSize, 10) || Math.min(w, h) / 8, 8), 200);
  const label = sanitizeText(text) || `${w} × ${h}`;

  const lines = label.split('\\n');
  const lineHeight = fs * 1.3;
  const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;

  const textElements = lines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${startY + i * lineHeight}" ` +
        `font-family="Arial, Helvetica, sans-serif" font-size="${fs}" ` +
        `fill="${tc}" text-anchor="middle" dominant-baseline="central">${escXml(line)}</text>`
    )
    .join('\n    ');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <rect width="100%" height="100%" fill="${bg}" />`,
    `  ${textElements}`,
    `</svg>`,
  ].join('\n');
}

/**
 * Sanitize a hex or named color value.
 */
function sanitizeColor(color) {
  if (!color) return null;
  const c = String(color).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  if (/^[a-zA-Z]{1,30}$/.test(c)) return c;
  if (/^rgb(a)?\(\s*\d/.test(c)) return c;
  return null;
}

/**
 * Sanitize text to prevent injection.
 */
function sanitizeText(text) {
  if (!text) return null;
  return String(text).slice(0, 200);
}

/**
 * Escape XML special characters.
 */
function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── POST /api/images/generate ────────────────────────────────────────────────
router.post('/generate', (req, res) => {
  const { width, height, bgColor, textColor, text, fontSize, format } = req.body;

  const svg = buildSvg({ width, height, bgColor, textColor, text, fontSize });

  if (format === 'base64') {
    const base64 = Buffer.from(svg).toString('base64');
    return res.json({
      format: 'base64',
      mimeType: 'image/svg+xml',
      data: `data:image/svg+xml;base64,${base64}`,
      width: Math.min(Math.max(parseInt(width, 10) || 600, 1), 4096),
      height: Math.min(Math.max(parseInt(height, 10) || 400, 1), 4096),
    });
  }

  // Default: return raw SVG
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Content-Disposition', `inline; filename="placeholder-${Date.now()}.svg"`);
  res.send(svg);
});

// ── GET /api/images/preview ──────────────────────────────────────────────────
router.get('/preview', (req, res) => {
  const { width, height, bgColor, textColor, text, fontSize } = req.query;

  const svg = buildSvg({
    width: width || 600,
    height: height || 400,
    bgColor: bgColor || '#cccccc',
    textColor: textColor || '#333333',
    text: text || '',
    fontSize: fontSize || 0,
  });

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(svg);
});

module.exports = { imagesRouter: router, buildSvg, sanitizeColor, sanitizeText, escXml };
