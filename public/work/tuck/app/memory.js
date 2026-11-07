/* Tuck's memory of you: one view, used by Tuck Brain (the You node) and Settings › Memory (h.unified: rules, about you and learned in one list).
   A short summary in plain sentences, then every line with where it came from, Edit and Forget.
   What you change is saved in localStorage 'tuckMemory', so an edit in Settings shows in Brain's You panel (and back) at once.
   hooks: toast(msg, undoFn), happy(line), go(className) to jump to a class, other:{href,label} link to the other place.
   Memory.onChange(fn) -> unsubscribe: fn() after any change here or in another tab. Memory.forget(lineId) for other pages.
   Memory.fromSetup(answers) writes what the person typed in setup (onboarding), each with the source "You told Tuck · Setup" (rule 15):
     answers = {school, year, study, classes:[names], work, find, people:[{name, role}]}; empty or missing values leave a line as it is.
     A class that isn't already a line is added under Classes. Memory.setup() -> the answers last saved. */
(function(){
const KEY='tuckMemory';
const M=window.MEMSTATE={edit:null,gone:new Set(),told:[],imp:false,wipe:false,off:new Set(),srcs:{},filter:'all',edit2:null};
const ORIG={};PROFILE.lines.forEach(l=>{ORIG[l.id]={v:l.v,src:l.src,from:l.from}});const ORIG_INSTR=PROFILE.instructions;
let edits={},added=[],setupAns=null;
function load(){let j=null;try{j=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
 edits=j&&j.edits||{};added=j&&Array.isArray(j.added)?j.added:[];setupAns=j&&j.setup||null;M.gone=new Set(j&&j.gone||[]);
 /* lines added in setup sit with the others (taken out first, so a reload never doubles them) */
 for(let i=PROFILE.lines.length-1;i>=0;i--)if(PROFILE.lines[i].added)PROFILE.lines.splice(i,1);
 added.forEach(a=>{const at=PROFILE.lines.map(l=>l.g).lastIndexOf(a.g);PROFILE.lines.splice(at<0?PROFILE.lines.length:at+1,0,Object.assign({added:true},a))});M.told=j&&j.told||[];M.off=new Set(j&&j.off||[]);M.srcs=j&&j.srcs||{};PROFILE.instructions=j&&typeof j.instructions==='string'?j.instructions:ORIG_INSTR;
 PROFILE.lines.forEach(l=>{const e=edits[l.id],o=ORIG[l.id];if(e){l.v=e.v;l.src=e.src;l.from=e.from}else if(o&&(l.v!==o.v||l.src!==o.src)){l.v=o.v;l.src=o.src;l.from=l.node?null:o.from}})}
function save(){try{localStorage.setItem(KEY,JSON.stringify({edits,added,setup:setupAns,gone:[...M.gone],told:M.told,off:[...M.off],srcs:M.srcs,instructions:PROFILE.instructions}))}catch(e){}tell()}
/* setup answers -> memory lines, source "You told Tuck · Setup" */
function fromSetup(a){a=a||{};const put=(id,v)=>{v=String(v==null?'':v).trim();if(!v)return;edits[id]={v,src:'told',from:'Setup'};M.gone.delete(id)};
 put('school',a.school);put('year',a.year);put('study',a.study);put('job',a.work);put('find',a.find);
 const have=()=>PROFILE.lines.filter(l=>l.g==='Classes').map(l=>l.v.toLowerCase());
 (a.classes||[]).map(c=>String(c).trim()).filter(Boolean).forEach(c=>{if(have().includes(c.toLowerCase())||added.some(x=>x.v.toLowerCase()===c.toLowerCase()))return;
  added.push({id:'s-c-'+c.toLowerCase().replace(/[^a-z0-9]+/g,'-'),g:'Classes',k:'Class',v:c,src:'told',from:'Setup'})});
 (a.people||[]).filter(p=>p&&p.name).forEach(p=>{const ex=PROFILE.lines.find(l=>l.g==='People'&&l.k.toLowerCase()===String(p.name).trim().toLowerCase());
  if(ex){put(ex.id,p.role||ex.v);return}if(added.some(x=>x.g==='People'&&x.k===p.name))return;
  added.push({id:'s-p-'+String(p.name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),g:'People',k:String(p.name).trim(),v:String(p.role||'someone you know').trim(),src:'told',from:'Setup'})});
 /* a sample line that claims "Setup" but wasn't in these answers was never told to Tuck: it goes, so no source line is made up */
 PROFILE.lines.forEach(l=>{const o=ORIG[l.id];if(o&&o.src==='told'&&/^Setup/.test(o.from||'')&&!(edits[l.id]&&edits[l.id].from==='Setup'))M.gone.add(l.id)});
 setupAns=Object.assign({},a,{at:Date.now()});save();load();tell()}
const hosts=new Set(),subs=new Set();
function tell(){subs.forEach(fn=>{try{fn()}catch(e){console.error(e)}})}
addEventListener('storage',e=>{if(e.key!==KEY&&e.key!==null)return;load();hosts.forEach(x=>{if(x.el.isConnected)render(x.el,x.h);else hosts.delete(x)});tell()});
load();
/* About You's headings are sentence case and the summary is plain text (system.css styles the old look) */
if(!document.getElementById('memstyle')){const st=document.createElement('style');st.id='memstyle';
 st.textContent='.memv .mgrp h4{text-transform:none;letter-spacing:0;font:600 13px var(--f);color:var(--ink);margin:0 0 8px}.memv .msum{font:500 13.5px/1.6 var(--f);color:var(--ink)}.memv .mrow.out{animation:mout .26s var(--ease,ease) forwards;overflow:hidden}@keyframes mout{to{opacity:0;max-height:0;padding:0;border-color:transparent}}.memv .mrow{max-height:120px}@media (prefers-reduced-motion:reduce){.memv .mrow.out{animation:none;display:none}}'+
  /* a narrow host (Brain's side panel, or Settings with the chat docked): the label sits above the value, with the actions on its right,
     so a value always gets the full width and never wraps one word per line */
  '.memv{container-type:inline-size;min-width:0}.memv>*{min-width:0}.memv .mv,.memv .msum{overflow-wrap:anywhere}'+
  '@container (max-width:520px){.memv .mrow{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"k a" "v v";column-gap:8px;row-gap:2px;align-items:center;padding:10px 0}'+
  '.memv .mrow .mk{grid-area:k;width:auto;min-width:0;font:600 12px var(--f);color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.memv .mrow .mv{grid-area:v;min-width:0}.memv .mrow .ma{grid-area:a;justify-self:end}'+
  '.memv .mrow:not(:has(.mk)){grid-template-areas:"v a";align-items:start}.memv .mrow .mv .field{width:100%;box-sizing:border-box}'+
  '.memv .madd{flex-wrap:wrap}.memv .madd .field{flex:1 1 180px}'+
  /* the one list in Settings › Memory carries an on/off switch on the right */
  '.memv.uni .mrow.mi{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"k a s" "v v v"}.memv.uni .mrow.mi:not(:has(.mk)){grid-template-areas:"v a s"}.memv.uni .mrow .sw{grid-area:s}}';
 document.head.appendChild(st)}

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const L=()=>PROFILE.lines.filter(l=>!M.gone.has(l.id));
const by=id=>L().find(l=>l.id===id);
const list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
/* "Intern at GRC" -> "You work as an intern at GRC"; "GRC Associates" -> "You work at GRC Associates" */
const workLine=v=>{v=String(v).trim();if(!/\sat\s/i.test(v))return 'You work at '+esc(v);const r=v.charAt(0).toLowerCase()+v.slice(1);return 'You work as '+(/^[aeiou]/.test(r)?'an ':'a ')+esc(r)};
/* plain sentences: the rows below are where you edit */
function summary(){const s=[],sc=by('school'),yr=by('year'),st=by('study'),cls=L().filter(l=>l.g==='Classes'),job=by('job'),srch=by('search'),ppl=L().filter(l=>l.g==='People'),fd=by('find');
 if(sc||yr||st)s.push(`You're ${yr?'in your '+esc(yr.v.toLowerCase())+' ':''}${sc?'at '+esc(sc.v):''}${st?', studying '+esc(st.v):''}.`);
 if(cls.length)s.push(`This term you're taking ${list(cls.map(c=>esc(c.v)))}.`);
 if(job||srch)s.push(`${job?workLine(job.v):''}${job&&srch?', and you\'re':job?'':'You\'re'}${srch?' looking for '+esc(srch.v.replace(/^S/,'s')):''}.`);
 if(ppl.length)s.push(`People in your files: ${list(ppl.map(p=>`${esc(p.k)} (${esc(p.v)})`))}.`);
 if(fd)s.push(`When you look for something, you think ${esc(fd.v)}.`);
 return s.length?`<p class="msum">${s.join(' ')}</p>`:`<p class="msum muted">Tuck doesn't remember anything about you right now. Tell it something below.</p>`}
/* a label that only repeats its heading ("School" under School, "Class" under Classes) is left out: the heading already says it */
const sameAsHead=l=>{const k=String(l.k).toLowerCase(),g=String(l.g).toLowerCase();return k===g||k+'es'===g||k+'s'===g};
function row(l,h){const ed=M.edit===l.id;
 return `<li class="mrow" data-mrow="${l.id}">${sameAsHead(l)?'':`<span class="mk">${esc(l.k)}</span>`}${ed?`<span class="mv"><input class="field" id="mein" value="${esc(l.v)}" aria-label="${esc(l.k)}"></span>`:`<span class="mv">${esc(l.v)}<small class="msrc s-${l.src}" title="${esc(l.from)}">${esc(SRC[l.src])}<em> · ${esc(l.from)}</em></small></span>`}
  <span class="ma">${!ed&&l.g==='Classes'&&h&&h.go?`<button class="btn sm ghost" data-mgo="${esc(l.v)}">Show</button>`:''}${ed?`<button class="btn sm pri" data-msave="${l.id}">Save</button>`:`<button class="btn sm ghost" data-medit="${l.id}">Edit</button>`}<button class="btn sm ghost" data-mforget="${l.id}">Forget</button></span></li>`}
function html(h){const groups=[...new Set(PROFILE.lines.map(l=>l.g))];
 return `<div class="memv">
  <div class="mhead"><span class="mav">${PROFILE.initials}</span><div><b>What Tuck remembers about you</b><small>Nothing here leaves your Mac.</small></div></div>
  ${summary()}
  ${groups.map(g=>{const ls=L().filter(l=>l.g===g);return ls.length?`<section class="mgrp"><h4>${esc(g)}</h4><ul>${ls.map(l=>row(l,h)).join('')}</ul></section>`:''}).join('')}
  <section class="mgrp"><h4>Things you told Tuck</h4><ul>${M.told.map((t,i)=>`<li class="mrow" data-mtold="${i}"><span class="mv">${esc(t)}<small class="msrc s-told">${SRC.told}</small></span><span class="ma"><button class="btn sm ghost" data-muntell="${i}">Forget</button></span></li>`).join('')}</ul>
   <div class="madd"><input class="field" id="mtell" placeholder="Tell Tuck something to remember, like “Theo is my roommate”" aria-label="Tell Tuck something to remember"><button class="btn sm" data-mtell>Remember</button></div></section>
  <section class="mgrp"><h4>How Tuck should work for you</h4><textarea class="field" id="minstr" rows="2" placeholder="e.g. Keep class files by week. Never touch my Music folder.">${esc(PROFILE.instructions)}</textarea></section>
  <section class="mgrp"><h4>Bring in what another AI knows</h4>${M.imp?`<textarea class="field" id="mimp" rows="4" placeholder="In your other AI assistant, ask “What do you remember about me?”, copy the answer and paste it here."></textarea><div class="madd"><button class="btn sm pri" data-mimpok>Add These Lines</button><button class="btn sm ghost" data-mimpno>Cancel</button></div>`:`<button class="btn sm" data-mimp><i class="ph ph-download-simple"></i>Import from another AI assistant</button><small class="mnote">You paste it. Tuck never connects to them.</small>`}</section>
  <div class="mfoot"><span>Health, money and ID details are never kept in this memory.</span>${h.other?`<a href="${h.other.href}">${h.other.label}</a>`:''}</div>
  <div class="mwipe">${M.wipe?`<p>Tuck will forget everything here. Your files and folders stay as they are.</p><button class="btn sm danger" data-mwipeok>Forget Everything</button><button class="btn sm ghost" data-mwipeno>Cancel</button>`:`<button class="btn sm ghost danger" data-mwipe><i class="ph ph-trash"></i>Forget Everything About Me</button>`}</div>
 </div>`}
/* ---------- Settings › Memory: ONE list of rules, what Tuck knows about you, and what it learned (h.unified).
   h.rules = {list:()=>[{text,src}], add(text), edit(item,v), forget(item)->undo}: the rules live in the plan (tuck.html wires them).
   Each line: its text, where it came from (.msrc), Edit, Forget and an on/off switch. Off = Tuck ignores it (saved in 'tuckMemory'.off). */
const where=()=>{const p=location.pathname,hh=location.hash;
 if(/agent-chat/.test(p))return 'You told Tuck in Ask Tuck';if(/brain/.test(p))return 'You told Tuck in Tuck Brain';if(/onboarding/.test(p))return 'You told Tuck in setup';
 if(document.querySelector('.tkchat.open,.tkchat.on'))return 'You told Tuck in Ask Tuck';
 if(/^#needs/.test(hh))return 'You told Tuck in Needs You';if(/^#chats/.test(hh))return 'You told Tuck in Chats';if(/^#(prefs|settings)/.test(hh))return 'You typed this in Settings';if(/^#edit/.test(hh))return 'You said Always in Edit Folders';
 return 'You told Tuck'};
const noteSrc=(key,src)=>{M.srcs[key]=src||where();save()};
/* rules made anywhere this file is loaded remember where they were said ("You told Tuck in Needs You") */
addEventListener('DOMContentLoaded',()=>{const P=window.Plan;if(!P||!P.addRule||P.addRule.__mem)return;const a=P.addRule;P.addRule=function(t){if(!M.srcs['r:'+t]){M.srcs['r:'+t]=where();save()}return a.apply(this,arguments)};P.addRule.__mem=1});
const isOn=k=>!M.off.has(k);
const RULEISH=/^(?:always|never|put|keep|move|file|send|sort|don['’]?t|do not|from now on|every time|whenever|anything|everything|all|any)\b|→/i;
const lineLabel=l=>sameAsHead(l)?(l.g==='Classes'?'Class':l.k):l.k;
function items(h){const rs=h.rules?h.rules.list():[];
 const out=rs.map((r,i)=>({kind:'rule',key:'r:'+r.text,text:r.text,src:M.srcs['r:'+r.text]||r.src||'You told Tuck',rule:r}));
 L().filter(l=>l.g!=='Patterns').forEach(l=>out.push({kind:'you',key:'p:'+l.id,label:lineLabel(l),text:l.v,src:`${SRC[l.src]} · ${l.from}`,line:l}));
 M.told.forEach((t,i)=>out.push({kind:'you',key:'t:'+t,label:'You said',text:t,src:M.srcs['t:'+t]||'You told Tuck',told:i}));
 L().filter(l=>l.g==='Patterns').forEach(l=>out.push({kind:'learned',key:'p:'+l.id,label:l.k,text:l.v,src:`${SRC[l.src]} · ${l.from}`,line:l}));
 return out}
const KINDS=[['rule','Rules','Tuck follows these every time it sorts.'],['you','About you','What Tuck knows about you, so it can guess where things belong.'],['learned','Learned','Habits Tuck noticed in your files. It uses them to guess, never to move things on its own.']];
function uitem(it,i){const ed=M.edit2===it.key,on=isOn(it.key);
 return `<li class="mrow mi${on?'':' off'}" data-mitem="${i}" data-mkind="${it.kind}">${it.label?`<span class="mk">${esc(it.label)}</span>`:''}
  <span class="mv">${ed?`<input class="field" id="mein2" value="${esc(it.text)}" aria-label="Edit this line">`:`<b>${esc(it.text)}</b>`}<small class="msrc">${esc(it.src)}${on?'':' · Off, Tuck ignores this'}</small></span>
  <span class="ma">${ed?`<button class="btn sm pri" data-msave2="${i}">Save</button>`:`<button class="btn sm ghost" data-medit2="${i}">Edit</button>`}<button class="btn sm ghost" data-mforget2="${i}">Forget</button></span>
  <button class="sw${on?' on':''}" role="switch" aria-checked="${on}" data-mon="${i}" aria-label="Use “${esc(it.text)}”"></button></li>`}
function uhtml(h){const all=items(h),n=k=>all.filter(x=>x.kind===k).length,f=M.filter;
 const groups=KINDS.filter(([k])=>f==='all'||f===k);
 return `<div class="memv uni">
  <div class="mchips" role="group" aria-label="Show">${[['all','All',all.length],...KINDS.map(([k,l])=>[k,l,n(k)])].map(([k,l,c])=>`<button class="mchip${f===k?' on':''}" data-mchip="${k}" aria-pressed="${f===k}">${l}${k==='all'?'':` <small>(${c})</small>`}</button>`).join('')}</div>
  <div class="madd2"><input class="field" id="madd2" placeholder="Add a rule or something about you, like “Always put receipts in Money”" aria-label="Add a rule or something about you"><button class="btn sm pri" data-madd2>Add</button><small class="mhint" id="mhint">Starts with always, never, put or keep? Tuck reads it as a rule. Anything else is something about you.</small></div>
  ${groups.map(([k,l,d])=>{const its=all.map((x,i)=>[x,i]).filter(([x])=>x.kind===k);return `<section class="mgrp" data-mgrp="${k}"><h4>${l} <small>${its.length}</small></h4><p class="mdesc">${d}</p><ul>${its.map(([x,i])=>uitem(x,i)).join('')||'<li class="mrow"><span class="mv muted">Nothing yet.</span></li>'}</ul></section>`}).join('')}
  <section class="mgrp mmore"><h4>How Tuck should work for you</h4><p class="mdesc">Plain words Tuck reads before every sort. Rules above win when they disagree.</p><textarea class="field" id="minstr" rows="2" placeholder="e.g. Keep class files by week. Never touch my Music folder.">${esc(PROFILE.instructions)}</textarea></section>
  <section class="mgrp mmore"><h4>Bring in what another AI knows</h4>${M.imp?`<textarea class="field" id="mimp" rows="4" placeholder="In your other AI assistant, ask “What do you remember about me?”, copy the answer and paste it here."></textarea><div class="madd"><button class="btn sm pri" data-mimpok>Add These Lines</button><button class="btn sm ghost" data-mimpno>Cancel</button></div>`:`<div class="madd"><button class="btn sm" data-mimp><i class="ph ph-download-simple"></i>Paste from another AI assistant</button><small class="mnote">You paste it. Tuck never connects to them. Health, money and ID details are left out.</small></div>`}</section>
  <section class="mgrp mmore"><h4>Forget everything</h4><div class="mwipe">${M.wipe?`<p>Tuck will forget everything about you. Rules stay; your files and folders stay as they are.</p><button class="btn sm danger" data-mwipeok>Forget Everything</button><button class="btn sm ghost" data-mwipeno>Cancel</button>`:`<button class="btn sm ghost danger" data-mwipe><i class="ph ph-trash"></i>Forget Everything About Me</button>${h.other?`<a class="mlink" href="${h.other.href}">${h.other.label}</a>`:''}`}</div></section>
 </div>`}
function urender(el,h){const re=()=>render(el,h);const all=items(h);
 const forgetIt=it=>{M.edit2=null;let undo;
  if(it.kind==='rule')undo=h.rules.forget(it.rule);
  else if(it.told!==undefined){const k=it.told,[x]=M.told.splice(k,1);save();undo=()=>{M.told.splice(k,0,x);save()}}
  else{M.gone.add(it.line.id);save();undo=()=>{M.gone.delete(it.line.id);save()}}
  return undo};
 el.onclick=e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.mchip){M.filter=d.mchip;M.edit2=null;re();return}
  if(d.mon!==undefined){const it=all[+d.mon],on=!isOn(it.key);on?M.off.delete(it.key):M.off.add(it.key);save();h.onToggle&&h.onToggle(it,on);re();
   h.toast(on?'Tuck uses it again.':'Off. Tuck ignores it from the next file on. Nothing already sorted moves.',()=>{on?M.off.add(it.key):M.off.delete(it.key);save();h.onToggle&&h.onToggle(it,!on);re()});return}
  if(d.medit2!==undefined){M.edit2=all[+d.medit2].key;re();const i=el.querySelector('#mein2');i&&(i.focus(),i.select());return}
  if(d.msave2!==undefined){saveEdit(all[+d.msave2]);return}
  if(d.mforget2!==undefined){const it=all[+d.mforget2],undo=forgetIt(it);
    h.toast(`Forgot “${it.text}”.`,()=>{undo&&undo();if(it.kind!=='rule'){save();tell()}re()});out(el,`[data-mitem="${d.mforget2}"]`,re);return}
  if('madd2' in d){addIt(el.querySelector('#madd2').value);return}
  if('mimp' in d){M.imp=true;re();el.querySelector('#mimp').focus();return}
  if('mimpno' in d){M.imp=false;re();return}
  if('mimpok' in d){const lines=el.querySelector('#mimp').value.split(/\n|(?<=\.)\s+/).map(x=>x.replace(/^[-•*\d.)\s]+/,'').trim()).filter(x=>x.length>3&&!/health|medical|bank|salary|passport|ssn|social security/i.test(x));lines.forEach(x=>{M.told.push(x);M.srcs['t:'+x]='Pasted from another AI assistant'});M.imp=false;save();h.toast(`Added ${lines.length} line${lines.length===1?'':'s'}. Health, money and ID details were left out.`,()=>{M.told.splice(M.told.length-lines.length);save();re()});re();return}
  if('mwipe' in d){M.wipe=true;re();return}
  if('mwipeno' in d){M.wipe=false;re();return}
  if('mwipeok' in d){const before=[new Set(M.gone),[...M.told],PROFILE.instructions];PROFILE.lines.forEach(l=>M.gone.add(l.id));M.told=[];PROFILE.instructions='';M.wipe=false;save();h.toast('Tuck forgot everything about you. Your rules and files are untouched.',()=>{[M.gone,M.told,PROFILE.instructions]=before;save();re()});h.happy&&h.happy('Okay. Starting fresh.');re();return}};
 const saveEdit=it=>{const v=(el.querySelector('#mein2')||{}).value;const nv=String(v||'').trim();M.edit2=null;
  if(nv&&nv!==it.text){const was=M.off.has(it.key);M.off.delete(it.key);
   if(it.kind==='rule'){h.rules.edit(it.rule,nv);M.srcs['r:'+nv]='You fixed this in Settings';if(was)M.off.add('r:'+nv)}
   else if(it.told!==undefined){M.told[it.told]=nv;M.srcs['t:'+nv]='You fixed this in Settings';if(was)M.off.add('t:'+nv)}
   else{edits[it.line.id]={v:nv,src:'told',from:'You fixed this'};it.line.v=nv;it.line.src='told';it.line.from='You fixed this';if(was)M.off.add(it.key)}
   save();h.happy&&h.happy("Got it. I'll remember that.")}
  re()};
 const addIt=v=>{v=String(v||'').trim();if(!v)return;
  if(RULEISH.test(v)){M.srcs['r:'+v]='You typed this in Settings';save();h.rules.add(v);h.toast('Rule added. Tuck follows it from the next file on.',()=>{h.rules.forget({text:v,mine:true});re()})}
  else{M.told.push(v);M.srcs['t:'+v]='You typed this in Settings';save();h.toast('Added to About you.',()=>{const k=M.told.lastIndexOf(v);if(k>=0)M.told.splice(k,1);save();re()})}
  h.happy&&h.happy("Noted. I'll keep that in mind.");re();const i=el.querySelector('#madd2');i&&i.focus()};
 el.onkeydown=e=>{e.stopPropagation();if(e.target.id==='madd2'&&e.key==='Enter')addIt(e.target.value);
  if(e.target.id==='mein2'){const it=all.find(x=>x.key===M.edit2);if(e.key==='Enter'&&it)saveEdit(it);if(e.key==='Escape'){M.edit2=null;re()}}};
 el.oninput=e=>{if(e.target.id==='madd2'){const v=e.target.value.trim(),hn=el.querySelector('#mhint');if(hn)hn.textContent=!v?'Starts with always, never, put or keep? Tuck reads it as a rule. Anything else is something about you.':RULEISH.test(v)?'Tuck reads this as a rule. It joins Rules.':'Tuck reads this as something about you. It joins About you.'}};
 el.onchange=e=>{if(e.target.id==='minstr'){PROFILE.instructions=e.target.value.trim();save();h.toast(PROFILE.instructions?'Saved. Tuck will follow this.':'Cleared.',null)}}}

/* a row leaves with a short collapse; then the view redraws */
function out(el,sel,then){const r=el.querySelector(sel);if(!r||matchMedia('(prefers-reduced-motion: reduce)').matches){then();return}r.classList.add('out');setTimeout(then,260)}
function render(el,h){hosts.forEach(x=>{if(x.el===el)hosts.delete(x)});hosts.add({el,h});if(h.unified){el.innerHTML=uhtml(h);urender(el,h);return}el.innerHTML=html(h);const re=()=>render(el,h);
 el.onclick=e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.mgo){h.go&&h.go(d.mgo);return}
  if(d.medit){M.edit=d.medit;re();const i=el.querySelector('#mein');i&&(i.focus(),i.select());return}
  if(d.msave){const l=PROFILE.lines.find(x=>x.id===d.msave),v=el.querySelector('#mein').value.trim();
   if(v&&v!==l.v){const had=edits[l.id]?Object.assign({},edits[l.id]):null;edits[l.id]={v,src:'told',from:'You fixed this'};l.v=v;l.src='told';l.from='You fixed this';
    h.toast(`Tuck will remember: ${v}.`,()=>{if(had)edits[l.id]=had;else delete edits[l.id];save();load();tell();re()});h.happy&&h.happy("Got it. I'll remember that.")}
   M.edit=null;save();re();return}
  if(d.mforget){const id=d.mforget,l=PROFILE.lines.find(x=>x.id===id);M.edit=null;
   out(el,`[data-mrow="${id}"]`,()=>{M.gone.add(id);save();re()});
   h.toast(`Forgot “${l.k==='Class'?l.v:l.k+': '+l.v}”.`,()=>{M.gone.delete(id);save();re()});return}
  if(d.muntell!==undefined){const k=+d.muntell;out(el,`[data-mtold="${k}"]`,()=>{const [x]=M.told.splice(k,1);save();re();h.toast(`Forgot “${x}”.`,()=>{M.told.splice(k,0,x);save();re()})});return}
  if('mtell' in d){add(el.querySelector('#mtell').value);return}
  if('mimp' in d){M.imp=true;re();el.querySelector('#mimp').focus();return}
  if('mimpno' in d){M.imp=false;re();return}
  if('mimpok' in d){const lines=el.querySelector('#mimp').value.split(/\n|(?<=\.)\s+/).map(x=>x.replace(/^[-•*\d.)\s]+/,'').trim()).filter(x=>x.length>3&&!/health|medical|bank|salary|passport|ssn|social security/i.test(x));M.told.push(...lines);M.imp=false;save();h.toast(`Added ${lines.length} line${lines.length===1?'':'s'}. Health, money and ID details were left out.`,()=>{M.told.splice(M.told.length-lines.length);save();re()});re();return}
  if('mwipe' in d){M.wipe=true;re();return}
  if('mwipeno' in d){M.wipe=false;re();return}
  if('mwipeok' in d){const before=[new Set(M.gone),[...M.told],PROFILE.instructions];PROFILE.lines.forEach(l=>M.gone.add(l.id));M.told=[];PROFILE.instructions='';M.wipe=false;save();h.toast('Tuck forgot everything about you. Your files are untouched.',()=>{[M.gone,M.told,PROFILE.instructions]=before;save();re()});h.happy&&h.happy('Okay. Starting fresh.');re();return}};
 const add=v=>{v=(v||'').trim();if(!v)return;M.told.push(v);save();h.happy&&h.happy("Noted. I'll keep that in mind.");re();el.querySelector('#mtell').focus()};
 el.onkeydown=e=>{e.stopPropagation();if(e.target.id==='mtell'&&e.key==='Enter')add(e.target.value);if(e.target.id==='mein'){if(e.key==='Enter')el.querySelector('[data-msave]').click();if(e.key==='Escape'){M.edit=null;re()}}};
 el.onchange=e=>{if(e.target.id==='minstr'){PROFILE.instructions=e.target.value.trim();save();h.toast(PROFILE.instructions?'Saved. Tuck will follow this.':'Cleared.',null)}}}
window.Memory={render,summaryText:()=>{const d=document.createElement('div');d.innerHTML=summary();return d.textContent},
 onChange:fn=>{subs.add(fn);return ()=>subs.delete(fn)},
 forget:id=>{M.gone.add(id);save()},
 /* something the person told Tuck in a composer ("I'm a TA for PHYS 1401"): kept with what they told Memory directly */
 remember:v=>{v=String(v||'').trim();if(!v)return false;M.told.push(v);if(!M.srcs['t:'+v])M.srcs['t:'+v]=where();save();tell();return true},
 /* on/off per line ('r:'+rule text, 't:'+told text, 'p:'+profile line id); off = Tuck ignores it */
 isOn,noteSource:noteSrc,counts:h=>{const a=items(h||{});return {rule:a.filter(x=>x.kind==='rule').length,you:a.filter(x=>x.kind==='you').length,learned:a.filter(x=>x.kind==='learned').length,off:a.filter(x=>!isOn(x.key)).length}},unremember:v=>{const i=M.told.lastIndexOf(v);if(i>=0){M.told.splice(i,1);save();tell()}},fromSetup,setup:()=>setupAns,restore:id=>{M.gone.delete(id);save()},reset:()=>{try{localStorage.removeItem(KEY)}catch(e){}load();tell()}};
})();
