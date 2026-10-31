import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = 'https://journal.uny.ac.id/index.php/jpip/';
const staticRoutes = new Map([
  ['index', 'index.html'], ['about', 'about.html'], ['about/submissions', 'submissions.html'],
  ['Author-guidelines', 'author-guidelines.html'], ['about/editorialTeam', 'editorial-team.html'],
  ['about/privacy', 'privacy.html'], ['about/contact', 'contact.html'],
  ['issue/current', 'current.html'], ['issue/archive', 'archive.html'],
  ['announcement', 'announcements.html'], ['search', 'search.html'],
  ['focus-and-scope', 'focus-and-scope.html'], ['publication-ethics', 'publication-ethics.html'],
  ['peer-reviewers', 'peer-reviewers.html'], ['author-fees', 'author-fees.html'],
  ['ai-policy', 'ai-policy.html'], ['information/readers', 'readers.html'],
  ['information/authors', 'authors.html'], ['information/librarians', 'librarians.html'],
  ['about/aboutThisPublishingSystem', 'publishing-system.html'],
]);
async function htmlFiles(dir='.') {
  let out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(['assets','pdfs','documents','viewers','node_modules'].includes(entry.name))continue;
    if(entry.isDirectory())out.push(...await htmlFiles(path.join(dir,entry.name)));
    else if(entry.name.endsWith('.html'))out.push(path.join(dir,entry.name));
  }
  return out;
}
const originals=await htmlFiles();
const articleIds=new Set();
for(const file of originals) {
  if(!/^(index|current)\.html$/.test(file)&&!file.startsWith(`issues${path.sep}`))continue;
  const html=await readFile(file,'utf8');
  for(const match of html.matchAll(/id=['"]article-(\d+)['"]/g))articleIds.add(match[1]);
}
await mkdir('articles',{recursive:true});
const queue=[...articleIds];
let added=0, checked=0;
const failures=[];
async function worker(){
  while(queue.length){
    const id=queue.shift(), file=`articles/${id}.html`;
    if(!(await access(file).then(()=>true).catch(()=>false))){
      try{
        const response=await fetch(`${root}article/view/${id}`,{signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        await writeFile(file,await response.text(),'utf8');
        added++;
      }catch(error){failures.push(`${id}: ${error.message}`)}
    }
    checked++;
    if(checked%25===0||checked===articleIds.size)console.log(`${checked}/${articleIds.size} article detail pages checked`);
  }
}
await Promise.all(Array.from({length:8},()=>worker()));

const routes=new Map(staticRoutes);
for(const id of articleIds)if(await access(`articles/${id}.html`).then(()=>true).catch(()=>false))routes.set(`article/view/${id}`,`articles/${id}.html`);
for(const name of await readdir('issues'))if(/^\d+\.html$/.test(name))routes.set(`issue/view/${name.slice(0,-5)}`,`issues/${name}`);
let changed=0;
for(const file of await htmlFiles()){
  let html=await readFile(file,'utf8');
  const prefix=file.includes(path.sep)?'../':'';
  html=html.replace(/\bhref=(['"])(.*?)\1/gis,(whole,q,value)=>{
    const raw=value.trim().replace(/&amp;/g,'&');
    let url;try{url=new URL(raw,root)}catch{return whole}
    if(url.origin!=='https://journal.uny.ac.id')return whole;
    const slug=url.pathname.replace(/^\/index\.php\/jpip\/?/,'')||'index';
    if(!routes.has(slug)||url.search)return raw.startsWith('/')?`href=${q}${url.href}${q}`:whole;
    return `href=${q}${prefix}${routes.get(slug)}${url.hash}${q}`;
  });
  html=html.replace(/\bsrc=(['"])\/([^/][^'"]*)\1/gis,(_,q,value)=>`src=${q}https://journal.uny.ac.id/${value}${q}`);
  html=html.replace(/<!-- Default Statcounter code[\s\S]*?End of Statcounter Code -->/g,'');
  html=html.replace(/<script[^>]*src=['"][^'"]*badge(?:-[0-9a-f]+)?\.js[^>]*><\/script>/gi,'');
  html=html.replace(/<link[^>]*href=['"][^'"]*badge\.css[^>]*\/?>/gi,'');
  html=html.replace(/<(span|div)\b[^>]*class=['"][^'"]*__dimensions_badge_embed__[^'"]*['"][^>]*><\/\1>/gi,'');
  html=html.replace(/<a\b([^>]*?)\btarget=['"]_blank['"]([^>]*)>/gis,(whole,before,after)=>
    /href=['"](?:\.\.\/)?(?:[a-z-]+\.html|articles\/\d+\.html|issues\/\d+\.html)/i.test(whole)
      ?`<a ${before}${after}>`:whole);
  html=html.replace(/https:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/search(?:\/search)?\?query=/g,'search.html?query=');
  // Restore relative paths for tag-cloud search links on nested pages.
  if(prefix)html=html.replaceAll('"search.html?query=',`"${prefix}search.html?query=`);
  if(html!==await readFile(file,'utf8')){await writeFile(file,html);changed++}
}
console.log(`${added} article pages added; ${changed} pages updated; ${failures.length} fetch failures.`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
