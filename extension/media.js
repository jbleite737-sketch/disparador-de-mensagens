export const MEDIA_LIMIT=5*1024*1024;
export function validateMedia(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
 if(!file.size||file.size>MEDIA_LIMIT)throw Error('A foto deve ter até 5 MB.');
}
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('contato-flow-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function operation(mode,fn){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),r=fn(tx.objectStore('photos'));let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('Falha ao salvar foto.'));tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export const readAsset=id=>operation('readonly',s=>s.get(id));
export async function storeAsset(file){validateMedia(file);const meta={id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size};await operation('readwrite',s=>s.put(file,meta.id));return meta;}
export const clearAssets=()=>operation('readwrite',s=>s.clear());
export const deleteAsset=id=>operation('readwrite',s=>s.delete(id));
export async function mediaPayload(meta){
 if(!meta)return null;const file=await readAsset(meta.id);if(!file)throw Error('Foto não encontrada neste navegador. Crie um novo rascunho e selecione novamente.');
 validateMedia(file);if(file.type!==meta.type||file.size!==meta.size)throw Error('A foto salva não corresponde ao rascunho.');
 let binary='';const bytes=new Uint8Array(await file.arrayBuffer());for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return {...meta,base64:btoa(binary)};
}
