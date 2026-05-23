import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const dir = path.dirname(new URL(import.meta.url).pathname);

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svg(name, title, lines) {
  const lineH = 22;
  const pad = 32;
  const termTop = 56;
  const termH = 292;
  const titleBarH = 38;
  const lineStart = termTop + titleBarH + 18;
  const w = 580;
  const h = 380;

  while (lines.length < 9) lines.push({ text: '', color: 'transparent' });

  const textLines = lines
    .map(
      (l, i) =>
        `<text x="${pad + 20}" y="${lineStart + i * lineH}" font-family="'SF Mono','Cascadia Code','JetBrains Mono',monospace" font-size="13" fill="${l.color}">${escapeXml(l.text)}</text>`,
    )
    .join('\n        ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="titlebar" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a1b26"/>
      <stop offset="100%" stop-color="#15161e"/>
    </linearGradient>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D946EF"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" rx="0"/>
  <g filter="url(#shadow)">
    <rect x="${pad}" y="${termTop}" width="${w - pad * 2}" height="${termH}" rx="8" fill="#0D0E14"/>
    <rect x="${pad}" y="${termTop}" width="${w - pad * 2}" height="${titleBarH}" rx="8" fill="url(#titlebar)"/>
    <rect x="${pad}" y="${termTop + titleBarH - 8}" width="${w - pad * 2}" height="8" fill="#15161e"/>
    <circle cx="${pad + 20}" cy="${termTop + 19}" r="5" fill="#EF4444"/>
    <circle cx="${pad + 38}" cy="${termTop + 19}" r="5" fill="#EAB308"/>
    <circle cx="${pad + 56}" cy="${termTop + 19}" r="5" fill="#22C55E"/>
    <text x="${pad + 74}" y="${termTop + 24}" font-family="'SF Mono','Cascadia Code',monospace" font-size="11" fill="rgba(255,255,255,0.25)">${escapeXml(title)}</text>
  </g>
  <g>
        ${textLines}
  </g>
  <rect x="${pad}" y="${termTop + termH - 8}" width="${w - pad * 2}" height="8" rx="8" fill="#0D0E14"/>
</svg>`;
}

const features = [
  {
    name: 'feature-init',
    title: 'memlink init my-project',
    lines: [
      { text: '$ memlink init my-project', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  ◆ Memory created', color: '#34D399' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project                      ', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR                     ', color: '#9CA3AF' },
      { text: '  MCP     http://localhost:4444/mcp?id=…   ', color: '#9CA3AF' },
    ],
  },
  {
    name: 'feature-serve',
    title: 'memlink serve --cors "*"',
    lines: [
      { text: '$ memlink serve --cors "*"', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  MCP     http://localhost:4444/mcp?id=wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '  CORS    *                                ', color: '#9CA3AF' },
      { text: '', color: 'transparent' },
      { text: '  ^C to stop                              ', color: '#6B7280' },
      { text: '', color: 'transparent' },
      { text: '  → http://localhost:4444/mcp              ', color: '#D1D5DB' },
    ],
  },
  {
    name: 'feature-connect',
    title: 'memlink connect wBuv_xxjS_wR',
    lines: [
      { text: '$ memlink connect wBuv_xxjS_wR', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project                      ', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR                     ', color: '#9CA3AF' },
      { text: '  MCP     http://localhost:4444/mcp?id=…   ', color: '#9CA3AF' },
      { text: '', color: 'transparent' },
      { text: '  ◆ URL copied to clipboard                ', color: '#6B7280' },
      { text: '', color: 'transparent' },
      { text: '  Start server:  memlink serve             ', color: '#6B7280' },
    ],
  },
  {
    name: 'feature-wsl-connect',
    title: 'memlink wsl-connect wBuv_xxjS_wR',
    lines: [
      { text: '$ memlink wsl-connect wBuv_xxjS_wR', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project                      ', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR                     ', color: '#9CA3AF' },
      { text: '  MCP     http://172.26.176.1:4444/mcp…    ', color: '#A855F7' },
      { text: '', color: 'transparent' },
      { text: '  Use this URL in your WSL agent with      ', color: '#6B7280' },
      { text: '  type "http". See docs/agent-setup.md     ', color: '#6B7280' },
    ],
  },
];

for (const f of features) {
  const svgStr = svg(f.name, f.title, f.lines);
  const svgPath = path.join(dir, f.name + '.svg');
  fs.writeFileSync(svgPath, svgStr);
  console.log(`Created ${svgPath}`);

  const resvg = new Resvg(svgStr, { fitTo: { mode: 'original' } });
  const pngData = resvg.render().asPng();
  const pngPath = path.join(dir, f.name + '.png');
  fs.writeFileSync(pngPath, pngData);
  console.log(`Created ${pngPath}`);
}
