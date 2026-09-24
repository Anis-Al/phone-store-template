// Generates brand-free phone (or accessory) renders for every image path in content/products.json that
// doesn't exist yet in /public. Real stores drop in real photos and never run this.
// Usage: npm run seed:images   (add --force to regenerate)
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const products = JSON.parse(readFileSync(path.join(root, "content/products.json"), "utf8"));
const force = process.argv.includes("--force");

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (hex, target, t) =>
  `rgb(${rgb(hex).map((c) => Math.round(c + (target - c) * t)).join(",")})`;
const luma = (hex) => rgb(hex).reduce((s, c, i) => s + c * [0.299, 0.587, 0.114][i], 0) / 255;

function cameraStyle(p) {
  const m = p.model;
  if (p.brand === "Apple") return /17 Pro/.test(m) ? "bar" : /16e/.test(m) ? "single" : /14 Pro/.test(m) ? "square" : "pill";
  if (p.brand === "Samsung") return "column";
  if (p.brand === "Realme" || p.brand === "Honor") return "circle";
  return "square";
}

const lens = (cx, cy, r) => `
  <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="rgba(0,0,0,.18)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#101012" stroke="#5a5a5e" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="url(#glass)"/>
  <circle cx="${cx - r * 0.25}" cy="${cy - r * 0.3}" r="${r * 0.14}" fill="rgba(255,255,255,.55)"/>`;
const flash = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="11" fill="#f3efe4" stroke="rgba(0,0,0,.2)"/>`;

function back(p, hex) {
  const lenses = (p.specs.mainCamera.match(/\+/g)?.length ?? 0) + 1;
  const plate = mix(hex, luma(hex) > 0.5 ? 0 : 255, 0.08);
  const modules = {
    bar: `<rect x="249" y="84" width="302" height="190" rx="44" fill="${plate}"/>${lens(318, 140, 34)}${lens(318, 222, 34)}${lens(392, 181, 34)}${flash(490, 140)}`,
    pill: `<rect x="262" y="88" width="96" height="190" rx="48" fill="${plate}"/>${lens(310, 136, 32)}${lens(310, 230, 32)}${flash(380, 110)}`,
    single: `${lens(312, 142, 36)}${flash(372, 116)}`,
    square: `<rect x="262" y="88" width="180" height="180" rx="44" fill="${plate}"/>${lens(310, 136, 32)}${lens(310, 222, 32)}${lens(392, 180, 32)}${flash(398, 110)}`,
    circle: `<circle cx="400" cy="200" r="104" fill="${plate}" stroke="rgba(0,0,0,.12)" stroke-width="3"/>${lens(360, 170, 30)}${lens(440, 170, 30)}${lens(400, 240, 30)}`,
    column: Array.from({ length: Math.min(lenses, 4) }, (_, i) => lens(300, 128 + i * 82, 30)).join("") + flash(360, 128),
  };
  return `
  <rect x="235" y="60" width="330" height="680" rx="60" fill="url(#body)" stroke="${mix(hex, 0, 0.35)}" stroke-width="3"/>
  <rect x="235" y="60" width="330" height="680" rx="60" fill="url(#sheen)"/>
  ${modules[cameraStyle(p)]}`;
}

function front(p, hex) {
  const island =
    p.brand === "Apple"
      ? `<rect x="358" y="94" width="84" height="26" rx="13" fill="#000"/>`
      : `<circle cx="400" cy="106" r="11" fill="#000"/>`;
  return `
  <rect x="235" y="60" width="330" height="680" rx="60" fill="${mix(hex, 0, 0.1)}" stroke="${mix(hex, 0, 0.4)}" stroke-width="3"/>
  <rect x="243" y="68" width="314" height="664" rx="53" fill="#050505"/>
  <clipPath id="screen"><rect x="253" y="78" width="294" height="644" rx="45"/></clipPath>
  <g clip-path="url(#screen)">
    <rect x="253" y="78" width="294" height="644" fill="url(#wall)"/>
    <circle cx="330" cy="520" r="210" fill="${mix(hex, 255, 0.25)}" opacity=".35"/>
    <circle cx="480" cy="300" r="160" fill="${mix(hex, 0, 0.3)}" opacity=".35"/>
  </g>
  ${island}
  <rect x="253" y="78" width="294" height="644" rx="45" fill="url(#sheen)"/>`;
}

function accessory(p, hex) {
  const edge = mix(hex, 0, 0.35);
  const shapes = [
    [/coque|case/, `<rect x="235" y="60" width="330" height="680" rx="64" fill="url(#body)" stroke="${edge}" stroke-width="4"/>
      <rect x="262" y="88" width="190" height="190" rx="46" fill="${mix(hex, 0, 0.45)}"/>
      <circle cx="400" cy="440" r="110" fill="none" stroke="${mix(hex, 0, 0.2)}" stroke-width="10"/>`],
    [/chargeur|charger/, `<rect x="360" y="170" width="18" height="120" rx="9" fill="#9a9a9e"/><rect x="422" y="170" width="18" height="120" rx="9" fill="#9a9a9e"/>
      <rect x="260" y="280" width="280" height="330" rx="56" fill="url(#body)" stroke="${edge}" stroke-width="4"/>
      <rect x="360" y="520" width="80" height="26" rx="13" fill="#1a1a1a"/>`],
    [/buds|ecouteur/, `<rect x="200" y="260" width="400" height="300" rx="150" fill="url(#body)" stroke="${edge}" stroke-width="4"/>
      <path d="M205 380 H595" stroke="${edge}" stroke-width="4"/><circle cx="400" cy="460" r="9" fill="#5fd068"/>`],
    [/cable/, `<path d="M250 250 C 550 180, 620 420, 400 440 S 180 640, 560 590" fill="none" stroke="${hex}" stroke-width="26" stroke-linecap="round"/>
      <rect x="200" y="220" width="70" height="60" rx="14" fill="#c8c8cc" stroke="${edge}" stroke-width="3"/>
      <rect x="545" y="560" width="70" height="60" rx="14" fill="#c8c8cc" stroke="${edge}" stroke-width="3"/>`],
    [/verre|glass/, `<rect x="245" y="70" width="310" height="660" rx="56" fill="${hex}" fill-opacity=".55" stroke="${edge}" stroke-width="3" transform="rotate(-8 400 400)"/>`],
    [/microsd|carte/, `<path d="M290 150 H470 L520 200 V250 L500 270 V650 H290 Z" fill="url(#body)" stroke="${edge}" stroke-width="4"/>
      <rect x="315" y="420" width="160" height="200" rx="10" fill="${mix(hex, 255, 0.5)}"/>`],
  ];
  const shape = shapes.find(([re]) => re.test(p.slug))?.[1];
  return `${shape ?? `<rect x="220" y="220" width="360" height="360" rx="48" fill="url(#body)" stroke="${edge}" stroke-width="4"/>`}
  <rect x="200" y="60" width="400" height="680" fill="url(#sheen)" opacity=".5"/>`;
}

function svg(p, hex, view) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mix(hex, 255, 0.18)}"/><stop offset="1" stop-color="${mix(hex, 0, 0.14)}"/>
    </linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${mix(hex, 0, 0.55)}"/><stop offset="1" stop-color="${mix(hex, 255, 0.1)}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glass"><stop offset="0" stop-color="#3b4a6b"/><stop offset="1" stop-color="#0b0b10"/></radialGradient>
  </defs>
  ${!p.specs ? accessory(p, hex) : view === "front" ? front(p, hex) : back(p, hex)}
</svg>`;
}

let made = 0;
for (const p of products) {
  for (const v of p.variants) {
    for (const src of v.images ?? []) {
      const out = path.join(root, "public", src);
      if (!force && existsSync(out)) continue;
      mkdirSync(path.dirname(out), { recursive: true });
      await sharp(Buffer.from(svg(p, v.color.hex, src.includes("-front") ? "front" : "back")))
        .webp({ quality: 82 })
        .toFile(out);
      made++;
    }
  }
}
console.log(`generated ${made} image(s)`);
