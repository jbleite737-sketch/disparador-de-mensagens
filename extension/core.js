export const DEFAULTS = {min:30,max:60,batch:10,rest:180,country:'55'};
export function key(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'');}
export function phone(raw,country='55'){
 let s=String(raw??'').trim();
 if(!s || /[a-zA-Z]/.test(s) || !/^\+?[\d\s().-]+$/.test(s))throw Error('Telefone inválido; use texto com DDI e DDD.');
 let p=s.replace(/\D/g,'');
 if(s.startsWith('00'))p=p.slice(2);
 else if(!s.startsWith('+') && country==='55' && (p.length===10||p.length===11))p='55'+p;
 if(!/^[1-9]\d{7,14}$/.test(p))throw Error('Telefone deve ter de 8 a 15 dígitos, com DDI.');
 return p;
}
export function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/)[0]||'';
 const counts={';':0,',':0,'\t':0};let inQuote=false;
 for(let i=0;i<first.length;i++){if(first[i]==='\"'){if(inQuote&&first[i+1]==='\"')i++;else inQuote=!inQuote;}else if(!inQuote&&Object.hasOwn(counts,first[i]))counts[first[i]]++;}
 const sep=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}
  else if(c===sep&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSV com aspas não fechadas.');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
export function importRows(rows,phoneIndex,nameIndex,country='55'){
 if(rows.length<2)throw Error('A planilha precisa de cabeçalho e pelo menos um contato.');
 if(rows.length>5001)throw Error('Importe no máximo 5.000 contatos por campanha.');
 const headers=rows[0].map((h,i)=>key(h)||`coluna_${i+1}`);
 if(new Set(headers).size!==headers.length)throw Error('Use cabeçalhos diferentes para cada coluna.');
 if(!Number.isInteger(phoneIndex)||phoneIndex<0||phoneIndex>=headers.length)throw Error('Selecione a coluna do telefone.');
 const contacts=[],errors=[];let duplicates=0;const seen=new Set();
 rows.slice(1).forEach((row,i)=>{
  if(!row.some(x=>String(x??'').trim()))return;
  try{
   const number=phone(row[phoneIndex],country);
   if(seen.has(number)){duplicates++;return;}
   seen.add(number);
   const fields=Object.fromEntries(headers.map((h,j)=>[h||`coluna_${j+1}`,String(row[j]??'').trim()]));
   fields.nome=String(row[nameIndex]??'').trim();fields.telefone=number;
   contacts.push({id:crypto.randomUUID(),phone:number,name:fields.nome,fields,status:'pending',detail:'',at:null});
  }catch(e){errors.push({line:i+2,reason:e.message});}
 });
 return {contacts,errors,duplicates};
}
export function personalize(template,c,allowEmpty=false,maxLength=4000){
 const unknown=new Set();
 const text=template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,k)=>{
  const name=key(k);if(!Object.hasOwn(c.fields,name)){unknown.add(name);return '';}
  return c.fields[name];
 });
 if(unknown.size)throw Error('Campos desconhecidos: '+[...unknown].join(', '));
 if(!text.trim()&&!allowEmpty)throw Error('Escreva uma mensagem.');
 if(text.length>maxLength)throw Error('A mensagem personalizada deve ter até '+maxLength+' caracteres.');
 return text;
}
export function settings(input){
 const out={...DEFAULTS,...input};
 for(const k of ['min','max','batch','rest'])if(!Number.isFinite(+out[k]))throw Error('Preencha os intervalos com números.');else out[k]=+out[k];
 if(out.min<30||out.max<out.min||out.max>3600)throw Error('Intervalos: mínimo de 30s e máximo entre o mínimo e 3.600s.');
 if(!Number.isInteger(out.batch)||out.batch<1||out.batch>500||out.rest<30||out.rest>86400)throw Error('Lote: 1–500 contatos. Pausa: 30–86.400 segundos.');
 return out;
}
export function delayMs(s,count,latency=0,random=Math.random){
 const base=(s.min+(s.max-s.min)*random())*1000;
 return Math.round(Math.max(base,Math.min(120000,latency*1.5))+(count>0&&count%s.batch===0?s.rest*1000:0));
}
export function csvExport(contacts){
 const q=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
 return '\uFEFF'+[['nome','telefone','status','detalhe','horario'],...contacts.map(c=>[c.name,c.phone,c.status,c.detail,c.at])].map(r=>r.map(q).join(';')).join('\r\n');
}
export function emptyState(){return {version:1,status:'draft',contacts:[],template:'Olá, {{nome}}! Tudo bem?',settings:{...DEFAULTS},nextAt:null,tabId:null,job:null,notice:'Importe sua lista para começar.',consent:false,media:null};}
