import { cp, mkdir, rm } from 'node:fs/promises';
const out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','admin.html','assets','data','.nojekyll'])await cp(new URL('../'+file,import.meta.url),new URL(file,out),{recursive:true});
console.log('Built AppHub in dist/ (no dependencies).');
