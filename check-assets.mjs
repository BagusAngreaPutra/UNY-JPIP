import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

async function files(dir = '.') {
  let result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    if (entry.isDirectory()) result.push(...await files(path.join(dir, entry.name)));
    else if (/\.(?:html|css)$/i.test(entry.name)) result.push(path.join(dir, entry.name));
  }
  return result;
}

let checked = 0;
const problems = [];
async function check(file, value) {
  if (!value || /^(data:|blob:|#)/i.test(value)) return;
  if (/^(https?:)?\/\//i.test(value)) { problems.push(`${file}: remote asset ${value}`); return; }
  const target = path.resolve(path.dirname(file), value.split(/[?#]/)[0]);
  try { await access(target); checked++; } catch { problems.push(`${file}: missing ${value}`); }
}

for (const file of await files()) {
  const content = await readFile(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const m of content.matchAll(/<(img|script|source|video|audio|link)\b[^>]*?>/gis)) {
      const tag = m[0];
      const kind = m[1].toLowerCase();
      for (const attr of ['src', 'poster', 'srcset', 'href']) {
        if (attr === 'href' && !(kind === 'link' && /rel=['"](?:stylesheet|icon|shortcut icon|apple-touch-icon)['"]/i.test(tag))) continue;
        const value = tag.match(new RegExp(`\\b${attr}=['"]([^'"]+)['"]`, 'i'))?.[1];
        if (!value) continue;
        if (attr === 'srcset') for (const part of value.split(',')) await check(file, part.trim().split(/\s+/)[0]);
        else await check(file, value);
      }
    }
  }
  const styleContent = file.endsWith('.html') ? content.replace(/<script\b[\s\S]*?<\/script>/gi, '') : content;
  for (const m of styleContent.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gis)) await check(file, m[1]);
}
console.log(`${checked} local asset references checked; ${problems.length} problems.`);
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
