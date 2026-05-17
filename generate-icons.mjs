// Run with: node generate-icons.mjs
// Generates icon-192.png and icon-512.png using the Canvas API

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

function drawFlameIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 100; // scale factor

  // Background
  const r = 22 * s;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#1a1612';
  ctx.fill();

  // Outer flame
  ctx.beginPath();
  ctx.moveTo(50 * s, 10 * s);
  ctx.bezierCurveTo(28 * s, 38 * s, 22 * s, 58 * s, 34 * s, 72 * s);
  ctx.bezierCurveTo(38 * s, 77 * s, 44 * s, 80 * s, 50 * s, 80 * s);
  ctx.bezierCurveTo(56 * s, 80 * s, 62 * s, 77 * s, 66 * s, 72 * s);
  ctx.bezierCurveTo(78 * s, 58 * s, 72 * s, 38 * s, 50 * s, 10 * s);
  ctx.closePath();
  ctx.fillStyle = '#c85a1e';
  ctx.fill();

  // Mid flame
  ctx.beginPath();
  ctx.moveTo(50 * s, 22 * s);
  ctx.bezierCurveTo(36 * s, 44 * s, 34 * s, 60 * s, 42 * s, 70 * s);
  ctx.bezierCurveTo(45 * s, 74 * s, 47 * s, 76 * s, 50 * s, 76 * s);
  ctx.bezierCurveTo(53 * s, 76 * s, 55 * s, 74 * s, 58 * s, 70 * s);
  ctx.bezierCurveTo(66 * s, 60 * s, 64 * s, 44 * s, 50 * s, 22 * s);
  ctx.closePath();
  ctx.fillStyle = '#d4823a';
  ctx.fill();

  // Inner flame ellipse
  ctx.beginPath();
  ctx.ellipse(50 * s, 60 * s, 10 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(232,168,85,0.9)';
  ctx.fill();

  // Core
  ctx.beginPath();
  ctx.ellipse(50 * s, 66 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,245,204,0.75)';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

writeFileSync(join(__dir, 'assets/icons/icon-192.png'), drawFlameIcon(192));
writeFileSync(join(__dir, 'assets/icons/icon-512.png'), drawFlameIcon(512));
console.log('Icons generated: icon-192.png and icon-512.png');
