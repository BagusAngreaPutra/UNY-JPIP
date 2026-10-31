import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sourceRoot = 'https://journal.uny.ac.id';
const assetRoot = 'assets';
const doiIcon = `${assetRoot}/doi.svg`;
const fallbackIcon = `${assetRoot}/unavailable.svg`;
const cache = new Map();
const failures = [];

async function htmlFiles(dir = '.') {
  let out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === assetRoot || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) out.push(...await htmlFiles(path.join(dir, entry.name)));
    else if (entry.name.endsWith('.html')) out.push(path.join(dir, entry.name));
  }
  return out;
}

function assetName(url, type) {
  const u = new URL(url);
  const bits = u.pathname.split('/').filter(Boolean).map(x => decodeURIComponent(x).replace(/[^a-zA-Z0-9._$-]/g, '_'));
  let name = bits.pop() || 'index';
  if (!path.extname(name)) name += type === 'css' ? '.css' : type === 'js' ? '.js' : '.bin';
  if (u.search) name = name.replace(/(\.[^.]+)$/, `-${createHash('sha256').update(u.search).digest('hex').slice(0, 8)}$1`);
  return path.posix.join(assetRoot, u.hostname, ...bits, name);
}

function absolute(value, base = sourceRoot) {
  if (/^(data:|blob:|#)/i.test(value)) return null;
  if (base === sourceRoot && !/^(https?:\/\/|\/)/i.test(value)) return null;
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}

async function download(value, type, base = sourceRoot) {
  const url = absolute(value, base);
  if (!url) return null;
  if (url.includes('journal.sepaham.or.id/doiimage/doi.png')) return doiIcon;
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    const filename = assetName(url, type);
    try {
      if ((await stat(filename).catch(() => null))?.size > 0) return filename;
      const response = await fetch(url, { signal: AbortSignal.timeout(url.includes('sertifikat-akreditasi-jpip') ? 180000 : 30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (type === 'css') {
        let css = data.toString('utf8');
        css = await replaceCss(css, url, filename);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, css);
      } else {
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, data);
      }
      return filename;
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
      return type === 'image' ? fallbackIcon : null;
    }
  })();
  cache.set(url, promise);
  return promise;
}

function relative(toFile, asset) {
  return path.relative(path.dirname(toFile), asset).replaceAll('\\', '/');
}

async function replaceCss(css, sourceUrl, filename) {
  const candidates = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gis)];
  for (const match of candidates) {
    const value = match[2].trim();
    if (!absolute(value, sourceUrl)) continue;
    const local = await download(value, 'image', sourceUrl);
    if (local) css = css.replaceAll(match[0], `url("${relative(filename, local)}")`);
  }
  const imports = [...css.matchAll(/@import\s+(?:url\()?\s*(['"])(.*?)\1\s*\)?/gis)];
  for (const match of imports) {
    const local = await download(match[2], 'css', sourceUrl);
    if (local) css = css.replace(match[2], relative(filename, local));
  }
  return css;
}

async function replaceHtml(html, filename) {
  const attrs = [...html.matchAll(/<(img|script|link|source|video|audio)\b[^>]*?>/gis)];
  for (const match of attrs) {
    const tag = match[0];
    const kind = match[1].toLowerCase();
    let changed = tag;
    for (const attr of ['src', 'poster', 'href', 'srcset']) {
      const m = changed.match(new RegExp(`\\b${attr}=(['"])(.*?)\\1`, 'is'));
      if (!m) continue;
      if (attr === 'href' && !(kind === 'link' && /rel=['"](?:stylesheet|icon|shortcut icon|apple-touch-icon)['"]/i.test(tag))) continue;
      const type = kind === 'script' ? 'js' : kind === 'link' ? 'css' : 'image';
      if (attr === 'srcset') {
        const parts = m[2].split(',');
        const localized = [];
        for (const part of parts) {
          const [url, ...descriptor] = part.trim().split(/\s+/);
          const local = await download(url, 'image');
          localized.push(`${local ? relative(filename, local) : url} ${descriptor.join(' ')}`.trim());
        }
        changed = changed.replace(m[0], `${attr}=${m[1]}${localized.join(', ')}${m[1]}`);
      } else {
        if (!absolute(m[2])) continue;
        const local = await download(m[2], type);
        if (local) changed = changed.replace(m[0], `${attr}=${m[1]}${relative(filename, local)}${m[1]}`);
      }
    }
    html = html.replace(tag, () => changed);
  }
  // Inline styles can contain background images too.
  for (const match of [...html.matchAll(/url\(\s*(['"]?)(https?:\/\/[^)'"\s]+|\/\/[^)'"\s]+)\1\s*\)/gis)]) {
    const local = await download(match[2], 'image');
    if (local) html = html.replaceAll(match[0], `url("${relative(filename, local)}")`);
  }
  return html;
}

await mkdir(assetRoot, { recursive: true });
await writeFile(doiIcon, '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="18" viewBox="0 0 42 18"><rect width="42" height="18" rx="3" fill="#17669b"/><text x="21" y="13" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="bold">DOI</text></svg>');
await writeFile(fallbackIcon, '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="31" viewBox="0 0 88 31"><rect width="88" height="31" fill="#eef1f4"/><text x="44" y="20" fill="#53606c" text-anchor="middle" font-family="Arial,sans-serif" font-size="10">Gambar</text></svg>');
const files = await htmlFiles();
for (const file of files) {
  let html = await readFile(file, 'utf8');
  html = await replaceHtml(html, file);
  // A prior replacement interpreted dollar signs in OJS's CSS endpoint.
  html = html.replaceAll('/$$call$$/', () => '/$$$call$$$/');
  html = html.replaceAll('/$call$/', () => '/$$$call$$$/');
  html = html.replaceAll('/$$$call$$$page/', () => '/$$$call$$$/page/');
  await writeFile(file, html);
  console.log(file);
}
console.log(`${files.length} pages; ${cache.size} asset URLs; ${failures.length} download failures.`);
if (failures.length) console.log(failures.join('\n'));
