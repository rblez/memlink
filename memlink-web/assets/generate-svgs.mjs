import fs from 'fs';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname);

function svg(name, title, lines) {
  const lineH = 22;
  const pad = 40;
  const termPad = 20;
  const termTop = 80;
  const lineStart = termTop + 54;
  const h = lineStart + lines.length * lineH + termPad + pad;

  const textLines = lines
    .map(
      (l, i) =>
        `<text x="${pad + 24}" y="${lineStart + i * lineH}" font-family="'SF Mono','Cascadia Code',monospace" font-size="14" fill="${l.color}">${l.text}</text>`,
    )
    .join('\n        ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="${h}" viewBox="0 0 580 ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D946EF"/>
    </linearGradient>
  </defs>
  <rect width="580" height="${h}" fill="url(#bg)" rx="16"/>
  <rect x="${pad}" y="${termTop}" width="500" height="${h - termTop - pad}" rx="12" fill="#0A0A0B"/>
  <rect x="${pad}" y="${termTop}" width="500" height="44" rx="12" fill="#0F0F12"/>
  <rect x="${pad}" y="${termTop + 44}" width="500" height="1" fill="rgba(255,255,255,0.06)"/>
  <circle cx="${pad + 24}" cy="${termTop + 22}" r="5" fill="#EF4444"/>
  <circle cx="${pad + 42}" cy="${termTop + 22}" r="5" fill="#EAB308"/>
  <circle cx="${pad + 60}" cy="${termTop + 22}" r="5" fill="#22C55E"/>
  <text x="${pad + 80}" y="${termTop + 27}" font-family="'SF Mono','Cascadia Code',monospace" font-size="12" fill="rgba(255,255,255,0.3)">${title}</text>
  <g>
        ${textLines}
  </g>
</svg>`;
}

const features = [
  {
    name: 'feature-init',
    title: 'memlink init my-project',
    lines: [
      { text: '$ memlink init my-project', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '◆ Memory created', color: '#34D399' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '  MCP     http://localhost:4444/mcp?id=wBuv_xxjS_wR', color: '#9CA3AF' },
    ],
  },
  {
    name: 'feature-serve',
    title: 'memlink serve --cors "*"',
    lines: [
      { text: '$ memlink serve --cors "*"', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  MCP     http://localhost:4444/mcp?id=wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '  CORS   *', color: '#9CA3AF' },
      { text: '', color: 'transparent' },
      { text: '  ^c stop', color: '#6B7280' },
      { text: '', color: 'transparent' },
      { text: '→ http://localhost:4444/mcp', color: '#D1D5DB' },
    ],
  },
  {
    name: 'feature-connect',
    title: 'memlink connect wBuv_xxjS_wR',
    lines: [
      { text: '$ memlink connect wBuv_xxjS_wR', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '  MCP     http://localhost:4444/mcp?id=wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '', color: 'transparent' },
      { text: '  ◆ URL copied to clipboard', color: '#6B7280' },
      { text: '', color: 'transparent' },
      { text: '  Start server:  Memlink serve', color: '#6B7280' },
    ],
  },
  {
    name: 'feature-wsl-connect',
    title: 'memlink wsl-connect wBuv_xxjS_wR',
    lines: [
      { text: '$ memlink wsl-connect wBuv_xxjS_wR', color: '#10B981' },
      { text: '', color: 'transparent' },
      { text: '  Name    my-project', color: '#9CA3AF' },
      { text: '  ID      wBuv_xxjS_wR', color: '#9CA3AF' },
      { text: '  MCP     http://172.26.176.1:4444/mcp?id=wBuv_xxjS_wR', color: '#A855F7' },
      { text: '', color: 'transparent' },
      { text: '  Use this URL in your WSL agent with type "http".', color: '#6B7280' },
      { text: '  See docs/agent-setup.md for config examples.', color: '#6B7280' },
    ],
  },
];

for (const f of features) {
  const filePath = path.join(dir, f.name + '.svg');
  fs.writeFileSync(filePath, svg(f.name, f.title, f.lines));
  console.log(`Created ${filePath}`);
}
