import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
import {storeAsset,readAsset,deleteAsset,mediaPayload,validateMedia,clearAssets} from '../extension/media.js';
import {personalize} from '../extension/core.js';
test('foto persiste com identidade e bytes; payload preserva MIME e tamanho',async()=>{const f=new File([new Uint8Array([1,2,3,4])],'foto.png',{type:'image/png'});const meta=await storeAsset(f);assert.equal(meta.name,'foto.png');const payload=await mediaPayload(meta);assert.equal(payload.base64,'AQIDBA==');assert.equal(payload.type,'image/png');assert.equal((await readAsset(meta.id)).size,4);await assert.rejects(mediaPayload({...meta,size:5}));await deleteAsset(meta.id);await assert.rejects(mediaPayload(meta));});
test('rejeita formatos não suportados, arquivo vazio e acima do limite',()=>{for(const f of [{type:'image/svg+xml',size:100},{type:'image/png',size:0},{type:'video/mp4',size:20},{type:'image/jpeg',size:5242881}])assert.throws(()=>validateMedia(f));});
test('legenda admite foto sem texto, valida campos e respeita o limite',()=>{const c={fields:{nome:'Ana'}};assert.equal(personalize('',c,true,1024),'');assert.throws(()=>personalize('',c));assert.throws(()=>personalize('x'.repeat(1025),c,true,1024));assert.throws(()=>personalize('{{desconhecido}}',c,true,1024));});
test('apagar campanha remove os arquivos do IndexedDB',async()=>{const meta=await storeAsset(new File(['abc'],'foto.jpg',{type:'image/jpeg'}));await clearAssets();assert.equal(await readAsset(meta.id),undefined);});
