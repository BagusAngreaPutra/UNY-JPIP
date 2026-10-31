import { writeFile, mkdir } from 'node:fs/promises';

const origin = 'https://journal.uny.ac.id';
const root = `${origin}/index.php/jpip/`;
const issueArg = process.argv.indexOf('--issue');
const issueId = issueArg === -1 ? null : process.argv[issueArg + 1];
if (issueArg !== -1 && !/^\d+$/.test(issueId ?? '')) {
  throw new Error('Usage: node update-site.mjs --issue <numeric issue ID>');
}
const pages = new Map([
  ['index', 'index.html'],
  ['about', 'about.html'],
  ['about/submissions', 'submissions.html'],
  ['Author-guidelines', 'author-guidelines.html'],
  ['about/editorialTeam', 'editorial-team.html'],
  ['about/privacy', 'privacy.html'],
  ['about/contact', 'contact.html'],
  ['issue/current', 'current.html'],
  ['issue/archive', 'archive.html'],
  ['announcement', 'announcements.html'],
  ['search', 'search.html'],
  ['focus-and-scope', 'focus-and-scope.html'],
  ['publication-ethics', 'publication-ethics.html'],
  ['peer-reviewers', 'peer-reviewers.html'],
  ['author-fees', 'author-fees.html'],
  ['ai-policy', 'ai-policy.html'],
  ['information/readers', 'readers.html'],
  ['information/authors', 'authors.html'],
  ['information/librarians', 'librarians.html'],
  ['about/aboutThisPublishingSystem', 'publishing-system.html'],
]);

async function get(slug) {
  const response = await fetch(root + slug);
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
  return response.text();
}

const source = await get('index');
const archive = await get('issue/archive');
const issueSource = issueId ? await get(`issue/view/${issueId}`) : null;
if (issueId) {
  for (const slug of [...pages.keys()]) {
    if (!['index', 'issue/current', 'issue/archive'].includes(slug)) pages.delete(slug);
  }
  pages.set(`issue/view/${issueId}`, `issues/${issueId}.html`);
}
for (const match of (issueSource ?? source).matchAll(/href=["']https?:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/article\/view\/(\d+)["']/g)) {
  pages.set(`article/view/${match[1]}`, `articles/${match[1]}.html`);
}
for (const match of (issueId ? '' : archive).matchAll(/href=["']https?:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/issue\/view\/(\d+)["']/g)) {
  pages.set(`issue/view/${match[1]}`, `issues/${match[1]}.html`);
}

function localize(html, filename) {
  const prefix = filename.includes('/') ? '../' : '';
  // Some OJS records contain a malformed relative license URL. Its visible
  // label describes the intended Creative Commons license.
  html = html.replace(/href="\/index\.php\/jpip\/manager\/setup\/[^\"]+"(?=>Creative Commons Attribution-ShareAlike 4\.0 International License)/g,
    'href="https://creativecommons.org/licenses/by-sa/4.0/"');
  html = html.replace(/\bhref=(['"])(.*?)\1/gis, (whole, quote, value) => {
    const trimmed = value.trim().replace(/&amp;/g, '&');
    let url;
    try { url = new URL(trimmed, root); } catch { return whole; }
    if (url.origin !== origin) return whole;
    const slug = url.pathname.replace(/^\/index\.php\/jpip\/?/, '') || 'index';
    if (!pages.has(slug) || url.search) {
      return trimmed.startsWith('/') ? `href=${quote}${url.href}${quote}` : whole;
    }
    return `href=${quote}${prefix}${pages.get(slug)}${url.hash}${quote}`;
  });
  html = html.replace(/\bsrc=(['"])\/([^/][^'"]*)\1/gis,
    (_, quote, value) => `src=${quote}${origin}/${value}${quote}`);
  // The copied OJS pages should not register visits with the source site's analytics.
  html = html.replace(/<!-- Default Statcounter code[\s\S]*?End of Statcounter Code -->/g, '');
  html = html.replace(/<script[^>]*src=["']https:\/\/www\.statcounter\.com\/counter\/counter\.js[^>]*><\/script>/gi, '');
  return html;
}

await mkdir('articles', { recursive: true });
await mkdir('issues', { recursive: true });
let count = 0;
for (const [slug, filename] of pages) {
  const html = slug === 'index' ? source : slug === 'issue/archive' ? archive
    : slug === `issue/view/${issueId}` ? issueSource : await get(slug);
  await writeFile(filename, localize(html, filename), 'utf8');
  console.log(`${filename} <- ${slug}`);
  count++;
}
console.log(`Saved ${count} pages.`);
await import('./finish-pages.mjs');
await import('./localize-assets.mjs');
await import('./localize-pdfs.mjs');
await import('./apply-local-articles.mjs');
await import('./build-pdf-viewers.mjs');
await import('./build-search.mjs');
await import('./localize-citations.mjs');
await import('./localize-citation-formats.mjs');
await import('./polish-navigation.mjs');
