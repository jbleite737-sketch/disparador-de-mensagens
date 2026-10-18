import {storeAsset,readAsset,deleteAsset} from './media.js';
import {parseCSV,importRows,personalize,csvExport,emptyState,key} from './core.js';
const $=id=>document.getElementById(id);let state=emptyState(),sheets=[],rows=[],previewIndex=0,dirty=false,toastTimer,photoUrl,renderedPhoto;
const labels={pending:'Pendente',preparing:'Abrindo',sending:'Enviando',submitted:'Submetida',error:'Erro',uncertain:'Incerta',reviewed:'Revisada'};
const states={draft:'Rascunho',running:'Em andamento',paused:'Pausada',completed:'Concluída'};
const rpc=async(type,more={})=>{const r=await chrome.runtime.sendMessage({type,...more});if(!r?.ok)throw Error(r?.error||'Não foi possível acessar a extensão.');return r.data;};
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function on(id,event,fn){$(id).addEventListener(event,async e=>{try{await fn(e);}catch(err){toast(err.message);}});}
function confirmAction(title,text){return new Promise(resolve=>{const dialog=$('confirm');$('confirm-title').textContent=title;$('confirm-text').textContent=text;const done=v=>{dialog.close();resolve(v);};$('accept-confirm').onclick=()=>done(true);$('cancel-confirm').onclick=()=>done(false);dialog.oncancel=()=>resolve(false);dialog.showModal();});}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showPreview(){
 const c=state.contacts[previewIndex%Math.max(1,state.contacts.length)];
 $('chars').textContent=$('template').value.length+(state.media?' / 1.024 (legenda)':' / 4.000');
 $('preview-name').textContent=c?.name||'Seu contato';$('preview-avatar').textContent=(c?.name||'Contato').slice(0,2).toUpperCase();
 $('preview-index').textContent=c?`${previewIndex+1} de ${state.contacts.length} contatos`:'Importe para visualizar';
 try{$('preview-text').textContent=c?personalize($('template').value,c,!!state.media,state.media?1024:4000):$('template').value||'Sua mensagem aparece aqui.';}catch(e){$('preview-text').textContent=e.message;}
}
function render(loadInputs=false){
 $('total').textContent=state.contacts.length;$('pending').textContent=state.contacts.filter(c=>['pending','preparing','sending'].includes(c.status)).length;
 $('submitted').textContent=state.contacts.filter(c=>c.status==='submitted').length;$('issues').textContent=state.contacts.filter(c=>['error','uncertain'].includes(c.status)).length;
 $('state').textContent=states[state.status];$('notice').textContent=state.notice;
 $('progress-fill').style.width=(state.contacts.length?state.contacts.filter(c=>!['pending','preparing','sending'].includes(c.status)).length/state.contacts.length*100:0)+'%';
 const draft=state.status==='draft';$('import-controls').hidden=!draft;$('save').hidden=!draft;
 $('pause').hidden=state.status!=='running';$('start').hidden=state.status==='running'||state.status==='completed';$('start').textContent=state.status==='paused'?'Retomar fila →':'Iniciar campanha →';
 $('start').disabled=!state.contacts.some(c=>c.status==='pending')||!!state.job;
 $('review').hidden=!state.contacts.some(c=>c.status==='uncertain')||!!state.job;
 for(const id of ['template','min','max','batch','rest','consent'])$(id).disabled=!draft;
 if(loadInputs){$('template').value=state.template;$('consent').checked=state.consent;for(const k of ['min','max','batch','rest'])$(k).value=state.settings[k];}
 const body=$('contact-table');body.replaceChildren();
 for(const c of state.contacts.slice(0,100)){
  const tr=document.createElement('tr');for(const text of [c.name||'Sem nome','+'+c.phone]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
  const td=document.createElement('td'),badge=document.createElement('span');badge.className='badge '+c.status;badge.textContent=labels[c.status];badge.title=c.detail;td.append(badge);tr.append(td);body.append(tr);
 }
 $('table-note').textContent=state.contacts.length>100?'Exibindo os primeiros 100 contatos. O relatório inclui todos.':'';
 $('variables').replaceChildren();
 for(const k of Object.keys(state.contacts[0]?.fields||{nome:'',telefone:''}).filter(Boolean)){
  const b=document.createElement('button');b.className='variable';b.textContent='{{'+k+'}}';b.disabled=!draft;b.onclick=()=>{const t=$('template');t.setRangeText(b.textContent,t.selectionStart,t.selectionEnd,'end');dirty=true;showPreview();};$('variables').append(b);
 }
 showPreview();countdown();renderPhoto().catch(e=>toast(e.message));
}
function countdown(){const n=state.nextAt?Math.max(0,Math.ceil((state.nextAt-Date.now())/1000)):0;$('countdown').textContent=state.status==='running'&&state.nextAt?(n?'Próximo contato em '+n+'s':'Aguardando o Chrome iniciar o próximo contato…'):'';}
function mapSheet(){
 rows=sheets[+$('sheet').value]?.rows||[];if(!rows.length)throw Error('Aba vazia.');
 for(const id of ['phone-column','name-column']){
  $(id).replaceChildren();if(id==='name-column')$(id).add(new Option('Sem coluna de nome','-1'));
  rows[0].forEach((h,i)=>$(id).add(new Option(String(h||'Coluna '+(i+1)),String(i))));
 }
 let p=rows[0].findIndex(h=>/^(telefone|phone|numero|whatsapp|celular|phone_number)$/.test(key(h)));
 let n=rows[0].findIndex(h=>/^(nome|name|nome_completo|user_name)$/.test(key(h)));
 $('phone-column').value=String(p<0?0:p);$('name-column').value=String(n);$('mapping').hidden=false;
}
function setSheets(data){sheets=data;$('sheet').replaceChildren();data.forEach((s,i)=>$('sheet').add(new Option(s.name,String(i))));mapSheet();}
function cellText(c){const v=c.value;if(v===null||v===undefined)return '';if(typeof v==='object'){if('formula'in v||'sharedFormula'in v)return v.result===undefined?'':String(v.result);if('richText'in v)return v.richText.map(x=>x.text).join('');if('text'in v)return String(v.text);if(v instanceof Date)return v.toISOString().slice(0,10);}return String(v);}
on('file','change',async e=>{
 const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('O limite por arquivo é 5 MB.');
 toast('Lendo '+file.name+'…');
 if(/\.csv$/i.test(file.name))setSheets([{name:file.name,rows:parseCSV(await file.text())}]);
 else if(/\.xlsx$/i.test(file.name)){
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());
  const data=wb.worksheets.map(w=>{if(w.rowCount>5001||w.columnCount>100)throw Error('Use até 5.000 contatos e 100 colunas.');const r=[];w.eachRow({includeEmpty:true},row=>{const cells=[];for(let i=1;i<=w.columnCount;i++)cells.push(cellText(row.getCell(i)));r.push(cells);});return {name:w.name,rows:r};}).filter(s=>s.rows.length);if(!data.length)throw Error('Nenhuma aba com dados.');setSheets(data);
 }else throw Error('Use .xlsx ou .csv. Salve arquivos .xls como .xlsx no Excel.');
 toast('Escolha as colunas e clique em Importar contatos.');
});
on('sheet','change',mapSheet);
on('paste-toggle','click',()=>{$('paste-area').hidden=!$('paste-area').hidden;});
on('parse-paste','click',()=>{
 let text=$('paste').value.trim();if(!text)throw Error('Cole os contatos primeiro.');
 let r=parseCSV(text);
 if(r.every(row=>row.length===1)&&/^[+\d\s().-]+$/.test(r[0][0]))r=[['telefone'],...r];
 setSheets([{name:'Lista colada',rows:r}]);
});
on('import','click',()=>{
 const result=importRows(rows,+$('phone-column').value,+$('name-column').value,$('country').value);
 if(!result.contacts.length)throw Error('Nenhum telefone válido. Confira a coluna e o DDI.');
 state.contacts=result.contacts;previewIndex=0;dirty=true;
 $('import-result').textContent=`${result.contacts.length} contatos importados · ${result.duplicates} duplicados removidos · ${result.errors.length} linhas inválidas.`+(result.errors.length?' Linhas ignoradas: '+result.errors.slice(0,10).map(e=>e.line).join(', ')+'.':'');
 render();toast('Lista pronta. Confira a prévia antes de iniciar.');
});
on('sample','click',async()=>{const wb=new ExcelJS.Workbook();const sheet=wb.addWorksheet('Contatos');sheet.addRow(['nome','telefone','empresa']);sheet.addRow(['Ana','+5511999999999','Exemplo']);sheet.addRow(['Bruno','+5521999999999','Exemplo']);sheet.getColumn(2).numFmt='@';sheet.columns.forEach(c=>c.width=25);download(new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'modelo-contatos.xlsx');});
for(const id of ['template','min','max','batch','rest','consent'])on(id,'input',()=>{dirty=true;showPreview();});
on('prev','click',()=>{previewIndex=(previewIndex-1+state.contacts.length)%Math.max(1,state.contacts.length);showPreview();});
on('next','click',()=>{previewIndex=(previewIndex+1)%Math.max(1,state.contacts.length);showPreview();});
async function saveDraft(){
 const previous=(await rpc('GET')).media;
 const result=await rpc('SAVE',{contacts:state.contacts,template:$('template').value,settings:Object.fromEntries(['min','max','batch','rest'].map(k=>[k,$(k).value])),consent:$('consent').checked,media:state.media});state=result;dirty=false;if(previous&&previous.id!==state.media?.id)await deleteAsset(previous.id);render(true);
}
on('save','click',async()=>{await saveDraft();toast('Rascunho salvo.');});
on('start','click',async()=>{
 if(state.status==='draft')await saveDraft();
 const count=state.contacts.filter(c=>c.status==='pending').length;
 if(!await confirmAction('Iniciar envio de mensagens?',`${count} contatos pendentes. Confira os números e as prévias. Será aberta uma aba do WhatsApp Web para enviar automaticamente ${state.media?'a foto com legenda':'o texto'}. Mantenha essa aba sem outras interações. Os intervalos não evitam bloqueios da plataforma.`))return;
 state=await rpc('START');render(true);
});
on('pause','click',async()=>{state=await rpc('PAUSE');render(true);});
on('review','click',async()=>{if(await confirmAction('Você conferiu as conversas?', 'As mensagens incertas serão marcadas como revisadas e não serão reenviadas. Confira cada conversa no WhatsApp antes de confirmar.')){state=await rpc('REVIEW');render(true);}});
on('new','click',async()=>{if(await confirmAction('Apagar a campanha atual?', 'A lista, o texto e o histórico local serão apagados. Exporte o relatório antes, se precisar.')){state=await rpc('RESET');dirty=false;previewIndex=0;render(true);$('import-result').textContent='Importe uma nova lista.';$('mapping').hidden=true;$('file').value='';}});
on('export','click',()=>{if(!state.contacts.length)throw Error('Não há contatos para exportar.');download(new Blob([csvExport(state.contacts)],{type:'text/csv;charset=utf-8'}),'relatorio-contato-flow.csv');});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.campaign)return;if(dirty&&state.status==='draft')return;state=changes.campaign.newValue||emptyState();previewIndex=Math.min(previewIndex,Math.max(0,state.contacts.length-1));render(true);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
setInterval(countdown,1000);
try{state=await rpc('GET');render(true);}catch(e){toast(e.message);}

async function renderPhoto(){
 const meta=state.media;$('template').maxLength=meta?1024:4000;$('media-controls').hidden=state.status!=='draft';$('media-remove').hidden=state.status!=='draft';
 $('media-selected').hidden=!meta;$('preview-photo').hidden=!meta;
 if(!meta){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;renderedPhoto=null;$('preview-photo').removeAttribute('src');return;}
 $('media-name').textContent=meta.name;$('media-size').textContent=(meta.size/1024/1024).toFixed(2)+' MB';
 if(renderedPhoto===meta.id)return;
 const file=await readAsset(meta.id);if(!file)throw Error('A foto do rascunho não está disponível. Selecione novamente.');
 if(state.media?.id!==meta.id)return;
 if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(file);renderedPhoto=meta.id;
 $('media-thumb').src=photoUrl;$('preview-photo').src=photoUrl;
}
on('media-file','change',async e=>{
 if(state.status!=='draft')throw Error('Crie uma campanha para trocar a foto.');
 const file=e.target.files[0];if(!file)return;
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('O arquivo não é uma imagem válida.');}if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Use uma foto com até 40 megapixels.');}bitmap.close();
 const meta=await storeAsset(file);state.media=meta;dirty=true;await renderPhoto();showPreview();toast('Foto adicionada. O texto será usado como legenda.');
});
on('media-remove','click',async()=>{if(state.status!=='draft')return;state.media=null;dirty=true;await renderPhoto();showPreview();$('media-file').value='';});
