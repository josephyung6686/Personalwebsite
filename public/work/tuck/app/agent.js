/* Tuck's agent pipeline (the composer on a Needs You card; any screen can use it).
   1. Context: the screen says what is in front of the person (the card's question, its files and their dates, where they go,
      the other places Tuck considered, every folder in the plan).
   2. Plan: the request becomes tool calls with the same names and arguments as the app's agent (src/assistant/registry.py):
      place_files, edit_plan, mark_sensitive, remember_rule, remember_fact, answer_question, explain_file, ask_user.
      In the real app the model makes this plan from the same context and tools. This prototype plans locally, so it costs
      nothing to try; it reads several requests in one message and asks a question when it is not sure, never "Got it".
   3. Run: the screen's own tools carry out each call on what is shown, and each one can be undone. The reply says what was done.
   Agent.run(text, ctx, tools) -> {reply, undo, chips, calls}
     ctx   = {what, files:[names], when:name->Date|null, dest:[path], alts:[[path]], folders:[[path]], why}
     tools = {place_files, edit_plan, mark_sensitive, remember_rule, remember_fact, answer_question, explain_file}
             each (args) -> {line, undo?} */
(function(){
const MON=['january','february','march','april','may','june','july','august','september','october','november','december'];
const clean=s=>String(s||'').trim().replace(/^["“'‘]+|["”'’.!]+$/g,'').trim();
const segs=s=>clean(s).split(/\s*(?:›|>|\/)\s*/).map(x=>x.trim()).filter(Boolean);
const same=(a,b)=>a.toLowerCase()===b.toLowerCase();
const blank=s=>!clean(s)||/^_+$|^\.\.\.$|^…$/.test(clean(s));

/* a folder the person named: a path ("PHYS 1401 › Labs") or one name ("ENGI 1006"), matched on the ends of the plan's
   paths; the card's own choices win a tie */
function findFolder(text,ctx){const want=segs(text);if(!want.length)return null;
  const ends=p=>p.length>=want.length&&want.every((w,i)=>same(p[p.length-want.length+i],w));
  const pool=[...(ctx.alts||[]),ctx.dest||[],...(ctx.folders||[])].filter(p=>p&&p.length);
  return pool.find(ends)||null}
/* files on the screen a phrase points at: a file name, part of one, or a month ("the March ones") */
function findFiles(text,ctx){const q=clean(text).toLowerCase().replace(/^(the|these|those)\s+/,'').replace(/\s+(ones?|files?)$/,'');if(!q)return [];
  const fs=ctx.files||[],exact=fs.filter(f=>f.toLowerCase()===q);if(exact.length)return exact;
  const mi=MON.findIndex(m=>m.startsWith(q.slice(0,3))&&q.length>=3&&m.startsWith(q));
  if(mi>=0&&ctx.when)return fs.filter(f=>{const d=ctx.when(f);return d&&d.getMonth()===mi});
  return fs.filter(f=>f.toLowerCase().includes(q))}

/* one clause -> tool calls, or null when this clause means nothing Tuck can act on */
function clause(t,ctx){const low=t.toLowerCase().replace(/[.!]+$/,'').trim();let m;
  if(/^(yes|yep|yeah|looks (right|good|fine)|that'?s (right|it|fine)|do it|go ahead|ok(ay)?|sure|perfect)$/.test(low))return [{name:'answer_question',args:{answer:'yes'}}];
  if(/^(skip|later|not now|ask me later|skip (it|this))$/.test(low))return [{name:'answer_question',args:{answer:'skip'}}];
  if(/^(why|how come|why here|why this|what is this|what'?s this)\b/.test(low))return [{name:'explain_file',args:{}}];
  if(m=low.match(/^(?:keep|make|mark|set)\s+(.+?)\s+private$/)){const who=/^(it|this|these|them|all|all of them|everything)$/.test(m[1])?ctx.files.slice():findFiles(m[1],ctx);
    return who.length?[{name:'mark_sensitive',args:{files:who}}]:null}
  if(m=t.match(/^(?:always|from now on|in future|in the future|every time|whenever)\b[\s,]*(.+)$/i))return [{name:'remember_rule',args:{text:clean(t)}}];
  if(m=t.match(/^(?:i'?m|i am|i work|i study|i teach|my (?:job|major|class|internship|work)\b)(.*)$/i))return [{name:'remember_fact',args:{text:clean(t)}}];
  if(m=low.match(/^(?:only|just)\s+(.+)$/)){const keep=findFiles(m[1],ctx);if(!keep.length)return [{name:'ask_user',args:{question:`None of these files match “${clean(m[1])}”. Which ones should go?`,choices:ctx.files.slice(0,3).map(f=>'Only '+f)}}];
    const rest=ctx.files.filter(f=>!keep.includes(f));return [{name:'place_files',args:{fileIds:rest,folderPath:'',keep}}]}
  if(m=low.match(/^(?:leave out|leave|skip|not|keep out|except|without|remove|drop)\s+(.+?)(?:\s+out)?$/)){const f=findFiles(m[1],ctx);return f.length?[{name:'place_files',args:{fileIds:f,folderPath:''}}]:null}
  if(m=t.match(/^(?:call|name|rename)\s+(?:it|this|the folder|this folder|that)?\s*(?:to|as)?\s*(.+)$/i)){const v=clean(m[1]);return blank(v)?null:[{name:'edit_plan',args:{op:'rename',label:v}}]}
  if(m=t.match(/^(?:make|create|add|new)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named)?\s*(.+?)(?:\s+(?:in|inside|under)\s+(.+))?$/i)){const v=clean(m[1]);if(blank(v))return null;
    const par=m[2]?findFolder(m[2],ctx):null;return [{name:'edit_plan',args:{op:'new_folder',label:v,parent:par?par.join(' › '):(ctx.dest||[]).join(' › ')}}]}
  if(m=t.match(/^(?:put|move|send|file|place)\s+(?:them|it|these|this|all|all of them|everything)?\s*(?:in|into|to|under|inside)\s+(.+)$/i))return place(m[1],ctx);
  /* "I want this to be in X", "I'd like these in X", "make this X", "this is for X" */
  if(m=t.match(/^(?:i\s+want|i'?d\s+like|i\s+would\s+like|let|make|have|this\s+is|these\s+are|it'?s|they'?re)\s+(?:(?:this|it|them|these|the files)\s+)?(?:to\s+)?(?:be\s+|go\s+|live\s+|sit\s+|stay\s+)?(in|into|under|inside|for|from|about|called|named)?\s*(.*)$/i)){
    const how=(m[1]||'').toLowerCase(),x=m[2];if(blank(x))return null;
    if(how==='called'||how==='named')return [{name:'edit_plan',args:{op:'rename',label:clean(x)}}];
    if(/^private$/i.test(clean(x)))return [{name:'mark_sensitive',args:{files:ctx.files.slice()}}];
    const f=findFolder(x,ctx);if(f)return [{name:'place_files',args:{fileIds:ctx.files.slice(),folderPath:f.join(' › ')}}];
    if(how==='in'||how==='into'||how==='under'||how==='inside')return place(x,ctx);
    return [{name:'ask_user',args:{question:`Do you want them in a new folder called “${clean(x)}”, or this folder renamed to “${clean(x)}”?`,choices:[`Put them in ${clean(x)}`,`Call it ${clean(x)}`]}}]}
  /* a folder name on its own */
  const f=findFolder(t,ctx);if(f)return [{name:'place_files',args:{fileIds:ctx.files.slice(),folderPath:f.join(' › ')}}];
  if(/^(no|nope|wrong|that'?s wrong|not (right|there|that))$/.test(low))return [{name:'ask_user',args:{question:'Where should they go instead?',choices:alts(ctx)}}];
  return null}
function place(x,ctx){if(blank(x))return null;const f=findFolder(x,ctx);
  /* a folder that is not in the plan yet: make it inside the card's part of life (PHYS 1401 › Lab Work), never at the top by accident */
  const path=f||(segs(x).length>1?segs(x):[...(ctx.dest||[]).slice(0,-1),clean(x)]);
  return [{name:'place_files',args:{fileIds:ctx.files.slice(),folderPath:path.join(' › '),isNew:!f}}]}
const alts=ctx=>[...(ctx.alts||[]).slice(0,2).map(p=>'Put them in '+p.join(' › ')),...(ctx.files.length>1?['Leave out '+ctx.files[0]]:[]),'Call it …'].slice(0,3);

/* the whole message: every clause must mean something, or Tuck asks one question about the whole message */
function plan(text,ctx){const t=clean(text);if(!t)return [];
  const whole=clause(t,ctx);
  const parts=t.split(/\s*(?:;|,\s*and\s+|,\s*then\s+|\s+and\s+then\s+|\s+then\s+|\s+and\s+|,\s+)\s*/i).filter(Boolean);
  if(parts.length>1){const each=parts.map(p=>clause(p,ctx));if(each.every(Boolean)&&!each.some(c=>c.some(x=>x.name==='ask_user')))return each.flat()}
  if(whole)return whole;
  return [{name:'ask_user',args:{question:`I’m not sure what to change on “${ctx.what}”. Should these go somewhere else, get a new name, or leave some out?`,choices:alts(ctx)}}]}

function run(text,ctx,tools){const calls=plan(text,ctx),lines=[],undos=[];let chips=null;
  for(const c of calls){
    if(c.name==='ask_user'){lines.push(c.args.question);chips=c.args.choices;continue}
    const fn=tools[c.name];if(!fn){lines.push(`I can’t do that from this card yet.`);continue}
    const r=fn(c.args)||{};if(r.line)lines.push(r.line);if(r.undo)undos.push(r.undo)}
  const reply=lines.join(' ');Agent.last={text,calls};
  return {reply,calls,chips,undo:undos.length?()=>undos.slice().reverse().forEach(u=>u()):undefined}}
window.Agent={run,plan,findFolder,findFiles};
})();

