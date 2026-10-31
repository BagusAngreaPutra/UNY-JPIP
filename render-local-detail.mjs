import {readFile, writeFile, mkdir} from 'node:fs/promises';
import CSL from 'citeproc';

export const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const esc = escapeHtml;
const styleNames = ['acm-sig-proceedings','acs-nano','apa','associacao-brasileira-de-normas-tecnicas','chicago-author-date','harvard-cite-them-right','ieee','modern-language-association','turabian-fullnote-bibliography','vancouver'];
const styles = new Map(await Promise.all(styleNames.map(async name=>[name,await readFile(`assets/csl/${name}.csl`,'utf8')])));
const locales = new Map(await Promise.all(['en-US','pt-BR'].map(async name=>[name,await readFile(`assets/csl/locales-${name}.xml`,'utf8')])));

function referenceHtml(text) {
  return esc(text).replace(/https?:\/\/[^\s<>]+/g, url=>{
    const clean=url.replace(/[.,;]+$/,'');
    return `<a href="${clean}">${clean}</a>${url.slice(clean.length)}`;
  });
}

export async function renderLocalDetail(template, a) {
  const citationItem = {id:a.id, type:'article-journal',title:a.title,author:a.authorNames,
    'container-title':'Jurnal Penelitian Ilmu Pendidikan',volume:a.volume,issue:a.number,
    page:`${a.firstPage}-${a.lastPage}`,issued:{'date-parts':[[Number(a.year)]]}, DOI:a.doi,URL:a.doiUrl,language:'en'};
  const citations={};
  await mkdir('citations/formats',{recursive:true});
  for(const [name,style] of styles) {
    const engine=new CSL.Engine({retrieveLocale:lang=>locales.get(lang)??locales.get('en-US'),retrieveItem:()=>citationItem},style);
    engine.updateItems([a.id]);
    const result=engine.makeBibliography();
    if(!result?.[1]?.length)throw Error(`No citation generated: ${a.id}/${name}`);
    citations[name]=`<div class="csl-bib-body">${result[1].join('')}</div>`;
    await writeFile(`citations/formats/${a.id}-${name}.json`,JSON.stringify({status:true,content:citations[name],elementId:'0',events:null}));
  }
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,()=>`<title>${esc(a.title)} | Jurnal Penelitian Ilmu Pendidikan</title>`);
  html=html.replace(/<meta\b[^>]*>/gi,tag=>/name="(?:viewport|generator|gs_meta_revision)"|charset=/i.test(tag)?tag:'');
  const meta={citation_journal_title:'Jurnal Penelitian Ilmu Pendidikan',citation_journal_abbrev:'JPIP',citation_issn:'2541-5492',
    citation_title:a.title,citation_language:'en',citation_date:a.year,citation_volume:a.volume,citation_issue:a.number,
    citation_firstpage:a.firstPage,citation_lastpage:a.lastPage,citation_doi:a.doi,citation_pdf_url:`../pdfs/${a.pdf}`,
    citation_keywords:a.keywords.join('; '),'DC.Title':a.title,'DC.Description':`${a.abstract}\nKeywords: ${a.keywords.join('; ')}`,
    'DC.Language':'en','DC.Date.issued':a.year,'DC.Date.dateSubmitted':a.receivedDate,
    'DC.Date.accepted':a.acceptedDate,'DC.Format':'application/pdf','DC.Identifier':a.id,
    'DC.Identifier.DOI':a.doi,'DC.Identifier.pageNumber':`${a.firstPage}–${a.lastPage}`,'DC.Source':'Jurnal Penelitian Ilmu Pendidikan',
    'DC.Source.ISSN':'2541-5492','DC.Source.Volume':a.volume,'DC.Source.Issue':a.number,
    'DC.Rights':`Copyright (c) ${a.year} ${a.authors.join(', ')}`};
  const tags=Object.entries(meta).map(([name,value])=>`<meta name="${name}" content="${esc(value)}">`);
  a.authors.forEach((name,i)=>tags.push(`<meta name="citation_author" content="${esc(name)}">`,
    `<meta name="citation_author_institution" content="${esc(a.authorAffiliations[i])}">`,`<meta name="DC.Creator.PersonalName" content="${esc(name)}">`));
  for(const ref of a.references)tags.push(`<meta name="citation_reference" content="${esc(ref)}">`);
  tags.push('<meta name="DC.Rights" content="https://creativecommons.org/licenses/by-sa/4.0/">');
  html=html.replace('</head>',()=>`${tags.join('\n')}\n</head>`);
  html=html.replace(/(<h1 class="page_title">)[\s\S]*?(<\/h1>)/,()=>`<h1 class="page_title">${esc(a.title)}</h1>`);
  html=html.replace(/<section class="item authors">[\s\S]*?<\/section>/,()=>`<section class="item authors"><h2 class="pkp_screen_reader">Authors</h2><ul class="authors">${a.authors.map((name,i)=>`<li><span class="name">${esc(name)}</span><span class="affiliation">${esc(a.authorAffiliations[i])}</span></li>`).join('')}</ul></section>`);
  html=html.replace(/<section class="item doi">[\s\S]*?<\/section>/,()=>`<section class="item doi"><h2 class="label">DOI:</h2> <span class="value"><a href="${esc(a.doiUrl)}">${esc(a.doiUrl)}</a></span></section>`);
  html=html.replace(/<section class="item abstract">[\s\S]*?<\/section>/,()=>`<section class="item abstract"><h2 class="label">Abstract</h2><div class="abstrak"><p>${esc(a.abstract)}</p><p><strong>Keywords</strong><strong>:</strong> ${esc(a.keywords.join('; '))}</p></div></section>`);
  html=html.replace(/<section class="item references">[\s\S]*?<\/section>/,()=>`<section class="item references"><h2 class="label">References</h2><div class="value">${a.references.map(text=>`<p>${referenceHtml(text)}</p>`).join('\n')}</div></section>`);
  const published=template.match(/<div class="item published">[\s\S]*?<\/section>\s*<\/div>/)?.[0];
  if(!published)throw Error('Published template missing');
  // The PDFs supply a publication year, not a full publication date.
  html=html.replace(/<div class="item published">[\s\S]*?<\/section>\s*<\/div>/,()=>published.replace(/<span>[\s\S]*?<\/span>/,`<span>${a.year}</span>`));
  html=html.replace(/(<div id="citationOutput"[^>]*>)[\s\S]*?(?=\s*<div class="citation_formats">)/,()=>`<div id="citationOutput" role="region" aria-live="polite">${citations.apa}</div>\n`);
  html=html.replace(/<a\b[\s\S]*?<\/a>/g,tag=>{
    if(!tag.includes('data-load-citation'))return tag;
    const style=tag.match(/data-json-href="[^\"]*99022-([a-z0-9-]+)\.json"/)?.[1];
    if(!style)throw Error('Citation style template missing');
    return tag.replace(/href="[^"]+"/,`href="../citations/formats/${a.id}-${style}.json"`)
      .replace(/data-json-href="[^"]+"/,`data-json-href="../citations/formats/${a.id}-${style}.json"`);
  });
  html=html.replaceAll('../viewers/99022-26322.html',`../viewers/${a.pdf.replace('.pdf','.html')}`)
    .replaceAll('../citations/99022.ris',`../citations/${a.id}.ris`).replaceAll('../citations/99022.bib',`../citations/${a.id}.bib`);
  html=html.replace(/<p>Copyright \(c\) 2026[^<]*<\/p>/,()=>`<p>Copyright (c) ${a.year} ${esc(a.authors.join(', '))}</p>`);
  if(html.includes('99022')||html.includes('Barkafik')||html.includes('Saputra'))throw Error(`Stale template data in ${a.id}`);
  return html;
}
