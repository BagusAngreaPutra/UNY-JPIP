import {readFile,writeFile,readdir,mkdir,access} from 'node:fs/promises';import path from 'node:path';
async function files(d='.') {let out=[];for(const e of await readdir(d,{withFileTypes:true})){if(['assets','pdfs','documents','viewers','node_modules','citations'].includes(e.name))continue;if(e.isDirectory())out.push(...await files(path.join(d,e.name)));else if(e.name.endsWith('.html'))out.push(path.join(d,e.name));}return out}
const pattern=/https:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/citationstylelanguage\/download\/(ris|bibtex)\?submissionId=(\d+)&amp;publicationId=(\d+)/g;
const pages=new Map(),jobs=new Map();
for(const file of await files()){const html=await readFile(file,'utf8');pages.set(file,html);for(const m of html.matchAll(pattern)){const ext=m[1]==='bibtex'?'bib':'ris';jobs.set(`${m[2]}.${ext}`,m[0].replaceAll('&amp;','&'))}}
await mkdir('citations',{recursive:true});
const queue=[...jobs],done=new Set(),failures=[];let checked=0;
async function worker(){while(queue.length){const [name,url]=queue.shift(),file=`citations/${name}`;if(await access(file).then(()=>true).catch(()=>false))done.add(name);else{try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=await response.text();if(!body.trim()||/<html/i.test(body.slice(0,200)))throw new Error('invalid citation');await writeFile(file,body);done.add(name)}catch(error){failures.push(`${name}: ${error.message}`)}}checked++;if(checked%50===0||checked===jobs.size)console.log(`${checked}/${jobs.size} citations checked`)}}
await Promise.all(Array.from({length:8},()=>worker()));
for(const [file,html] of pages){const prefix=file.includes(path.sep)?'../':'';const updated=html.replace(pattern,(whole,format,id)=>{const name=`${id}.${format==='bibtex'?'bib':'ris'}`;return done.has(name)?`${prefix}citations/${name}`:whole});if(updated!==html)await writeFile(file,updated)}
console.log(`${done.size}/${jobs.size} citations local; ${failures.length} failed.`);if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
