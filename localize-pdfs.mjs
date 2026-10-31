import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = 'https://journal.uny.ac.id/index.php/jpip/article/';
const pdfDir = 'pdfs';
const documentDir = 'documents';
const pattern = /https?:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/article\/(?:view|download)\/(\d+)\/(\d+)(?:\/[^"'\s<>?#]*)?/g;

async function htmlFiles(dir = '.') {
  let out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['assets', pdfDir, 'documents', 'node_modules'].includes(entry.name)) continue;
    if (entry.isDirectory()) out.push(...await htmlFiles(path.join(dir, entry.name)));
    else if (entry.name.endsWith('.html')) out.push(path.join(dir, entry.name));
  }
  return out;
}

const files = await htmlFiles();
const pages = new Map();
const galleys = new Set();
for (const file of files) {
  const html = await readFile(file, 'utf8');
  pages.set(file, html);
  for (const match of html.matchAll(pattern)) galleys.add(`${match[1]}-${match[2]}`);
}
await mkdir(pdfDir, { recursive: true });
await mkdir(documentDir, { recursive: true });

async function validPdf(file) {
  try {
    const buffer = await readFile(file);
    return buffer.length > 1024 && buffer.subarray(0, 4).toString() === '%PDF';
  } catch { return false; }
}
async function validDocx(file) {
  try {
    const buffer = await readFile(file);
    return buffer.length > 1024 && buffer.subarray(0, 2).toString() === 'PK';
  } catch { return false; }
}

const success = new Map();
const failures = [];
const queue = [...galleys];
let done = 0;
let bytes = 0;
async function worker() {
  while (queue.length) {
    const key = queue.shift();
    const [article, galley] = key.split('-');
    const file = `${pdfDir}/${key}.pdf`;
    const docxFile = `${documentDir}/${key}.docx`;
    if (await validPdf(file)) {
      success.set(key, file);
    } else if (await validDocx(docxFile)) {
      success.set(key, docxFile);
    } else {
      let problem = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(`${base}download/${article}/${galley}`, { signal: AbortSignal.timeout(120000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          const isPdf = buffer.length > 1024 && buffer.subarray(0, 4).toString() === '%PDF';
          const isDocx = buffer.length > 1024 && buffer.subarray(0, 2).toString() === 'PK' &&
            response.headers.get('content-type')?.includes('wordprocessingml');
          if (!isPdf && !isDocx)
            throw new Error(`unsupported file (${response.headers.get('content-type')}, ${buffer.length} bytes)`);
          const destination = isPdf ? file : docxFile;
          await writeFile(destination, buffer);
          bytes += buffer.length;
          success.set(key, destination);
          problem = '';
          break;
        } catch (error) {
          problem = error.message;
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
      if (problem) failures.push(`${key}: ${problem}`);
    }
    done++;
    if (done % 10 === 0 || done === galleys.size)
      console.log(`${done}/${galleys.size} article files checked; ${success.size} available locally`);
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));

for (const [file, html] of pages) {
  const prefix = file.includes(path.sep) ? '../' : '';
  const updated = html.replace(pattern, (whole, article, galley) => {
    const key = `${article}-${galley}`;
    return success.has(key) ? `${prefix}${success.get(key)}` : whole;
  });
  if (updated !== html) await writeFile(file, updated);
}
console.log(`${success.size}/${galleys.size} article files local; ${(bytes / 1048576).toFixed(1)} MiB downloaded.`);
if (failures.length) {
  console.error('Failed PDFs:\n' + failures.join('\n'));
  process.exitCode = 1;
}
