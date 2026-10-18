import JSZip from 'jszip';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';import {createHash} from 'node:crypto';
const artifacts='artifacts';await mkdir(artifacts,{recursive:true});
async function addTree(zip,dir,prefix){for(const item of await readdir(dir,{withFileTypes:true})){const file=join(dir,item.name),name=prefix+'/'+item.name;if(item.name==='.gitkeep')continue;if(item.isDirectory())await addTree(zip,file,name);else zip.file(name,await readFile(file));}}
const product=new JSZip();await addTree(product,'extension','Contato-Flow-Chrome');product.file('Contato-Flow-Chrome/LEIA-ME.txt',await readFile('README.md'));product.file('Contato-Flow-Chrome/ANALISE-REA.md',await readFile('docs/ANALISE-REA.md'));
const source=new JSZip();for(const dir of ['extension','scripts','tests','docs'])await addTree(source,dir,'Contato-Flow-Fonte/'+dir);for(const file of ['package.json','package-lock.json','README.md','.gitignore'])source.file('Contato-Flow-Fonte/'+file,await readFile(file));
for(const [name,zip] of [['Contato-Flow-Chrome.zip',product],['Contato-Flow-Codigo-Fonte.zip',source]]){
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});await writeFile(join(artifacts,name),bytes);await writeFile(join(artifacts,name+'.sha256'),createHash('sha256').update(bytes).digest('hex')+'  '+name+'\n');console.log(name+': '+bytes.length+' bytes');
 // Validate archive integrity and the installed root, not just ZIP creation.
 const loaded=await JSZip.loadAsync(bytes,{checkCRC32:true});const root=name.includes('Codigo')?'Contato-Flow-Fonte/extension/':'Contato-Flow-Chrome/';const manifest=JSON.parse(await loaded.file(root+'manifest.json').async('string'));
 if(manifest.manifest_version!==3||!loaded.file(root+manifest.background.service_worker))throw Error('Pacote inválido');
 for(const path of ['app.html','app.js','core.js','content.js','media.js','vendor/exceljs.min.js',...Object.values(manifest.icons)])if(!loaded.file(root+path))throw Error('Arquivo ausente: '+path);
}
