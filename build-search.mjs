import { readFile, writeFile, readdir } from 'node:fs/promises';

function decode(value='') {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|rsquo|ndash|mdash);/gi, (_, entity) => {
    const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:'’',ndash:'–',mdash:'—'};
    if(entity[0]==='#')return String.fromCodePoint(entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10));
    return named[entity.toLowerCase()]||`&${entity};`;
  });
}
function meta(html, name) {
  const tag=html.match(new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i'))?.[0]||'';
  return decode(tag.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2]||'');
}
// Reuse the issue's article markup in search so both views stay consistent.
const summaries=new Map();
const issueFiles=(await readdir('issues')).filter(name=>/^\d+\.html$/.test(name));
issueFiles.sort((a,b)=>a==='3133.html'?-1:b==='3133.html'?1:0);
for(const file of issueFiles){
  const html=await readFile(`issues/${file}`,'utf8');
  const starts=html.matchAll(/<div class="obj_article_summary">/g);
  for(const start of starts){
    const tags=/<div\b[^>]*>|<\/div>/gi;tags.lastIndex=start.index;
    let depth=0,match,end;
    while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){end=tags.lastIndex;break;}}
    if(!end)continue;
    const summary=html.slice(start.index,end).replace(/\b(href|src)=(['"])\.\.\//g,'$1=$2');
    const id=summary.match(/id=['"]article-(\d+)/)?.[1];
    if(id&&!summaries.has(id))summaries.set(id,summary);
  }
}
const items=[];
for(const name of await readdir('articles')) {
  if(!/^\d+\.html$/.test(name))continue;
  const html=await readFile(`articles/${name}`,'utf8');
  const authors=[...html.matchAll(/<meta\s+name=["']citation_author["'][^>]*>/gi)]
    .map(m=>decode(m[0].match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2]||'')).filter(Boolean);
  const id=name.slice(0,-5), title=meta(html,'citation_title')||`Article ${id}`;
  const displayDate=meta(html,'citation_date').replaceAll('/','-');
  const parts=displayDate.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  const date=parts ? [parts[1],...(parts[2]?[parts[2].padStart(2,'0')]:[]),...(parts[3]?[parts[3].padStart(2,'0')]:[])].join('-') : '';
  const dateStart=parts ? `${parts[1]}-${(parts[2]||'01').padStart(2,'0')}-${(parts[3]||'01').padStart(2,'0')}` : '';
  const lastDay=parts?.[2]?new Date(Number(parts[1]),Number(parts[2]),0).getDate():31;
  const dateEnd=parts ? `${parts[1]}-${(parts[2]||'12').padStart(2,'0')}-${(parts[3]||String(lastDay)).padStart(2,'0')}` : '';
  const keywords=[...html.matchAll(/<meta\s+name=["']citation_keywords["'][^>]*>/gi)]
    .map(m=>decode(m[0].match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2]||'')).filter(Boolean);
  if(!keywords.length){
    const abstract=html.match(/<section class="item abstract">[\s\S]*?<\/section>/)?.[0]||'';
    const text=decode(abstract.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
    const words=text.match(/Keywords\s*:\s*(.*)/i)?.[1];if(words)keywords.push(words.trim());
  }
  items.push({id,title,authors,date,dateStart,dateEnd,displayDate,keywords,summaryHtml:summaries.get(id)||''});
}
items.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
await writeFile('search-data.js',`window.JPIP_SEARCH_DATA = ${JSON.stringify(items)};\n`);
let page=await readFile('search.html','utf8');
page=page.replace(/(<form\s+class="cmp_form"\s+method="get"\s+action=")[^"]+("[^>]*>)/,
  '$1search.html$2');
const firstYear=Math.min(...items.map(item=>Number(item.date.slice(0,4))).filter(Boolean));
const lastYear=Math.max(...items.map(item=>Number(item.date.slice(0,4))).filter(Boolean));
const yearOptions='<option></option>'+Array.from({length:lastYear-firstYear+1},(_,i)=>
  `<option value="${firstYear+i}">${firstYear+i}</option>`).join('');
for(const id of ['dateFromYear','dateToYear'])
  page=page.replace(new RegExp(`(<select id="${id}"[^>]*>)[\\s\\S]*?(<\\/select>)`),
    (_,open,close)=>open+yearOptions+close);
if(!page.includes('search-local.js'))page=page.replace('</body>',
  '<script src="search-data.js"></script><script src="search-local.js"></script>\n</body>');
await writeFile('search.html',page);
console.log(`${items.length} articles indexed for local search.`);
