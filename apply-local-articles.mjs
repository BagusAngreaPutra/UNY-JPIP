import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {renderLocalDetail} from './render-local-detail.mjs';

// Keep user-supplied additions separate from the downloaded OJS snapshot.
const articles = JSON.parse(await readFile('local-articles.json', 'utf8'));
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const template = await readFile('articles/99022.html', 'utf8');
for (const dir of ['articles','pdfs','citations']) await mkdir(dir,{recursive:true});
for (const a of articles) {
  await copyFile(a.source, `pdfs/${a.pdf}`);
  await writeFile(`articles/${a.id}.html`,await renderLocalDetail(template,a));
  const ris = ['TY  - JOUR',...a.authorNames.map(name=>`AU  - ${name.literal ?? `${name.family}, ${name.given}`}`),`TI  - ${a.title}`,'JO  - Jurnal Penelitian Ilmu Pendidikan',`PY  - ${a.year}`,`VL  - ${a.volume}`,`IS  - ${a.number}`,`SP  - ${a.firstPage}`,`EP  - ${a.lastPage}`,`DO  - ${a.doi}`,`UR  - ${a.doiUrl}`,'ER  -',''].join('\n');
  await writeFile(`citations/${a.id}.ris`,ris);
  const bib = `@article{jpip${a.id},\n  title = {${a.title}},\n  author = {${a.authorNames.map(name=>name.literal?`{${name.literal}}`:`${name.family}, ${name.given}`).join(' and ')}},\n  journal = {Jurnal Penelitian Ilmu Pendidikan},\n  year = {${a.year}},\n  volume = {${a.volume}},\n  number = {${a.number}},\n  pages = {${a.firstPage}--${a.lastPage}},\n  doi = {${a.doi}},\n  url = {${a.doiUrl}}\n}\n`;
  await writeFile(`citations/${a.id}.bib`,bib);
}

for (const file of ['issues/3133.html','index.html','current.html']) {
  let html = await readFile(file,'utf8');
  // Home/current may point to a different issue after a future source update.
  if (!html.includes('Vol. 19 No. 2 (2026)')) continue;
  html = html.replace(/<!-- local-articles:start -->[\s\S]*?<!-- local-articles:end -->\s*/g,'');
  const prefix = file.startsWith('issues/')?'../':'';
  const items = articles.map(a=>`<li><div class="obj_article_summary">
<h3 class="title"><a id="article-${a.id}" href="${prefix}articles/${a.id}.html">${esc(a.title)}</a></h3>
<div class="meta"><div class="authors">${a.authors.map((name,index)=>`<span class="contribDegrees">${esc(name)} (${esc(a.authorAffiliations?.[index] ?? a.affiliation)})</span>`).join('<br/>')}</div></div>
<div class="doi_badge"></div>
<div class="newpages"><i class="fa fa-file-text" aria-hidden="true"></i> ${a.firstPage}—${a.lastPage}</div>
<div class="article_statistic" style="clear:both;">
  <div class="abstract_count"><span class="article_stat"><i class="fa fa-area-chart" aria-hidden="true"></i> Abstract View : 0 </span></div>
  <div class="pdf_count"><span class="galley_stat"><i class="fa fa-line-chart" aria-hidden="true"></i> PDF downloads: 0 </span></div>
  <div class="div_doi"><span class="doi_logo"> </span><img src="${prefix}assets/journal.uny.ac.id/public/assets/images/doi.png" alt=""><a href="${esc(a.doiUrl)}"> DOI : ${esc(a.doi)}</a></div>
</div>
<div class="galley_list"><ul class="galleys_links"><li><a class="obj_galley_link pdf" href="${prefix}viewers/${a.pdf.replace('.pdf','.html')}" aria-labelledby="article-${a.id}">PDF</a></li></ul></div>
</div></li>`).join('\n');
  // Find the actual article-list closing tag, accounting for nested galley lists.
  const start = html.indexOf('<ul class="cmp_article_list articles">');
  if (start === -1) throw new Error(`${file}: article list missing`);
  const tags = /<ul\b[^>]*>|<\/ul>/gi; tags.lastIndex=start;
  let depth=0, end=-1, match;
  while ((match=tags.exec(html))) {
    depth += match[0].startsWith('</')?-1:1;
    if(depth===0){end=match.index;break;}
  }
  if(end===-1)throw new Error(`${file}: article list not closed`);
  html=html.slice(0,end)+`<!-- local-articles:start -->\n${items}\n<!-- local-articles:end -->\n`+html.slice(end);
  await writeFile(file,html);
}
console.log(`${articles.length} local articles added to Vol. 19 No. 2, with details and citations.`);
