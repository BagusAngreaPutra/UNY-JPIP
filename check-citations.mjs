import {readFile,readdir} from 'node:fs/promises';
let checked=0;const problems=[];
for(const name of await readdir('citations')){
  if(!/\.ris$|\.bib$/i.test(name))continue;
  const text=await readFile(`citations/${name}`,'utf8');
  if(name.endsWith('.ris')?!/^TY\s+-\s+/m.test(text):!/^@\w+\s*[{(]/m.test(text))problems.push(name);
  checked++;
}
for(const name of await readdir('citations/formats')){
  if(!name.endsWith('.json'))continue;
  try{const data=JSON.parse(await readFile(`citations/formats/${name}`,'utf8'));if(!data.status||typeof data.content!=='string')problems.push(name)}catch{problems.push(name)}
  checked++;
}
console.log(`${checked} citation files checked; ${problems.length} problems.`);
if(problems.length){console.log(problems.slice(0,50).join('\n'));process.exitCode=1}
