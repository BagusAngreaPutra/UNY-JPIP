import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

async function files(dir = '.') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    if (entry.isDirectory()) result.push(...await files(path.join(dir, entry.name)));
    else if (entry.name.endsWith('.html')) result.push(path.join(dir, entry.name));
  }
  return result;
}

let checked = 0;
const missing = [];
const ids = new Map();
async function hasAnchor(file, fragment) {
  if (!ids.has(file)) {
    const html = await readFile(file, 'utf8');
    ids.set(file, new Set([...html.matchAll(/\b(?:id|name)=(['"])(.*?)\1/gis)].map(x => x[2])));
  }
  return ids.get(file).has(decodeURIComponent(fragment));
}
for (const file of await files()) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/\bhref=(['"])(.*?)\1/gis)) {
    const href = match[2].trim();
    if (!href || /^[a-z]+:/i.test(href) || href.startsWith('//')) continue;
    const pathname = href.split(/[?#]/)[0];
    const target = pathname ? path.resolve(path.dirname(file), pathname) : path.resolve(file);
    const fragment = href.includes('#') ? href.split('#')[1] : '';
    if (!pathname && !fragment) continue;
    try {
      await access(target);
      checked++;
      if (fragment && target.endsWith('.html') && !(await hasAnchor(target, fragment)))
        missing.push(`${file}: missing anchor ${href}`);
    } catch { missing.push(`${file}: ${href}`); }
  }
}
console.log(`${checked} local links checked; ${missing.length} missing.`);
if (missing.length) { console.log(missing.join('\n')); process.exitCode = 1; }
