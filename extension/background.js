import {mediaPayload,readAsset,validateMedia,clearAssets} from './media.js';
import {emptyState,personalize,settings,delayMs,phone} from './core.js';
let gate=Promise.resolve();
const locked=fn=>{const p=gate.then(fn);gate=p.catch(()=>{});return p;};
const read=async()=> (await chrome.storage.local.get('campaign')).campaign||emptyState();
const save=s=>chrome.storage.local.set({campaign:s});
const clear=async()=>{await chrome.alarms.clear('queue');await chrome.alarms.clear('watchdog');};
const pause=async(s,note)=>{s.status='paused';s.nextAt=null;s.notice=note;await clear();await save(s);};
function own(sender){return sender.id===chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('app.html'));}
function jobOwn(s,sender,m){return sender.tab?.id===s.tabId && sender.url?.startsWith('https://web.whatsapp.com/') && s.job?.token===m.token;}
async function tick(){
 await locked(async()=>{
  const s=await read();if(s.status!=='running'||s.job)return;
  if(s.nextAt>Date.now()+500){await chrome.alarms.create('queue',{when:s.nextAt});return;}
  const c=s.contacts.find(c=>c.status==='pending');
  if(!c){s.status='completed';s.nextAt=null;s.notice='Fila concluída. Confira os resultados por contato.';await clear();await save(s);return;}
  c.status='preparing';s.job={id:c.id,token:crypto.randomUUID(),started:Date.now()};s.nextAt=null;s.notice='Abrindo conversa de '+(c.name||c.phone);await save(s);
  try{
   const url='https://web.whatsapp.com/send?phone='+c.phone+(s.media?'':'&text='+encodeURIComponent(personalize(s.template,c)));
   if(s.tabId!==null){try{await chrome.tabs.get(s.tabId);}catch{s.tabId=null;}}
   // New tab is initially blank; persist its ownership before navigation.
   if(s.tabId===null){const t=await chrome.tabs.create({url:'about:blank',active:true});s.tabId=t.id;await save(s);}
   await chrome.alarms.create('watchdog',{when:Date.now()+120000});
   await chrome.tabs.update(s.tabId,{url,active:true});
  }catch(e){c.status='error';c.detail=e.message;s.job=null;await pause(s,'Não foi possível abrir a conversa. '+e.message);}
 });
}
async function handle(m,sender){
 if(m.type==='JOB')return locked(async()=>{
  const s=await read();if(sender.tab?.id!==s.tabId||s.status!=='running'||!s.job||!sender.url?.startsWith('https://web.whatsapp.com/'))return null;
  const c=s.contacts.find(c=>c.id===s.job.id);if(c.status!=='preparing')return null;
  return {...s.job,phone:c.phone,text:personalize(s.template,c,!!s.media,s.media?1024:4000),media:await mediaPayload(s.media)};
 });
 if(['READY','VERIFY','RESULT'].includes(m.type))return locked(async()=>{
  const s=await read();if(!jobOwn(s,sender,m))throw Error('Operação antiga ou aba incorreta.');
  const c=s.contacts.find(c=>c.id===s.job.id);
  if(m.type==='READY'){
   if(s.status!=='running'||c.status!=='preparing')throw Error('Fila pausada.');
   c.status='sending';await save(s);return true;
  }
  if(m.type==='VERIFY')return s.status==='running'&&c.status==='sending';
  if(!['submitted','uncertain','error'].includes(m.status))throw Error('Resultado inválido.');
  if(!['preparing','sending'].includes(c.status))return false;
  c.status=m.status;c.detail=String(m.detail||'').slice(0,500);c.at=new Date().toISOString();
  const elapsed=Date.now()-s.job.started;s.job=null;await chrome.alarms.clear('watchdog');
  if(m.status!=='submitted'){await pause(s,'Fila pausada: '+c.detail);return true;}
  if(s.status!=='running'){await save(s);return true;}
  if(!s.contacts.some(c=>c.status==='pending')){s.status='completed';s.notice='Fila concluída. “Submetida” não confirma entrega ou leitura.';s.nextAt=null;await save(s);return true;}
  const sent=s.contacts.filter(c=>c.status==='submitted').length;
  s.nextAt=Date.now()+delayMs(s.settings,sent,elapsed);s.notice='Intervalo entre contatos. Aguarde ou pause a fila.';
  await save(s);await chrome.alarms.create('queue',{when:s.nextAt});return true;
 });
 if(!own(sender))throw Error('Página não autorizada.');
 return locked(async()=>{
  let s=await read();
  if(m.type==='GET')return s;
  if(m.type==='SAVE'){
   if(s.status!=='draft')throw Error('Crie uma nova campanha para editar os dados.');
   if(!Array.isArray(m.contacts)||m.contacts.length>5000)throw Error('Lista inválida.');
   const seen=new Set();
   s.contacts=m.contacts.map(c=>{const p=phone(c.phone,'');if(seen.has(p))throw Error('Telefone duplicado.');seen.add(p);const fields=Object.fromEntries(Object.entries(c.fields||{}).map(([k,v])=>[k,String(v).slice(0,10000)]));return {id:crypto.randomUUID(),phone:p,name:String(c.name||''),fields:{...fields,nome:String(c.name||''),telefone:p},status:'pending',detail:'',at:null};});
   s.media=m.media||null;if(s.media){const file=await readAsset(s.media.id);if(!file)throw Error('Selecione a foto novamente.');validateMedia(file);s.media={id:s.media.id,name:String(file.name||s.media.name||'foto'),type:file.type,size:file.size};}
   s.template=String(m.template||'');s.settings=settings(m.settings);s.consent=!!m.consent;s.notice='Rascunho salvo neste navegador.';await save(s);return s;
  }
  if(m.type==='START'){
   if(!['draft','paused'].includes(s.status))throw Error('A fila já está ativa ou concluída.');
   if(s.job)throw Error('Aguarde a operação atual terminar antes de retomar.');
   if(s.contacts.some(c=>c.status==='uncertain'))throw Error('Confira o envio incerto no WhatsApp e marque-o como revisado antes de continuar.');
   if(!s.consent)throw Error('Confirme que os contatos autorizaram as mensagens.');
   if(!s.contacts.some(c=>c.status==='pending'))throw Error('Não há contatos pendentes.');
   s.contacts.filter(c=>c.status==='pending').forEach(c=>personalize(s.template,c,!!s.media,s.media?1024:4000));if(s.media)await mediaPayload(s.media);s.settings=settings(s.settings);
   s.status='running';s.nextAt=Date.now()+1000;s.notice='Fila iniciada. Mantenha o Chrome e o WhatsApp Web abertos.';await save(s);await chrome.alarms.create('queue',{when:s.nextAt});return s;
  }
  if(m.type==='PAUSE'){
   if(s.status!=='running')return s;
   if(s.job){const c=s.contacts.find(c=>c.id===s.job.id);if(c.status==='preparing'){c.status='pending';s.job=null;}}
   s.status='paused';s.nextAt=null;s.notice='Fila pausada. Um envio já acionado pode terminar.';
   await chrome.alarms.clear('queue');if(!s.job)await chrome.alarms.clear('watchdog');await save(s);return s;
  }
  if(m.type==='REVIEW'){
   if(s.status==='running'||s.job)throw Error('Pause e aguarde o envio atual.');
   for(const c of s.contacts)if(c.status==='uncertain'){c.status='reviewed';c.detail+=' • Revisado manualmente; não será reenviado.';}
   s.notice='Envios incertos revisados e excluídos de novas tentativas.';await save(s);return s;
  }
  if(m.type==='RESET'){
   if(s.status==='running'||s.job)throw Error('Pause e aguarde o envio atual antes de apagar.');
   await clear();await clearAssets();s=emptyState();await save(s);return s;
  }
  throw Error('Comando desconhecido.');
 });
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{handle(m,sender).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('app.html')}));
chrome.alarms.onAlarm.addListener(a=>{
 if(a.name==='queue')tick().catch(console.error);
 if(a.name==='watchdog')locked(async()=>{const s=await read();if(!s.job)return;const c=s.contacts.find(c=>c.id===s.job.id);c.status=c.status==='sending'?'uncertain':'error';c.detail='Sem confirmação a tempo. Verifique conexão, login e conversa no WhatsApp.';s.job=null;await pause(s,c.detail);}).catch(console.error);
});
async function interrupted(note){await locked(async()=>{const s=await read();if(s.status!=='running'&&!s.job)return;if(s.job){const c=s.contacts.find(c=>c.id===s.job.id);c.status=c.status==='sending'?'uncertain':'pending';c.detail=note;s.job=null;}await pause(s,note);});}
chrome.runtime.onStartup.addListener(()=>interrupted('Chrome reiniciado. Revise a fila e retome manualmente.'));
chrome.tabs.onRemoved.addListener(id=>{locked(async()=>{const s=await read();if(s.tabId!==id)return;s.tabId=null;if(s.job){const c=s.contacts.find(c=>c.id===s.job.id);c.status=c.status==='sending'?'uncertain':'pending';c.detail='A aba do WhatsApp foi fechada.';s.job=null;}if(s.status==='running')await pause(s,'Aba fechada. Retome para abrir outra.');else await save(s);}).catch(console.error);});
