/**
 * Статика design-source/ на 3006 — эталон для попиксельной сверки.
 *
 * Почему сервер, а не file:// — макеты тянут assets/site.css относительным путём,
 * а сравнивать надо в тех же условиях, что и живой сайт: тот же движок загрузки,
 * те же шрифты, тот же порядок применения стилей.
 *
 * design-source/ только на чтение (ограничение 5) — сервер отдаёт файлы и ничего не пишет.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { ROOT } from './lib/pages.mjs';

const DIR = join(ROOT, 'design-source');
const PORT = Number(process.env.DESIGN_PORT ?? 3006);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(handler);

async function handler(req, res) {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // не выпускаем за пределы design-source
    const path = join(DIR, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(DIR)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(path);
    const file = info.isDirectory() ? join(path, 'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
  }
}

/**
 * Поднимает эталон, если его ещё никто не поднял. Нужно, чтобы
 * `node tools/compare.mjs` работал одной командой, без «сначала запусти сервер».
 * Возвращает функцию остановки (или пустую, если сервер был уже чужой).
 */
export async function ensureDesignServer() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return () => {};
  } catch {
    // не отвечает — поднимаем свой
  }
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, '127.0.0.1', resolve);
    });
    ours = true;
  }
  return stopDesignServer;
}

let ours = false;

/**
 * Гасит сервер, если поднимали его мы. Без этого процесс не завершится:
 * открытый слушающий сокет держит event loop.
 */
export function stopDesignServer() {
  if (ours) {
    server.close();
    ours = false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`design-source → http://127.0.0.1:${PORT}`);
  });
}
