import { readdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';

let valid = 0;
const problems = [];
for (const [dir, ext, signature] of [['pdfs', '.pdf', '%PDF'], ['documents', '.docx', 'PK']]) {
  for (const name of await readdir(dir)) {
    if (!name.endsWith(ext)) continue;
    const file = path.join(dir, name);
    const handle = await open(file);
    const buffer = Buffer.alloc(signature.length);
    await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();
    if (buffer.toString() === signature) valid++;
    else problems.push(`${file}: invalid signature`);
  }
}
async function htmlFiles(dir='.') {
  let out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if (['assets', 'pdfs', 'documents', 'node_modules'].includes(entry.name)) continue;
    if(entry.isDirectory()) out.push(...await htmlFiles(path.join(dir,entry.name)));
    else if(entry.name.endsWith('.html')) out.push(path.join(dir,entry.name));
  }
  return out;
}
for (const file of await htmlFiles()) {
  const html = await readFile(file,'utf8');
  if (/https?:\/\/journal\.uny\.ac\.id\/index\.php\/jpip\/article\/(?:view|download)\/\d+\/\d+/.test(html))
    problems.push(`${file}: remote article file link`);
}
console.log(`${valid} PDF/DOCX files validated; ${problems.length} problems.`);
if(problems.length){console.log(problems.join('\n'));process.exitCode=1;}
