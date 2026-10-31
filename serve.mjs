import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 8765;
const siteUrl = `http://127.0.0.1:${port}/index.html`;
function openBrowser() {
  if (process.argv.includes('--open'))
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', siteUrl], error => {
      if (error) console.error(`Browser tidak dapat dibuka otomatis: ${error.message}`);
    });
}
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ris': 'application/x-research-info-systems', '.bib': 'application/x-bibtex',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  const download = pathname.startsWith('/download/');
  if (download) {
    const name = pathname.slice('/download/'.length);
    if (!/^\d+-\d+\.pdf$/.test(name)) { response.writeHead(404).end('Not found'); return; }
    pathname = `/pdfs/${name}`;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) { response.writeHead(404).end('Not found'); return; }
  const headers = {
    'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    'X-Content-Type-Options': 'nosniff',
    'X-JPIP-Local': '1',
  };
  if (download || /\.(?:ris|bib|docx)$/i.test(file))
    headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
  response.writeHead(200, headers);
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(siteUrl, { signal: AbortSignal.timeout(2000) });
      if (response.headers.get('X-JPIP-Local') === '1') { openBrowser(); return; }
    } catch {}
    console.error(`Port ${port} sedang dipakai aplikasi lain.`);
  } else console.error(error);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`JPIP local: ${siteUrl}`);
  openBrowser();
});
