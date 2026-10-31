import {readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';
async function files(d='.') {let out=[];for(const e of await readdir(d,{withFileTypes:true})){if(['assets','pdfs','documents','viewers','node_modules'].includes(e.name))continue;if(e.isDirectory())out.push(...await files(path.join(d,e.name)));else if(e.name.endsWith('.html'))out.push(path.join(d,e.name));}return out}
const destinations=new Map([
  ['Peer-Review Process','publication-ethics.html#peerReview'],
  ['Copyright Notice','submissions.html#copyrightNotice'],
  ['Open-Acces Policy','about.html#openAccess'],
  ['Plagiarism Policy','publication-ethics.html#plagiarismPolicy'],
  ['Indexing','index.html#indexing'],
  ['Contact','contact.html'],
]);
let count=0;
for(const file of await files()){
  let html=await readFile(file,'utf8');const before=html,prefix=file.includes(path.sep)?'../':'';
  if(file==='about.html')html=html.replace(/<p data-start="102" data-end="545">All articles/, '<p id="openAccess" data-start="102" data-end="545">All articles');
  if(file==='publication-ethics.html'){
    html=html.replace('<p>The ethic norms that must hold', '<p id="plagiarismPolicy">The ethic norms that must hold');
    html=html.replace('<p>Duties of Reviewers</p>', '<p id="peerReview">Duties of Reviewers</p>');
  }
  if(file==='submissions.html'){
    html=html.replace('<div class="copyright_notice">','<div class="copyright_notice" id="copyrightNotice">');
    html=html.replace('<div class="cmp_notification">','<div class="cmp_notification" id="onlineSubmissions">');
  }
  if(file==='index.html')html=html.replace('<p>Accepted and published papers', '<p id="indexing">Accepted and published papers');
  html=html.replace(/<a\b[^>]*href=['"](?:\.\.\/)?about\.html['"][^>]*>[\s\S]*?<\/a>/gi,anchor=>{
    const label=anchor.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    const target=destinations.get(label);
    if(!target)return anchor;
    const updated=anchor.replace(/\bhref=['"][^'"]*['"]/,`href="${prefix}${target}"`);
    return label==='Open-Acces Policy'?updated.replace('Open-Acces Policy','Open Access Policy'):updated;
  });
  html=html.replace(/href=['"]https:\/\/docs\.google\.com\/document\/d\/1ur1NU0Tv2_bTUxxXZXTt5renCcIr8BG_\/export\?format=docx['"]/g,
    `href="${prefix}documents/template-jpip.docx" download="template-jpip.docx"`);
  html=html.replace(/<a\b[^>]*>/gi,tag=>{
    const href=tag.match(/\bhref=['"]([^'"]+)['"]/i)?.[1]||'';
    return href && !/^(?:https?:|mailto:|#|\/\/)/i.test(href)
      ?tag.replace(/\s+target=['"]_blank['"]/i,''):tag;
  });
  html=html.replace(/<p><a href="https:\/\/statcounter\.com\/p13198745\/\?guest=1">View My Stats<\/a><\/p>/g,'');
  html=html.replace(/href="\/index\.php\/jpip\/manager\/setup\/[^\"]+"(?=>Creative Commons Attribution-ShareAlike 4\.0 International License)/g,
    'href="https://creativecommons.org/licenses/by-sa/4.0/"');
  if(html!==before){await writeFile(file,html);count++}
}
console.log(`${count} pages polished.`);
