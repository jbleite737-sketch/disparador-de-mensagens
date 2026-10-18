import 'fake-indexeddb/auto';
import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join,extname} from 'node:path';import {createServer} from 'node:http';import ExcelJS from 'exceljs';
// Managed Chromium forbids unpacked extensions. Exercise real UI/content/background
// code with simulated chrome.* boundaries; never modify administrative policy.
const ext=resolve('extension'),temp=await mkdtemp(join(tmpdir(),'contato-flow-test-'));await mkdir('artifacts',{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(ext,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(ext+'/'))throw Error('path');const b=await readFile(path);res.writeHead(200,{'Content-Security-Policy':"script-src 'self'; object-src 'none'",'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain'});res.end(b);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true});
let data={},receiver,onAlarm,removed,nextId=1,passed=0;const tabs=new Map(),timers=new Map();const pass=s=>{passed++;console.log('PASS',s);};
const contentSource=await readFile('extension/content.js','utf8');
globalThis.chrome={runtime:{id:'test',getURL:p=>base+p,onMessage:{addListener:f=>receiver=f},onStartup:{addListener:()=>{}}},storage:{local:{get:async()=>structuredClone(data),set:async v=>{const old=data;data={...data,...structuredClone(v)};for(const p of context.pages())if(p.url().startsWith(base))await p.evaluate(change=>window.__storageChange?.(change),{campaign:{oldValue:old.campaign,newValue:data.campaign}}).catch(()=>{});}}},action:{onClicked:{addListener:()=>{}}},alarms:{create:async(n,a)=>{clearTimeout(timers.get(n));const ms=Math.max(0,a.when-Date.now());timers.set(n,setTimeout(()=>onAlarm({name:n}),ms));},clear:async n=>{clearTimeout(timers.get(n));timers.delete(n);},onAlarm:{addListener:f=>onAlarm=f}},tabs:{get:async id=>{if(!tabs.has(id))throw Error('no tab');return{id};},create:async({url})=>{const page=await context.newPage();const id=nextId++;tabs.set(id,page);page.on('close',()=>{tabs.delete(id);removed?.(id);});await page.goto(url);return{id};},update:async(id,{url})=>{const p=tabs.get(id);await p.goto(url);await p.addScriptTag({content:contentSource});return{id};},onRemoved:{addListener:f=>removed=f}}};
await import('../extension/background.js?browser');
await context.exposeBinding('extensionRPC',async({page},m)=>{
 if(m.type==='SAVE'&&m.media){
  const bytes=await page.evaluate(async id=>{const {readAsset}=await import('/media.js');return [...new Uint8Array(await (await readAsset(id)).arrayBuffer())];},m.media.id);
  await new Promise((resolve,reject)=>{const r=indexedDB.open('contato-flow-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>{const db=r.result,tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(new File([new Uint8Array(bytes)],m.media.name,{type:m.media.type}),m.media.id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 }
 return new Promise(resolve=>{const tab=[...tabs].find(([,p])=>p===page);receiver(m,{id:'test',url:page.url(),...(tab?{tab:{id:tab[0]}}:{})},resolve);});
});
await context.addInitScript(()=>{window.chrome={runtime:{sendMessage:m=>window.extensionRPC(m)},storage:{onChanged:{addListener:f=>{window.__storageChange=c=>f(c,'local');}}}};});
try{
 await context.route('https://web.whatsapp.com/**',async route=>{
  const u=new URL(route.request().url());const payload=JSON.stringify({phone:u.searchParams.get('phone')||'',message:u.searchParams.get('text')||''}).replace(/</g,'\\u003c');
  await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><body><div id="main"><header><span id="identity"></span></header><div id="history"></div><footer><div contenteditable="true" role="textbox" style="min-height:30px"></div><button aria-label="Enviar"><span data-icon="send">Enviar</span></button></footer></div><script>const p=${payload}; document.querySelector('#identity').textContent='+'+p.phone; document.querySelector('[contenteditable]').textContent=p.message; document.querySelector('button').onclick=()=>{const d=document.createElement('div'); d.className='message-out';d.textContent=p.message;document.querySelector('#history').append(d);document.querySelector('[contenteditable]').textContent='';};</script></body></html>`});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'app.html');
 await page.getByText('Uma boa mensagem.').waitFor();pass('Interface real no Chromium (chrome.* simulado)');
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Clientes');sheet.addRow(['Nome','Telefone','Empresa']);sheet.addRow(['Ana','+5511999999999','Acme']);sheet.addRow(['Ana duplicada','11999999999','Acme']);sheet.addRow(['Bruno','+5521999999999','Norte']);sheet.addRow(['Inválido','abc','']);const file=join(temp,'contatos.xlsx');await workbook.xlsx.writeFile(file);
 await page.locator('#file').setInputFiles(file);await page.locator('#mapping').waitFor({state:'visible'});await page.locator('#import').click();assert.equal(await page.locator('#total').textContent(),'2');assert.match(await page.locator('#import-result').textContent(),/1 duplicados.*1 linhas/);pass('Excel real importa, deduplica e identifica linha inválida');
 await page.locator('#template').fill('Olá, {{nome}}! Novidades da {{empresa}}.');assert.match(await page.locator('#preview-text').textContent(),/Olá, Ana! Novidades da Acme/);await page.locator('#next').click();assert.match(await page.locator('#preview-text').textContent(),/Bruno/);pass('Prévia personaliza campos e navega entre contatos');
 await page.locator('#consent').check();await page.locator('#save').click();await page.waitForTimeout(200);await page.reload();await page.waitForFunction(()=>document.querySelector('#total').textContent==='2');assert.equal(await page.locator('#template').inputValue(),'Olá, {{nome}}! Novidades da {{empresa}}.');pass('Rascunho preservado após recarregar a interface');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'artifacts/interface.png',fullPage:true});
 await page.locator('#start').click();await page.locator('#accept-confirm').click();
 await page.waitForFunction(()=>document.querySelector('#submitted').textContent==='1',{},{timeout:20000});pass('Background real → aba simulada → content script real → clique → resultado');
 await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#state').textContent==='Pausada');pass('Pausa cancela próximo envio');
 const reportPromise=page.waitForEvent('download');await page.locator('#export').click();const report=await reportPromise;assert.match(report.suggestedFilename(),/relatorio/);pass('Relatório CSV baixado');
 await context.unroute('https://web.whatsapp.com/**');
 await context.route('https://web.whatsapp.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<div id="main"><header>+5531999999999</header><footer><div contenteditable="true" role="textbox">Olá, Bruno! Novidades da Norte.</div><button aria-label="Enviar" onclick="window.didClick=true"><span data-icon="send">Enviar</span></button></footer></div>'}));
 await page.locator('#start').click();await page.locator('#accept-confirm').click();await page.waitForTimeout(2500);
 const wa=[...tabs.values()][0];assert.equal(await wa.evaluate(()=>!!window.didClick),false);onAlarm({name:'watchdog'});
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='Pausada');assert.equal(await page.locator('#issues').textContent(),'1');pass('Número diferente não recebe clique; timeout pausa');
 await page.locator('#new').click();await page.locator('#accept-confirm').click();await page.locator('#paste-toggle').click();await page.locator('#paste').fill('+5511988888888\n+5521988888888');await page.locator('#parse-paste').click();await page.locator('#import').click();assert.equal(await page.locator('#total').textContent(),'2');pass('Lista de números colada importa sem Excel');
 await page.locator('#template').fill('<img src=x onerror=alert(1)> {{nome}}');assert.equal(await page.locator('#preview-text img').count(),0);pass('Conteúdo da prévia não executa HTML');

 await context.unroute('https://web.whatsapp.com/**');
 await context.route('https://web.whatsapp.com/**',async route=>{
  const p=new URL(route.request().url()).searchParams.get('phone');
  await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><div id="main"><header>+${p}</header><div id="history"></div><footer><div contenteditable="true" role="textbox" style="min-height:20px"></div><button aria-label="Anexar"><span data-icon="plus-rounded">+</span></button><input type="file" accept="image/*" hidden></footer></div><script>
   history.replaceState({},'', '/');
   document.querySelector('input').onchange=e=>{
    const file=e.target.files[0];window.uploadedName=file.name;window.uploadedSize=file.size;
    const dialog=document.createElement('section');dialog.setAttribute('role','dialog');dialog.innerHTML='<img width="100" height="100"><div contenteditable="true" role="textbox" style="min-height:30px"></div><button><span data-icon="send">Enviar foto</span></button>';
    dialog.querySelector('img').src=URL.createObjectURL(file);document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>{window.mediaClicks=(window.mediaClicks||0)+1;const bubble=document.createElement('div');bubble.className='message-out';const image=document.createElement('img');image.src=dialog.querySelector('img').src;bubble.append(image,document.createTextNode(dialog.querySelector('[contenteditable]').innerText));document.querySelector('#history').append(bubble);dialog.remove();};
   };
  </script>`});
 });
 await page.locator('#template').fill('Uma foto para você!');
 await page.locator('#media-file').setInputFiles(resolve('extension/icons/128.png'));
 await page.locator('#media-selected').waitFor({state:'visible'});assert.ok(await page.locator('#preview-photo').isVisible());
 await page.locator('#consent').check();await page.locator('#save').click();await page.waitForTimeout(300);await page.reload();await page.locator('#media-selected').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#preview-photo').naturalWidth>0);pass('Foto validada, salva em IndexedDB e restaurada na prévia');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'artifacts/interface.png',fullPage:true});
 await page.locator('#start').click();await page.locator('#accept-confirm').click();await page.waitForFunction(()=>document.querySelector('#submitted').textContent==='1',{},{timeout:15000});
 const photoTab=tabs.get(data.campaign.tabId);
 assert.equal(await photoTab.evaluate(()=>window.mediaClicks),1);assert.equal(await photoTab.evaluate(()=>window.uploadedName),'128.png');assert.match(await photoTab.locator('.message-out').innerText(),/Uma foto para você!/);assert.equal(await photoTab.locator('.message-out img').count(),1);pass('Foto e legenda submetidas juntas com um único clique (simulado), após URL mudar para /');
 await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#state').textContent==='Pausada');
 assert.deepEqual(errors,[]);pass('Sem exceções JavaScript na interface');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/interface-mobile.png',fullPage:true});pass('Layout estreito não cria rolagem horizontal');
 await writeFile('artifacts/browser-results.json',JSON.stringify({passed,realWhatsApp:false,extensionLoaded:false,note:'Chromium administrado proíbe extensões locais. UI, background e content script reais; APIs Chrome e WhatsApp simulados.'},null,2));console.log(`${passed} verificações passaram.`);
}catch(e){console.log('DEBUG state',JSON.stringify(data));for(const p of context.pages())console.log('DEBUG page',p.url(),await p.locator('body').innerText().catch(()=>''));throw e;}finally{for(const timer of timers.values())clearTimeout(timer);await browser.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
