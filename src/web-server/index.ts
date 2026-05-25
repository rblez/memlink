import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './api.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

function findWebBuild(): string | null {
  try {
    if (fs.existsSync(WEB_DIST)) {
      return WEB_DIST;
    }
  } catch {
    /* no build yet */
  }
  return null;
}

export function createWebApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRouter);

  const buildDir = findWebBuild();
  if (buildDir) {
    app.use(express.static(buildDir));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexPath = path.join(buildDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  return app;
}

export async function startWebServer(port?: number): Promise<void> {
  const p = port || parseInt(process.env.WEB_PORT || process.env.PORT || '8888', 10);
  const app = createWebApp();

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(p, () => {
      console.log(`\n  ${'─'.repeat(48)}`);
      console.log(`  Web UI   http://localhost:${p}`);
      console.log(`  API      http://localhost:${p}/api`);
      console.log(`  ${'─'.repeat(48)}`);
      resolve();
    });
    server.on('error', reject);
  });
}
