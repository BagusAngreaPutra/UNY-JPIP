import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const viewerDir = 'viewers';
const assetCss = '../assets/journal.uny.ac.id/index.php/jpip/$$$call$$$/page/page/css-f3842390.css';
const fontCss = '../assets/journal.uny.ac.id/lib/pkp/styles/fontawesome/fontawesome-a2782a3a.css';
const journalCss = '../assets/journal.uny.ac.id/public/journals/39/styleSheet-03d3d4ee.css';

async function htmlFiles(dir = '.') {
  let out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['assets', 'pdfs', 'documents', 'node_modules', viewerDir].includes(entry.name)) continue;
    if (entry.isDirectory()) out.push(...await htmlFiles(path.join(dir, entry.name)));
    else if (entry.name.endsWith('.html')) out.push(path.join(dir, entry.name));
  }
  return out;
}

function plain(value) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function escape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const files = await htmlFiles();
const titles = new Map();
const issuePages = new Map();
const sourcePages = new Map();
for (const file of files) {
  const html = await readFile(file, 'utf8');
  sourcePages.set(file, html);
  for (const match of html.matchAll(/<a\s+id=['"]article-(\d+)['"][^>]*>([\s\S]*?)<\/a>/gis)) {
    const id = match[1];
    if (!titles.has(id)) titles.set(id, plain(match[2]));
    if (file.startsWith(`issues${path.sep}`) && !issuePages.has(id)) issuePages.set(id, file);
  }
}

await mkdir(viewerDir, { recursive: true });
const pdfs = (await readdir('pdfs')).filter(name => /^\d+-\d+\.pdf$/.test(name));
for (const name of pdfs) {
  const id = name.split('-')[0];
  const title = titles.get(id) || `Article ${id}`;
  const articlePage = `articles/${id}.html`;
  const back = await access(articlePage).then(() => `../${articlePage}`).catch(() =>
    issuePages.has(id) ? `../${issuePages.get(id).replaceAll('\\', '/')}#article-${id}` : '../archive.html');
  const pdf = `../pdfs/${name}`;
  const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>View of ${escape(title)}</title>
  <link rel="stylesheet" href="${assetCss}">
  <link rel="stylesheet" href="${fontCss}">
  <link rel="stylesheet" href="${journalCss}">
</head>
<body class="pkp_page_article pkp_op_view">
  <header class="header_view">
    <a href="${back}" class="return" aria-label="Return to Article Details"><span class="pkp_screen_reader">Return to Article Details</span></a>
    <a href="${back}" class="title">${escape(title)}</a>
    <a href="${pdf}" class="download" download="${name}"><span class="label">Download</span><span class="pkp_screen_reader">Download PDF</span></a>
  </header>
  <div id="pdfCanvasContainer" class="galley_view"><iframe src="${pdf}" width="100%" height="100%" style="min-height:500px" title="PDF of ${escape(title)}" allowfullscreen></iframe></div>
  <script>
    const downloadLink = document.querySelector('.header_view .download');
    downloadLink.addEventListener('click', async event => {
      event.preventDefault();
      if (location.protocol === 'file:') {
        alert('Untuk mengunduh PDF, buka situs melalui start-site.cmd lalu klik Download lagi.');
        return;
      }
      if (location.hostname === '127.0.0.1' && location.port === '8765') {
        location.href = '/download/${name}';
        return;
      }
      try {
        const response = await fetch(downloadLink.href);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const url = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = '${name}';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch {
        alert('PDF tidak dapat diunduh. Coba buka situs melalui start-site.cmd.');
      }
    });
  </script>
</body>
</html>
`;
  await writeFile(`${viewerDir}/${name.replace(/\.pdf$/, '.html')}`, html);
}

let changed = 0;
for (const [file, html] of sourcePages) {
  const prefix = file.includes(path.sep) ? '../' : '';
  const updated = html.replace(/href=(['"])(?:\.\.\/)?pdfs\/(\d+-\d+)\.pdf\1/g,
    (whole, quote, key) => `href=${quote}${prefix}${viewerDir}/${key}.html${quote}`);
  if (updated !== html) { await writeFile(file, updated); changed++; }
}
console.log(`${pdfs.length} local PDF viewers built; ${changed} pages linked to viewers.`);
