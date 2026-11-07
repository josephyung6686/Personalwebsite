/* chatbot.js: Tuck's chat does the work (sort, clean up, edit folders, re-sort, answer questions) as plan cards.
   One engine: every change goes through plan.js (Plan.sortNew, Plan.applyNow, Plan.applyMine, Plan.setLevel, Plan.setKeep),
   so private files are never planned, Keep As Is never changes, Never Look In is skipped, and each card is one History row with Undo.
   Tuck's folders are a view: sorting never moves a file on disk. Trash is the one action that touches the Mac.
   Requests are read by a scripted parser (no AI call): the words map to an intent, names map to the plan's folders and files.

   TuckBot.reply(text, {thread, context}) -> bot message data | null (null: the page's own reply answers)
     A bot message is plain data (it is kept with the chat): {t, card?, ask?, files?, folders?, chips?, sent?}
   TuckBot.html(bot, i) -> html          TuckBot.handle(event, thread) -> true when it was a chat control
   TuckBot.started(bot, thread)          after the host shows a new message (a card that may run on its own starts here)
   TuckBot.attach(cpEl, composer)        the autonomy pop-up and the / and @ suggestions above the composer
   TuckBot.disclosure() -> html          the one line on what goes to AI      TuckBot.after(root)  mixed ticks after drawing
   thread = {msgs() -> [{me, bot?}], paint(), save(), send(text), push(bot), fill(text)}
   Card: {id, kind:'sort'|'move'|'arrange'|'trash'|'folders', title, state:'ready'|'running'|'done'|'undone'|'error',
          groups:[{k, to?, nw?:{name, parent}, acc?, trash?, del?, chg?, label?, clash?}], rows:[{id, k, fid?, nid?, op?, name, from, on, unsure, why, gone}],
          hist:[History row ids], res:{...}, req:{intent, args} (for Refine)}
   Safeguards: Trash, name clashes, unsure rows and making something readable always ask. Under every level but Just Do It,
   more than 20 files or a whole folder re-planned always shows the card. "Always do this kind" is a rule scoped to a place. */
(function(){
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pl=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
const mid=(s,n)=>window.tuckMid?tuckMid(s,n):s;
const V=()=>Plan.view();
const RM=matchMedia('(prefers-reduced-motion: reduce)');
let SEQ=0;const nid=p=>(p||'b')+Date.now().toString(36)+(SEQ++).toString(36);
const live=(v,f)=>f&&f.node!=='trash'&&v.node(f.node);
const allFiles=v=>Object.values(v.D.files).filter(f=>live(v,f));
const pathOf=(v,id)=>id&&v.node(id)?v.path(id):[];
const isPriv=(v,id)=>v.level(id).level==='private';
const lc=s=>String(s||'').toLowerCase();
const normN=s=>lc(s).replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const Pl=(n,w,ws)=>`${n} ${n===1?cap(w):cap(ws||w+'s')}`;

/* ---------- Tuck's voice: every fixed line the chat says lives here, in the bubble. Cards stay labels.
   First person, warm, short, one flourish at most. line(key, vars) picks a variant: the same message in the same place in the
   chat always gets the same one (checks stay stable), and it skips what was just said so it doesn't feel canned.
   Read the room: money, tax, health, legal, deadlines, private files, stress and Trash get the plain line (c), never a joke.
   Failures and refusals are plain and own what happened. Honesty first: lines only use numbers handed to them, and only
   say a change happened after it did. Same rules as the real AI's prompt (src/assistant/chat.py SYSTEM_BASE). */
const HEAVY=/\b(tax(es)?|w-?2|1099|1098|invoices?|bills?|bank|statements?|salary|pay ?slips?|pay ?stubs?|budgets?|loans?|debt|rent|mortgage|refunds?|money|finance|receipts?|insurance|health|medical|doctors?|hospital|clinic|therapy|therapist|diagnos\w*|prescriptions?|vaccines?|legal|lawyer|attorney|court|contracts?|lease|visa|passport|immigration|divorce|lawsuit|deadlines?|due|overdue|urgent|asap|late|exam|private|sensitive|passwords?|secret|confidential|ssn|stress(ed)?|panic\w*|worried|lost|missing|gone|deleted?|broken?|failed|error|wrong|died|death|funeral|grief|sad|fired|ugh|damn|shit|fuck\w*|trash)\b/i;
let ROOM={calm:false,seed:0,th:null,vk:[],said:{}};
const hash=s=>{let h=5381;for(const ch of String(s))h=(h*33+ch.charCodeAt(0))>>>0;return h};
const textOf=s=>String(s||'').replace(/<[^>]+>/g,'');
const firstW=s=>lc(textOf(s)).split(/\s+/)[0].replace(/[^a-z0-9]/g,'');
const shownT=b=>{const c=b&&b.card;if(c){if(c.state==='undone'&&c.undoSay)return c.undoSay;if(c.state==='done'&&c.win)return c.win;if(c.state==='error'&&c.errSay)return c.errSay}return (b&&b.t)||''};
const recentM=()=>{const ms=ROOM.th&&ROOM.th.msgs?ROOM.th.msgs():[];return ms.filter(m=>!m.me&&!m.think).slice(-24)};
/* said once per chat: the disk line, Trash's "never for good", privacy, "I didn't ask" */
const saidBefore=(flag,th)=>{const ms=(th||ROOM.th)&&(th||ROOM.th).msgs?(th||ROOM.th).msgs():[];return !!ROOM.said[flag]||ms.some(m=>m.said&&m.said[flag]||m.bot&&m.bot.said&&m.bot.said[flag])};
const once=flag=>{if(saidBefore(flag))return false;ROOM.said[flag]=1;return true};
function openRoom(raw,th){const sel=ctxName();ROOM={calm:HEAVY.test(String(raw||''))||(!!sel&&HEAVY.test(sel)),seed:hash(lc(raw))+(th&&th.msgs?th.msgs().length:0),th:th||null,vk:[],said:{}}}
function withRoom(c,th,fn){const keep=ROOM;ROOM={calm:!!c.calm,seed:c.seed||0,th:th||null,vk:[],said:{}};let out;try{out=fn()}finally{const r=ROOM;ROOM=keep;const b=th&&botOf(th,c);if(b){b.vk=(b.vk||[]).concat(r.vk);b.said=Object.assign(b.said||{},r.said)}}return out}
const botOf=(th,c)=>{const m=th.msgs().find(x=>x.bot&&(x.bot.card===c||x.bot.card2===c));return m&&m.bot};
function line(key,a={},force){const L=LINES[key];if(!L)return '';const fmt=x=>typeof x==='function'?x(a):x;
 if(!L.w||(ROOM.calm&&L.c!=null))return polish(fmt(L.c));if(force!=null){ROOM.vk.push(key+':'+force);return polish(fmt(L.w[force]))}
 const ms=recentM();const used=new Set(ms.flatMap(m=>(m.bot&&m.bot.vk)||m.vk||[]).concat(ROOM.vk));const lastM=ms[ms.length-1];const prev=lastM?firstW(lastM.bot?shownT(lastM.bot):lastM.h):'';
 const n=L.w.length,start=(ROOM.seed+hash(key))%n;let pick=-1;
 for(let i=0;i<n&&pick<0;i++){const k=(start+i)%n;if(!used.has(key+':'+k)&&firstW(fmt(L.w[k]))!==prev)pick=k}
 for(let i=0;i<n&&pick<0;i++){const k=(start+i)%n;if(firstW(fmt(L.w[k]))!==prev)pick=k}
 if(pick<0)pick=start;ROOM.vk.push(key+':'+pick);return polish(fmt(L.w[pick]))}
/* one exclamation mark a reply; none when it's serious */
function polish(t){t=String(t);if(ROOM.calm)return t.replace(/!/g,'.');let seen=false;return t.replace(/!/g,()=>{if(seen)return '.';seen=true;return '!'})}
const bold=s=>`<b>${esc(s)}</b>`;
const LINES={
 /* wins, after the change really happened */
 'win.many':{w:[a=>`All tucked in! ${a.n} files went to ${a.to}.`,a=>`${a.n} files, all snug in ${a.to}.`,a=>`Done! ${a.n} files now live in ${a.to}.`,a=>`There we go. ${a.n} files tucked into ${a.to}.`,a=>`${a.n} files found a home in ${a.to}.`,a=>`Sorted! ${a.n} files are in ${a.to}.`],c:a=>`Done. ${a.n} files are in ${a.to}.`},
 'win.one':{w:[a=>`All tucked in! ${a.name} went to ${a.to}.`,a=>`${a.name} is snug in ${a.to}.`,a=>`Done! ${a.name} now lives in ${a.to}.`,a=>`There we go. ${a.name} is in ${a.to}.`,a=>`${a.name} found its home in ${a.to}.`],c:a=>`Done. ${a.name} is in ${a.to}.`},
 'win.new':{w:[a=>`All tucked in! ${pl(a.n,'file')} settled into ${pl(a.f,'new folder')}.`,a=>`Done! ${pl(a.f,'new folder')}, ${pl(a.n,'file')} tucked inside.`,a=>`${pl(a.f,'new folder')}, freshly made. ${pl(a.n,'file')} went in.`,a=>`There we go. ${pl(a.n,'file')} now live in ${pl(a.f,'new folder')}.`],c:a=>`Done. ${pl(a.n,'file')} are in ${pl(a.f,'new folder')}.`},
 'win.rename':{w:[a=>`Done! ${a.a} is now ${a.b}.`,a=>`${a.b} it is.`,a=>`Same files, new name: ${a.b}.`],c:a=>`Done. ${a.a} is now ${a.b}.`},
 'win.merge':{w:[a=>`Folded ${a.a} into ${a.b}. Every file came along.`,a=>`Done! ${a.a} and ${a.b} are one folder now.`,a=>`${a.a} moved in with ${a.b}. Every file came along.`],c:a=>`Done. ${a.a} is part of ${a.b} now.`},
 'win.newFolder':{w:[a=>`Fresh folder! ${a.a} is ready.`,a=>`${a.a} is ready for files.`,a=>`Made ${a.a}. Nice and empty.`],c:a=>`Done. I made ${a.a}.`},
 'win.hide':{w:[a=>`${a.a} is out of sight. Its files stay where they are.`,a=>`Hidden! Say “show ${a.a} again” whenever you want it back.`],c:a=>`Done. ${a.a} is hidden. Its files stay where they are.`},
 'win.show':{w:[a=>`${a.a} is back.`,a=>`Welcome back, ${a.a}.`],c:a=>`Done. ${a.a} shows again.`},
 'win.inside':{w:[a=>`${a.a} now sits inside ${a.b}.`,a=>`Done! ${a.a} is tucked inside ${a.b}.`],c:a=>`Done. ${a.a} is inside ${a.b}.`},
 'win.keep':{w:[a=>`Hands off ${a.a}, promised.`,a=>`Got it. I’ll leave ${a.a} exactly as it is.`,a=>`${a.a} stays just as it is.`],c:a=>`Done. I’ll leave ${a.a} as it is.`},
 'win.private':{c:a=>a.first?`Done. ${a.a} is private now, so it never goes to AI. You can still open it.`:`Done. ${a.a} is private now.`},
 'win.privateMany':{c:a=>a.first?`Done. ${a.n} are private now, so they never go to AI. You can still open them.`:`Done. ${a.n} are private now.`},
 'win.release':{c:a=>`Done. I may read ${a.a} now, and its contents can go to AI. You can make it private again any time.`},
 'win.changes':{w:[a=>`Done! ${pl(a.n,'change')} made.`,a=>`There we go. ${pl(a.n,'change')}, all in.`,a=>`All set. ${pl(a.n,'change')} made.`],c:a=>`Done. ${pl(a.n,'change')} made.`},
 'win.folders':{w:[a=>`${pl(a.n,'fresh folder')}, ready to go.`,a=>`Done! ${pl(a.n,'new folder')} made.`],c:a=>`Done. ${pl(a.n,'new folder')} made.`},
 'win.needs':{w:[a=>`Answered! That’s ${pl(a.n,'thing')} off your list.`,a=>`Done. ${pl(a.n,'answer')} in, thanks.`],c:a=>`Done. ${pl(a.n,'answer')} in.`},
 'win.apply':{w:['Applied! Your waiting changes are in.','All in. Your waiting changes are applied.'],c:'Done. Your waiting changes are applied.'},
 'win.discard':{c:'Discarded. Undo brings them back.'},
 'win.forget':{c:'Forgetting this chat now.'},
 'win.trash':{c:a=>a.n&&a.d?`Moved ${pl(a.n,'file')} to the Trash and removed ${pl(a.d,'empty folder')}. Undo brings them back.`:a.n?`Moved ${pl(a.n,'file')} to the Trash. You can put ${a.n===1?'it':'them'} back any time.`:`Removed ${pl(a.d,'empty folder')}. Undo brings ${a.d===1?'it':'them'} back.`},
 'win.stopped':{c:a=>`Stopped, like you asked. ${a.done} done, ${a.left} not.`},
 'win.decision':{w:['Got it. One less thing to decide.','Thanks! That’s settled.','Settled. Undo is on the card.','Lovely, that one’s done.'],c:'Done. That one’s answered.'},
 'no.decision':{w:['Okay, leaving it as it is.','No it is. Nothing changed.','Fair enough. It stays put.'],c:'Okay. Nothing changed.'},
 'rule.saved':{w:['Saved! I’ll follow that from now on.','Got it, that’s a rule now.'],c:'Saved. I’ll follow that from now on.'},
 'linked':{w:['Linked! It shows on the map now.','Done. Those two are linked on the map.'],c:'Linked. It shows on the map now.'},
 /* undoing is never a win */
 'undo':{w:['Undone.','Undone. Back as it was.','All back where it was.','Taken back.'],c:'Undone.'},
 'undo.part':{c:a=>`Undone, mostly. ${a.left} had changed since, so I left ${a.left===1?'it':'them'}.`},
 'undo.none':{w:['Nothing to undo yet.','There’s nothing to undo yet. Clean slate.'],c:'Nothing to undo yet.'},
 'redo':{w:['Back on.','Redone.'],c:'Redone.'},
 /* failures: own it, say what happened */
 'oops.fail':{c:a=>`I couldn’t do that. ${a.why} Nothing changed.`},
 'no.folder':{w:[a=>`I couldn’t find a folder called “${a.q}”. Type its name as it shows in Edit Folders, or pick one with @.`,a=>`No folder called “${a.q}” that I can see. Try its name as it shows in Edit Folders, or pick one with @.`,a=>`“${a.q}” isn’t a folder I know. Pick one with @, or type its name as it shows in Edit Folders.`]},
 'oops.undo':{c:a=>`I couldn’t undo that. ${a.why}`},
 /* before a card */
 'lead.sort':{w:[a=>`${pl(a.n,'new file')} from ${a.from}! Here’s where I’d tuck ${a.n===1?'it':'them'}.`,a=>`I spotted ${pl(a.n,'new file')} in ${a.from}. Here’s where each would go.`,a=>`${pl(a.n,'new arrival')} from ${a.from}. Here’s my plan.`,a=>`Here’s where I’d put ${a.n===1?'the new file':`the ${a.n} new files`} from ${a.from}.`],c:a=>`${pl(a.n,'new file')} from ${a.from}. Here’s where each would go.`},
 'lead.merge':{w:[a=>`I’d fold ${a.a} into ${a.b}. All ${pl(a.n,'file')} come along.`,a=>`${pl(a.n,'file')} join ${a.b}, and ${a.a} goes away.`],c:a=>`${pl(a.n,'file')} join ${a.b}, and ${a.a} goes away.`},
 'lead.rename':{w:['Same files, new name. Change it on the card if you like.','Fresh name, same files. Tweak it on the card if you like.'],c:'Same files, new name. Change it on the card if you like.'},
 'lead.newFolder':{w:[a=>`A fresh folder ${a.at}. Click its name to change it.`,a=>`One new folder ${a.at}, coming up. Click its name to change it.`],c:a=>`A new folder ${a.at}. Click its name to change it.`},
 'lead.hide':{c:'It leaves your folders and the sidebar. Its files stay where they are, and you can bring it back any time.'},
 'lead.show':{w:['Back in your folders it goes.','Bringing it back to your folders.'],c:'Back in your folders.'},
 'lead.release':{c:'This always asks: once I may read it, its contents can be sent to AI to sort it. You can make it private again any time.'},
 'lead.private':{c:'I’ll make it private. It never goes to AI, and you can still open it.'},
 'lead.keep':{w:['I’ll leave it exactly as it is.','Hands off, promised.'],c:'I’ll leave it as it is.'},
 'lead.move':{w:['Here’s where it’d go in my folders. Change any file with its ⌄.','Here’s my plan for it. Change any file with its ⌄.'],c:'Here’s where it’d go in my folders. Change any file with its ⌄.'},
 'lead.moveFolder':{w:['The folder goes along with everything in it.','Everything in the folder comes along.'],c:'The folder moves with everything in it.'},
 'lead.locked':{c:'Some of these can’t be sorted. They show why.'},
 'lead.arrange':{w:[a=>`Here’s how I’d arrange ${a.a}.`,a=>`I had a think about ${a.a}. Here’s my plan.`,a=>`Here’s a plan for ${a.a}.`],c:a=>`Here’s a plan for ${a.a}.`},
 'lead.arrangeBy':{w:[a=>`Here’s ${a.a} by ${a.way}.`,a=>`${a.a}, by ${a.way}. Here’s how it’d look.`],c:a=>`Here’s a plan by ${a.way} for ${a.a}.`},
 'lead.split':{w:[a=>`I’d split ${a.a} into folders next to it.`,a=>`${a.a} could be a few smaller folders. Here’s how I’d split it.`],c:a=>`I’d split ${a.a} into folders next to it.`},
 'lead.resort':{w:[a=>`Here’s my re-sort of ${a.a}. Only these files change places.`,a=>`I took another look at ${a.a}. Only these files change places.`],c:a=>`Here’s a re-sort of ${a.a}. Only these files change places.`},
 'ask.arrange':{w:[a=>`How should I arrange ${a.a}?`,a=>`${a.a}: how would you like it?`],c:a=>`How should I arrange ${a.a}?`},
 'ask.resort':{w:[a=>`How far should I go with ${a.a}?`,a=>`${a.a}: how far should I go?`],c:a=>`How far should I go with ${a.a}?`},
 /* Trash: plain, always */
 'trash.ask':{c:'What should I clean up? Nothing goes until you say so.'},
 'trash.lead':{c:a=>`Here’s what can go${a.size?`, about ${a.size}`:''}. It goes to the Trash, so you can put it back.${a.first?' I never delete anything for good.':''}`},
 'trash.files':{c:'Trash always asks first. Tick what should go; you can put it back from the Trash.'},
 'trash.folder':{c:'It’s empty. Undo brings it back.'},
 'trash.none':{c:'Nothing to clean. I checked:'},
 'trash.notempty':{c:a=>`${a.a} still has files in it, and I only remove empty folders.`},
 /* answers */
 'found.one':{w:['Found it!','Here it is.',a=>`Got it. It’s in ${a.at}.`,a=>`There it is, in ${a.at}.`,a=>`That one was hiding in ${a.at}.`,a=>`Found it, tucked in ${a.at}.`],c:a=>`Here it is, in ${a.at}.`},
 'found.private':{c:a=>a.first?`Here it is, in ${a.at}. It’s private, so it stays on this Mac.`:`Here it is, in ${a.at}.`},
 'found.many':{w:[a=>`Found ${a.n}.`,a=>`${a.n} matches.`,a=>`I found ${a.n} that fit.`,a=>`Here are ${a.n}.`],c:a=>`I found ${a.n}.`},
 'found.folder':{w:[a=>`Found it! ${a.a} has ${pl(a.n,'file')}.`,a=>`Here’s ${a.a}, ${pl(a.n,'file')} and counting.`,a=>`${a.a}, right here. ${pl(a.n,'file')}.`],c:a=>`Here’s ${a.a}, ${pl(a.n,'file')}.`},
 'found.none':{w:[a=>`I couldn’t find anything called “${a.q}”. Want to try another word?`,a=>`Nothing called “${a.q}” in your folders. Try another word?`,a=>`No luck with “${a.q}”. Try another word, or a folder name?`],c:a=>`I couldn’t find anything called “${a.q}”. Try another word, or a folder name.`},
 'in.has':{w:[a=>`Peeked inside ${a.a}: ${pl(a.n,'file')}${a.k?` in ${pl(a.k,'folder')}`:''}.`,a=>`${a.a} has ${pl(a.n,'file')}${a.k?` in ${pl(a.k,'folder')}`:''}.`,a=>`Here’s what’s in ${a.a}: ${pl(a.n,'file')}${a.k?` in ${pl(a.k,'folder')}`:''}.`],c:a=>`${a.a} has ${pl(a.n,'file')}${a.k?` in ${pl(a.k,'folder')}`:''}.`},
 'in.empty':{w:[a=>`${a.a} is empty. All quiet in there.`,a=>`Nothing in ${a.a} yet.`],c:a=>`${a.a} is empty.`},
 'today.some':{w:[a=>`${pl(a.n,'file')} came in today${a.w?`, and ${a.w} still ${a.w===1?'waits':'wait'} for a home`:''}.`,a=>`${a.n>=5?'Busy day! ':''}${pl(a.n,'file')} came in${a.w?`, ${a.w} still waiting for a home`:''}.`,a=>`Today brought ${pl(a.n,'file')}${a.w?`. ${a.w} still ${a.w===1?'waits':'wait'} to be sorted`:''}.`],c:a=>`${pl(a.n,'file')} came in today${a.w?`. ${a.w} still ${a.w===1?'waits':'wait'} to be sorted`:''}.`},
 'today.none':{w:['Nothing came in today. Quiet one.','Nothing new today yet.','All quiet today, nothing came in.'],c:'Nothing came in today.'},
 'size':{c:a=>`${a.a} has ${pl(a.n,'file')}${a.k?` in ${pl(a.k,'folder')}`:''}, about ${a.size}.`},
 'private.list':{c:a=>`${pl(a.n,'file')}${a.in?` in ${a.in}`:''} ${a.n===1?'is':'are'} private: never sent to AI. You can still open them.${a.f?' Private folders:':''}`},
 'big':{w:[a=>`The biggest files${a.in?` in ${a.in}`:''}:`,a=>`Here are the heavyweights${a.in?` in ${a.in}`:''}:`],c:a=>`The biggest files${a.in?` in ${a.in}`:''}:`},
 'history':{w:['Here’s what I’ve been up to:','The latest changes:','Lately I’ve done this:'],c:'The latest changes:'},
 'history.none':{w:['No changes yet. Everything is as I first sorted it.','All quiet. Everything is as I first sorted it.'],c:'No changes yet. Everything is as I first sorted it.'},
 'sorted.day':{w:[a=>`I sorted ${a.n} ${a.day}. ${a.need?`${a.need} still ${a.need===1?'needs':'need'} you.`:'Nothing needs you.'}`,a=>`${a.n} tucked in ${a.day}. ${a.need?`${a.need} still ${a.need===1?'needs':'need'} you.`:'Nothing needs you.'}`,a=>`${a.n} sorted ${a.day}. ${a.need?`${a.need} ${a.need===1?'needs':'need'} you.`:'Nothing needs you.'}`],c:a=>`${a.n} sorted ${a.day}. ${a.need?`${a.need} ${a.need===1?'needs':'need'} you.`:'Nothing needs you.'}`},
 'attn':{w:[a=>a.needs&&a.nw?`${pl(a.needs,'thing')} ${a.needs===1?'needs':'need'} you, and ${pl(a.nw,'new file')} ${a.nw===1?'is':'are'} waiting.`:a.needs?`${pl(a.needs,'thing')} ${a.needs===1?'needs':'need'} you. No new files.`:a.nw?`Nothing needs you, but ${pl(a.nw,'new file')} ${a.nw===1?'is':'are'} waiting.`:'All clear! Nothing needs you.'],c:a=>a.needs&&a.nw?`${pl(a.needs,'thing')} ${a.needs===1?'needs':'need'} you. ${pl(a.nw,'new file')} waiting.`:a.needs?`${pl(a.needs,'thing')} ${a.needs===1?'needs':'need'} you.`:a.nw?`Nothing needs you. ${pl(a.nw,'new file')} waiting.`:'Nothing needs you.'},
 'needs.first':{c:a=>`${pl(a.n,'thing')} ${a.n===1?'needs':'need'} a yes or no. First up: ${a.q}`},
 'needs.none':{w:['All clear! Nothing needs you.','Nothing needs you right now. I checked every question I had.','Nothing waiting on you. Enjoy it.'],c:'Nothing needs you right now.'},
 'sort.none':{w:[a=>`Nothing new! I checked Downloads and Desktop${a.since?`: no new files since you sorted ${a.since}`:''}.`,a=>`All caught up. I checked Downloads and Desktop${a.since?`: no new files since you sorted ${a.since}`:''}.`,a=>`Nothing to tuck in right now. I checked Downloads and Desktop${a.since?`: no new files since you sorted ${a.since}`:''}.`],c:a=>`Nothing new to sort. I checked Downloads and Desktop${a.since?`: no new files since you sorted ${a.since}`:''}.`},
 'sort.last':{w:[a=>`Nothing new! I checked Downloads and Desktop. Your last sort, ${a.n}, ${a.when}:`,a=>`All caught up. I checked Downloads and Desktop. Here’s your last sort, ${a.n}, ${a.when}:`],c:a=>`Nothing new. I checked Downloads and Desktop. Your last sort, ${a.n}, ${a.when}:`},
 'setting':{w:['There you go.','All set.','You got it.','Done.','Switched.'],c:'Done.'},
 'setting.dark':{w:['Lights down.','Dark mode it is.'],c:'Done.'},
 'setting.light':{w:['Lights up.','Light mode it is.'],c:'Done.'},
 'setting.auto':{w:['I’ll follow your Mac.'],c:'Done.'},
 'setting.pause':{w:['Paused. I’ll sit tight until you say so.','Okay, hands off. I’ll wait until you say so.'],c:'Paused. I’ll wait until you say so.'},
 'setting.resume':{w:['Back to sorting!','And we’re back on.'],c:'Sorting is on again.'},
 'setting.raise':{c:'This lets me do more on my own, so I’ll ask first. Confirm on the card.'},
 'remember':{w:['Got it, I’ll remember that.','Noted!','Tucked away in my memory.'],c:'Noted. It’s in Settings › Memory.'},
 'forgot':{c:'Forgotten. Undo brings it back.'},
 'corrected':{w:['Fixed. Thanks for telling me.','Thanks, I’ve got it right now.'],c:'Fixed. Thanks for telling me.'},
 'unkeep':{w:[a=>`Okay, I can change ${a.a} again.`,a=>`${a.a} is open to changes again.`],c:a=>`Okay. I can change ${a.a} again.`},
 'opening':{c:a=>`Opening ${a.a}.`},
 'opening.to':{c:a=>`Opening ${a.a} to do it.`},
 'skip':{c:a=>`Skipped “${a.q}”. It waits at the end.`},
 'watch':{w:['Here’s what I’m keeping an eye on.','These are the places I watch.'],c:'These are the places I watch.'},
 'rules':{w:['Here are the rules I follow.','The rules you’ve taught me:'],c:'Here are the rules I follow.'},
 'tree':{w:['Here’s your whole tree.','Your folders, top to bottom.'],c:'Your folders, top to bottom.'},
 'rule.lead':{w:['Say the word and I’ll follow this from now on.','Happy to learn this one. Save it and I’ll follow it.'],c:'Save this and I’ll follow it from now on.'},
 'why.file':{w:['Here’s my thinking.','Here’s why I put it there.'],c:'Here’s why it’s there.'},
 'explain':{w:['Here’s what I know about it.','Here’s the rundown.'],c:'Here’s what I know about it.'},
 'about':{w:['Here’s what I know about you. Fix or forget anything.','This is what I’ve picked up about you. Fix or forget anything.'],c:'Here’s what I know about you. Fix or forget anything.'},
 'related':{w:[a=>`${a.n} files share a name with it.`,a=>`These ${a.n} go with it, going by their names.`],c:a=>`${a.n} files share a name with it.`},
 'next':{w:['Next up.','Here’s the next one.','This one’s next.'],c:'Here’s the next one.'},
 'estimate':{c:a=>`About ${a.mins} min and ${a.req} AI requests, by my count.`},
 'copies':{c:a=>`${pl(a.n,'copy','copies')}. I keep the one in your sorted folder.`},
 'versions':{w:[a=>`${a.n} versions. Newest: ${a.a}.`,a=>`I count ${a.n} versions. ${a.a} is the newest.`],c:a=>`${a.n} versions. Newest: ${a.a}.`},
 'versions.plan':{c:a=>`${pl(a.n,'older version')} into one folder. ${a.a} stays.`},
 'draft':{c:'Here’s a draft. I never send mail myself, so it’s yours to send.'},
 'due':{c:'Here’s what I can see. Dates come from names, and page 1 of files I may read.'},
 'accept.all':{c:a=>`${pl(a.n,'decision')} waiting. Untick any you’d rather answer yourself.`},
 'didnt.ask':{c:'I didn’t ask first, so Undo is on the card.'},
 'by.rule':{c:'Your rule covers this one.'},
 'think':{w:['Looking…','Rummaging…','Checking my folders…','One sec…','Having a look…'],c:'Looking…'},
 /* small talk */
 'hi.new':{w:[a=>`${a.hi}! ${pl(a.n,'new file')} ${a.n===1?'is':'are'} waiting. What can I do for you?`,a=>`${a.hi}! I’ve got ${pl(a.n,'new file')} looking for a home. What can I do for you?`],c:a=>`Hi. ${pl(a.n,'new file')} waiting. What can I do for you?`},
 'hi.clear':{w:[a=>`${a.hi}! All quiet in your folders. What can I do for you?`,a=>`${a.hi}! Nothing’s waiting on you. Ask me anything.`],c:'Hi. What can I do for you?'},
 'thanks':{w:['Anytime!','Happy to help.','You got it.','Anytime. I’ll be right here.','My pleasure.'],c:'You’re welcome.'},
 'praise':{w:['Aw, thanks!','Thanks! I do love a tidy folder.','Happy little folder over here.'],c:'Thanks.'},
 'how':{w:['Snug as ever, thanks. What can I do for you?','Feeling very organised. What do you need?'],c:'I’m here. What do you need?'},
 'who':{c:'I’m Tuck, the little folder who lives on your Mac and keeps your files sorted. I’m an AI, so ask me things in your own words.'},
 'joke':{w:['Why did the folder blush? Someone peeked at its hidden files.','I told a ZIP file a joke. It didn’t unpack it.','My favourite exercise? Filing. It really works the tabs.']},
 'stress':{c:'That sounds like a lot. Tell me what you need and I’ll keep it simple.'},
 'broken':{c:'I’m sorry. Tell me what you were trying to do and I’ll try another way.'},
 'whydid':{c:'I went by names, kinds and where similar files sit. If I got it wrong, Undo is on the card.'},
 'whydid.none':{c:'Do what? Point me at a file and I’ll explain.'},
 'miss':{w:[a=>`I looked through your ${a.n} files and found nothing for “${a.q}”. Give me a class or a month and I’ll narrow it down.`,a=>`Nothing for “${a.q}” in your ${a.n} files. Try a class, a month or a folder name.`,a=>`I’m not sure what “${a.q}” means. Try a file or folder name, or tell me what you’d like done.`],c:a=>`I found nothing for “${a.q}” in your ${a.n} files. Try a class, a month or a folder name.`},
 'wrong':{c:a=>a.undo?'My bad. Undo is right there on the card. What should I fix?':'My bad. What should I fix?'},
 'sorry':{w:['No need to be sorry.','All good, nothing to be sorry about.'],c:'No need to be sorry.'},
 'bye':{w:['See you soon!','Bye for now.'],c:'Bye for now.'},
 'ok':{w:['Sounds good.','Righto.','Okay!'],c:'Okay.'},
 'help.safe':{c:'Ask me anything about your files. Small, safe changes I just do, with Undo. Bigger ones I show you first. Trash always asks.'},
 'help.ask':{c:'Ask me anything about your files. You’ve got me on Ask Each Time, so I show you a plan before anything changes.'},
 'help.just':{c:'Ask me anything about your files. You’ve got me on Just Do It, so I do what you ask, with Undo. Trash, privacy and over 20 files still ask.'},
 'help.plan':{c:'Ask me anything about your files. You’ve got me on Plan Only, so plans wait for you in Edit Folders.'},
 'cant':{c:a=>a.why}
};
/* Tuck talks about himself as "I": refusals that come from plan.js still say "Tuck". */
const ME={never:'I never','won’t':'I won’t',may:'I may',can:'I can',does:'I do',leaves:'I leave',keeps:'I keep',checks:'I check',reads:'I read','isn’t':'I’m not','hasn’t':'I haven’t',could:'I could',suggests:'I suggest'};
const me=s=>String(s||'').replace(/(^|[.!?:]\s+)Tuck’s\b/g,'$1My').replace(/\bTuck’s\b/g,'my').replace(/\bTuck (never|won’t|may|can|does|leaves|keeps|checks|reads|isn’t|hasn’t|could|suggests)\b/g,(m,v)=>ME[v]);
/* Title Case for labels that come from data: small words stay small; "As" and "Is" do not (Keep As Is) */
const SMALLW=new Set(['a','an','and','at','by','for','in','of','on','or','the','to','with','from','into']);
const tc=s=>String(s||'').split(' ').map((w,i)=>!w||(i&&SMALLW.has(w))?w:/^[a-z]/.test(w)?w[0].toUpperCase()+w.slice(1):w).join(' ');
/* a chip you could have typed stays as a question; a command chip is a button */
const chipL=s=>/\?$/.test(s)?s:tc(s);
const ctxName=()=>{try{const s=curSel();return s?selName(s):''}catch(e){return ''}};
function helpLine(){const lv=level();return line(lv==='Ask About Everything'?'help.ask':lv==='Just Do It'?'help.just':lv==='Plan Only'?'help.plan':'help.safe')}
/* the small talk every chat shares: warm, and honest about what it knows */
function talk(q,th){const t=lc(q).replace(/[’']/g,'').replace(/[!.?,:;~\s]+/g,' ').trim();if(!t||!window.Plan)return null;openRoom(q,th);
 {const lm=recentM().pop();const lb=lm&&lm.bot;if(lm&&(lm.calmRoom||(lb&&(lb.calmRoom||lb.mood==='oops'))))ROOM.calm=true}
 const done=(html,starters)=>({html,text:textOf(html),starters:!!starters,vk:ROOM.vk,said:ROOM.said,calmRoom:ROOM.calm});
 const h=new Date().getHours(),hi=h<5?'Hi':h<12?'Morning':h<18?'Hi':'Evening';
 if(/^(hi|hey|hello|hiya|yo|howdy|good (morning|afternoon|evening))( there)?( tuck)?$/.test(t)){const n=Plan.counts?Plan.counts().new:0;return done(line(n?'hi.new':'hi.clear',{hi,n}),true)}
 if(/^(thanks|thank you|thx|ty|cheers|thanks a lot|thank you so much|great thanks|ok thanks|okay thanks)( tuck)?$/.test(t))return done(line('thanks'));
 if(/^(help|help me|what can you do|what do you do|how does this work|commands)( tuck)?$/.test(t))return done(helpLine(),true);
 if(/^(who are you|what are you|are you (an )?(ai|real|a robot|a bot|human|a person))( tuck)?$/.test(t))return done(line('who'));
 if(/^(nice|good job|great|great job|awesome|amazing|perfect|love it|well done|good one|yay|wow|you rock)( tuck)?$/.test(t))return done(line('praise'));
 if(/^(how are you|how are you doing|hows it going|how is it going|whats up|sup)( tuck)?$/.test(t))return done(line('how'));
 if(/^(tell me a joke|joke|make me laugh|say something funny)( tuck)?$/.test(t)){ROOM.calm=false;return done(line('joke'))}
 if(/^(sorry|my bad|im sorry)( tuck)?$/.test(t))return done(line('sorry'));
 if(/^(bye|goodbye|see you|see ya|night|good night|goodnight)( tuck)?$/.test(t))return done(line('bye'));
 if(/^(ok|okay|k|got it|sounds good|alright|all right|fine|cool)( tuck)?$/.test(t))return done(line('ok'));
 if(/^(im |i am |this is |feeling )?(so )?(stressed|overwhelmed|panicking|freaking out|worried|exhausted|a mess)( out)?$|^ugh$/.test(t)){ROOM.calm=true;return done(line('stress'))}
 if(/^(this is |its |it is |thats |that is )?(broken|not working|so broken)$|^(this |it )?(doesnt|does not|isnt|is not) work(ing)?$/.test(t)){ROOM.calm=true;return done(line('broken'))}
 if(/^why did you (do|sort|move|change|put) (that|this|it)( there)?$/.test(t)){ROOM.calm=true;const c=th&&lastCard(th);return done(line(c?'whydid':'whydid.none'))}
 if(/^(thats |that is |this is )?(wrong|not right|incorrect|a mistake)$|^you (got|did) (it|that) wrong$|^you messed up$|^nope?$|^not (that|there)$/.test(t)){ROOM.calm=true;const c=th&&lastCard(th);return done(line('wrong',{undo:!!c}))}
 return null}


/* ---------- autonomy: the plan's own setting (Settings › Limits), three named here */
const LEVELS=[['Ask About Everything','Ask Each Time','Nothing changes until you say so.'],
 ['Ask When Unsure','Do Safe Moves, Ask the Rest','Up to 20 sure files: done at once, with Undo. Bigger runs wait for you.'],
 ['Just Do It','Just Do It, Undo Stays','I do what you ask. Undo is on every card. Trash, privacy and over 20 files still ask.']];
const SHORT={'Ask About Everything':'Ask Each Time','Ask When Unsure':'Safe Moves','Just Do It':'Just Do It','Plan Only':'Plan Only'};
const level=()=>Plan.limits?Plan.limits():'Ask When Unsure';
/* "Always do this kind" lands in Settings › Memory as a rule naming its place; whole-folder sorts, Trash and privacy have none */
function ruleTexts(c){const v=V();if(c.kind==='sort'){const ps=[...new Set(c.rows.filter(r=>!r.gone&&r.on).map(r=>r.from).filter(Boolean))];return ps.map(p=>`Sort new files from ${p} without asking`)}
 if(c.kind==='move'){const ds=[...new Set(c.rows.filter(r=>!r.gone&&r.on).map(r=>{const g=c.groups.find(x=>x.k===r.k);return g&&g.to}).filter(Boolean))];return ds.length&&ds.every(d=>v.node(d))?ds.map(d=>`Sort files I name into ${v.path(d).join(' › ')} without asking`):[]}
 return []}
const hasRule=c=>{const t=ruleTexts(c),have=(Plan.rules?Plan.rules():[]).map(r=>r.text);return t.length>0&&t.every(x=>have.includes(x))};

/* ---------- names -> the plan's folders and files */
const PLACES=['downloads','desktop','documents','pictures','music'];
function strip(q){return String(q||'').trim().replace(/^["“'‘]+|["”'’.!?]+$/g,'').replace(/^(?:the|my|all|all the|all my|everything in|files in|the files in)\s+/i,'').replace(/\s+(?:folder|files)$/i,'').trim()}
function findNode(q,opt={}){const v=V();q=strip(q);if(!q)return null;const n=normN(q);if(!n)return null;
 const ids=v.all().filter(id=>{const x=v.node(id);return x&&(!x.special||/no folder/.test(n)||n==='loose')&&(opt.hidden||!x.hidden)});
 if(/^no folder( yet)?$|^loose$/.test(n)&&v.node('loose'))return 'loose';
 const segs=q.split(/\s*(?:›|>|\/)\s*/).filter(Boolean);
 if(segs.length>1){const want=segs.map(normN);const hit=ids.find(id=>{const p=v.path(id).map(normN);return p.length>=want.length&&want.every((w,i)=>p[p.length-want.length+i]===w)});if(hit)return hit}
 const nm=id=>normN(v.node(id).name),sq=s=>s.replace(/ /g,'');
 let hit=ids.find(id=>nm(id)===n)||ids.find(id=>sq(nm(id))===sq(n));if(hit)return hit;
 if(n.length<3)return null;
 const pre=ids.filter(id=>nm(id).startsWith(n)||sq(nm(id)).startsWith(sq(n)));if(pre.length)return pre.sort((a,b)=>nm(a).length-nm(b).length)[0];
 const inc=ids.filter(id=>nm(id).includes(n));return inc.length?inc.sort((a,b)=>nm(a).length-nm(b).length)[0]:null}
function findFiles(q){const v=V();q=strip(q);const n=normN(q.replace(/\.[a-z0-9]{2,4}$/i,''));if(!n)return [];const fs=allFiles(v);
 const ex=fs.filter(f=>normN(f.name.replace(/\.[^.]+$/,''))===n||lc(f.name)===lc(q));if(ex.length)return ex.map(f=>f.id);
 const all=fs.filter(f=>normN(f.name).includes(n));if(all.length)return all.slice(0,40).map(f=>f.id);
 const ws=n.split(' ').filter(w=>w.length>1);if(!ws.length)return [];
 const sc=fs.map(f=>[f,ws.filter(w=>normN(f.name).split(' ').some(t=>t===w||t.startsWith(w))).length]).filter(x=>x[1]===ws.length);
 return sc.slice(0,40).map(x=>x[0].id)}
/* @mentions: "@PHYS 1401 arrange by kind" -> scope; the longest folder or file name that follows the @ */
function mentions(text){const v=V();const out=[];let t=text;
 const names=[...v.all().map(id=>({ty:'node',id,name:v.node(id).name})),...allFiles(v).map(f=>({ty:'file',id:f.id,name:f.name}))].sort((a,b)=>b.name.length-a.name.length);
 t=t.replace(/@([^@]+)/g,(m0,rest)=>{const r=lc(rest);const hit=names.find(x=>r.startsWith(lc(x.name)));if(!hit)return m0;out.push(hit);return ' '+(hit.ty==='node'?'«'+hit.id+'»':'«f:'+hit.id+'»')+rest.slice(hit.name.length)});
 t=t.replace(/\s+/g,' ').trim();
 /* a mention in front only sets the scope */
 const lead=/^«[^»]+»\s+(?=\S)/.exec(t);if(lead)t=t.slice(lead[0].length);
 return {text:t,scope:out}}
const tok=s=>{const m=/«(f:)?([^»]+)»/.exec(s||'');return m?{ty:m[1]?'file':'node',id:m[2]}:null};
function target(s){const t=tok(s);if(t)return t;const n=findNode(s);if(n)return {ty:'node',id:n};const fs=findFiles(s);return fs.length?{ty:'files',ids:fs}:null}
const nameOf=(v,t)=>t?t.ty==='node'?v.node(t.id).name:t.ty==='file'?v.file(t.id).name:pl(t.ids.length,'file'):'';

/* ---------- reasons ("Why here?") */
function whyHere(v,fid,to){const f=v.file(fid),n=v.node(to);if(!f||!n)return '';
 const words=normN(f.name.replace(/\.[^.]+$/,'')).split(' ').filter(w=>w.length>2&&!/^\d+$/.test(w));
 const sib=v.files(to,true).filter(x=>x.id!==fid);const w=words.find(w=>sib.filter(x=>normN(x.name).split(' ').includes(w)).length>=2);
 if(w){const c=sib.filter(x=>normN(x.name).split(' ').includes(w)).length;return `Its name has “${w}”, like ${pl(c,'file')} in ${n.name}.`}
 if(f.hint===to)return `My pick from its name and kind. ${n.why?n.why+'.':''}`.trim();
 const k=Plan.kind(f.name).label,same=sib.filter(x=>Plan.kind(x.name).label===k).length;
 return same>=2?`${k} files like it sit in ${n.name} (${same}).`:n.why?`${n.why}.`:`You picked ${n.name}.`}

/* ---------- cards */
function mkCard(kind,title,o={}){return Object.assign({id:nid('c'),kind,title,state:'ready',groups:[],rows:[],hist:[],note:'',req:null,calm:ROOM.calm,seed:ROOM.seed},o)}
function grp(c,g){let x=c.groups.find(y=>y.k===g.k);if(!x){x=Object.assign({},g);c.groups.push(x)}return x}
function rowFile(c,k,fid,o={}){const v=V(),f=v.file(fid);if(!f)return null;const r=Object.assign({id:nid('r'),k,fid,fromNode:f.node,name:f.name,from:f.node==='loose'?(f.from||'No folder yet'):v.node(f.node)?v.path(f.node).slice(-1)[0]:'',on:true,unsure:false,why:''},o);c.rows.push(r);return r}
const destK=id=>'n:'+id;
function groupFor(c,id){return grp(c,{k:destK(id),to:id})}
/* a software project is one item: Tuck never sorts into it or out of it (package.json, .git, or a site's index.html with its code) */
function isProject(v,id){const n=v.node(id);if(!n||n.special)return false;const fs=v.files(id);return fs.some(f=>/^(package\.json|\.git)$/i.test(f.name))||fs.filter(f=>/^(index\.html|main\.js|styles\.css)$/i.test(f.name)).length>=2}
const projectOf=(v,id)=>v.node(id)?v.pathIds(id).find(x=>isProject(v,x))||null:null;
const projSay=(v,id,verb)=>`${esc(v.node(projectOf(v,id)).name)} is a software project. I keep it whole and never ${verb}.`;
/* files Tuck may plan: not private, not Keep As Is, not under Never Look In, not inside a software project */
function plannable(v,fid){const f=v.file(fid);if(!f)return 'It isn’t in your folders any more.';
 {const pj=f.node!=='loose'&&projectOf(v,f.node);if(pj)return `${v.node(pj).name} is a software project. I keep it whole and never sort its files.`}
 if(isPriv(v,fid))return `${f.name} is private. I never plan private files.`;
 if(Plan.isKept&&Plan.isKept(fid))return `${f.name} is Keep As Is.`;if(f.node!=='loose'&&Plan.neverIn&&Plan.neverIn(f.node))return `I never look in ${v.node(f.node).name}.`;
 const k=f.node!=='loose'&&v.pathIds(f.node).find(id=>Plan.isKept&&Plan.isKept(id));if(k)return `${v.node(k).name} is Keep As Is.`;return ''}

/* sort new files */
function cardSort(){const v=V();const rows=Plan.sortPlan?Plan.sortPlan():[];if(!rows.length)return null;
 const c=mkCard('sort','Sort New Files',{req:{intent:'sort'}});const stay=rows.filter(r=>r.stay);
 rows.filter(r=>!r.stay&&r.to).forEach(r=>{groupFor(c,r.to);const f=v.file(r.id);const out=f&&f.where&&!['Downloads','Desktop'].includes(String(f.where).split(' › ')[0]);
  rowFile(c,destK(r.to),r.id,{from:r.from||'Downloads',on:r.sure&&!out,unsure:!r.sure||out,why:out?`It’s in ${f.where}, outside your places.`:r.why})});
 if(stay.length)c.note=`${pl(stay.length,'file')} stay${stay.length===1?'s':''} where ${stay.length===1?'it is':'they are'}: ${stay.map(r=>r.stay.split(':')[0].toLowerCase()).filter((x,i,a)=>a.indexOf(x)===i).join(', ')}.`;
 return c}
/* move named files (or a folder) somewhere */
const noFolder=q=>line('no.folder',{q:esc(strip(q))});
const outside=q=>`${esc(cap(strip(q)))} is outside my folders, so I won’t put files there. I only sort into the folders in Edit Folders.`;
function cardMove(t,destQ){const v=V();let to=tok(destQ);to=to&&to.ty==='node'?to.id:findNode(destQ);
 if(to&&projectOf(v,to))return {say:projSay(v,to,'sort files into it')};
 if(t.ty==='node'){if(!to)return {say:noFolder(destQ)};return cardFolders([{ty:'putInside',nodes:[t.id],parent:to}],`Move ${v.node(t.id).name}`,'move')}
 const ids=t.ty==='file'?[t.id]:t.ids;const c=mkCard('move',ids.length===1?`Sort ${v.file(ids[0]).name}`:`Sort ${Pl(ids.length,'file')}`,{req:{intent:'move',args:[ids,destQ]}});
 let k;if(to){groupFor(c,to);k=destK(to)}
 else{if(PLACES.includes(normN(destQ)))return {say:outside(destQ)};const nm=strip(destQ).replace(/^a new folder( called| named)?\s*/i,'');if(!nm)return {say:noFolder(destQ)};
  k='new:'+nid('g');grp(c,{k,nw:{name:cap(nm),parent:null}});c.newName=nm}
 ids.forEach(fid=>{const why=plannable(v,fid);const f=v.file(fid);if(to&&f.node===to)return;rowFile(c,k,fid,why?{on:false,unsure:true,why,locked:true}:{})});
 if(!c.rows.length)return {say:`${ids.length===1?esc(v.file(ids[0]).name)+' is':'They are'} already in ${esc(v.node(to).name)}.`};
 checkClash(c,c.groups.find(g=>g.k===k));return c}
/* arrange inside a folder (by what they're for, year, kind or month), split next to it, re-sort */
function partsBy(id,way){const v=V();if(way==='month'){const fs=v.files(id,false).filter(f=>!isPriv(v,f.id));if(fs.length<4)return [];
  const g={};fs.forEach(f=>{const d=new Date(f.at);const k=d.toLocaleDateString('en-GB',{month:'long'})+' '+d.getFullYear();(g[k]=g[k]||[]).push(f.id)});
  const ps=Object.entries(g).map(([name,files])=>({name,files})).filter(p=>p.files.length>=2);return ps.length>=2?ps.slice(0,6):[]}
 return way==='pick'?Plan.draftBest(id,'thing'):Plan.draftArrange(id,way)}
const WAYW={pick:'my pick',thing:'what they’re for',year:'year',kind:'kind',month:'month'};
const WAYS_CH=(name,way)=>['year','kind','month','pick'].filter(w=>w!==way).slice(0,3).map(w=>w==='pick'?`Arrange ${name}`:`Arrange ${name} by ${w}`);
function cardArrange(id,way,split){const v=V(),n=v.node(id);if(projectOf(v,id))return {say:projSay(v,id,'re-arrange it')};
 const tool=split?'split':'arrange';const ok=Plan.can(tool,id);if(!ok.ok)return {say:esc(me(ok.why))};
 const parts=split?Plan.draftSplit(id):partsBy(id,way||'pick');
 if(!parts.length)return {say:`${esc(n.name)} doesn’t ${split?'split':'group'} well by ${WAYW[way||'pick']}. ${v.files(id).length<6?`It has only ${pl(v.files(id).length,'file')} of its own.`:'The files are too alike.'}`,chips:WAYS_CH(n.name,way)};
 const parent=split?(n.parent||null):id;
 const c=mkCard('arrange',split?`Split ${n.name}`:`Arrange ${n.name}${way&&way!=='pick'?' by '+tc(WAYW[way]):''}`,{req:{intent:split?'split':'arrange',args:[id,way||'pick']},scope:id});
 parts.forEach(p=>{const k='new:'+nid('g');const g=grp(c,{k,nw:{name:p.name,parent}});p.files.forEach(fid=>{const why=plannable(v,fid);rowFile(c,k,fid,why?{on:false,unsure:true,why,locked:true}:{})});checkClash(c,g)});
 const rest=v.files(id).length-c.rows.length;if(rest>0&&!split)c.note=`${pl(rest,'file')} stay${rest===1?'s':''} in ${esc(n.name)}.`;return c}
function cardResort(id,reach){const v=V(),n=v.node(id);if(projectOf(v,id))return {say:projSay(v,id,'re-sort it')};
 const ok=Plan.can('resort',id);if(!ok.ok)return {say:esc(me(ok.why))};
 if(!window.Resort||!Resort._planFor)return cardArrange(id,'pick');
 const p=Resort._planFor({scope:'folder_tree',nodeId:id,reach:reach||'suggest_subfolders'});const ops=p.ops||[];
 const c=mkCard('arrange',`Re-sort ${n.name}`,{req:{intent:'resort',args:[id]},scope:id});
 const newK={};ops.filter(o=>o.ty==='newFolder').forEach(o=>{const k='new:'+o.node;newK[o.node]=k;grp(c,{k,nw:{name:o.name,parent:o.parent}})});
 ops.filter(o=>o.ty==='accept').forEach(o=>{const s=v.node(o.node);if(!s)return;const k='acc:'+o.node;grp(c,{k,acc:o.node,nw:{name:s.name,parent:s.parent}});
  v.files(o.node).forEach(f=>{const r=rowFile(c,k,f.id);if(r)r.from=v.node(s.parent).name})});
 ops.filter(o=>o.ty==='moveFiles').forEach(o=>{const k=newK[o.to]||destK(o.to);if(!newK[o.to])groupFor(c,o.to);o.files.forEach(fid=>{if(!c.rows.some(r=>r.fid===fid)){const why=plannable(v,fid);rowFile(c,k,fid,why?{on:false,unsure:true,why,locked:true}:{})}})});
 c.groups=c.groups.filter(g=>c.rows.some(r=>r.k===g.k));
 if(!c.rows.length)return {say:`${esc(n.name)} already looks right to me: every file fits where it is.`,chips:WAYS_CH(n.name,'')};
 const skip=(p.sc&&p.sc.priv||0)+(p.sc&&p.sc.kept||0);if(skip)c.note=`${pl(skip,'file')} stay${skip===1?'s':''} as they are: private or Keep As Is.`;return c}
/* clean up: duplicates, old installers, empty folders, old screenshots (and opened zips) */
const CLEAN={dup:'Duplicates',ins:'Old Installers',empty:'Empty Folders',shots:'Screenshots Older Than 30 Days',zip:'Opened Zips'};
function trashedNames(){const out=new Set();(Plan.history?Plan.history():[]).forEach(r=>{if(r.undone)return;(r.ops||[]).forEach(o=>{if(o.ty==='trash')(o.names||[]).forEach(n=>out.add(n))})});return out}
function tidyLeft(id){const q=window.TuckQueue?TuckQueue.get():null;if(q&&Array.isArray(q.tidy))return q.tidy.some(g=>g.id===id);return true}
function cleanItems(kind,days){const v=V();const gone=trashedNames();const byName={};allFiles(v).forEach(f=>{byName[f.name]=f});
 if(kind==='empty')return v.all().filter(id=>{const n=v.node(id);return n&&!n.special&&!n.sug&&!n.hidden&&!v.total(id)&&!v.kids(id).length}).map(id=>({nid:id,name:v.node(id).name,from:pathOf(v,v.node(id).parent).join(' › ')||'Top level'}));
 if(kind==='shots'){days=days||30;return allFiles(v).filter(f=>/^Screenshot\b/i.test(f.name)&&f.age>days&&!plannable(v,f.id)).sort((a,b)=>b.age-a.age).map(f=>({fid:f.id,name:f.name,from:v.path(f.node).slice(-1)[0],why:`${f.age} days old`}))}
 const g=(window.TIDY_GROUPS||[]).find(x=>x.id===kind);if(!g||!tidyLeft(kind))return [];
 return g.items.filter(([n])=>!gone.has(n)&&!(byName[n]&&plannable(v,byName[n].id))).filter(([n])=>!(kind==='ins'&&!byName[n]&&Object.values(v.D.files).some(f=>f.name===n))).map(([n,mb,where])=>({fid:byName[n]?byName[n].id:null,name:n,from:byName[n]?v.path(byName[n].node).slice(-1)[0]:String(where).split(' · ')[0],mb,why:kind==='dup'?String(where):g.why}))}
function cardClean(kinds,days){const c=mkCard('trash','Clean Up',{req:{intent:'clean',args:[kinds,days]}});
 kinds.forEach(kd=>{const items=cleanItems(kd,days);if(!items.length)return;const k='t:'+kd;
  grp(c,kd==='empty'?{k,del:true,label:'Remove Empty Folders'}:{k,trash:true,label:kd==='shots'?`Screenshots Older Than ${days||30} Days`:CLEAN[kd]});
  items.forEach(it=>c.rows.push(Object.assign({id:nid('r'),k,on:true,unsure:false},it)))});
 return c.rows.length?c:null}
/* folder edits: rename, merge, new folder, hide, show, private, release, keep as is, move a folder */
function cardFolders(ops,title,kind){const c=mkCard('folders',title,{req:{intent:'folders'},rk:kind||'folders'});grp(c,{k:'chg',chg:true});
 ops.forEach(op=>{const r={id:nid('r'),k:'chg',op,on:true};const why=opWhy(op);if(why){r.on=false;r.locked=true;r.why=why}c.rows.push(r);
  if(op.ty==='newFolder'||op.ty==='rename')clashRow(r)});return c}
function opWhy(op){const v=V();if(op.ty==='release')return '';
 if(op.ty==='private')return isPriv(v,op.target)?`${(v.node(op.target)||v.file(op.target)).name} is already private.`:'';
 if(op.ty==='keep')return Plan.isKept(op.target)?`${(v.node(op.target)||v.file(op.target)).name} is already Keep As Is.`:'';
 if(op.ty==='merge'){if(op.nodes[0]===op.into)return 'That’s the same folder.';if(v.pathIds(op.into).includes(op.nodes[0]))return `${v.node(op.into).name} is inside ${v.node(op.nodes[0]).name}.`}
 if(op.ty==='putInside'&&op.parent&&v.pathIds(op.parent).includes(op.nodes[0]))return `${v.node(op.parent).name} is inside ${v.node(op.nodes[0]).name}.`;
 return Plan.guard?me(Plan.guard(op,false)||''):''}
/* name clashes always need the card: a folder with that name already sits there */
function sibling(parent,name,not){const v=V();const sib=parent?v.kids(parent):v.roots();return sib.find(id=>id!==not&&v.node(id)&&lc(v.node(id).name)===lc(name))||null}
function checkClash(c,g){if(!g||!g.nw)return;g.clash=sibling(g.nw.parent,g.nw.name)||null}
function clashRow(r){const op=r.op;r.clash=op.ty==='newFolder'?sibling(op.parent,op.name):op.ty==='rename'?sibling(V().node(op.node).parent,op.name,op.node):null}

/* ---------- counts and labels (sorting is "Sort": Tuck's folders are a view; only Trash says Move) */
const rowsIn=(c,k)=>c.rows.filter(r=>r.k===k&&!r.gone);
function blocked(c,r){const g=c.groups.find(x=>x.k===r.k);return !!(r.locked||(g&&g.clash&&!g.clashOk)||(r.clash&&!r.clashOk))}
const onRows=c=>c.rows.filter(r=>r.on&&!r.gone&&!blocked(c,r));
function tally(c){const on=onRows(c);const t={files:0,folders:0,trash:0,del:0,chg:0};const nf=new Set();
 on.forEach(r=>{const g=c.groups.find(x=>x.k===r.k);if(g.trash)t.trash++;else if(g.del)t.del++;else if(g.chg){t.chg++;if(r.op.ty==='newFolder')t.folders++}else{t.files++;if(g.nw)nf.add(g.k)}});
 t.folders+=nf.size;return t}
function primary(c){const t=tally(c);
 if(c.kind==='trash'){const a=[];if(t.trash)a.push(`Move ${t.trash} to Trash`);if(t.del)a.push(`Remove ${Pl(t.del,'empty folder')}`);return a.join(', ')||'Nothing Ticked'}
 if(c.kind==='folders'){const on=onRows(c);if(!on.length)return c.rows.some(r=>r.clash&&!r.clashOk)?'Choose on the Card':'Nothing Ticked';if(on.length>1)return t.folders===on.length?`Make ${t.folders} Folders`:`Make ${on.length} Changes`;
  if(on[0].op.ty==='need')return `Accept ${on.length}`;
  const o=on[0].op;return {apply:'Apply',discard:'Discard',forgetChat:'Forget',rename:'Rename',merge:'Merge',hide:'Hide',show:'Show Again',newFolder:'Make 1 Folder',putInside:'Move',private:'Make Private',keep:'Keep As Is',release:'Let Tuck Read It'}[o.ty]||'Do It'}
 if(t.files&&t.folders)return `Sort ${Pl(t.files,'file')}, Make ${Pl(t.folders,'folder')}`;if(t.files)return `Sort ${Pl(t.files,'file')}`;return c.groups.some(g=>g.clash&&!g.clashOk)?'Choose on the Card':'Nothing Ticked'}
const verbIng=c=>c.kind==='trash'?'Moving':c.kind==='folders'?'Changing':'Sorting';
/* Tuck's folders are a view: one quiet line says where the files really are. Trash is the one thing that touches the disk */
function diskLine(c,rows){const v=V();if(c.kind==='trash')return c.state==='ready'||c.state==='running'?'Goes to the Trash on your Mac. You can put it back.':'';if(!c.disk)return '';if(c.kind==='folders')return 'Only my folders change. Nothing moves on disk.';
 const ps=[...new Set((rows||c.rows).filter(r=>r.fid&&!r.gone).map(r=>{const f=v.file(r.fid);return f?String(f.where||f.from||'').split(' › ')[0]:''}).filter(Boolean))];
 return ps.length?`Still in ${ps.slice(0,2).join(' and ')}${ps.length>2?' and more':''} on disk. My folders are a view.`:'Nothing moves on disk.'}

/* ---------- applying (always through plan.js), with its steps: Reading → Planning → Sorting n of m */
const STEPS=c=>[...(c.kind==='folders'||c.kind==='trash'?[]:[['read','Reading'],['plan','Planning']]),['do',c.kind==='trash'?'Moving to Trash':c.kind==='folders'?'Changing':'Sorting']];
function stepsHtml(c){const k=STEPS(c).findIndex(s=>s[0]===c.phase);return `<ol class="tkb-steps">${STEPS(c).map((s,i)=>`<li class="${i<k?'ok':i===k?'on':''}">${i<k?'<i class="ph ph-check" aria-hidden="true"></i>':''}${esc(s[1])}${s[0]==='do'&&i===k?` ${Math.min((c.done||0)+1,c.total)} of ${c.total}`:''}</li>`).join('')}</ol>`}
const runLine=c=>c.phase==='do'?`${verbIng(c)} ${Math.min((c.done||0)+1,c.total)} of ${c.total}${c.kind==='trash'?' to Trash':''}…`:c.phase==='plan'?'Planning…':'Reading…';
function prog(c){document.querySelectorAll(`[data-tkb-card="${c.id}"]`).forEach(el=>{const sx=el.querySelector('.tkb-steps');if(sx)sx.outerHTML=stepsHtml(c);
 const i=el.querySelector('.tkb-prog i');if(i)i.style.transform=`scaleX(${(c.done||0)/c.total})`;const p=el.querySelector('.tkb-run p');if(p)p.textContent=runLine(c)})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(c,th,o={}){if(c.state!=='ready')return;const pick=onRows(c);if(!pick.length)return;c.state='running';c.stop=false;c.done=0;c.total=pick.length;th.mood&&th.mood('think');
 const step=RM.matches||c.ran==='auto'?12:Math.max(70,Math.min(260,1400/pick.length));
 if(c.kind!=='folders'&&c.kind!=='trash'&&c.ran!=='auto'){c.phase='read';th.paint();await wait(RM.matches?10:280);if(c.stop){c.state='ready';c.stopped=true;th.mood&&th.mood('listen');th.paint();th.save();return}
  c.phase='plan';prog(c);await wait(RM.matches?10:280)}
 c.phase='do';th.paint();prog(c);
 for(let i=0;i<pick.length;i++){await wait(step);if(c.stop)break;c.done=i+1;prog(c)}
 const did=pick.slice(0,c.done);if(!did.length){c.state='ready';c.stopped=true;th.mood&&th.mood('listen');th.paint();th.save();return}
 let hist=[];try{hist=commit(c,did)}catch(e){console.error(e);hist=null}
 if(!hist||!hist.length){c.state='error';c.err='Not Done';c.errSay=withRoom(c,th,()=>{ROOM.calm=true;return line('oops.fail',{why:esc(me(Plan.lastRefusal||''))}).replace(/\s+/g,' ')});th.mood&&th.mood('oops');th.paint();th.save();return}
 c.hist=hist.map(h=>h.id);c.applied=did.map(r=>r.id);c.left=pick.length-did.length;c.state='done';c.at=Date.now();
 if(o.rule){const have=(Plan.rules?Plan.rules():[]).map(r=>r.text);c.ruled=o.rule.filter(t=>!have.includes(t));c.ruled.forEach(t=>Plan.addRule(t))}
 c.res=result(c,did);c.win=winLine(c,did,th);c.latest=true;th.msgs().forEach(m=>{const x=m.bot&&m.bot.card;if(x&&x!==c&&x.state==='done')x.latest=false});th.mood&&th.mood(c.left||c.calm?'idle':'happy');th.paint();th.save();fire()}
function commit(c,did){const v=V();
 if(c.kind==='folders'){const out=[];const plain=[];did.forEach(r=>{const op=r.op;if(op.ty==='need'){out.push(Plan.answerNeed(op.need,true));rerender()}else if(op.ty==='apply')out.push(Plan.apply());else if(op.ty==='discard'){c.discarded=Plan.discard();out.push({id:'none'})}else if(op.ty==='forgetChat'){out.push({id:'none'});setTimeout(()=>{window.TuckChat&&TuckChat.clear()},400)}
   else if(op.ty==='private')out.push(Plan.setLevel(op.target,'private'));else if(op.ty==='keep')out.push(Plan.setKeep(op.target,true));else if(op.ty==='release')out.push(Plan.setLevel(op.target,'read'));
   else plain.push(Object.assign({},op,op.ty==='newFolder'&&!op.node?{node:Plan.uid('n')}:{}))});
  if(plain.length){const text=plain.length===1?Plan.describe(plain[0]).text:`You changed ${pl(plain.length,'folder')} in chat`;const row=(Plan.applyMine||Plan.applyNow)(plain,text,'chat');if(!row)return null;out.unshift(row)}return out.filter(Boolean)}
 if(c.kind==='trash'){const files=did.filter(r=>r.fid).map(r=>r.fid),names=did.filter(r=>!r.nid).map(r=>r.name),dels=did.filter(r=>r.nid).map(r=>r.nid);const ops=[];
  if(names.length)ops.push({ty:'trash',files,names});dels.forEach(n=>ops.push({ty:'deleteEmpty',node:n}));
  const full=(window.TIDY_GROUPS||[]).filter(g=>g.items.every(([n])=>names.includes(n))).map(g=>g.id);
  const row=Plan.applyNow(ops,names.length?`Moved ${pl(names.length,'file')} to the Trash`:`Removed ${pl(dels.length,'empty folder')}`,'chat');if(!row)return null;
  if(full.length&&window.TuckQueue)c.tidyGone=TuckQueue.trash(full);return [row]}
 /* sorts: new folders first, then the files; Sort New Files keeps its one state (Plan.sortNew) */
 const ops=[],made={};const by={};did.forEach(r=>{(by[r.k]=by[r.k]||[]).push(r.fid)});
 const gs=c.groups.filter(g=>by[g.k]);
 if(c.kind==='sort'&&gs.every(g=>g.to)){const to={};did.forEach(r=>{const g=c.groups.find(x=>x.k===r.k);to[r.fid]=g.to});const row=Plan.sortNew(did.map(r=>r.fid),to);return row?[row]:null}
 gs.forEach(g=>{if(g.acc){ops.push({ty:'accept',node:g.acc});const left=rowsIn(c,g.k).filter(r=>!by[g.k].includes(r.fid)).map(r=>r.fid);if(left.length)ops.push({ty:'moveFiles',files:left,to:v.node(g.acc).parent});return}
  if(g.nw){const use=g.clash&&g.clashUse;const id=use?g.clash:Plan.uid('n');if(!use)ops.push({ty:'newFolder',node:id,parent:g.nw.parent,name:g.clash&&g.clashOk?g.nw.name+' 2':g.nw.name});made[g.k]=id;ops.push({ty:'moveFiles',files:by[g.k],to:id});return}
  ops.push({ty:'moveFiles',files:by[g.k],to:g.to})});
 const n=did.length,nf=gs.filter(g=>g.nw&&!g.clashUse).length;const text=c.title+(c.kind==='move'?'':`: ${pl(n,'file')}${nf?`, ${pl(nf,'new folder')}`:''}`);
 const row=Plan.applyNow(ops,text,'chat');if(!row)return null;c.made=made;return [row]}
function result(c,did){const v=V();const groups=[];
 c.groups.forEach(g=>{const rs=did.filter(r=>r.k===g.k);if(!rs.length)return;
  let label;if(g.trash)label='Trash';else if(g.del)label='Removed';else if(g.chg)label='';else{const id=g.to||(c.made&&c.made[g.k])||g.acc;label=id&&v.node(id)?v.path(id).join(' › '):g.nw?g.nw.name:''}
  /* one folder change: the card's head says it all, no row repeating it */if(g.chg&&did.length===1)return;
  const opText=r=>{const o=r.op;if(!o)return r.name;if(o.target){const x=v.node(o.target)||v.file(o.target);return x?x.name:''}return Plan.describe(o,V()).text};
  groups.push({label,n:rs.length,names:rs.map(opText),rows:rs.map(r=>({id:r.id,name:opText(r),from:r.from||'',fid:r.fid||null})),isNew:!!g.nw,trash:!!g.trash})});
 const t={files:0,trash:0,del:0};did.forEach(r=>{const g=c.groups.find(x=>x.k===r.k);if(g.trash)t.trash++;else if(g.del)t.del++;else if(!g.chg)t.files++});
 const nf=c.groups.filter(g=>g.nw&&!g.clashUse&&did.some(r=>r.k===g.k)).length;
 const one=did.length===1&&did[0].op;
 const nmOf=id=>(v.node(id)||v.file(id)||{}).name;
 const past=op=>{const d=Plan.describe(op,V()).text;return op.ty==='rename'?`Renamed ${c.title.replace(/^Rename /,'')} to ${op.name}`:op.ty==='merge'?`Merged ${d}`:op.ty==='hide'?d.replace(/^Hide /,'Hid '):op.ty==='show'?d.replace(/^Show (.*) again$/,'Showed $1'):op.ty==='newFolder'?`Made ${op.name}`:op.ty==='putInside'?d.replace(' goes inside ',' Inside ').replace(' go inside ',' Inside '):d};
 const head=c.kind==='trash'?[t.trash&&`Moved ${Pl(t.trash,'file')} to the Trash`,t.del&&`Removed ${Pl(t.del,'empty folder')}`].filter(Boolean).join(', ')
  :c.kind==='folders'&&did[0].op&&did[0].op.ty==='need'?`Accepted ${Pl(did.length,'question')}`:c.kind==='folders'&&one&&one.ty==='apply'?'Applied Waiting Changes':c.kind==='folders'&&one&&one.ty==='discard'?'Discarded Waiting Changes':c.kind==='folders'&&one&&one.ty==='forgetChat'?'Forgetting This Chat':c.kind==='folders'?(one?(one.ty==='private'?`Private: ${nmOf(one.target)}`:one.ty==='keep'?`Keep As Is: ${nmOf(one.target)}`:one.ty==='release'?`Readable: ${nmOf(one.target)}`:past(one)):`Made ${Pl(did.length,'change')}`)
  :`Sorted ${Pl(t.files,'file')}${nf?`, Made ${Pl(nf,'folder')}`:''}`;
 return {head:head+(c.left?`. Stopped: ${c.left} Not Done`:''),groups,disk:diskLine(c,did)}}
/* the win, in the bubble: says what really happened, and how it sounds depends on what it touched */
function winLine(c,did,th){const v=V();return withRoom(c,th,()=>{const out=winLine0(c,did,v);c.calm=ROOM.calm;return out})}
function winLine0(c,did,v){{
  const heavyN=did.filter(r=>HEAVY.test(r.name||'')).length;const gsAll=c.groups.filter(g=>did.some(r=>r.k===g.k));const heavyG=gsAll.filter(g=>HEAVY.test(g.to&&v.node(g.to)?v.path(g.to).join(' '):g.nw?g.nw.name:'')).length;
 if(c.kind==='trash'||(did.length&&heavyN*2>=did.length)||(gsAll.length&&heavyG*2>=gsAll.length))ROOM.calm=true;
 if(c.kind==='trash'){const t=tally0(c,did);return line('win.trash',{n:t.trash,d:t.del})}
 if(c.left)return line('win.stopped',{done:did.length,left:c.left});
 if(c.kind==='folders')return folderWin(c,did);
 const gs=c.groups.filter(g=>did.some(r=>r.k===g.k));const nw=gs.filter(g=>g.nw&&!g.clashUse).length;const lab=g=>{const id=g.to||(c.made&&c.made[g.k])||g.acc;return id&&v.node(id)?v.node(id).name:g.nw?g.nw.name:''};
 const to=gs.length===1?bold(lab(gs[0])):gs.length===2?`${bold(lab(gs[0]))} and ${bold(lab(gs[1]))}`:`${pl(gs.length,'folder')}`;
 /* the first win in a chat is always the signature line */const f0=!ROOM.calm&&once('firstwin')?0:undefined;
 let t=nw&&nw===gs.length&&did.length>1?line('win.new',{n:did.length,f:nw},f0):did.length===1?line('win.one',{name:esc(did[0].name),to},f0):line('win.many',{n:did.length,to},f0);
 const lo=c.rows.filter(r=>r.fid&&!r.gone&&!r.locked&&!(c.applied||[]).includes(r.id)).length;if(lo)t+=` I wasn’t sure about ${lo}, so I left ${lo===1?'it':'them'}.`;
 t+=autoNote(c);return t}}
const tally0=(c,did)=>{const t={trash:0,del:0};did.forEach(r=>{const g=c.groups.find(x=>x.k===r.k);if(g&&g.trash)t.trash++;else if(g&&g.del)t.del++});return t};
function autoNote(c){if(c.ran!=='auto')return '';if(level()==='Ask About Everything')return ' '+line('by.rule');return once('didnt')?' '+line('didnt.ask'):''}
function folderWin(c,did){const v=V();const nm=id=>esc((v.node(id)||v.file(id)||{}).name||'');
 if(did.length>1){const k=did[0].op.ty;if(k==='private'){ROOM.calm=true;return line('win.privateMany',{n:did.length,first:once('privacy')})}if(k==='need')return line('win.needs',{n:did.length});if(did.every(r=>r.op.ty==='newFolder'))return line('win.folders',{n:did.length});return line('win.changes',{n:did.length})}
 const o=did[0].op;switch(o.ty){
  case 'rename':return line('win.rename',{a:esc(c.renameFrom||c.title.replace(/^Rename /,'')),b:bold(o.name)});
  case 'merge':return line('win.merge',{a:esc(c.title.replace(/^Merge /,'')),b:bold(nm(o.into))});
  case 'newFolder':return line('win.newFolder',{a:bold(o.name)});
  case 'hide':return line('win.hide',{a:esc(c.title.replace(/^Hide /,''))});
  case 'show':return line('win.show',{a:esc(c.title.replace(/^Show /,''))});
  case 'putInside':return line('win.inside',{a:esc(c.title.replace(/^Move /,'')),b:bold(nm(o.parent))});
  case 'private':ROOM.calm=true;return line('win.private',{a:bold(nm(o.target)),first:once('privacy')});
  case 'keep':return line('win.keep',{a:bold(nm(o.target))})+autoNote({ran:null});
  case 'release':ROOM.calm=true;return line('win.release',{a:bold(nm(o.target))});
  case 'need':return line('win.needs',{n:1});
  case 'apply':return line('win.apply');
  case 'discard':ROOM.calm=true;return line('win.discard');
  case 'forgetChat':ROOM.calm=true;return line('win.forget')}
 return line('win.changes',{n:1})}
/* Undo: the card's History rows. Honest about what it skipped (files you sorted again since) */
/* a done card for a History row made elsewhere (the launcher, another page): every file and its folder, with Undo */
function cardFromRow(rowId,kind,title){const v=V();const r=(Plan.history?Plan.history():[]).find(x=>x.id===rowId);if(!r)return null;
 const fids=r.files||[].concat(...(r.ops||[]).filter(o=>o.ty==='moveFiles').map(o=>o.files||[]));if(!fids.length)return null;
 const c=mkCard(kind,title);fids.forEach(fid=>{const f=v.file(fid);if(!f||!v.node(f.node))return;groupFor(c,f.node);const row=rowFile(c,destK(f.node),fid);if(row)row.from=String(f.where||f.from||'Downloads').split(' › ')[0]});
 c.state='done';c.hist=[rowId];c.applied=c.rows.map(x=>x.id);c.autoChecked=true;c.res=result(c,c.rows);c.latest=true;return c}
function laterTouched(c){const h=(Plan.history?Plan.history():[]).slice().reverse();const i=Math.max(...c.hist.map(id=>h.findIndex(r=>r.id===id)));if(i<0)return [];
 const mine=new Set(c.rows.filter(r=>(c.applied||[]).includes(r.id)&&r.fid).map(r=>r.fid));const out=new Set();
 const walk=o=>{if(o.ty==='batch')(o.ops||[]).forEach(walk);(o.files||[]).forEach(f=>mine.has(f)&&out.add(f));(o.parts||[]).forEach(p=>(p.files||[]).forEach(f=>mine.has(f)&&out.add(f)))};
 h.slice(i+1).filter(r=>!r.undone).forEach(r=>{(r.ops||[]).forEach(walk);(r.files||[]).forEach(f=>mine.has(f)&&out.add(f))});return [...out]}
function histRows(c){const h=Plan.history?Plan.history():[];return (c.hist||[]).map(id=>h.find(r=>r.id===id)).filter(Boolean)}
function syncState(c){if(c.state!=='done'&&c.state!=='undone')return;const rs=histRows(c);if(!rs.length)return;
 const und=rs.every(r=>r.undone);if(und&&c.state==='done'){c.state='undone';c.undoMsg=c.undoMsg||'Undone in History.'}else if(!und&&c.state==='undone')c.state='done'}
function undo(c,th){if(c.state!=='done')return '';
 if(c.kind==='view'){if(c.tool){undoView(c,th);return c.undoMsg||''}histRows(c).slice().reverse().forEach(r=>{if(!r.undone)Plan.undoApply(r.id)});if(c.rule)Plan.removeRule(c.rule);if(c.unrule)Plan.addRule(c.unrule);if(c.fact&&window.Memory&&Memory.unremember)Memory.unremember(c.fact);if(c.retell&&window.Memory)Memory.remember(c.retell);if(c.regone&&window.Memory&&Memory.restore)Memory.restore(c.regone);rerender();c.state='undone';c.undoMsg='Undone';c.undoSay=withRoom(c,th,()=>line('undo'));th.mood&&th.mood('idle');th.paint();th.save();fire();return c.undoMsg}
 if(c.discarded){c.discarded.forEach(o=>Plan.restore(o));c.discarded=null}const skip=laterTouched(c);const total=(c.applied||[]).length;
 histRows(c).slice().reverse().forEach(r=>{if(!r.undone)Plan.undoApply(r.id)});if(c.ruled){c.ruled.forEach(t=>Plan.removeRule&&Plan.removeRule(t));c.ruled=null}
 if(c.tidyGone&&window.TuckQueue){TuckQueue.untrash(c.tidyGone);c.tidyGone=null}
 const v=V();const names=skip.map(id=>v.file(id)?v.file(id).name:'').filter(Boolean);
 c.undoSay=withRoom(c,th,()=>{if(c.kind==='trash')ROOM.calm=true;const o0=c.rows[0]&&c.rows[0].op;if(c.rows.length===1&&o0&&o0.ty==='release'){const x=V().node(o0.target)||V().file(o0.target);return `Undone. ${bold(x?x.name:'It')} is private again.`}return skip.length?line('undo.part',{left:skip.length}):line('undo')});th.mood&&th.mood('idle');
 c.undoMsg=c.kind==='trash'?`Put back ${skip.length?`${total-skip.length} of ${total}`:`all ${total}`} from the Trash.`:c.kind==='folders'?'Undone':
  skip.length?`Put back ${total-skip.length} of ${total}. ${skip.length} ${skip.length===1?'was':'were'} skipped because you sorted ${skip.length===1?'it':'them'} again since: ${names.slice(0,3).join(', ')}${names.length>3?` and ${names.length-3} more`:''}.`
  :`${total===1?'Put the file back.':`Put back all ${total} files.`}${c.made&&Object.keys(c.made).length?` The ${pl(Object.keys(c.made).length,'new folder')} went away.`:''}`;
 c.state='undone';th.paint();th.save();fire();return c.undoMsg}
function redo(c,th){if(c.state!=='undone')return;histRows(c).forEach(r=>{if(r.undone)Plan.undoApply(r.id)});c.state='done';c.undoMsg='';if(!c.win)c.win=withRoom(c,th,()=>line('redo'));th.mood&&th.mood('happy');th.paint();th.save();fire()}
const fire=()=>{try{document.dispatchEvent(new CustomEvent('tuckbot'))}catch(e){}};

/* ---------- answers about files (chips cite the files and folders) */
function qDownloads(text,scopeId){const v=V();let fs=allFiles(v).filter(f=>f.from==='Downloads'||/^Downloads/.test(f.where||''));
 let topic=scopeId?v.node(scopeId):null;if(!topic){const m=/download(?:ed|s)?\s+(?:for|from|in|about)\s+(.+?)(?:\s+(?:this|last|today|yesterday|in|on|from)\b.*)?\??$/i.exec(text);if(m){const id=findNode(m[1]);if(id)topic=v.node(id)}}
 if(topic)fs=fs.filter(f=>v.pathIds(f.node).includes(topic.id)||f.hint===topic.id||(f.hint&&v.node(f.hint)&&v.pathIds(f.hint).includes(topic.id)));
 const r=Plan.dateRange(text)||Plan.dateRange('this week');const hit=fs.filter(f=>f.at>=r.from&&f.at<r.to).sort((a,b)=>b.at-a.at);const when=r.label;
 if(!hit.length){const last=fs.sort((a,b)=>b.at-a.at)[0];return {t:`Nothing${topic?` for <b>${esc(topic.name)}</b>`:''} came from Downloads ${esc(when)}.${last?` The newest I can see is <b>${esc(last.name)}</b>, ${esc(Plan.fileDate(last.id))}.`:''}`,title:'From Downloads',files:last?[last.id]:[],folders:topic?[topic.id]:[],chips:['What came in today?','Sort new files']}}
 return {t:`${esc(cap(when))} you downloaded ${pl(hit.length,'file')}${topic?` for <b>${esc(topic.name)}</b>`:''}:`,title:'From Downloads',files:hit.slice(0,8).map(f=>f.id),folders:topic?[topic.id]:[],chips:[topic?`Arrange ${topic.name}`:'Sort new files','What came in today?']}}
function qWhere(q){const v=V();const words=strip(q.replace(/^(?:where(?:'s| is| are| did i put| did i save| do i keep)?|find|locate|show me|search(?: for)?)\s+/i,'').replace(/\?$/,''));if(!words)return null;
 const hits=Plan.find(words);if(!hits.length)return {t:line('found.none',{q:esc(words)}),chips:['What came in today?','What’s in No folder yet?']};
 const fsh=hits.filter(h=>h.type==='file').map(h=>h.id).filter(id=>live(v,v.file(id))),nds=hits.filter(h=>h.type==='node').map(h=>h.id);const top=hits[0];
  if(top.type==='file'&&live(v,v.file(top.id))){const f=v.file(top.id),p=v.path(f.node);const pv=isPriv(v,f.id);
  const at=bold(p.slice(-1)[0]);return {t:fsh.length>1?line('found.many',{n:fsh.length}):pv?(ROOM.calm=true,line('found.private',{at,first:once('privacy')})):line('found.one',{at}),one:fsh.length<=1?f.id:null,title:`Found ${Pl(fsh.length,'file')}`,files:fsh.slice(0,6),folders:[f.node,...nds.filter(x=>x!==f.node)].slice(0,2),chips:[`What’s in ${p.slice(-1)[0]}?`,`Why is ${f.name} in ${p.slice(-1)[0]}?`]}}
 const n=v.node(nds[0]);if(!n)return null;const p=v.path(n.id).slice(0,-1);const pv=isPriv(v,n.id);
 return {t:pv?(ROOM.calm=true,`Found ${bold(n.name)}.${once('privacy')?' It’s private, so it stays on this Mac.':''}`):line('found.folder',{a:bold(n.name),n:v.total(n.id)}),title:n.name,files:v.files(n.id,true).slice(0,4).map(f=>f.id),folders:nds.slice(0,3),chips:[`What’s in ${n.name}?`,`Arrange ${n.name}`]}}
function qIn(id){const v=V(),n=v.node(id);const kids=v.kids(id).filter(k=>v.node(k)&&!v.node(k).hidden);const own=v.files(id);const tot=v.total(id);
 if(!tot&&!kids.length)return {t:line('in.empty',{a:bold(n.name)}),title:n.name,folders:[id],chips:['Clean up empty folders',`Hide ${n.name}`]};
 const newest=v.files(id,true).slice(0,4);
 return {t:line('in.has',{a:bold(n.name),n:tot,k:kids.length}),title:n.name,files:newest.map(f=>f.id),folders:kids.slice(0,4),chips:[`Arrange ${n.name}`,`Re-sort ${n.name}`,`How big is ${n.name}?`]}}
function qToday(){const v=V();const fs=allFiles(v).filter(f=>Plan.dayOf(f.at)==='Today').sort((a,b)=>b.at-a.at);const nf=Plan.newFiles();
 return {t:fs.length?line('today.some',{n:fs.length,w:nf.length}):line('today.none'),title:'Came In Today',files:fs.slice(0,6).map(f=>f.id),chips:nf.length?['Sort new files','Clean up']:['Clean up','What did you change?']}}
function qSize(id){const v=V(),n=v.node(id);const mb=v.size(id)/1000;return {t:line('size',{a:bold(n.name),n:v.total(id),k:v.kids(id).length,size:mb>=1000?(mb/1000).toFixed(1)+' GB':Math.round(mb)+' MB'}),title:n.name,folders:[id],files:v.files(id,true).slice().sort((a,b)=>b.size-a.size).slice(0,3).map(f=>f.id),chips:[`What’s in ${n.name}?`,'Clean up']}}
function qPrivate(id){const v=V();const nodes=v.all().filter(x=>{const n=v.node(x);return n&&!n.hidden&&isPriv(v,x)&&!isPriv(v,n.parent||'')&&(!id||v.pathIds(x).includes(id))});
 const fs=allFiles(v).filter(f=>isPriv(v,f.id)&&(!id||v.pathIds(f.node).includes(id)));
 ROOM.said.privacy=1;return {t:line('private.list',{n:fs.length,in:id?bold(v.node(id).name):'',f:nodes.length}),title:nodes.length?'Private Folders':'Private Files',folders:nodes.slice(0,6),files:nodes.length?[]:fs.slice(0,4).map(f=>f.id),chips:['Make Bills private','Where is my lease?']}}
function qWhy(text){const v=V();const m=/^why (?:is|are|did you put)\s+(.+?)(?:\s+(?:in|here|there)\b.*)?\??$/i.exec(text);if(!m)return null;const t=target(m[1]);if(!t)return null;
 if(t.ty==='node'){const n=v.node(t.id);return {t:`${n.why?esc(me(n.why))+'.':`You made ${esc(n.name)}.`}${n.sug?' It’s my suggestion, not a folder yet.':''}`,folders:[t.id],chips:[`What’s in ${n.name}?`]}}
 const fid=t.ty==='file'?t.id:t.ids[0];const f=v.file(fid);return {t:line('why.file'),one:fid,files:[fid],chips:[`What’s in ${v.node(f.node).name}?`,'Re-sort '+v.node(f.node).name]}}
function qHistory(){const h=(Plan.history?Plan.history():[]).filter(r=>!r.undone).slice(0,4);
 if(!h.length)return {t:line('history.none'),chips:['Sort new files','Clean up']};
 return {t:`${line('history')}<ul class="tkb-ul">${h.map(r=>`<li>${esc(r.text)} <small>${esc(Plan.when(Math.round((Date.now()-r.at)/6e4)))}</small></li>`).join('')}</ul>`,chips:['Undo','What came in today?']}}
function qNeeds(){const n=(Plan.needs?Plan.needs():[]).filter(x=>!x.done);if(!n.length)return {t:line('needs.none'),chips:['Sort new files','Clean up']};
 const here=window.TuckLauncher?`<a href="#" onclick="TuckChat.close();TuckLauncher.open('needs');return false">Answer it here</a>`:`<a href="tuck.html#needs">Answer it in Needs You</a>`;
 return {t:`${line('needs.first',{n:n.length,q:bold(n[0].q)})} ${here}`,folders:n[0].node&&V().node(n[0].node)?[n[0].node]:[],files:n[0].file?[n[0].file]:[],chips:['Sort new files']}}
function qBig(id){const v=V();const fs=(id?v.files(id,true):allFiles(v)).slice().sort((a,b)=>b.size-a.size).slice(0,5);
 return {t:line('big',{in:id?bold(v.node(id).name):''}),title:'Biggest Files',files:fs.map(f=>f.id),chips:['Clean up old installers','Clean up duplicates']}}

/* ---------- reading what was typed (scripted; the real app's model makes the same calls) */
const SLASH=[['/sort','Sort new files'],['/clean','Clean up'],['/arrange','Arrange a folder'],['/split','Split a folder'],['/resort','Re-sort a folder'],['/find','Find a file'],['/undo','Undo the last change']];
function cleanT(q){return String(q||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim()}
function parse(raw){const {text,scope}=mentions(withThis(cleanT(raw)));const sc=scope[0]||null;let t=text,m;
 const sl=/^\/(\w+)\s*(.*)$/.exec(t);if(sl){const a=sl[2];t=({sort:'sort new files',clean:'clean up '+a,arrange:'arrange '+a,split:'split '+a,resort:'re-sort '+a,find:'find '+a,undo:'undo',help:'help'}[sl[1].toLowerCase()]||t).trim()}
 const low=lc(t).replace(/[.!]+$/,'').trim();const scT=sc?(sc.ty==='node'?'«'+sc.id+'»':'«f:'+sc.id+'»'):'';const orScope=s=>s&&s.trim()?s:scT;
 if(/^(undo|undo (that|it|this|the last( one| change)?)|take (that|it) back|put (it|them) back|revert( that)?)$/.test(low))return {i:'undo'};
 if(/^(help|commands|what can you do)$/.test(low)||low==='/')return {i:'help'};
 if(/^(sort|file)( my| the)?( new| incoming)?( files| downloads| desktop| stuff)?$|^sort (new|my new|the new)\b|^sort( my)? (downloads|desktop)$/.test(low)&&!/\bby\b/.test(low))return {i:'sort'};
 if(m=/^(?:please )?(?:merge|combine)\s+(.+?)\s+(?:into|with|and)\s+(.+)$/i.exec(t))return {i:'merge',a:m[1],b:m[2]};
 if(m=/^(?:rename|call)\s+(.+?)\s+(?:to|as|into)\s+(.+)$/i.exec(t))return {i:'rename',a:m[1],b:m[2]};
 if(m=/^(?:make|create|add|new)\s+(?:a\s+)?(?:new\s+)?folder(?:\s+(?:called|named))?(?:\s+"?([^"]+?)"?)?(?:\s+(?:in|inside|under)\s+(.+))?$/i.exec(t))return {i:'newFolder',name:m[1]||'',parent:orScope(m[2]||'')};
 if(m=/^(?:make|mark|set)\s+(.+?)\s+(?:not private|readable|public)$|^(?:let (?:the )?(?:ai|tuck) read|unprivate|release|stop keeping)\s+(.+?)(?:\s+private)?$/i.exec(t))return {i:'release',a:m[1]||m[2]};
 if(m=/^(?:make|mark|keep|set)\s+(.+?)\s+private$/i.exec(t))return {i:'private',a:m[1]};
 if(m=/^(?:make|mark|set)\s+private\s+(.+)$/i.exec(t))return {i:'private',a:m[1]};
 if(/^(?:make|mark|keep|set) (?:it|this) private$|^make private$/i.test(t)&&sc)return {i:'private',a:scT};
 if(m=/^(?:keep|leave)\s+(.+?)\s+(?:as is|as it is|alone|the way it is)$|^don'?t (?:touch|change|move)\s+(.+)$/i.exec(t))return {i:'keep',a:m[1]||m[2]};
 if(m=/^(?:un)?hide\s+(.+)$/i.exec(t))return {i:/^unhide/i.test(t)?'show':'hide',a:m[1]};
 if(m=/^show\s+(.+?)\s+again$/i.exec(t))return {i:'show',a:m[1]};
 /* clean up and other words that could throw things away: one question first, unless the kind is named */
 if(/\b(clean( ?up)?|clear out|declutter|free (up )?(some )?space|get rid of|throw (away|out)|trash|tidy up|delete|remove)\b/.test(low)&&!/\bfrom\b.*\binto\b/.test(low)){
  const kinds=[];if(/dup|copies|copy/.test(low))kinds.push('dup');if(/install|dmg/.test(low))kinds.push('ins');if(/empty/.test(low))kinds.push('empty');if(/screenshot/.test(low))kinds.push('shots');if(/\bzips?\b/.test(low))kinds.push('zip');
  if(/\b(all of (these|them|it)|everything|all four|all)\b/.test(low)&&!kinds.length)kinds.push('dup','ins','empty','shots');
  let days=30;const dm=/(\d+)\s*(day|week|month|year)s?/.exec(low);if(dm)days=+dm[1]*({day:1,week:7,month:30,year:365}[dm[2]]);else if(/a week/.test(low))days=7;
  if(!kinds.length&&(m=/^(?:delete|remove|trash)\s+(.+)$/i.exec(t))){const x=tok(m[1]);const id=x&&x.ty==='node'?x.id:findNode(m[1]);if(id)return {i:'delete',a:id};const fs=findFiles(m[1]);if(fs.length)return {i:'trashFiles',ids:fs}}
  return kinds.length?{i:'clean',kinds,days}:{i:'cleanAsk'}}
 if(m=/^(?:move|put|file|send|drop|sort)\s+(.+?)\s+(?:to|into|in|inside|under)\s+(.+)$/i.exec(t))return {i:'move',a:m[1],b:m[2]};
 if(m=/^split\s+(?:up\s+)?(.+?)(?:\s+(?:by|into)\s+.+)?$/i.exec(t))return {i:'split',a:orScope(m[1])};
 if(/^split( it| this)?$/i.test(t)&&sc)return {i:'split',a:scT};
 if(m=/^re-?sort\s+(.+?)(?:\s+(place only|with subfolders|redesign))?$/i.exec(t))return {i:'resort',a:m[1],reach:m[2]?({'place only':'place_only','with subfolders':'suggest_subfolders',redesign:'redesign'})[lc(m[2])]:null};
 if(/^re-?sort( it| this)?$/i.test(t))return {i:'resort',a:scT};
 if(m=/^(?:arrange|organi[sz]e|group|sort|tidy|help me organi[sz]e)\s+(.*?)\s*(?:by\s+(.+))?$/i.exec(t)){const what=orScope(m[1].replace(/^(?:my|the)\s+/i,''));const wy=lc(m[2]||'');
  const way=/year|date/.test(wy)?'year':/month/.test(wy)?'month':/kind|type/.test(wy)?'kind':/what|project|topic|subject/.test(wy)?'thing':'pick';return {i:'arrange',a:what,way}}
 /* questions */
 if(/\bdownload/.test(low))return {i:'qDownloads',text:t,scope:sc&&sc.ty==='node'?sc.id:null};
 if(/^(what came in|what'?s new|what is new|new files|anything new)\b|\btoday\b.*\b(came|arrived|new)\b/.test(low))return {i:'qToday'};
 if(/^why (?:is|are|did you put)\s+.+/i.test(t))return {i:'qWhy',text:t};
 if(/^(what did you (do|change|sort)|what changed|what have you (done|changed)|history|recent changes)\b/.test(low))return {i:'qHistory'};
 if(/^what needs (me|you)|needs me\b/.test(low))return {i:'qNeeds'};
 if(m=/^(?:what'?s|what is|what are|which files are)\s+private(?:\s+in\s+(.+?))?\??$/i.exec(t))return {i:'qPrivate',a:m[1]?findNode(m[1]):sc&&sc.ty==='node'?sc.id:null};
 if(m=/^(?:what are )?(?:the )?(?:biggest|largest)\s+files(?:\s+in\s+(.+?))?\??$/i.exec(t))return {i:'qBig',a:m[1]?findNode(m[1]):null};
 if(m=/^(?:how (?:big|large) is|how many (?:files )?(?:are )?(?:in|does)|size of)\s+(.+?)(?:\s+have)?\??$/i.exec(t)){const id=tok(m[1])?tok(m[1]).id:findNode(m[1]);if(id&&V().node(id))return {i:'qSize',a:id}}
 if(m=/^(?:what'?s|what is|whats|show me|open)\s+(?:in\s+)?(.+?)\??$/i.exec(t)){const s=m[1].replace(/^in\s+/i,'');const x=tok(s);const id=x&&x.ty==='node'?x.id:findNode(s);if(id&&/^(?:what'?s|what is|whats)\s+in\b|^show me\b|^open\b/i.test(t))return {i:'qIn',a:id}}
 if(/^(where|find|locate|search)\b/.test(low))return {i:'qWhere',text:t};
 if(sc&&sc.ty==='node'&&/^(what'?s in (it|here|this)|show( me)?( it)?)$/.test(low))return {i:'qIn',a:sc.id};
 return null}

/* ---------- the reply: data only, so the thread can be kept and drawn anywhere */
/* rule 9: a file appears only inside a row that says what happened to it. Answers with files become a C8 list (or a C7 for one file) */
function cardify(b){if(b.card||(!(b.files||[]).length&&!(b.folders||[]).length)){delete b.files;delete b.folders;return}const v=V();
 if(b.one&&v.file(b.one)){const r=fileCardReply(b.one);b.card=r.card;delete b.files;delete b.folders;return}
 const rows=[...(b.folders||[]).filter(id=>v.node(id)).map(id=>folderRow(v,id)),...(b.files||[]).map(id=>v.file(id)).filter(Boolean).map(f=>fileRow(v,f))];
 const first=(b.folders||[])[0];const title=String(b.title||'').trim()||(first&&v.node(first)?v.node(first).name:'Files');
 b.card=mkCard('list',title,{state:'done',rows,open:first&&v.node(first)?{label:'Edit Folders',hash:'edit',sel:{type:'node',id:first}}:(b.files||[])[0]?{label:'Edit Folders',hash:'edit',sel:{type:'file',id:b.files[0]}}:null,autoChecked:true});delete b.files;delete b.folders}
function lastCard(th){const ms=th&&th.msgs?th.msgs():[];for(let i=ms.length-1;i>=0;i--){const c=ms[i].bot&&ms[i].bot.card;if(c&&(c.hist||[]).length&&c.kind!=='list'&&c.kind!=='today'){syncState(c);if(c.state==='done')return c}}return null}
const say=(t,o={})=>Object.assign({t},o);
const decorate=(c,lead,chips)=>({t:lead,card:c,chips:chips||[]});
function folderReply(c,lead){const why=c.rows.filter(r=>r.locked).map(r=>r.why);if(why.length===c.rows.length){const v=V();const b0=listCard(c.title,c.rows.map(r=>{const id=r.op.target||r.op.node||(r.op.nodes||[])[0];const x=v.node(id)||v.file(id);return {ic:'prohibit',name:x?x.name:c.title,sub:r.why}}),null,why[0]);if(!/already/.test(why[0]))b0.mood='oops';return b0}return decorate(c,lead)}
/* chips under an answer the page wrote itself (no dead ends) */
function chipsFor(q){const v=V();const n=findNode(String(q||'').replace(/^.*?\b(?:in|about|of|for)\s+/i,''));const base=Plan.newFiles&&Plan.newFiles().length?'Sort new files':'What came in today?';
 return n&&v.node(n)&&!v.node(n).special?[`What’s in ${v.node(n).name}?`,`Arrange ${v.node(n).name}`,base]:[base,'Clean up','What changed?']}
/* what this answer sent to AI (the real app's what_was_sent): your words and file names only; private files and contents never */
function sentOf(raw,b){const v=V();const ids=new Set([...(b.files||[]),...(b.card?b.card.rows.map(r=>r.fid).filter(Boolean):[])]);const fs=[...ids].map(id=>v.file(id)).filter(Boolean);
 const priv=fs.filter(f=>isPriv(v,f.id)).length;return {q:String(raw||'').slice(0,80),names:fs.length-priv+(b.folders||[]).length,priv}}
function reply(raw,o={}){openRoom(raw,o.thread);const b=reply0(raw,o);if(!b)return null;cardify(b);b.ctype=ctypeOf(b);if(!b.ask&&!b.card&&!b.quiet&&!(b.chips&&b.chips.length))b.chips=chipsFor(raw);const said0=lc(cleanT(raw));b.chips=(b.chips||[]).filter((x,i,a)=>x&&a.indexOf(x)===i&&lc(cleanT(x))!==said0);
 /* a name clash: say so, instead of a cheerful lead over a card that waits */
 {const cc=b.card;if(cc&&cc.state==='ready'&&(cc.rows.some(x=>x.clash)||cc.groups.some(g=>g.clash)))b.t='A folder with that name is already there, so I’m checking with you first. Pick on the card.'}b.sent=sentOf(raw,b);b.vk=ROOM.vk;b.said=ROOM.said;b.calmRoom=ROOM.calm;return b}
/* what the mascot does for a reply: a question or a card waiting for you: listening; a change that happened: happy; a refusal: oops */
function moodOf(b){const m0=moodOf0(b);return m0==='happy'&&(b.calmRoom||(b.card&&b.card.calm))?'idle':m0}
function moodOf0(b){if(!b)return 'idle';if(b.mood)return b.mood;const c=b.card;if(b.ask&&!b.answered)return 'listen';if(!c)return 'idle';
 if(c.state==='running')return 'think';if(c.state==='error')return 'oops';if(c.kind==='trash'&&c.state==='done')return 'idle';if(c.state==='ready'&&!c.dismissed)return 'listen';
 if(c.state==='done'&&((c.kind==='view'&&c.res)||(c.kind==='setting'&&c.changed)||((c.hist||[]).length&&c.kind!=='list'&&c.kind!=='today')))return 'happy';return 'idle'}
/* a refusal or something that failed: said plainly, and the mascot says oops */
const no=(t,o)=>Object.assign({t,mood:'oops'},o||{});
function reply0(raw,o={}){if(!window.Plan||!Plan.view)return null;{const tm=matchTool(raw);if(tm){const b=runTool(tm.t,tm.a,o);b.tool=tm.t.id;return b}}const p=parse(raw);if(!p)return null;const v=V();const th=o.thread;let c;
 const need=(q,fn)=>{const x=target(q);if(!x)return no(noFolder(q),{chips:['What’s in Studying?','Help']});return fn(x)};
 const nodeOnly=(q,fn)=>need(q,x=>x.ty==='node'?fn(x.id):no(`“${esc(nameOf(v,x))}” is a file. This works on folders.`));
 switch(p.i){
  case 'help':return say(helpLine()+' Type @ to point at a folder or file.',{chips:chipsFor('')});
  case 'undo':{const c0=lastCard(th);if(c0){const msg=undo(c0,th);return listCard('Undone',[{ic:'arrow-counter-clockwise',name:c0.title,sub:msg}],{label:'History',hash:'history',hist:(c0.hist||[])[0]},line('undo'),{})}
   const h=(Plan.history?Plan.history():[]).find(x=>!x.undone);if(!h)return listCard('Undo',[{ic:'clock-counter-clockwise',name:'Nothing to Undo Yet'}],{label:'History',hash:'history'},line('undo.none'));Plan.undoApply(h.id);fire();return listCard('Undone',[{ic:'arrow-counter-clockwise',name:h.text,sub:'Undone from History'}],{label:'History',hash:'history',hist:h.id},line('undo'))}
  case 'sort':{c=cardSort();if(!c){const s=Plan.sortedNew&&Plan.sortedNew();const loose=v.files('loose').length;
    /* a sort you did is still in place: show it as a full result card (every file → folder, Undo), never a bare sentence */
    if(s&&!s.undone&&s.n){const d=cardFromRow(s.row,'sort','Sort New Files');if(d)return decorate(d,line('sort.last',{n:pl(s.n,'file'),when:esc(s.when.toLowerCase())}),['What came in today?','Clean up'])}
    return say(`${line('sort.none',{since:s&&!s.undone?`${pl(s.n,'file')} ${esc(s.when.toLowerCase())}`:''})}${loose?` ${pl(loose,'file')} still ${loose===1?'has':'have'} no folder, because I’m not sure where ${loose===1?'it goes':'they go'}.`:''}`,{folders:loose?['loose']:[],chips:[loose?'Re-sort No folder yet':'What came in today?','Clean up','What changed?']})}
   const n=c.rows.length,u=c.rows.filter(r=>r.unsure).length;const fromT=esc([...new Set(c.rows.map(r=>r.from))].join(' and '));return decorate(c,u===n?`${pl(n,'new file')} from ${fromT}, and I’m not sure where ${n===1?'it goes':'they go'}. Tick ${n===1?'it':'them'} if my guess looks right.`:`${line('lead.sort',{n,from:fromT})}${u?` I’m not sure about ${u}, so ${u===1?'it starts':'they start'} unticked.`:''}`,['What came in today?','Clean up'])}
  case 'cleanAsk':{const counts=['dup','ins','empty','shots'].map(k=>[k,cleanItems(k,30).length]);
   return say(line('trash.ask'),{ask:counts.map(([k,n])=>({label:CLEAN[k]+(n?` · ${n}`:''),say:`Clean up ${lc(CLEAN[k])}`})).concat([{label:'All of These',say:'Clean up all of these'}])})}
  case 'clean':{c=cardClean(p.kinds,p.days);const checked=p.kinds.map(k=>k==='shots'?`screenshots older than ${p.days} days`:lc(CLEAN[k]));
   if(!c){const others=Object.keys(CLEAN).filter(k=>!p.kinds.includes(k)&&k!=='zip'&&cleanItems(k,30).length).map(k=>`Clean up ${lc(CLEAN[k])}`);const nF=v.all().filter(id=>Plan.isFolder(id)).length;
    const shots=allFiles(v).filter(f=>/^Screenshot/i.test(f.name)),old=shots.reduce((a,f)=>Math.max(a,f.age),0),wk=Math.floor((old-1)/7)*7;
    if(p.kinds.includes('shots')&&wk>=7)others.unshift(`Clean up screenshots older than ${wk} days`);
    const b0=listCard('Checked',p.kinds.map(k=>({ic:'check',name:k==='shots'?`Screenshots Older Than ${p.days} Days`:CLEAN[k],sub:k==='empty'?`None · ${nF} folders checked`:k==='shots'?`None · ${shots.length} screenshots, oldest ${old} days`:'None'})),{label:'Tidy Up',hash:'tidy'},line('trash.none'));b0.chips=others.length?others.slice(0,3):['Sort new files','Biggest files'];return b0}
   const mb=c.rows.reduce((a,r)=>a+(r.mb||(r.fid&&v.file(r.fid)?v.file(r.fid).size/1000:0)),0);
   return decorate(c,line('trash.lead',{size:mb?(mb>=1000?(mb/1000).toFixed(1)+' GB':Math.round(mb)+' MB'):'',first:once('forgood')}),p.kinds.includes('empty')?['Biggest files']:['Clean up empty folders','Biggest files'])}
  case 'trashFiles':{const ids=p.ids.filter(id=>!plannable(v,id));if(!ids.length)return no(esc(plannable(v,p.ids[0])||'I can’t move that to the Trash.'));
   c=mkCard('trash','Move to Trash',{req:{intent:'trashFiles'}});grp(c,{k:'t:x',trash:true,label:'To the Trash'});ids.forEach(id=>{const f=v.file(id);c.rows.push({id:nid('r'),k:'t:x',fid:id,name:f.name,from:v.path(f.node).slice(-1)[0],on:true})});
   return decorate(c,line('trash.files'))}
  case 'delete':{const n=v.node(p.a);if(v.total(p.a)||v.kids(p.a).length){const b0=listCard(n.name,[folderRow(v,p.a,`Not empty · ${pl(v.total(p.a),'file')}`)],{label:'Edit Folders',hash:'edit',sel:{type:'node',id:p.a}},line('trash.notempty',{a:bold(n.name)}));b0.mood='oops';b0.chips=[`Hide ${n.name}`,`What’s in ${n.name}?`];return b0}
   c=mkCard('trash','Remove a Folder');grp(c,{k:'t:empty',del:true,label:'Remove Empty Folders'});c.rows.push({id:nid('r'),k:'t:empty',nid:p.a,name:n.name,from:pathOf(v,n.parent).join(' › ')||'Top level',on:true});return decorate(c,line('trash.folder'))}
  case 'merge':return need(p.a,a=>a.ty!=='node'?no(`Merge works on folders. “${esc(nameOf(v,a))}” is a file; try “sort ${esc(nameOf(v,a))} into ${esc(strip(p.b))}”.`):need(p.b,b=>b.ty!=='node'?no(noFolder(p.b)):
   folderReply(cardFolders([{ty:'merge',nodes:[a.id],into:b.id}],`Merge ${v.node(a.id).name}`),line('lead.merge',{a:esc(v.node(a.id).name),b:bold(v.node(b.id).name),n:v.total(a.id)}))));
  case 'rename':return need(p.a,a=>{if(a.ty!=='node')return no(a.ty==='files'&&a.ids.length>1?'I can’t rename many files at once yet. Folders I can: “rename ECON 2257 to Economics”.':'I leave file names as they are on disk. Folders I can rename: “rename ECON 2257 to Economics”.',{chips:['Rename ECON 2257 to Economics']});
   const name=strip(p.b);if(!name)return say('What should it be called?');return folderReply(cardFolders([{ty:'rename',node:a.id,name}],`Rename ${v.node(a.id).name}`),line('lead.rename'))});
  case 'newFolder':{let par=null;if(p.parent){const x=target(p.parent);if(!x||x.ty!=='node')return no(noFolder(p.parent));par=x.id}
   const name=strip(p.name)||'New Folder';return folderReply(cardFolders([{ty:'newFolder',parent:par,name}],'New Folder'),line('lead.newFolder',{at:par?`inside ${bold(v.node(par).name)}`:'at the top level'}))}
  case 'hide':return nodeOnly(p.a,id=>folderReply(cardFolders([{ty:'hide',nodes:[id]}],`Hide ${v.node(id).name}`),line('lead.hide')));
  case 'show':{const id=findNode(p.a,{hidden:true});if(!id||!v.node(id).hidden)return no(id?`${esc(v.node(id).name)} isn’t hidden.`:noFolder(p.a));return folderReply(cardFolders([{ty:'show',nodes:[id]}],`Show ${v.node(id).name}`),line('lead.show'))}
  case 'private':return need(p.a,x=>{const ids=x.ty==='files'?x.ids.slice(0,8):[x.id];ROOM.calm=true;const r0=folderReply(cardFolders(ids.map(id=>({ty:'private',target:id})),'Make Private'),line('lead.private'));return r0});
  case 'release':return need(p.a,x=>{const ids=(x.ty==='files'?x.ids.slice(0,8):[x.id]).filter(id=>isPriv(v,id));if(!ids.length)return say(`${esc(nameOf(v,x))} isn’t private, so my AI may already read it.`,{chips:['What’s private?']});
   ROOM.calm=true;return folderReply(cardFolders(ids.map(id=>({ty:'release',target:id})),'Let Tuck Read It'),line('lead.release'))});
  case 'keep':return need(p.a,x=>{const ids=x.ty==='files'?x.ids.slice(0,8):[x.id];return folderReply(cardFolders(ids.map(id=>({ty:'keep',target:id})),'Keep As Is'),line('lead.keep'))});
  case 'move':return need(p.a,a=>{const r0=cardMove(a,p.b);if(r0.say)return no(r0.say,{chips:['What’s in Studying?']});if(r0.kind==='folders')return folderReply(r0,line('lead.moveFolder'));if(r0.rows.every(r=>r.locked))return no(esc(r0.rows[0].why),{chips:[]});
   return decorate(r0,(r0.newName?`There’s no folder called “${esc(r0.newName)}” yet, so I’d make one. `:'')+(r0.rows.some(r=>r.locked)?line('lead.locked'):line('lead.move')))});
  case 'arrange':return nodeOnly(p.a||'',id=>{
   /* a real fork: more than one way fits → one question, each option with its consequence, plus Other */
   if(p.way==='pick'&&Plan.can('arrange',id).ok&&!projectOf(v,id)){const ways=['thing','year','kind','month'].map(w=>[w,partsBy(id,w)]).filter(x=>x[1].length>=2);
    if(ways.length>1)return say(line('ask.arrange',{a:bold(v.node(id).name)}),{ask:[...ways.map(([w,ps])=>({label:`By ${tc(WAYW[w])} · ${pl(ps.length,'new folder')}`,say:`arrange ${v.node(id).name} by ${w==='thing'?'what they’re for':w}`})),{label:'Other…',fill:`arrange ${v.node(id).name} by `}]})}
   const r0=cardArrange(id,p.way,false);if(r0.say)return no(r0.say,{chips:r0.chips||[]});return decorate(r0,(p.way==='pick'?line('lead.arrange',{a:bold(v.node(id).name)}):line('lead.arrangeBy',{a:bold(v.node(id).name),way:WAYW[p.way]}))+(once('newname')?' Click a new folder’s name to change it.':''),WAYS_CH(v.node(id).name,p.way).slice(0,2))});
  case 'split':return nodeOnly(p.a||'',id=>{const r0=cardArrange(id,'thing',true);if(r0.say)return no(r0.say,{chips:r0.chips||[]});return decorate(r0,line('lead.split',{a:bold(v.node(id).name)}),[`Arrange ${v.node(id).name}`])});
  case 'resort':return nodeOnly(p.a||'',id=>{if(!p.reach&&Plan.can('resort',id).ok&&!projectOf(v,id))return say(line('ask.resort',{a:bold(v.node(id).name)}),{ask:[{label:'Place Files Only · Keep My Folders',say:`re-sort ${v.node(id).name} place only`},{label:'Suggest Subfolders · May Add Folders',say:`re-sort ${v.node(id).name} with subfolders`},{label:'Redesign · May Merge Small Folders',say:`re-sort ${v.node(id).name} redesign`},{label:'Other…',fill:`re-sort ${v.node(id).name} `}]});
   const r0=cardResort(id,p.reach);if(r0.say)return /already looks right/.test(r0.say)?say(r0.say,{chips:r0.chips||[]}):no(r0.say,{chips:r0.chips||[]});return decorate(r0,line('lead.resort',{a:bold(v.node(id).name)}),[`Arrange ${v.node(id).name} by year`])});
  case 'qDownloads':return qDownloads(p.text,p.scope);
  case 'qToday':return qToday();
  case 'qWhy':return qWhy(p.text);
  case 'qHistory':return qHistory();
  case 'qNeeds':return qNeeds();
  case 'qPrivate':return qPrivate(p.a);
  case 'qBig':return qBig(p.a);
  case 'qSize':return qSize(p.a);
  case 'qIn':return qIn(p.a);
  case 'qWhere':return qWhere(p.text);}
 return null}

/* the policy: does this card run on its own? The always-ask list never does: Trash, name clashes, unsure rows, making something readable */
/* the policy (owner, 2 Nov): safe, undoable changes are done at once and show only the result card with Undo (tier A).
   A card first only for tiers B/C/Q: Trash, making a private file readable, accepting decisions, applying or discarding waiting
   changes, forgetting chats, a name clash (a real fork), more than 20 files, and every file or folder change when you chose
   Ask each time or Plan Only. Unsure rows are left for you on the result card. */
function auto(c){if(!c||c.state!=='ready')return false;
 /* Private and Keep As Is act at once with Undo at every level */
 if(c.kind==='folders'&&c.rows.length&&c.rows.every(r=>r.op&&(r.op.ty==='private'||r.op.ty==='keep')&&!r.locked))return true;
 const lv=level();if(lv==='Plan Only')return false;
 if(c.kind==='trash')return false;
 if(c.rows.some(r=>r.op&&['release','need','apply','discard','forgetChat','pend'].includes(r.op.ty)))return false;
 if(c.groups.some(g=>g.clash)||c.rows.some(r=>r.clash))return false;
 const n=onRows(c).length;if(!n)return false;
 /* Ask each time: a card first, unless a rule you saved for that place says yes */
 if(lv==='Ask About Everything')return n<=20&&!c.rows.some(r=>r.unsure)&&hasRule(c);
 if(n>20)return false;
 return true}
const DISK_OPS=['rename','merge','newFolder','hide','show','putInside'];
const wantsDisk=c=>c&&(['sort','move','arrange','today'].includes(c.kind)||(c.kind==='folders'&&c.rows.some(r=>r.op&&DISK_OPS.includes(r.op.ty))));
function started(bot,th){const c=bot&&bot.card;
 /* "my folders are a view": once per chat, on the first card it matters on */
 if(wantsDisk(c)&&th&&th.msgs&&!th.msgs().some(m=>{const x=m.bot&&m.bot.card;return x&&x.disk}))c.disk=true;
 if(!c||c.state!=='ready'||c.autoChecked)return;c.autoChecked=true;if(!auto(c)){const n=onRows(c).length;if(n>20&&c.kind!=='trash'&&['Ask When Unsure','Just Do It'].includes(level())){ROOM={calm:false,seed:0,th,vk:[],said:{}};if(once('bigask')){bot.t=`${bot.t?bot.t+' ':''}That’s ${n} files, so I’m checking with you first.`;bot.said=Object.assign(bot.said||{},ROOM.said)}}return}c.ran='auto';
 bot.t='';bot.chips=[];run(c,th)}

/* ---------- drawing */
const ICK=n=>Plan.kind(n).ic;
const fIc=(v,id)=>`<i class="ph-fill ph-${id&&v.node(id)&&isPriv(v,id)?'folder-simple-lock':'folder-simple'} tkb-fi" aria-hidden="true"></i>`;
const popDest=(attr,id,v,label,fold)=>`<button type="button" class="popchip tkb-dest" ${attr}="${esc(id)}" aria-haspopup="menu" aria-expanded="false" title="Change where it goes">${fold?fIc(v,fold):''}<span>${esc(label)}</span><i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`;
function gHead(c,g,v){if(g.chg)return '';const rs=rowsIn(c,g.k);const on=rs.filter(r=>r.on&&!blocked(c,r)).length;const all=rs.filter(r=>!blocked(c,r)).length;
 const ck=c.state==='ready'?`<input type="checkbox" data-tkb-g="${esc(g.k)}"${on&&on===all?' checked':''}${on&&on<all?' data-mixed="1"':''}${all===0?' disabled':''} aria-label="Tick every file in this group">`:'';
 let path;if(g.trash)path=`<i class="ph ph-trash tkb-fi" aria-hidden="true"></i><span class="last">${esc(g.label||'Trash')}</span>`;
 else if(g.del)path=`<i class="ph ph-folder-minus tkb-fi" aria-hidden="true"></i><span class="last">${esc(g.label)}</span>`;
 else{const ids=g.to?v.pathIds(g.to):g.nw&&g.nw.parent?v.pathIds(g.nw.parent):[];const names=ids.map(id=>v.node(id).name);const last=g.to?names.pop():g.nw.name;
  const lastH=g.nw&&c.state==='ready'?(g.edit?`<input class="tkb-nm" data-tkb-nm="${esc(g.k)}" value="${esc(last)}" aria-label="Folder name">`:`<button type="button" class="tkb-ren" data-tkb-ren="${esc(g.k)}" title="Rename this new folder">${esc(last)}<i class="ph ph-pencil-simple" aria-hidden="true"></i></button>`):`<span class="last">${esc(last)}</span>`;
  path=`<i class="ph ph-arrow-right tkb-to" aria-hidden="true"></i>${fIc(v,g.to||g.nw&&g.nw.parent)}<span class="pth">${names.map(esc).join(' › ')}${names.length?' › ':''}</span>${lastH}${g.nw?'<em class="tkb-new">New</em>':''}`}
 const clash=g.clash&&c.state==='ready'?`<div class="tkb-clash"><i class="ph ph-warning-circle" aria-hidden="true"></i><span>A folder called <b>${esc(v.node(g.clash)?v.node(g.clash).name:g.nw.name)}</b> is already there.</span>${g.clashOk?`<small>${g.clashUse?'Using that folder.':'Keeping both.'}</small>`:`<button class="btn sm" type="button" data-tkb-clash="use" data-k="${esc(g.k)}">Use That One</button><button class="btn sm ghost" type="button" data-tkb-clash="both" data-k="${esc(g.k)}">Keep Both</button>`}</div>`:'';
 return `<div class="tkb-gh">${ck}<span class="tkb-gp">${path}</span><small>${rs.length}</small></div>${clash}`}
function rowHtml(c,r,v){const g=c.groups.find(x=>x.k===r.k);const ready=c.state==='ready';const bl=blocked(c,r);
 const ck=ready?`<input type="checkbox" data-tkb-r="${esc(r.id)}"${r.on&&!bl?' checked':''}${bl?' disabled':''} aria-label="${esc(r.name||'this change')}">`:'';
 if(r.op){const d=Plan.describe(r.op,v);const op=r.op;let main=esc(d.text);const nm=id=>esc(v.node(id)?v.node(id).name:'');const tgt=()=>{const x=v.node(op.target)||v.file(op.target);return esc(x?x.name:'')};
  if(ready&&op.ty==='rename')main=`${nm(op.node)} <i class="ph ph-arrow-right" aria-hidden="true"></i> <input class="tkb-nm in" data-tkb-opname="${esc(r.id)}" value="${esc(op.name)}" aria-label="New name">`;
  if(ready&&op.ty==='newFolder')main=`New folder <input class="tkb-nm in" data-tkb-opname="${esc(r.id)}" value="${esc(op.name)}" aria-label="Folder name"> in ${popDest('data-tkb-opdest',r.id,v,op.parent&&v.node(op.parent)?v.node(op.parent).name:'Top level',op.parent)}`;
  if(ready&&op.ty==='merge')main=`${nm(op.nodes[0])} into ${popDest('data-tkb-opdest',r.id,v,v.node(op.into)?v.node(op.into).name:'',op.into)}`;
  if(ready&&op.ty==='putInside')main=`${nm(op.nodes[0])} goes inside ${popDest('data-tkb-opdest',r.id,v,op.parent&&v.node(op.parent)?v.node(op.parent).name:'Top level',op.parent)}`;
  if(op.ty==='need')main=`Yes: ${esc(op.q)}`;if(op.ty==='apply')main=`Apply: ${esc(op.text||pl(op.n,'change'))}`;if(op.ty==='discard')main=`Discard ${pl(op.n,'waiting change')}`;if(op.ty==='forgetChat')main='Forget this chat';
  if(op.ty==='private')main=`Make <b>${tgt()}</b> private`;
  if(op.ty==='keep')main=`Keep <b>${tgt()}</b> as is`;
  if(op.ty==='release')main=`Let Tuck read <b>${tgt()}</b><small class="tkb-why">Now: Private. After: its contents can be sent to AI.</small>`;
  const sub=r.why?`<small class="tkb-why">${esc(r.why)}</small>`:r.clash&&ready?`<small class="tkb-why">A folder with that name is already there. ${r.clashOk?'':`<button class="btn sm ghost" type="button" data-tkb-rclash="${esc(r.id)}">${op.ty==='rename'?'Merge Them Instead':'Keep Both'}</button>`}</small>`:['private','keep','release','need','apply','discard','forgetChat'].includes(op.ty)?'':`<small>${esc(d.sub||'')}</small>`;
  return `<li class="tkb-r chg${bl?' off':''}" data-row="${esc(r.id)}">${ck}<i class="ph ph-${esc(op.ty==='private'?'lock-simple':op.ty==='release'?'lock-simple-open':op.ty==='keep'?'push-pin':d.ic)} tkb-ki" aria-hidden="true"></i><span class="tkb-n">${main}${sub}</span></li>`}
 const ic=r.nid?'folder-simple':ICK(r.name);
 const dest=!g.trash&&!g.del&&ready&&!r.locked?popDest('data-tkb-dest',r.id,v,g.to?v.node(g.to).name:g.nw.name,null):'';
 const tools=ready?`${!g.trash&&!g.del&&r.fid?`<button type="button" class="tkb-ib" data-tkb-why="${esc(r.id)}" aria-expanded="${!!r.whyOpen}" title="Why here?" aria-label="Why here?"><i class="ph ph-question" aria-hidden="true"></i></button>`:''}<button type="button" class="tkb-ib" data-tkb-x="${esc(r.id)}" title="Remove from the plan" aria-label="Remove ${esc(r.name)} from the plan"><i class="ph ph-x" aria-hidden="true"></i></button>`:'';
 const note=r.unsure&&r.why&&!r.locked?`<b>Not Sure</b> · ${esc(r.why)}`:r.locked?esc(r.why):g.trash||g.del?esc(r.why||('In '+r.from)):'';
 const whyLine=r.whyOpen&&r.fid?`<small class="tkb-whyl">Here because: ${esc(whyHere(v,r.fid,g.to||g.acc||'')||(g.nw?`it belongs with the other ${g.nw.name} files.`:''))}</small>`:'';
 return `<li class="tkb-r${bl||!r.on?' off':''}${r.unsure?' unsure':''}" data-row="${esc(r.id)}">${ck}<i class="ph ph-${esc(ic)} tkb-ki" aria-hidden="true"></i><span class="tkb-n"><span class="tkb-l1"><span class="tkb-nm1">${esc(r.name)}</span>${tools?`<span class="tkb-tools">${tools}</span>`:''}</span>${!g.trash&&!g.del?`<span class="tkb-ft"><span class="fr">From ${esc(r.from||'')}</span>${dest?`<i class="ph ph-arrow-right" aria-hidden="true"></i>${dest}`:''}</span>`:''}${note?`<small class="tkb-why">${note}</small>`:''}${whyLine}</span></li>`}
const PRESETS={arrange:[['fewer','Fewer New Folders'],['month','By Month'],['year','By Year'],['kind','By Kind'],['again','Try Again']],sort:[['again','Try Again']],move:[],trash:[['again','Check Again']],folders:[]};
function cardHtml(c){if(KINDHTML[c.kind])return KINDHTML[c.kind](c);const v=V();syncState(c);
 if(c.state==='done'||c.state==='undone'){const res=c.res||{head:'Done',groups:[]};const skip=c.state==='done'?laterTouched(c):[];
  const nf=(c.applied||[]).filter(id=>c.rows.find(r=>r.id===id&&r.fid)).length;const gone=c.state==='done'&&skip.length&&skip.length>=nf&&c.kind!=='folders';
  const groups=res.groups.map(g=>`<div class="tkb-rg"><h4>${g.label?`<i class="ph ${g.trash?'ph-trash':'ph-fill ph-folder-simple'} tkb-fi" aria-hidden="true"></i><span>${esc(g.label)}</span>${g.isNew?'<em class="tkb-new">New</em>':''}<small>${g.n}</small>`:''}</h4><ul class="tkb-tb">${(g.rows||g.names.map(x=>({name:x}))).map(r=>{const back=r.id&&(c.rowBack||{})[r.id];const can=c.state==='done'&&r.fid&&['sort','move','arrange'].includes(c.kind);return `<li class="${back?'off':''}"><span class="tkb-rname">${esc(r.name).replace(/([_.\-])/g,'$1<wbr>')}${r.from?`<small>from ${esc(r.from)}</small>`:''}</span>${back?'<small>Put back</small>':can?`<button class="tkb-ib" type="button" data-tkb-rowundo="${esc(r.id)}" title="Undo this one" aria-label="Undo ${esc(r.name)}"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i></button>`:''}</li>`}).join('')}</ul></div>`).join('');
  const st=c.state==='undone'?`<p class="tkb-res"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i><span>${esc(c.undoMsg||'Undone')}</span></p>`:`<p class="tkb-res"><i class="ph ph-check-circle" aria-hidden="true"></i><span>${esc(res.head)}${c.ruled&&c.ruled.length?`<small class="tkb-ruled">New Rule: ${esc(c.ruled[0])}</small>`:''}</span></p>`;
  const acts=c.state==='undone'&&(c.kind==='view'||c.kind==='trash')?'':c.confirmOlder?`<button class="btn sm" type="button" data-tkb-undo="${esc(c.id)}">Undo Older Change</button><button class="btn sm ghost" type="button" data-tkb-keepit="${esc(c.id)}">Keep It</button>`:c.state==='undone'?`<button class="btn sm" type="button" data-tkb-redo="${esc(c.id)}">Redo</button>`:gone?'<small class="tkb-sup">Changed since. Undo it in History</small>':`<button class="btn sm" type="button" data-tkb-undo="${esc(c.id)}">Undo</button>`;
  const lo=c.state==='done'?c.rows.filter(r=>r.fid&&!r.gone&&!r.locked&&!(c.applied||[]).includes(r.id)).length:0;
  const more=lo?`<button class="btn sm ghost" type="button" data-tkb-rest="${esc(c.id)}">Review the Other ${lo}</button>`:'';
  const loNote=lo&&!c.left?`<p class="tkb-disk">${Pl(lo,'file')} Left: Not Sure</p>`:'';
  return `<div class="tkb-card done${c.state==='undone'?' undone':''}" data-tkb-card="${esc(c.id)}">${st}${c.state==='done'?`<div class="tkb-res-g">${groups}</div>${res.disk?`<p class="tkb-disk">${esc(res.disk)}</p>`:''}${loNote}`:''}<div class="tkb-acts">${more}${acts}<span class="sp"></span>${openHtml(c)}</div></div>`}
 if(c.dismissed)return `<div class="tkb-card dim" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b></div><p class="tkb-note">Set Aside</p><div class="tkb-acts"><button class="btn sm ghost" type="button" data-tkb-reopen="${esc(c.id)}">Show the Plan</button><span class="sp"></span>${openHtml(c)}</div></div>`;
 const label=primary(c),n=onRows(c).length;const allRows=c.rows.filter(r=>!r.gone&&!blocked(c,r));const allOn=allRows.length&&allRows.every(r=>r.on);
 const body=c.groups.map(g=>{const rs=rowsIn(c,g.k);if(!rs.length)return '';return `<section class="tkb-g${g.trash||g.del?' tr':''}">${gHead(c,g,v)}<ul>${rs.map(r=>rowHtml(c,r,v)).join('')}</ul></section>`}).join('');
 const running=c.state==='running';const pres=(PRESETS[c.kind]||[]).filter(()=>c.kind!=='arrange'||c.req&&['arrange','resort','split'].includes(c.req.intent));
 const rt=ruleTexts(c);
 const acts=running?`<div class="tkb-run">${stepsHtml(c)}<p>${runLine(c)}</p><div class="tkb-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i style="transform:scaleX(${(c.done||0)/c.total})"></i></div><button class="btn sm" type="button" data-tkb-stop="${esc(c.id)}">Stop</button></div>`
  :c.state==='error'?`<p class="tkb-err"><i class="ph ph-warning-circle" aria-hidden="true"></i>${esc(c.err||'Not Done')}</p><div class="tkb-acts"><span class="sp"></span><button class="btn sm" type="button" data-tkb-retry="${esc(c.id)}">Try Again</button></div>`
  :`<div class="tkb-acts">${pres.length?`<button type="button" class="btn sm ghost" data-tkb-refine="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false">Refine<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`:''}<span class="sp"></span>${openHtml(c)}<button type="button" class="btn sm ghost" data-tkb-dismiss="${esc(c.id)}">Not Now</button><span class="tkb-split"><button type="button" class="btn sm pri" data-tkb-go="${esc(c.id)}"${n?'':' disabled'}>${esc(label)}</button>${rt.length?`<button type="button" class="btn sm pri tkb-more" data-tkb-gomenu="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="More ways to approve"${n?'':' disabled'}><i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`:''}</span></div>`;
 const head=`<div class="tkb-hd"><b>${esc(c.title)}</b>${c.state==='ready'&&allRows.length>1?`<button type="button" class="tkb-all" data-tkb-all="${esc(c.id)}">${allOn?'None':'All'}</button>`:''}</div>`;
 return `<div class="tkb-card${running?' running':''}" data-tkb-card="${esc(c.id)}">${head}${c.note?`<p class="tkb-note">${c.note}</p>`:''}${c.stopped?'<p class="tkb-note">Stopped. Nothing changed.</p>':''}<div class="tkb-body">${body}</div>${diskLine(c)?`<p class="tkb-disk">${esc(diskLine(c))}</p>`:''}${acts}</div>`}
function chipHtml(v,id){const f=v.file(id);if(!f)return '';const pv=isPriv(v,id);const where=live(v,f)?v.path(f.node).slice(-1)[0]:'Trash';
 return `<button type="button" class="tkb-fc" data-tkb-file="${esc(id)}" title="${esc((live(v,f)?v.path(f.node).join(' › '):'Trash')+' · '+Plan.fileDate(id))}"><i class="ph ph-${pv?'lock-simple':ICK(f.name)}" aria-hidden="true"></i><span>${esc(mid(f.name,26))}</span><small>${esc(where)} · ${esc(Plan.fileDate(id))}${v.level(id).level!=='read'?' · matched by name':''}</small></button>`}
function folderChip(v,id){const n=v.node(id);if(!n)return '';return `<button type="button" class="tkb-fc fo" data-tkb-folder="${esc(id)}" title="Open ${esc(v.path(id).join(' › '))} in Edit Folders">${fIc(v,id)}<span>${esc(n.name)}</span><small>${v.total(id)}</small></button>`}
function peekHtml(v,id){const f=v.file(id);if(!f)return '';const pv=isPriv(v,id),inF=live(v,f);
 return `<div class="tkb-peek"><div class="tkb-pk-h"><i class="ph ph-${pv?'lock-simple':ICK(f.name)}" aria-hidden="true"></i><b>${esc(f.name)}</b></div><p>${esc(Plan.kind(f.name).label)} · ${f.size>=1000?(f.size/1000).toFixed(1)+' MB':f.size+' KB'} · ${esc(Plan.fileDate(id,true))}</p><p>${inF?`In ${esc(v.path(f.node).join(' › '))}`:'In the Trash'}${f.where?` · On disk: ${esc(f.where)}`:''}</p>${pv?'<p>Private: Never Sent to AI</p>':''}
  <div class="tkb-acts">${inF?`<button class="btn sm" type="button" data-tkb-open="${esc(id)}">Show in Edit Folders</button><button class="btn sm ghost" type="button" data-tkb-finder="${esc(id)}">Show in Finder</button>`:''}</div></div>`}
function disclosure(){const v=V();const n=allFiles(v).filter(f=>isPriv(v,f.id)).length;return `<p class="tkb-disc"><i class="ph ph-shield-check" aria-hidden="true"></i>Your questions and file names go to my AI. Private files (${n}) never leave this Mac.</p>`}
function html(b){if(!b)return '';const v=V();const say0=shownT(b);let h=say0?`<div class="tkb-t">${say0}</div>`:'';
 if(b.ask)h+=`<div class="tkb-ask">${b.ask.map(a=>a.fill?`<button type="button" class="tkb-chip" data-tkb-fill="${esc(a.fill)}"${b.answered?' disabled':''}>${esc(a.label)}</button>`:`<button type="button" class="tkb-chip q" data-tkb-say="${esc(a.say)}"${b.answered?' disabled':''}>${esc(a.label)}</button>`).join('')}</div>`;
 if((b.files&&b.files.length)||(b.folders&&b.folders.length))h+=`<div class="tkb-fcs">${(b.folders||[]).map(id=>folderChip(v,id)).join('')}${(b.files||[]).map(id=>chipHtml(v,id)).join('')}</div>`;
 if(b.peek)h+=peekHtml(v,b.peek);
 if(b.card)h+=cardHtml(b.card);if(b.card2)h+=cardHtml(b.card2);
 if(b.sent)h+=`<button type="button" class="tkb-sent" data-tkb-sent aria-haspopup="menu" aria-expanded="false">What Was Sent<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`;
 const ch=(b.chips||[]).filter(Boolean);
 if(ch.length)h+=`<div class="tkb-sugg">${ch.slice(0,b.cmds?7:3).map(x=>`<button type="button" class="tkb-chip" data-tkb-say="${esc(b.cmds?x.split(' · ')[0]:x)}">${esc(chipL(x))}</button>`).join('')}</div>`;
 return h}
/* after the host draws: a group that is partly ticked shows the mixed tick */
function after(root){(root||document).querySelectorAll('[data-mixed]').forEach(i=>{i.indeterminate=true})}

/* ---------- controls (one delegated handler; the host gives the thread). Menus open only from ⌄ pop-up buttons */
function findCard(th,id){for(const m of th.msgs()){if(m.bot){if(m.bot.card&&m.bot.card.id===id)return m.bot.card;if(m.bot.card2&&m.bot.card2.id===id)return m.bot.card2}}return null}
function cardOfEl(th,el){const c=el.closest('[data-tkb-card]');return c?findCard(th,c.dataset.tkbCard):null}
function botOfEl(th,el){const m=el.closest('[data-tkb-i]');if(m){const x=th.msgs()[+m.dataset.tkbI];return x&&x.bot}return null}
let MENU=null;function closeMenu(){if(!MENU)return;MENU.m.remove();MENU.btn.setAttribute('aria-expanded','false');MENU=null}
function menu(btn,items){closeMenu();const m=document.createElement('div');m.className='menu tkb-menu';m.setAttribute('role','menu');
 m.innerHTML=items.map((it,i)=>it==='-'?'<hr>':`<button role="menuitem" type="button" data-i="${i}">${it.check!=null?`<i class="ph ph-check" style="visibility:${it.check?'visible':'hidden'}" aria-hidden="true"></i>`:''}<span><b>${esc(it.label)}</b>${it.sub?`<small>${esc(it.sub)}</small>`:''}</span></button>`).join('');
 document.body.appendChild(m);const r=btn.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight;let x=Math.min(r.left,innerWidth-w-8),y=r.bottom+4;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-4);
 m.style.left=Math.max(8,x)+'px';m.style.top=y+'px';btn.setAttribute('aria-expanded','true');MENU={m,btn};
 m.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const it=items[+b.dataset.i];closeMenu();it.fn&&it.fn()};
 m.onkeydown=e=>{const bs=[...m.querySelectorAll('button')],k=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();bs[(k+1)%bs.length].focus()}if(e.key==='ArrowUp'){e.preventDefault();bs[(k-1+bs.length)%bs.length].focus()}if(e.key==='Escape'){e.stopPropagation();closeMenu();btn.focus()}};
 const f=m.querySelector('button');f&&f.focus({preventScroll:true})}
document.addEventListener('pointerdown',e=>{if(MENU&&!MENU.m.contains(e.target)&&!MENU.btn.contains(e.target))closeMenu()},true);
function sentMenu(btn,s){menu(btn,[{label:`Your words: “${s.q}”`,sub:'Sent so I could understand the request.'},{label:`${pl(s.names,'name')} of files and folders`,sub:'Names only. No file contents.'},{label:s.priv?`${pl(s.priv,'private file')}: not sent`:'No private files',sub:'Private files never leave this Mac.'}])}
function pickFolder(btn,title){if(!window.FolderPanel||!FolderPanel.pick)return Promise.resolve(undefined);btn.setAttribute('aria-expanded','true');
 return FolderPanel.pick(btn,{title}).then(t=>{btn.setAttribute('aria-expanded','false');return t})}
const nextWay=w=>({pick:'kind',thing:'kind',kind:'year',year:'month',month:'pick'})[w]||'kind';
function refine(c,th,way){const q=c.req||{};let n=null;
 if(way==='again')n=q.intent==='sort'?cardSort():q.intent==='clean'?cardClean(...q.args):q.intent==='resort'?cardResort(q.args[0]):q.intent==='split'?cardArrange(q.args[0],'thing',true):q.intent==='arrange'?cardArrange(q.args[0],nextWay(q.args[1]),false):null;
 else if(way==='fewer'){const nws=c.groups.filter(g=>g.nw);nws.sort((a,b)=>rowsIn(c,a.k).length-rowsIn(c,b.k).length).slice(0,Math.max(1,Math.ceil(nws.length/2))).forEach(g=>rowsIn(c,g.k).forEach(r=>{r.gone=true}));
  c.note=(c.note?c.note+' ':'')+'Fewer New Folders: Smallest Groups Stay';th.paint();th.save();return}
 else if(['month','year','kind'].includes(way)&&q.args)n=cardArrange(q.args[0],way,false);
 if(!n||n.say){c.note=n&&n.say?n.say:'That way doesn’t fit here, so the plan stays as it was.';th.paint();th.save();return}
 /* keep what you unticked or removed */
 const off=new Set(c.rows.filter(r=>!r.on||r.gone).map(r=>r.fid).filter(Boolean));n.rows.forEach(r=>{if(r.fid&&off.has(r.fid))r.on=false});
 Object.assign(c,{groups:n.groups,rows:n.rows,title:n.title,note:n.note,req:n.req,stopped:false});th.paint();th.save()}
function lastDone(th){const ms=th.msgs();for(let i=ms.length-1;i>=0;i--){const c=ms[i].bot&&ms[i].bot.card;if(c&&c.state==='done'&&['sort','move','arrange'].includes(c.kind))return c}return null}
/* "leave the PDFs", "only the photos", "call it Lab Reports", "fewer folders" on a result card: adjust what was done, with Undo */
function resultChange(c,a,th){const v=V();const did=c.rows.filter(r=>(c.applied||[]).includes(r.id)&&r.fid&&!(c.rowBack||{})[r.id]);
 if(a.name){const nf=Object.values(c.made||{})[0];if(!nf||!v.node(nf))return no('This card made no new folder to name.',{chips:[]});const nm=cap(String(a.name).trim().replace(/^["“]+|["”.!]+$/g,''));const row=Plan.applyMine([{ty:'rename',node:nf,name:nm}],`Renamed ${v.node(nf).name} to ${nm}`,'chat');if(row){c.hist.push(row.id);const g=c.groups.find(x=>c.made[x.k]===nf);if(g)g.nw.name=nm;c.res=result(c,c.rows.filter(r=>(c.applied||[]).includes(r.id)))}th.paint();th.save();return say(line('win.rename',{a:'The new folder',b:bold(nm)}),{chips:[],quiet:true})}
 if(a.fm){undo(c,th);const n=JSON.parse(JSON.stringify(c));Object.assign(n,{id:nid('c'),state:'ready',hist:[],applied:[],res:null,left:0,made:null,autoChecked:false,ran:null});n.rows.forEach(r=>{delete r.gone});refine(n,{paint:()=>{},save:()=>{}},a.fm==='fewer'?'fewer':'again');const b={t:'',card:n,chips:['Undo']};th.push(b);started(b,th);return say(`Done again, with ${a.fm} folders.`,{chips:[],quiet:true})}
 const want=lc(strip(a.leave||a.only)).replace(/s$/,'');const ext={pdf:'pdf',doc:'docx',word:'docx',sheet:'xlsx',spreadsheet:'xlsx',photo:'heic',image:'png',screenshot:'screenshot'}[want]||null;
 const hit=r=>ext?(ext==='screenshot'?/^screenshot/i.test(r.name):lc(r.name).endsWith('.'+ext)||(ext==='heic'&&/\.(heic|png)$/i.test(r.name))):lc(r.name).includes(want);
 const back=did.filter(r=>a.only?!hit(r):hit(r));if(!back.length)return no(`Nothing on the card matches “${esc(a.leave||a.only)}”.`,{chips:[]});
 const by={};back.forEach(r=>{(by[r.fromNode]=by[r.fromNode]||[]).push(r.fid)});const row=Plan.applyNow(Object.entries(by).filter(([to])=>v.node(to)).map(([to,files])=>({ty:'moveFiles',files,to})),`Put back ${pl(back.length,'file')}`,'chat');
 if(row){c.rowBack=c.rowBack||{};back.forEach(r=>c.rowBack[r.id]=row.id)}rerender();th.paint();th.save();return say(`Put back ${pl(back.length,'file')}. The card above shows it.`,{chips:[],quiet:true})}
function lastReady(th){const ms=th.msgs();for(let i=ms.length-1;i>=0;i--){const c=ms[i].bot&&ms[i].bot.card;if(c&&c.state==='ready'&&!c.dismissed)return c}return null}
function handle(e,th){const el=e.target;if(!el||!el.closest)return false;const type=e.type;
 if(type==='input'&&el.matches('[data-tkb-flt]')){const q=lc(el.value);el.closest('.tkb-card').querySelectorAll('.tkb-lr li').forEach(li=>{li.hidden=!!q&&!li.dataset.q.includes(q)});return true}
 if(type==='input'){const nm=el.closest('[data-tkb-opname]');if(nm){const c=cardOfEl(th,nm),r=c&&c.rows.find(x=>x.id===nm.dataset.tkbOpname);if(r)r.op.name=nm.value;return true}return false}
 if(type==='keydown'){if(el.matches('.tkb-nm')){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();el.blur()}if(e.key==='Escape'){el.dataset.cancel='1';el.blur()}return true}return false}
 if(type==='focusout'){if(el.matches('[data-tkb-nm]')){const c=cardOfEl(th,el),g=c&&c.groups.find(x=>x.k===el.dataset.tkbNm);if(!g)return true;const v=el.value.trim();if(!el.dataset.cancel&&v){g.nw.name=v;g.clashOk=false;g.clashUse=false;checkClash(c,g)}g.edit=false;setTimeout(()=>{th.paint();th.save()},0);return true}
  if(el.matches('[data-tkb-opname]')){const c=cardOfEl(th,el),r=c&&c.rows.find(x=>x.id===el.dataset.tkbOpname);if(r){r.op.name=el.value.trim()||r.op.name;r.clashOk=false;clashRow(r);setTimeout(()=>{th.paint();th.save()},0)}return true}return false}
 if(type==='change'){const ck=el.closest('[data-tkb-r]');if(ck){const c=cardOfEl(th,ck);const r=c&&c.rows.find(x=>x.id===ck.dataset.tkbR);if(r){r.on=ck.checked;th.paint();th.save()}return true}
  const gk=el.closest('[data-tkb-g]');if(gk){const c=cardOfEl(th,gk);if(c){rowsIn(c,gk.dataset.tkbG).filter(r=>!blocked(c,r)).forEach(r=>r.on=gk.checked);th.paint();th.save()}return true}return false}
 if(type!=='click')return false;
 if(handleX(e,th))return true;
 const q=el.closest('[data-tkb-say]');if(q){const b=botOfEl(th,q);if(b&&b.ask&&q.classList.contains('q'))b.answered=true;const s=q.dataset.tkbSay;
  if(/^\/(arrange|split|resort|find)$/.test(s)&&th.fill){th.fill(s+' ');return true}th.send(s);return true}
 const sn=el.closest('[data-tkb-sent]');if(sn){const b=botOfEl(th,sn);if(b&&b.sent)sentMenu(sn,b.sent);return true}
 const fo=el.closest('[data-tkb-folder]');if(fo){goSel({type:'node',id:fo.dataset.tkbFolder});return true}
 const fc=el.closest('[data-tkb-file]');if(fc){const b=botOfEl(th,fc);if(b){b.peek=b.peek===fc.dataset.tkbFile?null:fc.dataset.tkbFile;th.paint();th.save()}return true}
 const op=el.closest('[data-tkb-open]');if(op){goSel({type:'file',id:op.dataset.tkbOpen});return true}
 const fd=el.closest('[data-tkb-finder]');if(fd){finder(fd.dataset.tkbFinder);return true}
 const c=cardOfEl(th,el);if(!c)return false;
 if(el.closest('[data-tkb-go]')){run(c,th);return true}
 const gm=el.closest('[data-tkb-gomenu]');if(gm){const rt=ruleTexts(c);menu(gm,[{label:primary(c),fn:()=>run(c,th)},{label:`${primary(c)}, and Always Do This Kind`,sub:`A rule in Settings › Memory: “${rt.join('”, “')}”. Trash, privacy and more than 20 files still ask.`,fn:()=>run(c,th,{rule:rt})},'-',{label:'Keep Planning',sub:'Nothing changes',fn:()=>{}}]);return true}
 if(el.closest('[data-tkb-stop]')){c.stop=true;return true}
 if(el.closest('[data-tkb-keepit]')){c.confirmOlder=false;th.paint();return true}
 if(el.closest('[data-tkb-undo]')){if(c.latest===false&&!c.confirmOlder){c.confirmOlder=true;th.paint();return true}c.confirmOlder=false;try{undo(c,th)}catch(x){console.error(x);c.win=withRoom(c,th,()=>{ROOM.calm=true;return line('oops.undo',{why:esc(me(Plan.lastRefusal||'It may have changed since.'))})});th.mood&&th.mood('oops');th.paint();th.save()}return true}
 if(el.closest('[data-tkb-redo]')){redo(c,th);return true}
 if(el.closest('[data-tkb-retry]')){c.state='ready';c.err='';th.paint();return true}
 if(el.closest('[data-tkb-dismiss]')){c.dismissed=true;th.paint();th.save();return true}
 if(el.closest('[data-tkb-reopen]')){c.dismissed=false;th.paint();th.save();return true}
 if(el.closest('[data-tkb-rest]')){const left=c.rows.filter(r=>r.fid&&!r.gone&&!r.locked&&!(c.applied||[]).includes(r.id));if(!left.length)return true;
  const n=JSON.parse(JSON.stringify(c));Object.assign(n,{id:nid('c'),state:'ready',hist:[],applied:[],res:null,left:0,stopped:false,autoChecked:true,ran:null,title:c.title+': the rest'});n.rows=n.rows.filter(r=>left.some(x=>x.id===r.id));n.rows.forEach(r=>{r.on=!r.unsure});
  th.push({t:`Here are the other ${c.kind==='trash'?pl(n.rows.length,'item'):n.rows.length===1?'one':n.rows.length}.`,card:n,chips:['What changed?']});return true}
 if(el.closest('[data-tkb-all]')){const rs=c.rows.filter(r=>!r.gone&&!blocked(c,r));const on=!rs.every(r=>r.on);rs.forEach(r=>r.on=on);th.paint();th.save();return true}
 const x=el.closest('[data-tkb-x]');if(x){const r=c.rows.find(y=>y.id===x.dataset.tkbX);if(r){r.gone=true;th.paint();th.save()}return true}
 const wy=el.closest('[data-tkb-why]');if(wy){const r=c.rows.find(y=>y.id===wy.dataset.tkbWhy);if(r){r.whyOpen=!r.whyOpen;th.paint();th.save()}return true}
 const rn=el.closest('[data-tkb-ren]');if(rn){const g=c.groups.find(y=>y.k===rn.dataset.tkbRen);if(g){g.edit=true;th.paint();setTimeout(()=>{const i=document.querySelector(`[data-tkb-card="${c.id}"] [data-tkb-nm="${CSS.escape(g.k)}"]`);if(i){i.focus();i.select()}},0)}return true}
 const cl=el.closest('[data-tkb-clash]');if(cl){const g=c.groups.find(y=>y.k===cl.dataset.k);if(g){g.clashOk=true;g.clashUse=cl.dataset.tkbClash==='use';th.paint();th.save()}return true}
 const rc=el.closest('[data-tkb-rclash]');if(rc){const r=c.rows.find(y=>y.id===rc.dataset.tkbRclash);if(r){if(r.op.ty==='rename')r.op={ty:'merge',nodes:[r.op.node],into:r.clash};else r.op.name+=' 2';r.clash=null;r.clashOk=true;th.paint();th.save()}return true}
 const dd=el.closest('[data-tkb-dest]');if(dd){const r=c.rows.find(y=>y.id===dd.dataset.tkbDest);if(!r)return true;pickFolder(dd,`Where should ${mid(r.name,24)} go?`).then(t=>{const v=V();if(!t||!v.node(t))return;
   if(projectOf(v,t)){r.why=projSay(v,t,'sort files into it').replace(/&amp;/g,'&');th.paint();return}
   const ex=c.groups.find(g=>g.to===t)||grp(c,{k:destK(t),to:t});r.k=ex.k;r.on=true;r.unsure=false;r.why='';r.whyOpen=false;c.groups=c.groups.filter(g=>rowsIn(c,g.k).length||g.chg);th.paint();th.save()});return true}
 const od=el.closest('[data-tkb-opdest]');if(od){const r=c.rows.find(y=>y.id===od.dataset.tkbOpdest);if(!r)return true;const ex=r.op.ty==='merge'||r.op.ty==='putInside'?r.op.nodes:[];
  pickFolder(od,r.op.ty==='merge'?'Merge into':r.op.ty==='newFolder'?'Make it inside':'Move it inside').then(t=>{if(!t||!V().node(t)||ex.includes(t))return;if(r.op.ty==='merge')r.op.into=t;else r.op.parent=t;const w=opWhy(r.op);r.locked=!!w;r.why=w;r.on=!w;if(r.op.ty==='newFolder')clashRow(r);th.paint();th.save()});return true}
 const rf=el.closest('[data-tkb-refine]');if(rf){menu(rf,(PRESETS[c.kind]||[]).map(([k,l])=>({label:l,fn:()=>refine(c,th,k)})));return true}
 return false}
/* file and folder chips open the thing: Edit Folders (this page or tuck.html), Finder for the file on disk */
function goSel(sel){if(typeof window.wbSelect==='function'){if(location.hash!=='#edit')location.hash='edit';setTimeout(()=>{try{wbSelect(sel,true)}catch(e){}},120);return}
 try{sessionStorage.setItem('tuckBot.select',JSON.stringify(sel))}catch(e){}location.href='tuck.html#edit'}
function finder(id){if(window.TuckChat&&TuckChat._openFile&&TuckChat._openFile(id))return;try{sessionStorage.setItem('tuckBot.reveal',id)}catch(e){}location.href='finder.html'}

/* ---------- above the composer: autonomy pop-up, and the / and @ suggestions (chips, not a menu) */
function attach(cp,comp){if(!cp||cp.querySelector('.tkb-bar'))return;const bar=document.createElement('div');bar.className='tkb-bar';
 bar.innerHTML=`<div class="tkb-sl" hidden></div><div class="tkb-row"><button type="button" class="popchip tkb-auto" aria-haspopup="menu" aria-expanded="false" title="How much I do without asking"><i class="ph ph-hand-palm" aria-hidden="true"></i><span></span><i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button><span class="tkb-hint">Type @ to point at a folder</span></div>`;
 cp.insertBefore(bar,cp.firstChild);const ab=bar.querySelector('.tkb-auto'),sl=bar.querySelector('.tkb-sl');
 const paintAuto=()=>{ab.querySelector('span').textContent=SHORT[level()]||level()};paintAuto();
 if(Plan.subscribe)Plan.subscribe(r=>{if(r==='limits')paintAuto()});
 /* Lower acts at once; raising how much Tuck decides takes a second press (plan decision 7) */
 const setLevel=k=>{Plan.setLimits(k);paintAuto()};
 ab.onclick=()=>menu(ab,LEVELS.map(([k,l,s])=>({label:l,sub:s,check:level()===k,fn:()=>{if(RANK[k]<=RANK[level()])return setLevel(k);
  menu(ab,[{label:`Turn On ${SHORT[k]}`,sub:TOOL.set_autonomy.preview({lv:k}),fn:()=>setLevel(k)},{label:`Keep ${SHORT[level()]}`,fn:()=>{}}])}})));
 const inp=comp&&comp.input;if(!inp)return;
 const show=list=>{sl.hidden=!list.length;sl.innerHTML=list.map(x=>`<button type="button" class="tkb-chip" data-fill="${esc(x.fill)}"${x.send?' data-send="1"':''}>${x.ic?`<i class="ph ${x.ic}" aria-hidden="true"></i>`:''}${esc(x.label)}${x.sub?`<small>${esc(x.sub)}</small>`:''}</button>`).join('')};
 inp.addEventListener('input',()=>{const s=inp.value;
  if(/^\/\w*$/.test(s)){const k=s.slice(1).toLowerCase();show(SLASH.filter(([c])=>c.slice(1).startsWith(k)).map(([c,l])=>({label:c,sub:l,fill:c+' ',send:c==='/sort'||c==='/undo'||c==='/clean'})));return}
  const at=/@([^@]*)$/.exec(s);if(at){const q=lc(at[1]);const v=V();const ns=v.all().filter(id=>{const n=v.node(id);return n&&!n.special&&!n.hidden&&!n.sug&&lc(n.name).includes(q)}).slice(0,6);
   show(ns.map(id=>({label:'@'+v.node(id).name,sub:v.path(id).slice(0,-1).join(' › ')||'Top level',ic:'ph-folder-simple',fill:s.slice(0,at.index)+'@'+v.node(id).name+' '})));return}
  show([])});
 sl.addEventListener('click',e=>{const b=e.target.closest('[data-fill]');if(!b)return;show([]);if(b.dataset.send){comp.send&&comp.send(b.dataset.fill.trim());return}inp.value=b.dataset.fill;inp.dispatchEvent(new Event('input'));inp.focus()});
 inp.addEventListener('keydown',e=>{if(e.key==='Escape')show([])})}

/* ---------- styles (system.css tokens only: accent blue, ink and greys) */
function css(){if(document.getElementById('tkbcss'))return;const s=document.createElement('style');s.id='tkbcss';s.textContent=`
.tkb-tb li>.tkb-rname{overflow-wrap:break-word}.tkb-rname small{display:block;margin:1px 0 0}
.tkb-t{font:500 14px/1.45 var(--f);overflow-wrap:anywhere}.tkb-t b{font-weight:600}.tkb-t a{color:var(--ac-ink)}.tkb-ul{margin:6px 0 0;padding-left:18px}.tkb-ul small{color:var(--ink3)}
.tkb-card{margin-top:10px;border-radius:12px;background:var(--win);box-shadow:inset 0 0 0 1px var(--line);display:grid;gap:8px;padding:8px;min-width:0}
.tkchat .m.bot:has(.tkb-card){padding:8px 8px 10px}.tkchat .m.bot:has(.tkb-card)>.tkb-t{padding:0 4px}
.tkb-card.dim{opacity:.85}
.tkb-hd{display:flex;align-items:center;gap:8px;min-height:24px}.tkb-hd b{flex:1;min-width:0;font:600 13px/1.35 var(--f);overflow-wrap:anywhere}
.tkb-all{height:24px;padding:0 8px;border-radius:7px;font:600 12px var(--f);color:var(--ac-ink)}.tkb-all:hover{background:var(--hov)}
.tkb-note{margin:0;font:500 12px/1.45 var(--f);color:var(--ink2)}.tkb-note .btn{margin-left:4px}
.tkb-disk{margin:0;font:500 11.5px/1.4 var(--f);color:var(--ink3)}
.tkb-body{display:grid;gap:8px;max-height:min(420px,52vh);overflow:auto;overscroll-behavior:contain;min-width:0}
.tkb-g{border-radius:10px;background:var(--soft);padding:4px 2px 2px;min-width:0}
.tkb-gh{display:flex;align-items:flex-start;gap:6px;min-height:28px;padding:4px 6px;font:600 12.5px var(--f);color:var(--ink);min-width:0}
.tkb-gh small{flex:none;margin-left:auto;font:500 12px var(--f);color:var(--ink3)}
.tkb-gp{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;min-width:0;flex:1}.tkb-gp .pth{min-width:0;overflow-wrap:anywhere;color:var(--ink2);font-weight:500}.tkb-gp .pth:empty{display:none}.tkb-gp .last{min-width:0;overflow-wrap:anywhere}
.tkb-to{flex:none;color:var(--ink3);font-size:12px}.tkb-fi{flex:none;color:var(--ac-ink);font-size:14px}
.tkb-new{flex:none;font:600 10.5px/16px var(--f);font-style:normal;padding:0 5px;border-radius:5px;background:var(--ac-fill);color:var(--ac-ink)}
.tkb-ren{display:inline-flex;align-items:center;gap:4px;min-width:0;min-height:22px;padding:0 4px;border-radius:6px;font:600 12.5px/1.3 var(--f);color:var(--ink);overflow-wrap:anywhere;text-align:left}.tkb-ren:hover{background:var(--win);box-shadow:inset 0 0 0 1px var(--line2)}.tkb-ren i{font-size:11px;color:var(--ink3)}
.tkb-nm{min-width:0;width:9em;max-width:100%;height:22px;padding:0 6px;border-radius:6px;border:0;background:var(--win);box-shadow:inset 0 0 0 1px var(--ac);font:600 12.5px var(--f);color:var(--ink);outline:0}
.tkb-nm.in{width:8em;box-shadow:inset 0 0 0 1px var(--line2);font-weight:500}.tkb-nm.in:focus{box-shadow:inset 0 0 0 1px var(--ac)}
.tkb-g ul{list-style:none;margin:2px 0 0;padding:0;display:grid}
.tkb-r{display:grid;grid-template-columns:16px 16px minmax(0,1fr);align-items:start;gap:6px;padding:5px 6px;border-radius:8px;font:500 12.5px/1.35 var(--f)}
.tkb-r:not(:has(input[type=checkbox])){grid-template-columns:16px minmax(0,1fr)}
.tkb-r:hover{background:var(--hov)}.tkb-r input[type=checkbox]{margin:1px 0 0;accent-color:var(--ac)}
.tkb-r.off .tkb-nm1{color:var(--ink3)}
.tkb-ki{color:var(--ink3);font-size:15px}
.tkb-n{display:grid;gap:2px;min-width:0}.tkb-nm1{min-width:0;overflow-wrap:anywhere;color:var(--ink)}
.tkb-l1{display:flex;align-items:center;gap:4px;min-width:0}.tkb-l1 .tkb-nm1{flex:1}.tkb-tools{flex:none;display:flex;margin:-3px -4px -3px 0}
.tkb-ft{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;min-width:0;font:500 11.5px var(--f);color:var(--ink3)}.tkb-ft .fr{min-width:0;overflow-wrap:anywhere}.tkb-ft>i{flex:none;font-size:10px}
.tkb-dest{min-height:22px;height:auto;padding:1px 5px 1px 7px;font-size:11.5px;max-width:100%;flex:0 1 auto;min-width:56px;gap:2px}.tkb-dest span{min-width:0;overflow-wrap:anywhere;text-align:left}
.tkb-r.chg .tkb-n{display:block;line-height:1.9}.tkb-r.chg .tkb-dest{display:inline-flex;vertical-align:middle}.tkb-r.chg small{display:block;line-height:1.4}
.tkb-why,.tkb-whyl{font:500 11.5px/1.4 var(--f);color:var(--ink3)}.tkb-why b{color:var(--ink2);font-weight:600}.tkb-whyl{color:var(--ink2)}
.tkb-ib{width:22px;height:22px;border-radius:6px;display:inline-grid;place-items:center;color:var(--ink3);font-size:13px}.tkb-ib:hover,.tkb-ib[aria-expanded=true]{background:var(--win);color:var(--ink)}
.tkb-clash{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 6px 4px;padding:6px 8px;border-radius:8px;background:var(--win);font:500 12px/1.4 var(--f);color:var(--ink2)}.tkb-clash>i{color:var(--ac-ink)}.tkb-clash span{flex:1 1 140px}
.tkb-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.tkb-acts .sp{flex:1}
.tkb-split{display:inline-flex}.tkb-split .btn.pri:first-child:not(:only-child){border-top-right-radius:0;border-bottom-right-radius:0}.tkb-more{width:24px;padding:0!important;border-top-left-radius:0!important;border-bottom-left-radius:0!important;margin-left:1px}.tkb-more .pcaret{margin:0;opacity:.9}
.tkb-run{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 10px}
.tkb-steps{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;padding:0;list-style:none;font:500 11.5px var(--f);color:var(--ink3);grid-column:1/-1;grid-row:1}.tkb-steps li{display:inline-flex;align-items:center;gap:3px}.tkb-steps li.on{color:var(--ink);font-weight:600}.tkb-steps li.ok i{color:var(--ac-ink)}
.tkb-run p{grid-column:1;grid-row:2;margin:0;font:500 12.5px var(--f);color:var(--ink2)}.tkb-run .tkb-prog{grid-column:1;grid-row:3}.tkb-run .btn{grid-column:2;grid-row:2 / span 2}
.tkb-prog{height:6px;border-radius:3px;background:var(--soft2);overflow:hidden}.tkb-prog i{display:block;height:100%;border-radius:inherit;background:var(--ac);transform-origin:0 50%;transition:transform .2s var(--ease)}
.tkb-err{display:flex;gap:6px;align-items:center;margin:0;font:500 12.5px var(--f);color:var(--ink)}
.tkb-res{display:flex;gap:8px;align-items:flex-start;margin:0;font:600 13px/1.4 var(--f);overflow-wrap:anywhere}.tkb-ruled{display:block;font:500 11.5px/1.4 var(--f);color:var(--ink3)}.tkb-res i{color:var(--ac-ink);font-size:17px;flex:none}.tkb-card.undone .tkb-res{font-weight:500;color:var(--ink2)}
.tkb-res-g{display:grid;gap:6px;max-height:240px;overflow:auto}
.tkb-rg{border-radius:9px;background:var(--soft);padding:6px 10px}.tkb-rg h4{display:flex;align-items:center;gap:6px;margin:0;font:600 12px var(--f)}.tkb-rg h4 span{flex:1;min-width:0;overflow-wrap:anywhere}.tkb-rg h4 small{color:var(--ink3);font-weight:500}
.tkb-rg ul{list-style:none;margin:2px 0 0;padding:0 0 0 20px;display:grid;gap:1px;font:500 11.5px/1.4 var(--f);color:var(--ink2)}.tkb-rg li{overflow-wrap:anywhere}.tkb-sup{font:500 12px var(--f);color:var(--ink3)}
.tkb-ask,.tkb-sugg,.tkb-fcs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tkb-chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;min-height:26px;padding:3px 10px;border-radius:13px;background:var(--win);box-shadow:inset 0 0 0 1px var(--line2);font:500 12.5px/1.3 var(--f);color:var(--ink);text-align:left}
.tkb-chip:hover{box-shadow:inset 0 0 0 1px var(--ac);color:var(--ac-ink)}.tkb-chip.q{font-weight:600}.tkb-chip:disabled{opacity:.55;pointer-events:none}.tkb-chip small{color:var(--ink3);font-weight:500;margin-left:2px}
.tkb-fc{display:inline-grid;grid-template-columns:auto minmax(0,1fr);column-gap:6px;align-items:center;max-width:100%;padding:5px 10px 5px 8px;border-radius:9px;background:var(--win);box-shadow:inset 0 0 0 1px var(--line2);text-align:left;color:var(--ink)}
.tkb-fc i{grid-row:span 2;font-size:16px;color:var(--ink3)}.tkb-fc.fo i{color:var(--ac-ink)}.tkb-fc span{font:600 12.5px/1.3 var(--f);overflow-wrap:anywhere;min-width:0}
.tkb-fc small{font:500 11px/1.3 var(--f);color:var(--ink3);overflow-wrap:anywhere;min-width:0}.tkb-fc:hover{box-shadow:inset 0 0 0 1px var(--ac)}
.tkb-peek{margin-top:8px;padding:10px;border-radius:10px;background:var(--win);box-shadow:inset 0 0 0 1px var(--line);display:grid;gap:4px}.tkb-peek p{margin:0;font:500 12px/1.4 var(--f);color:var(--ink2);overflow-wrap:anywhere}
.tkb-pk-h{display:flex;gap:6px;align-items:center;font:600 13px var(--f);min-width:0}.tkb-pk-h b{overflow-wrap:anywhere}.tkb-pk-h i{color:var(--ink3);font-size:16px}
.tkb-sent{display:inline-flex;align-items:center;gap:2px;margin-top:8px;height:22px;padding:0 6px;border-radius:6px;font:500 11.5px var(--f);color:var(--ink3)}.tkb-sent:hover,.tkb-sent[aria-expanded=true]{background:var(--hov);color:var(--ink)}
.tkb-disc{display:flex;gap:6px;align-items:flex-start;margin:0 0 4px;font:500 11.5px/1.45 var(--f);color:var(--ink3)}.tkb-disc i{flex:none;font-size:13px;margin-top:1px;color:var(--ac-ink)}
.tkb-menu{min-width:240px;max-width:min(320px,calc(100vw - 16px))}.tkb-menu button{height:auto;min-height:28px;padding:5px 9px;align-items:flex-start}.tkb-menu button span{display:grid;gap:1px}.tkb-menu button b{font-weight:500}.tkb-menu button small{font:500 11.5px/1.35 var(--f);opacity:.75;white-space:normal}.tkb-menu button i{margin-top:2px}
.tkb-bar{display:grid;gap:6px;margin-bottom:8px}.tkb-row{display:flex;align-items:center;gap:8px;min-width:0}.tkb-auto{height:24px;font-size:12px;padding:0 6px 0 7px;flex:none}.tkb-auto i:first-child{color:var(--ac-ink);font-size:13px}
.tkb-hint{min-width:0;font:500 11.5px var(--f);color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tkb-sl{display:flex;flex-wrap:wrap;gap:6px;max-height:120px;overflow:auto}.tkb-sl[hidden]{display:none}
.tkchat.tkb-on .tk-starters button{--h:var(--ac-ink)}
.tkchat .m.tk:has(.tkb-card){max-width:100%;width:100%}
.tkb-hd small{flex:none;font:500 12px var(--f);color:var(--ink3)}
.tkb-open{gap:3px}.tkb-open i{font-size:12px}
.tkb-flt{height:26px;border:0;border-radius:7px;padding:0 8px;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line);font:500 12px var(--f);color:var(--ink);outline:0}.tkb-flt:focus{box-shadow:inset 0 0 0 1px var(--ac)}
.tkb-lr{list-style:none;margin:0;padding:0;display:grid;gap:1px;max-height:280px;overflow:auto}.tkb-lr li{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 6px;border-radius:8px}.tkb-lr li:hover{background:var(--hov)}.tkb-lr li.in{padding-left:22px}
.tkb-lr li>i{color:var(--ink3);font-size:15px}.tkb-lr li[hidden]{display:none}
.tkb-lname{min-width:0;text-align:left;font:600 12.5px/1.3 var(--f);color:var(--ink);overflow-wrap:anywhere}.tkb-lname:hover{color:var(--ac-ink)}.tkb-lr small{display:block;font:500 11.5px/1.3 var(--f);color:var(--ink3);overflow-wrap:anywhere}
.tkb-tb{list-style:none;margin:4px 0 0;padding:0 0 0 20px;display:grid;gap:1px;font:500 12px/1.4 var(--f);color:var(--ink2)}.tkb-tb li{display:flex;align-items:center;gap:6px;min-width:0}.tkb-tb li>span{flex:1;min-width:0;overflow-wrap:anywhere}.tkb-tb li small{flex:none;color:var(--ink3)}.tkb-tb li.off span{color:var(--ink3);text-decoration:line-through}
.tkb-tag{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:var(--ac-fill);color:var(--ac-ink);font:600 11.5px var(--f)}.tkb-dec .tkb-hd{justify-content:space-between}
.tkb-dq{font:600 14px/1.35 var(--f);color:var(--ink)}
.tkb-box{border-radius:10px;background:var(--soft);padding:6px 4px}.tkb-box h5{display:flex;gap:6px;align-items:baseline;margin:0 6px 4px;font:600 12px var(--f)}.tkb-box h5 small{color:var(--ink3);font-weight:500}.tkb-box .tkb-lr li{grid-template-columns:16px minmax(0,1fr)}
.tkb-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 10px;margin:0;font:500 12px/1.4 var(--f)}.tkb-facts dt{color:var(--ink3)}.tkb-facts dd{margin:0;color:var(--ink);overflow-wrap:anywhere}.tkb-path{font-weight:600}
.tkb-seg{display:flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:9px;background:var(--soft)}.tkb-seg button{flex:1 1 auto;min-height:26px;padding:3px 9px;border-radius:7px;font:500 12px/1.3 var(--f);color:var(--ink2)}.tkb-seg button:hover{color:var(--ink)}.tkb-seg button.on{background:var(--win);color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line2)}
.tkb-cmp{width:100%;border-collapse:collapse;font:500 12px/1.4 var(--f)}.tkb-cmp th{text-align:left;color:var(--ink3);font-weight:600;padding:2px 6px}.tkb-cmp td{padding:4px 6px;border-top:1px solid var(--line);color:var(--ink2);overflow-wrap:anywhere}
.tkb-cmpv{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px}.tkb-cmpv>div{display:grid;gap:2px;padding:8px;border-radius:9px;background:var(--soft);font:500 12px/1.35 var(--f);min-width:0}.tkb-cmpv b{font-weight:600;overflow-wrap:anywhere}.tkb-cmpv small{color:var(--ink3)}.tkb-cmpv .nw{box-shadow:inset 0 0 0 1px var(--ac)}
.tkb-askbtn{flex:none;gap:3px;color:var(--ac-ink)}.tkb-askbtn .ph-sparkle{font-size:13px}.tkb-askrow{margin-left:6px}.tkb-askset{flex:none;height:26px;align-self:center;margin-left:-6px;color:var(--ac-ink)}.sgrp h4.tkb-sech{display:flex;align-items:center;gap:8px}.sgrp h4.tkb-sech .tkb-asksec{margin:-5px 2px -5px auto;height:24px}.phead.tkb-sech{position:relative}.phead.tkb-sech>.tkb-asksec{position:absolute;top:0;right:0;margin:0;height:24px}
.tkb-askset.tkb-askfinder{margin-left:0;height:28px}
.tkb-hl{outline:2px solid var(--ac);outline-offset:2px;border-radius:8px}
@media (prefers-reduced-motion:reduce){.tkb-prog i{transition:none}}`;document.head.appendChild(s)}
css();

/* ================= TOOLS: every feature the agent can use (source of truth for agent-map.html) =================
   Follows tuck-review/agent-feature-map-2026-11-02.md: its tool names, its 10 card types, its routes and status, its rules for every
   answer. Rows the map doesn't have are marked added. Each entry:
   {id, section, feature, tool (the agent tool), card ('C1'…'C10'), route (the app's backend route), status (built | route | missing),
    added, tier (instant: done at once with Undo · card: a card first · ask: always asks, in every mode), kind (data | view),
    page (any | tuck | brain | finder), hash, maps (what the prototype calls), say (2+ phrasings), intent (parse) or re/args/run or get/set/opts}
   Ask or act (research: asking_questions.md): reversible and confident → do it, result card, Undo · a real fork → one chip question,
   2 to 4 options and Other (or Needs You when it can wait) · Trash, leaving your places, making something readable → always confirm ·
   after the same correction twice → ask once, then remember it as a rule (Settings › Memory). */
const PG=()=>{const p=location.pathname;return /brain/.test(p)?'brain':/finder/.test(p)?'finder':/agent-map/.test(p)?'map':'tuck'};
const PAGEURL={tuck:'tuck.html',brain:'brain.html',finder:'finder.html'};
const PAGENAME={tuck:'Tuck',brain:'Tuck Brain',finder:'Finder'};
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const rerender=()=>{const r=G('render');if(typeof r==='function'&&PG()==='tuck')r()};
const toHash=h=>{if(PG()!=='tuck'||!h)return;if(location.hash.slice(1)!==h)location.hash=h;else rerender()};
const cfgGet=()=>{try{return JSON.parse(localStorage.getItem('tuckSettings')||'{}')||{}}catch(e){return {}}};
const cfgSet=(k,v)=>{const c=cfgGet();c[k]=v;try{localStorage.setItem('tuckSettings',JSON.stringify(c))}catch(e){}const st=G('st');if(st&&st.cfg){st.cfg[k]=Array.isArray(v)?v.slice():v;rerender()}};
const CFGDEF={never:['~/Library','~/Music','~/Developer','iCloud Drive › Shared with me'],naming:'Keep Names',read:'Every Page',notify:'Needs and summary'};
const cfgVal=k=>{const c=cfgGet();return c[k]!==undefined?c[k]:CFGDEF[k]};
const nodeArg=s=>{const t=tok(s);if(t&&t.ty==='node')return t.id;return findNode(s)};
const MONTHN=['january','february','march','april','may','june','july','august','september','october','november','december'];
const MON3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TOOLS=[];const TOOL={};
function T(o){o.say=o.say||[];TOOLS.push(o);TOOL[o.id]=o;return o}
const bclick=sel=>{const b=document.querySelector(sel);b&&b.click()};
const bcheck=(sel,on)=>{const c=document.querySelector(sel);if(c&&c.checked!==on){c.checked=on;c.dispatchEvent(new Event('change'))}};
const waitingNeeds=()=>(Plan.needs?Plan.needs():[]).filter(x=>!x.done);
const THEME=()=>document.documentElement.dataset.theme||'auto';
const fdate=id=>Plan.fileDate?Plan.fileDate(id):'';
const sizeTxt=kb=>kb>=1000?(kb/1000).toFixed(1)+' MB':Math.round(kb)+' KB';

/* ---------- Today */
T({id:'sort_new',section:'Today',feature:'Sort new files',tool:'sort_new',card:'C1 → C3',route:'corner.sort (fileIds, placed[])',status:'built',tier:'card',kind:'data',page:'any',maps:'Plan.sortPlan() → card → Plan.sortNew(ids, to)',intent:'sort',say:['Sort my new files','/sort','sort my downloads'],expect:['C1','C3']});
T({id:'what_changed',section:'Today',feature:'What changed today',tool:'what_changed',card:'C8 → C3',route:'history.list',status:'route',tier:'instant',kind:'view',page:'any',maps:'Plan.recentSorted() + Plan.history()',
 re:/^(?:what did you (?:sort|do|change|move)(?: today| this week)?|what changed(?: today)?|what have you (?:done|sorted|changed)|what did tuck (?:sort|do)(?: today)?|history|recent changes)\??$/i,args:()=>({}),run:()=>sortedToday(),say:['what did you sort today?','what changed today'],expect:['C3']});
T({id:'attention',section:'Today',feature:'What needs me',tool:'attention',card:'C8',route:'attention',status:'built',tier:'instant',kind:'view',page:'any',maps:'Plan.counts() · Plan.needs() · TuckQueue',
 re:/^(?:anything need me|what needs (?:me|you|my attention)|what'?s waiting|attention)\??$/i,args:()=>({}),run:()=>attention(),say:['anything need me?','what needs me?'],expect:['C8']});
/* ---------- Needs You */
T({id:'next_questions',section:'Needs You',feature:'Next decision',tool:'next_questions',card:'C5',route:'questions.next',status:'built',tier:'instant',kind:'view',page:'any',maps:'Plan.needs()[0] → decision card',
 re:/^(?:what'?s next|next (?:question|decision)|review now|show (?:me )?the (?:next|first) (?:question|decision))\??$/i,args:()=>({}),run:()=>decisionReply(),say:["what's next?",'next decision'],expect:['C5','C8']});
T({id:'answer_question',section:'Needs You',feature:'Answer one',tool:'answer_question',card:'C5 → C3',route:'questions.answer',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.answerNeed(id, yes)',
 re:/^(?:answer (?:the )?(?:next|first) (?:question|card|decision) (yes|no)|(yes|no) to (?:the )?(?:next|first) (?:question|card|decision))$/i,args:m=>({yes:/yes/i.test(m[1]||m[2])}),
 run:a=>{const n=waitingNeeds()[0];if(!n)return attention();const row=Plan.answerNeed(n.id,a.yes);rerender();return doneCard('Needs You',`${a.yes?'Yes':'No'}: ${n.q}`,[row],{open:{label:'Needs You',hash:'needs'}})},say:['answer the next question yes','no to the first card'],expect:['C3','C8']});
T({id:'skip_question',section:'Needs You',feature:'Skip, tell Tuck',tool:'answer_question, card_agent',card:'C5',route:'questions.skip / tell',status:'built',tier:'instant',kind:'data',page:'any',maps:'TuckQueue.answer(id, skip)',
 re:/^skip (?:the |this )?(?:next |first )?(?:question|card|decision)$/i,args:()=>({}),
 run:()=>{const n=waitingNeeds()[0];if(!n)return attention();window.TuckQueue&&TuckQueue.answer(n.id,'skip');rerender();return decisionReply(line('skip',{q:esc(n.q)}))},say:['skip the next question','skip this decision'],expect:['C5','C8']});
T({id:'accept_all',section:'Needs You',feature:'Accept all',tool:'accept_all',card:'C8 → C3',route:'questions.acceptAll',status:'missing',tier:'card',kind:'data',page:'any',maps:'card → Plan.answerNeed(id, true) for each ticked',
 re:/^(?:accept all(?: needs[- ]you| questions| cards| waiting| decisions)?|yes to all(?: of them)?|say yes to everything)$/i,args:()=>({}),
 run:()=>{const n=waitingNeeds();if(!n.length)return attention();const c=mkCard('folders','Accept All Waiting',{rk:'needs',open:{label:'Needs You',hash:'needs'}});grp(c,{k:'chg',chg:true});
  n.forEach(x=>c.rows.push({id:nid('r'),k:'chg',op:{ty:'need',need:x.id,q:x.q,yes:x.yes},on:true}));return decorate(c,line('accept.all',{n:n.length}),['What’s next?'])},say:['yes to all of them','accept all needs-you'],expect:['C2','C8']});
/* ---------- Edit Folders and Finder */
T({id:'organise',section:'Edit Folders',feature:'Organise a folder',tool:'ways_to_arrange, plan_folder, folder_plan',card:'C2 (ways first)',route:'organise.arrange, arrange_plan.make',status:'built',tier:'card',kind:'data',page:'any',maps:'one question (ways) → Plan.draftArrange → card',intent:'arrange',say:['organise Trips','help me organise PHYS 1401'],expect:['ask','C2']});
T({id:'plan_change',section:'Edit Folders',feature:'Edit the plan',tool:'plan_change',card:'C2 updates in place',route:'plan.change, plan.view',status:'built',tier:'instant',kind:'view',page:'any',maps:'edits the card on screen (rename, leave out, only, fewer, by…)',
 re:/^(?:call it|name it|rename it(?: to)?)\s+(.+)$|^(?:leave out|leave|skip|without|not)\s+(?:the\s+)?(.+)$|^only (?:the\s+)?(.+)$|^(fewer|more) (?:new )?folders$/i,args:m=>({name:m[1],leave:m[2],only:m[3],fm:m[4]}),run:a=>planChange(a),say:['call it Lab Reports','leave the PDFs'],expect:['line']});
T({id:'arrange_by',section:'Edit Folders',feature:'Arrange by thing / year / month / kind',tool:'ways_to_arrange',card:'C2',route:'organise.arrange.layout',status:'built',tier:'card',kind:'data',page:'any',maps:'Plan.draftArrange(id, way) → card',intent:'arrange',say:['arrange ENGI 1006 by kind','organise Trips by year'],expect:['C2']});
T({id:'rename_folder',section:'Edit Folders',feature:'Rename a folder',tool:'edit_plan',card:'C2',route:'folder.edit, plan.edit',status:'built',tier:'card',kind:'data',page:'any',maps:'card → Plan.applyMine([rename])',intent:'rename',say:['rename ECON 2257 to Economics','call Music as Songs'],expect:['C2']});
T({id:'move_folder',section:'Edit Folders',feature:'Move a folder',tool:'edit_plan',card:'C2',route:'folder.edit',status:'built',tier:'card',kind:'data',page:'any',maps:'card → Plan.applyMine([putInside])',intent:'move',say:['move Robotics club into Studying','put Music in Projects'],expect:['C2','line']});
T({id:'merge',section:'Edit Folders',feature:'Merge folders',tool:'edit_plan',card:'C2',route:'folder.edit',status:'built',tier:'card',kind:'data',page:'any',maps:'card → Plan.applyMine([merge])',intent:'merge',say:['merge Cover letters into Applications','combine Timesheets with Invoices'],expect:['C2']});
T({id:'new_folder',section:'Edit Folders',feature:'New folder',tool:'edit_plan',card:'C2',route:'plan.edit new_folder',status:'built',tier:'card',kind:'data',page:'any',maps:'card → Plan.applyMine([newFolder])',intent:'newFolder',say:['new folder Drafts in Resumes','make a folder called Receipts in Bills'],expect:['C2']});
T({id:'hide_folder',section:'Edit Folders',feature:'Hide or show a folder',tool:'edit_plan',card:'C2',route:'folder.edit hide',status:'built',added:true,tier:'card',kind:'data',page:'any',maps:'card → Plan.applyMine([hide | show])',intent:'hide',say:['hide Fitness','hide Music'],expect:['C2']});
T({id:'split',section:'Edit Folders',feature:'Split a folder',tool:'rearrange_area',card:'C2',route:'resort.start (suggest_subfolders)',status:'built',tier:'card',kind:'data',page:'any',maps:'Plan.draftSplit → card → Plan.applyNow',intent:'split',say:['split Trips','/split Trips'],expect:['C2']});
T({id:'fewer_folders',section:'Edit Folders',feature:'Fewer or more folders',tool:'plan_change (hint)',card:'C2 regenerated',route:'arrange_plan.make with hint',status:'missing',tier:'instant',kind:'view',page:'any',maps:'Refine ⌄ on the card',re:/^(fewer|more) (?:new )?folders(?: please)?$/i,args:m=>({fm:lc(m[1])}),run:a=>planChange(a),say:['fewer folders','more folders'],expect:['line']});
T({id:'set_depth',section:'Edit Folders',feature:'Folder depth',tool:'set_depth',card:'C6',route:'limits depth',status:'built',tier:'instant',kind:'view',page:'tuck',hash:'prefs/limits',maps:'st.depth · Settings › Limits',
 re:/^(?:only (\d) levels|(?:let|make|allow) folders? (?:go )?(?:up to )?(\d) (?:levels )?deep|folder depth (\d))$/i,args:m=>({n:Math.max(2,Math.min(8,+(m[1]||m[2]||m[3])))}),
 opts:[2,3,4,5,6].map(n=>({label:String(n),a:{n}})),get:()=>({n:G('st').depth}),set:a=>{G('st').depth=a.n},done:a=>`Folders go up to ${a.n} levels deep`,probe:a=>`st.depth===${a.n}`,say:['only 3 levels','let folders go 5 levels deep']});
T({id:'why_here',section:'Edit Folders',feature:'Why is a file here',tool:'why_here',card:'C7',route:'file.why',status:'built',tier:'instant',kind:'view',page:'any',maps:'node.why · name match',intent:'qWhy',say:['why is Lecture 1 Kinematics.pdf in PHYS 1401?','why is Labs here'],expect:['C7','C8']});
T({id:'place_files',section:'Edit Folders',feature:'Move a file',tool:'place_files',card:'C7 → C3',route:'place',status:'built',tier:'card',kind:'data',page:'any',maps:'card → Plan.applyNow([moveFiles])',intent:'move',say:['move Lab 8 prelab to PHYS 1401','put Invoice 0044 in Invoices'],expect:['C1','C3']});
T({id:'folder_setting',section:'Edit Folders',feature:'Keep or split per folder (Keep As Is)',tool:'folder_setting',card:'C6',route:'folders.setting',status:'missing',tier:'instant',kind:'data',page:'any',maps:'Plan.setKeep(id, on)',intent:'keep',say:['keep Robotics club as it is',"don't touch Lease"],expect:['C3']});
T({id:'unkeep',section:'Edit Folders',feature:'Let Tuck change it again',tool:'folder_setting',card:'C6',route:'folders.setting',status:'missing',added:true,tier:'instant',kind:'data',page:'any',maps:'Plan.setKeep(id, false)',
 re:/^(?:let tuck change|stop keeping|turn off keep as is (?:for|on))\s+(.+?)(?:\s+again)?(?:\s+as is)?$/i,args:m=>({q:m[1]}),
 run:a=>{const id=nodeArg(a.q)||(findFiles(a.q)[0]);if(!id)return say(noFolder(a.q));const x=V().node(id)||V().file(id);if(!Plan.isKept(id))return listCard(`${x.name}`,[{ic:'push-pin-slash',name:x.name,sub:'Not Keep As Is'}],{label:'Edit Folders',hash:'edit',sel:{type:V().node(id)?'node':'file',id}},`${esc(x.name)} isn’t Keep As Is, so I can already change it.`);
  const row=Plan.setKeep(id,false);return doneCard('Keep As Is Off',`Keep As Is Off: ${x.name}`,[row],{say:line('unkeep',{a:bold(x.name)}),open:{label:'Edit Folders',hash:'edit',sel:{type:V().node(id)?'node':'file',id}}})},say:['let tuck change Lease again','turn off keep as is for Lease'],expect:['C3','C8']});
T({id:'go_back',section:'Edit Folders',feature:'Go back to an earlier layout',tool:'go_back',card:'C8 → C3',route:'layouts.restore',status:'built',tier:'card',kind:'data',page:'any',maps:'Plan.history() rows → Plan.undoApply(row)',
 re:/^(?:go back to (?:an )?(?:earlier|yesterday'?s|last week'?s|the old|my old) (?:layout|folders)|earlier layouts|show (?:me )?(?:earlier|old) layouts)$/i,args:()=>({}),run:()=>goBack(),say:["go back to yesterday's folders",'show earlier layouts'],expect:['C8']});
T({id:'list_folders',section:'Edit Folders',feature:'Copy outline as text',tool:'list_folders',card:'C8 (Copy)',route:'tree.outline',status:'built',tier:'instant',kind:'view',page:'any',maps:'Plan.view() outline',
 re:/^(?:give me|show me|copy) (?:my |the )?folder (?:list|outline|tree)$|^list (?:my |all )?folders$/i,args:()=>({}),run:()=>outline(),say:['give me my folder list','list my folders'],expect:['C8']});
T({id:'edit_view',section:'Edit Folders',feature:'Graph / Columns view',tool:'open_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'edit',maps:'WB.view · view switch',
 re:/^(?:show|switch to|use) (?:edit folders (?:as |in )?)?(?:the )?(tree|columns|graph)(?: view)?(?: in edit folders)?$/i,args:m=>({v:lc(m[1])}),opts:['tree','columns','graph'].map(v=>({label:cap(v),a:{v}})),
 get:()=>({v:G('WB').view}),set:a=>{const W=G('WB');W.view=a.v;G('wbSave')&&G('wbSave')()},done:a=>`Edit Folders: ${cap(a.v)}`,probe:a=>`WB.view==='${a.v}'`,say:['switch to the graph view','show edit folders as columns']});
T({id:'edit_levels',section:'Edit Folders',feature:'How much of the tree shows',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'edit',maps:'WB.openTo · Show ⌄',
 re:/^show (main folders only|(\d) levels?|all levels)(?: in edit folders)?$/i,args:m=>({n:/main/i.test(m[1])?1:/all/i.test(m[1])?0:+m[2]}),opts:[[1,'Main'],[2,'2'],[3,'3'],[0,'All']].map(([n,l])=>({label:l,a:{n}})),
 get:()=>({n:G('WB').openTo}),set:a=>{const W=G('WB');W.openTo=a.n;G('wbSave')&&G('wbSave')()},done:a=>a.n===0?'Edit Folders: all levels':a.n===1?'Edit Folders: main folders only':`Edit Folders: ${a.n} levels`,probe:a=>`WB.openTo===${a.n}`,say:['show 3 levels in edit folders','show main folders only']});
T({id:'edit_open',section:'Edit Folders',feature:'Open in Edit Folders',tool:'open_item',card:'C8',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'any',maps:'wbSelect({type, id})',
 re:/^(?:open|show|select)\s+(.+?)\s+in edit folders$/i,args:m=>({q:m[1]}),run:a=>{const id=nodeArg(a.q);const f=!id&&findFiles(a.q)[0];if(!id&&!f)return say(noFolder(a.q));const sel=id?{type:'node',id}:{type:'file',id:f};openIn({hash:'edit',sel});return say(line('opening',{a:`${esc(id?V().node(id).name:V().file(f).name)} in Edit Folders`}))},
 probe:a=>`WB.sel&&WB.sel.id===${JSON.stringify(nodeArg(a.q)||'')}`,say:['open PHYS 1401 in edit folders','show Trips in edit folders']});
T({id:'edit_apply',section:'Edit Folders',feature:'Pending changes, Apply',tool:'apply_pending',card:'C2 → C3',route:'plan.apply',status:'built',added:true,tier:'card',kind:'data',page:'any',maps:'card → Plan.apply()',re:/^apply (?:the |my )?(?:waiting |pending )?changes$|^apply edit folders$/i,args:()=>({}),
 run:()=>{const p=Plan.pending();if(!p.length)return listCard('Waiting Changes',[{ic:'check',name:'No Changes Waiting',sub:'Make one in Edit Folders, or type it here'}],{label:'Edit Folders',hash:'edit'},'Nothing’s waiting in Edit Folders.');
  const c=mkCard('folders','Apply Waiting Changes',{rk:'apply'});grp(c,{k:'chg',chg:true});p.forEach(o=>c.rows.push({id:nid('r'),k:'chg',op:{ty:'pend',text:o.text,sub:o.sub,pid:o.id},on:true,locked:false}));c.rows.push({id:nid('r'),k:'chg',op:{ty:'apply',n:p.length,text:Plan.summary().line},on:true});return decorate(c,`${pl(p.length,'change')} ${p.length===1?'waits':'wait'} in Edit Folders.`,['Discard the changes'])},say:['apply my changes','apply edit folders'],expect:['C2','C8']});
T({id:'edit_discard',section:'Edit Folders',feature:'Discard waiting changes',tool:'plan_discard',card:'C2',route:'plan.discard',status:'built',added:true,tier:'ask',kind:'data',page:'any',maps:'card → Plan.discard() (Undo: Plan.restore)',re:/^discard (?:the |my )?(?:waiting |pending )?changes$/i,args:()=>({}),
 run:()=>{const p=Plan.pending();if(!p.length)return listCard('Waiting Changes',[{ic:'check',name:'No Changes Waiting'}],{label:'Edit Folders',hash:'edit'},'Nothing’s waiting in Edit Folders.');const c=mkCard('folders','Discard Waiting Changes',{rk:'discard'});grp(c,{k:'chg',chg:true});c.rows.push({id:nid('r'),k:'chg',op:{ty:'discard',n:p.length},on:true});return decorate(c,'This one always asks first.')},say:['discard the changes','discard my pending changes'],expect:['C2','C8']});
T({id:'finder_mode',section:'Finder',feature:'Sorted by Tuck switch',tool:'show_sorted',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'finder',maps:'setMode(sorted | real)',
 re:/^(?:show |switch (?:finder )?to )?(sorted by tuck|real folders|folders on disk)(?: in finder)?$|^finder: (sorted|real)$/i,args:m=>({m:/sort/i.test(m[1]||m[2])?'sorted':'real'}),opts:[{label:'Sorted by Tuck',a:{m:'sorted'}},{label:'Real folders',a:{m:'real'}}],
 get:()=>({m:G('S').mode}),set:a=>G('setMode')(a.m),done:a=>a.m==='sorted'?'Finder: Sorted by Tuck':'Finder: real folders',probe:a=>`S.mode==='${a.m}'`,say:['show sorted by tuck in finder','switch finder to real folders']});
T({id:'finder_view',section:'Finder',feature:'Icons, List, Columns, Gallery',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'finder',maps:'setView(v)',
 re:/^(?:show )?(?:finder )?(?:as )?(icons|list|columns|gallery)(?: view)? in finder$|^finder as (icons|list|columns|gallery)$/i,args:m=>({v:lc(m[1]||m[2])}),opts:['icons','list','columns','gallery'].map(v=>({label:cap(v),a:{v}})),
 get:()=>({v:G('S').view}),set:a=>G('setView')(a.v),done:a=>`Finder: ${cap(a.v)}`,probe:a=>`S.view==='${a.v}'`,say:['finder as list','show gallery view in finder']});
T({id:'finder_preview',section:'Finder',feature:'Preview pane',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'finder',maps:'setSide(on)',
 re:/^(show|hide) (?:the )?preview(?: pane)?(?: in finder)?$/i,args:m=>({on:/show/i.test(m[1])}),opts:[{label:'Show',a:{on:true}},{label:'Hide',a:{on:false}}],
 get:()=>({on:!!G('S').pv}),set:a=>G('setSide')(a.on),done:a=>a.on?'Preview pane: shown':'Preview pane: hidden',probe:a=>`S.pv===${a.on}`,say:['hide the preview pane','show preview in finder']});
T({id:'finder_place',section:'Finder',feature:'Open a place',tool:'open_item',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'finder',maps:'go(r:…)',
 re:/^(?:open|show|go to) (downloads|desktop|documents) in finder$/i,args:m=>({p:cap(lc(m[1]))}),opts:['Downloads','Desktop','Documents'].map(p=>({label:p,a:{p}})),
 get:()=>({p:(String(G('S').loc).match(/(Downloads|Desktop|Documents)/)||[])[1]||'Downloads'}),set:a=>G('go')('r:Users/joseph/'+a.p),done:a=>`Finder: ${a.p}`,probe:a=>`S.loc.includes('${a.p}')||String(S.place).includes('${a.p}')`,say:['open downloads in finder','show desktop in finder']});
/* ---------- Re-sort */
T({id:'rearrange_area',section:'Re-sort',feature:'Re-sort some folders',tool:'rearrange_area',card:'Question → C4 → C2',route:'resort.start (nodeIds, reach)',status:'built',tier:'card',kind:'data',page:'any',maps:'how far? → Resort._planFor(reach) → card',intent:'resort',say:['re-sort PHYS 1401','/resort Trips'],expect:['ask','C2']});
T({id:'resort_new',section:'Re-sort',feature:'Re-sort new files only',tool:'rearrange_area (scope new)',card:'C4 → C2',route:'resort.start scope new',status:'built',tier:'card',kind:'data',page:'any',maps:'Plan.sortPlan() card',
 re:/^re-?sort (?:what came in|the new files|new files)(?: this week| today)?$/i,args:()=>({}),run:()=>reply0('sort new files'),say:['re-sort what came in this week','re-sort the new files'],expect:['C1','C3']});
T({id:'estimate',section:'Re-sort',feature:'Cost before a big re-sort',tool:'estimate',card:'C8',route:'resort.estimate, limits.estimate',status:'route',tier:'instant',kind:'view',page:'any',maps:'Resort._scope(…) counts',
 re:/^(?:how long will it take|how much will (?:it|that) cost|estimate(?: a)?(?: re-?sort)?(?: of (.+))?|how long to re-?sort (.+))\??$/i,args:m=>({q:m[1]||m[2]||''}),run:a=>estimate(a),say:['how long will it take?','how long to re-sort Work'],expect:['C8']});
T({id:'stop',section:'Re-sort',feature:'Stop',tool:'stop',card:'C4 ends → C3',route:'scan.stop, chat.cancel',status:'built',tier:'instant',kind:'data',page:'any',maps:'card.stop',re:/^(?:stop|stop it|cancel)$/i,args:()=>({}),
 run:(a,o)=>{const ms=o&&o.thread?o.thread.msgs():[];const c=ms.map(m=>m.bot&&m.bot.card).filter(x=>x&&x.state==='running').pop();if(c){c.stop=true;return say('Stopping. The card shows what was done.',{chips:['What changed?']})}return listCard('Running',[{ic:'stop-circle',name:'Nothing Running'}],null,'Nothing’s running, so nothing to stop.')},say:['stop','cancel'],expect:['line','C8']});
T({id:'resort_wizard',section:'Re-sort',feature:'Open the Re-sort wizard',tool:'open_item',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'resort',maps:'Resort.open({inline}) on #resort',re:/^(?:open|start) (?:the )?re-?sort(?: wizard| with tuck)?$/i,args:()=>({}),
 get:()=>({}),set:()=>{},done:()=>'Re-sort wizard: open',probe:()=>`location.hash==='#resort'`,say:['open the re-sort wizard','start re-sort with tuck']});
/* ---------- Tidy Up */
T({id:'cleanup',section:'Tidy Up',feature:'Clean up',tool:'cleanup, plan_tidy',card:'C1 → C3',route:'tidy.duplicates, space.list, corner.trash',status:'built',tier:'ask',kind:'data',page:'any',maps:'one question → Trash card → Plan.applyNow([trash]) + TuckQueue.trash',intent:'cleanAsk',say:['What can I clean up?','Clean up'],expect:['ask']});
T({id:'clean_kind',section:'Tidy Up',feature:'Clean up one kind',tool:'cleanup',card:'C1 → C3',route:'corner.trash',status:'built',tier:'ask',kind:'data',page:'any',maps:'Trash card',intent:'clean',say:['clean up old installers','clean up duplicates'],expect:['C1','C8']});
T({id:'show_copies',section:'Tidy Up',feature:'Exact copies',tool:'show_copies',card:'C9',route:'tidy.duplicates',status:'built',tier:'instant',kind:'view',page:'any',maps:'TIDY_GROUPS dup',re:/^(?:show (?:me )?(?:the )?(?:copies|duplicates)|which files are copies|exact copies)\??$/i,args:()=>({}),run:()=>compareCopies(),say:['show me copies','exact copies'],expect:['C9','C8']});
T({id:'remove_empty',section:'Tidy Up',feature:'Empty folders',tool:'remove_empty',card:'C1 → C3',route:'tidy.removeEmpty',status:'route',tier:'ask',kind:'data',page:'any',maps:'card → Plan.applyNow([deleteEmpty])',intent:'clean',say:['remove empty folders','clean up empty folders'],expect:['C1','C8']});
T({id:'old_versions',section:'Tidy Up',feature:'Old versions',tool:'newest_version, archive_versions',card:'C9 → C2',route:'versions.list',status:'missing',tier:'card',kind:'data',page:'any',maps:'C9 → card: Old Resumes (accept or new folder) + moveFiles',
 re:/^(?:put (?:my )?old (resumes|versions)(?: of (.+?))? away|old versions(?: of (.+))?|which (?:resume|version) is newest)\??$/i,args:m=>({q:m[2]||m[3]||'resume'}),run:a=>compareVersions(a),say:['put old resumes away','old versions of resume'],expect:['C9']});
T({id:'trash_files',section:'Tidy Up',feature:'Move named files to the Trash',tool:'cleanup',card:'C1 → C3',route:'corner.trash',status:'built',added:true,tier:'ask',kind:'data',page:'any',maps:'card → Plan.applyNow([trash])',intent:'trashFiles',say:['trash Zoom.dmg','trash Lab 3 draft.docx'],expect:['C1']});
T({id:'delete_empty',section:'Tidy Up',feature:'Remove one empty folder',tool:'remove_empty',card:'C1 → C3',route:'tidy.removeEmpty',status:'route',added:true,tier:'ask',kind:'data',page:'any',maps:'card → Plan.applyNow([deleteEmpty])',intent:'delete',say:['delete Music','remove Fitness'],expect:['C8','C1']});
/* ---------- Tuck Brain */
T({id:'show_in_brain',section:'Tuck Brain',feature:'Show in Brain',tool:'show_in_brain',card:'C8 link',route:'brain.focus',status:'missing',tier:'instant',kind:'view',page:'any',maps:'brain.focus(id) on brain.html',
 re:/^(?:show(?: me)?|find|focus(?: on)?|select)\s+(.+?)\s+(?:on|in) the (?:brain|map)$/i,args:m=>({q:strip(m[1])}),run:a=>{const id=nodeArg(a.q);if(PG()==='brain'){brain.focus(id||a.q);return listCard(`${cap(a.q)} on the Map`,[{ic:'graph',name:cap(a.q),sub:'Selected on the map'}],null,`Here’s ${esc(cap(a.q))} on the map.`)}
  return listCard(`${cap(a.q)} in Tuck Brain`,[{ic:'graph',name:id?V().node(id).name:cap(a.q),sub:id?`${V().total(id)} files · ${V().path(id).join(' › ')}`:'On the map'}],{label:'Tuck Brain',page:'brain',focus:id||a.q},'')},probe:()=>'true',say:['show me Work in the brain','find Trips on the map'],expect:['C8']});
T({id:'list_related',section:'Tuck Brain',feature:'Related files',tool:'list_related',card:'C8',route:'graph.related',status:'built',tier:'instant',kind:'view',page:'any',maps:'shared name words',re:/^what goes with\s+(.+?)\??$|^(?:files )?related to\s+(.+?)\??$/i,args:m=>({q:m[1]||m[2]}),run:a=>related(a),say:['what goes with Lab 3?','related to Invoice 0043'],expect:['C8']});
T({id:'graph_links',section:'Tuck Brain',feature:'Links between files',tool:'graph_links',card:'C8 Accept / Reject',route:'graph.links',status:'built',tier:'card',kind:'data',page:'any',maps:'localStorage tuckLinks',re:/^link\s+(.+?)\s+(?:and|with|to)\s+(.+)$/i,args:m=>({a:m[1],b:m[2]}),run:a=>linkCard(a),say:['link Lab 3 data.xlsx and Lab 3.pdf','link Budget October.xlsx with Invoice 0043'],expect:['C8']});
T({id:'set_reading',section:'Tuck Brain',feature:'AI can read this folder',tool:'set_reading',card:'C6',route:'privacy.setItem',status:'built',tier:'ask',kind:'data',page:'any',maps:'Plan.setLevel(id, read | names | private)',
 re:/^(?:don'?t let (?:the )?ai read|stop (?:the )?ai reading|what can (?:the )?ai read in|reading level (?:for|of))\s+(.+?)\??$/i,args:m=>({q:m[1],deny:/don|stop/i.test(m[0])}),run:a=>readingCard(a),say:["don't let AI read Health",'reading level for Bills'],expect:['C6']});
T({id:'make_private',section:'Tuck Brain',feature:'Make private',tool:'mark_sensitive',card:'C7 → done',route:'privateFiles.addItems',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.setLevel(target, private)',intent:'private',say:['make Bills private','keep Orders private'],expect:['C3']});
T({id:'release',section:'Tuck Brain',feature:'Let Tuck read it',tool:'set_reading',card:'C6',route:'privacy.setItem',status:'built',added:true,tier:'ask',kind:'data',page:'any',maps:'card → Plan.setLevel(target, read)',intent:'release',say:['make Taxes 2025 readable','let tuck read Lease'],expect:['C2']});
T({id:'brain_colour',section:'Tuck Brain',feature:'Colour the map by',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'brain.colby(by) · Display ⌄',
 re:/^colou?r (?:the )?(?:brain|map) by (part(?: of life)?|life|file ?types?|types?|kinds?)$/i,args:m=>({by:/type|kind/.test(lc(m[1]))?'type':'part'}),opts:[{label:'Part of life',a:{by:'part'}},{label:'File type',a:{by:'type'}}],
 get:()=>({by:brain.look().colby}),set:a=>brain.colby(a.by),done:a=>`Map: coloured by ${a.by==='type'?'file type':'part of life'}`,probe:a=>`brain.look().colby==='${a.by}'`,say:['colour the brain by file type','color the map by part of life']});
T({id:'brain_files',section:'Tuck Brain',feature:'Files on the map',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'Display ⌄ › Files',
 re:/^(show|hide) files on the (?:brain|map)$/i,args:m=>({on:/show/i.test(m[1])}),opts:[{label:'Show',a:{on:true}},{label:'Hide',a:{on:false}}],
 get:()=>({on:brain.look().files}),set:a=>bcheck('#fshowf',a.on),done:a=>a.on?'Map: files shown':'Map: files hidden',probe:a=>`brain.look().files===${a.on}`,say:['hide files on the map','show files on the brain']});
T({id:'brain_people',section:'Tuck Brain',feature:'People on the map',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'Display ⌄ › People',
 re:/^(show|hide) people(?: on the (?:brain|map))?$/i,args:m=>({on:/show/i.test(m[1])}),opts:[{label:'Show',a:{on:true}},{label:'Hide',a:{on:false}}],
 get:()=>({on:brain.look().people}),set:a=>bcheck('#fshowp',a.on),done:a=>a.on?'Map: people shown':'Map: people hidden',probe:a=>`brain.look().people===${a.on}`,say:['hide people','show people on the map']});
T({id:'brain_unsure',section:'Tuck Brain',feature:'Unsure only',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'brain.filter(unsure | all)',
 re:/^(?:show (?:only )?(unsure)(?: things| files)?(?: on the (?:brain|map))?|(unsure) only|show everything on the (?:brain|map))$/i,args:m=>({on:!!(m[1]||m[2])}),opts:[{label:'Everything',a:{on:false}},{label:'Unsure only',a:{on:true}}],
 get:()=>({on:!!(document.getElementById('funs')||{}).checked}),set:a=>brain.filter(a.on?'unsure':'all'),done:a=>a.on?'Map: unsure only':'Map: everything',probe:a=>`document.getElementById('funs').checked===${a.on}`,say:['show only unsure','show everything on the map']});
T({id:'brain_key',section:'Tuck Brain',feature:'One part of life',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'Key chip › part of life (KEYPART)',
 re:new RegExp('^(?:show )?only ('+['Studying','Work','Job Search','Home and Money','Photos','Projects','Health'].join('|')+') on the (?:brain|map)$|^show all parts(?: of life)?(?: on the (?:brain|map))?$','i'),args:m=>({part:m[1]?(LIFE_AREAS.find(l=>l.name.toLowerCase()===lc(m[1]))||{}).id:''}),
 opts:[{label:'All',a:{part:''}},...(window.LIFE_AREAS||[]).slice(0,4).map(l=>({label:l.name,a:{part:l.id}}))],
 get:()=>({part:(()=>{try{return sessionStorage.getItem('tuckBot.brainKey')||''}catch(e){return ''}})()}),
 set:a=>{let cur='';try{cur=sessionStorage.getItem('tuckBot.brainKey')||''}catch(e){}if(cur===(a.part||''))return;const tap=id=>{const b=document.querySelector(`#fkchip [data-g="${id}"]`);b&&b.click()};if(cur)tap(cur);if(a.part)tap(a.part);try{sessionStorage.setItem('tuckBot.brainKey',a.part||'')}catch(e){}},
 done:a=>a.part?`Map: only ${(LIFE_AREAS.find(l=>l.id===a.part)||{}).name}`:'Map: every part of life',probe:a=>`sessionStorage.getItem('tuckBot.brainKey')==='${a.part||''}'&&!!document.querySelector('#fkchip [data-g="${a.part||'work'}"]')`,say:['only Work on the map','show all parts of life']});
T({id:'brain_zoom',section:'Tuck Brain',feature:'Zoom or fit',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'#zin · #zout · Fit to View',
 re:/^(zoom (in|out)(?: on the (?:brain|map))?|fit (?:the )?(?:brain|map)(?: to (?:the )?view)?)$/i,args:m=>({z:m[2]?lc(m[2]):'fit'}),opts:[{label:'Out',a:{z:'out'}},{label:'Fit',a:{z:'fit'}},{label:'In',a:{z:'in'}}],
 get:()=>({z:'fit'}),set:a=>bclick(a.z==='in'?'#zin':a.z==='out'?'#zout':'#fit'),done:a=>a.z==='fit'?'Map: fits the view':`Map: zoomed ${a.z}`,probe:()=>'true',say:['zoom in on the map','fit the map to view']});
T({id:'brain_time',section:'Tuck Brain',feature:'Brain on a past day',tool:'show_in_brain (date)',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'brain',maps:'brain.setDay(day) · time slider',
 re:/^show the (?:brain|map) (?:as it was )?(\d+) days ago$|^(?:brain|map) (\d+) days ago$|^show the (?:brain|map) (?:as it is )?(today|now)$/i,args:m=>({ago:m[3]?0:+(m[1]||m[2])}),opts:[60,30,7,0].map(d=>({label:d?`${d} days ago`:'Today',a:{ago:d}})),
 get:()=>({ago:61-(+(document.getElementById('scrubr')||{}).value||61)}),set:a=>brain.setDay(61-Math.min(61,a.ago)),done:a=>a.ago?`Map: ${a.ago} days ago`:'Map: today',probe:a=>`+document.getElementById('scrubr').value===${61-Math.min(61,a.ago)}`,say:['show the map 30 days ago','show the brain today']});
/* ---------- Diary */
T({id:'files_on_day',section:'Diary',feature:'A day’s files',tool:'files_on_day',card:'C8',route:'items by date',status:'missing',tier:'instant',kind:'view',page:'any',maps:'files with that date + Diary photos',
 re:new RegExp('^what did i (?:save|get|download)(?: on)? (\\d{1,2}) ('+MON3.join('|')+')[a-z]*\\??$|^files (?:from|on) (\\d{1,2}) ('+MON3.join('|')+')[a-z]*$','i'),args:m=>({d:+(m[1]||m[3]),mo:MON3.findIndex(x=>lc(x)===lc((m[2]||m[4]).slice(0,3)))}),run:a=>dayCard(a),say:['what did I save on 25 Oct?','files from 28 Oct'],expect:['C8']});
T({id:'photos_place',section:'Diary',feature:'Photos of a trip',tool:'find_files (place)',card:'C8',route:'search',status:'built',tier:'instant',kind:'view',page:'any',maps:'Diary photos by place',re:/^(?:photos|pictures) (?:from|of|at)\s+(.+)$/i,args:m=>({q:m[1]}),run:a=>placePhotos(a),say:['photos from Storm King','pictures from Montauk'],expect:['C8']});
const DIAF={all:'All',favourites:'Favourites',favorites:'Favourites',people:'People',pets:'Pets',trips:'Trips',screenshots:'Screenshots'};
T({id:'diary_filter',section:'Diary',feature:'One kind of photo',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'diary',maps:'st.dy.f · Diary chips',
 re:/^(?:show )?(?:only )?(all|favou?rites|people|pets|trips|screenshots)(?: photos)? in the diary$|^diary:? (?:only )?(all|favou?rites|people|pets|trips|screenshots)$/i,args:m=>({f:DIAF[lc(m[1]||m[2])]}),opts:['All','Favourites','People','Pets','Trips','Screenshots'].map(f=>({label:f,a:{f}})),
 get:()=>({f:G('st').dy.f}),set:a=>{G('st').dy.f=a.f},done:a=>`Diary: ${a.f==='All'?'every photo':a.f.toLowerCase()}`,probe:a=>`st.dy.f==='${a.f}'`,say:['only pets in the diary','show trips in the diary']});
T({id:'diary_jump',section:'Diary',feature:'Open the Diary at a month',tool:'open_item',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'diary',maps:'st.dy.i · timeline',
 re:new RegExp('^(?:open|show|go to|jump to) (?:the )?diary (?:at|in|to|from) ('+MONTHN.join('|')+'|'+MONTHN.map(x=>x.slice(0,3)).join('|')+')\\s+(20\\d\\d)$|^(?:diary|photos) (?:from|in) ('+MONTHN.join('|')+')\\s+(20\\d\\d)$','i'),
 args:m=>({mo:MONTHN.findIndex(x=>x.startsWith(lc(m[1]||m[3]).slice(0,3))),y:+(m[2]||m[4])}),
 get:()=>({i:G('st').dy.i}),set:a=>{const st=G('st');if(a.i!=null){st.dy.i=a.i;return}const D=G('D')||[];let best=null,bd=1e9;D.forEach(p=>{const d=Math.abs(p.d.getFullYear()*12+p.d.getMonth()-(a.y*12+a.mo));if(d<bd){bd=d;best=p}});if(best){st.dy.f='All';st.dy.i=best.i}},
 done:a=>a.i!=null?'Diary: where you were':`Diary: ${cap(MONTHN[a.mo])} ${a.y}`,probe:a=>`(()=>{const p=D.find(x=>x.i===st.dy.i);return !!p&&Math.abs(p.d.getFullYear()*12+p.d.getMonth()-(${a.y}*12+${a.mo}))<=2})()`,say:['open the Diary at October 2025','diary from march 2025']});
T({id:'diary_fav',section:'Diary',feature:'Favourite this photo',tool:'set_favourite',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'data',page:'tuck',hash:'diary',maps:'st.dy.fav',
 re:/^(?:favou?rite this photo|add (?:this|it|this photo) to favou?rites|unfavou?rite this photo)$/i,args:m=>({on:!/^unfav/i.test(m[0])}),opts:[{label:'Favourite',a:{on:true}},{label:'Not a favourite',a:{on:false}}],
 get:()=>({on:G('st').dy.fav.has(G('st').dy.i)}),set:a=>{const st=G('st');a.on?st.dy.fav.add(st.dy.i):st.dy.fav.delete(st.dy.i)},done:a=>a.on?'Photo: favourite':'Photo: not a favourite',probe:a=>`st.dy.fav.has(st.dy.i)===${a.on}`,say:['favourite this photo','add this photo to favourites']});
T({id:'diary_step',section:'Diary',feature:'Next or previous photo',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'diary',maps:'dstep(±1)',
 re:/^(next|previous|prev) photo$/i,args:m=>({d:/next/i.test(m[1])?1:-1}),opts:[{label:'Previous',a:{d:-1}},{label:'Next',a:{d:1}}],get:()=>({i:G('st').dy.i}),set:a=>{const st=G('st');if(a.i!=null){st.dy.i=a.i;return}const L=G('dlist')();const k=L.findIndex(p=>p.i===st.dy.i);const n=L[k+a.d];if(n)st.dy.i=n.i},
 done:a=>a.i!=null?'Diary: the photo you were on':a.d>0?'Diary: next photo':'Diary: previous photo',probe:()=>'true',say:['next photo','previous photo']});
/* ---------- History */
T({id:'undo',section:'History',feature:'Undo',tool:'undo',card:'C3',route:'journal.undo',status:'built',tier:'instant',kind:'data',page:'any',maps:'card Undo · Plan.undoApply(row)',intent:'undo',say:['undo','take that back'],expect:['C3','C8']});
T({id:'undo_kind',section:'History',feature:'Undo one kind of change',tool:'undo',card:'C3',route:'journal.undo',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.undoApply(latest matching row)',re:/^undo (?:the )?(?:last|latest) (sort|clean ?up|merge|rename|change)$/i,args:m=>({what:lc(m[1])}),
 run:a=>{const h=(Plan.history?Plan.history():[]).filter(r=>!r.undone);const r=a.what==='sort'?h.find(x=>Plan.isSortRow(x)||/^Sort/.test(x.text)):a.what.startsWith('clean')?h.find(x=>/Trash|empty folder/.test(x.text)):a.what==='change'?h[0]:h.find(x=>new RegExp(a.what,'i').test(x.text));
  if(!r)return listCard('History',[{ic:'clock-counter-clockwise',name:`No ${cap(a.what)} to Undo`}],{label:'History',hash:'history'},line('undo.none'));Plan.undoApply(r.id);fire();rerender();const b0=doneCard('Undone',`Undid “${r.text}”`,[],{say:line('undo'),redoOf:r.id,open:{label:'History',hash:'history',hist:r.id}});b0.mood='idle';return b0},say:['undo the last sort','undo the latest clean up'],expect:['C3','C8']});
T({id:'redo',section:'History',feature:'Redo',tool:'undo',card:'C3',route:'journal.undo',status:'built',added:true,tier:'instant',kind:'data',page:'any',maps:'Plan.undoApply(last undone row)',re:/^redo(?: (?:that|it|the last (?:one|change)))?$/i,args:()=>({}),
 run:()=>{const r=(Plan.history?Plan.history():[]).find(x=>x.undone);if(!r)return listCard('History',[{ic:'arrow-clockwise',name:'Nothing to Redo'}],{label:'History',hash:'history'},'Nothing to redo.');Plan.undoApply(r.id);fire();rerender();return doneCard('Redone',`Redid “${r.text}”`,[r],{say:line('redo'),open:{label:'History',hash:'history',hist:r.id}})},say:['redo','redo that'],expect:['C3','C8']});
T({id:'history_filter',section:'History',feature:'Filter History',tool:'set_view',card:'C6',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'tuck',hash:'history',maps:'st.hf · History chips',
 re:/^(?:show |filter )?(?:only )?(all|undone|tidy ?up|your choices|sorted by tuck|sorted)(?: changes)? in history$/i,args:m=>{const w=lc(m[1]);return {f:/undone/.test(w)?'undone':/tidy/.test(w)?'tidy':/choice/.test(w)?'you':/sort/.test(w)?'sorted':'all'}},
 opts:[['all','All'],['sorted','Sorted'],['you','Your choices'],['tidy','Tidy Up'],['undone','Undone']].map(([f,l])=>({label:l,a:{f}})),get:()=>({f:G('st').hf}),set:a=>{G('st').hf=a.f},done:a=>`History: ${({all:'all',sorted:'sorted by Tuck',you:'your choices',tidy:'Tidy Up',undone:'undone'})[a.f]}`,probe:a=>`st.hf==='${a.f}'`,say:['show only undone in history','show tidy up in history']});
/* ---------- Settings */
T({id:'set_watching',section:'Settings',feature:'Watching folders',tool:'set_watching',card:'C6',route:'watch.set',status:'missing',tier:'instant',kind:'view',page:'tuck',hash:'prefs/watching',maps:'Settings › Watching (st.watch)',
 re:/^(?:also )?(start|stop) watching (downloads|desktop|documents|pictures)$|^(?:also )?watch (downloads|desktop|documents|pictures)$/i,args:m=>({n:cap(lc(m[2]||m[3])),on:!/stop/i.test(m[1]||'')}),
 opts:['Downloads','Desktop','Documents','Pictures'].map(n=>({label:n,a:{n,toggle:true}})),get:()=>({on:null}),set:a=>{const st=G('st');const w=st.watch.find(x=>x.n===a.n);if(!w)return;if(a.toggle)w.on=!w.on;else if(a.on!=null)w.on=a.on},sel:()=>G('st').watch.filter(w=>w.on).map(w=>w.n),
 done:a=>a.toggle?`Watching: ${G('st').watch.filter(w=>w.on).map(w=>w.n).join(', ')}`:a.on?`Watching: ${a.n}`:`Not watching: ${a.n}`,probe:a=>`st.watch.find(x=>x.n==='${a.n}').on===${a.on}`,say:['also watch documents','stop watching desktop']});
T({id:'never_look',section:'Settings',feature:'Never look in',tool:'set_watching',card:'C6',route:'watch.set',status:'missing',tier:'instant',kind:'data',page:'any',maps:'tuckSettings.never → Plan.neverIn',
 re:/^never (?:look|go) in\s+(.+)$|^(?:stop never looking in|you may look in)\s+(.+?)(?: again)?$/i,args:m=>({q:strip(m[1]||m[2]),on:!!m[1]}),
 get:()=>({list:cfgVal('never')}),set:a=>{if(a.list){cfgSet('never',a.list);return}const L=cfgVal('never').slice();const i=L.findIndex(x=>lc(String(x).split(/\s*›\s*|\//).pop())===lc(a.q.split(/\s*›\s*|\//).pop()));if(a.on&&i<0)L.push(a.q);if(!a.on&&i>=0)L.splice(i,1);cfgSet('never',L)},
 list:()=>cfgVal('never'),done:a=>a.list?'Never Look In: as it was':a.on?`Never Look In: ${a.q} added`:`Never Look In: ${a.q} removed`,probe:a=>`(JSON.parse(localStorage.tuckSettings||'{}').never||[]).some(x=>x.toLowerCase().endsWith(${JSON.stringify(lc(a.q.split('/').pop()))}))===${a.on}`,say:['never look in Downloads/Old','never look in Code']});
T({id:'set_autonomy',section:'Settings',feature:'How much Tuck decides',tool:'set_autonomy',card:'C6 with preview',route:'limits.get/set',status:'route',tier:'instant',kind:'view',page:'any',maps:'Plan.setLimits(level) · Safe moves ⌄',
 re:/^(?:turn on|set|use|switch to|go to)\s+(ask each time|ask about everything|safe moves|do safe moves|ask when unsure|just do it|plan only)(?: mode)?$|^just sort new files without asking$/i,args:m=>{const w=lc(m[1]||'just do it');return {lv:/each|everything/.test(w)?'Ask About Everything':/safe|unsure/.test(w)?'Ask When Unsure':/just/.test(w)?'Just Do It':'Plan Only'}},
 opts:[['Ask About Everything','Ask each time'],['Ask When Unsure','Safe moves'],['Just Do It','Just do it'],['Plan Only','Plan only']].map(([lv,l])=>({label:l,a:{lv}})),
 preview:a=>{const wk=(Plan.recentSorted?Plan.recentSorted():[]).filter(r=>r.minsAgo<7*1440).reduce((n,r)=>n+r.n,0);return a.lv==='Just Do It'?`Last week this would have sorted ${wk} files without asking.`:a.lv==='Ask When Unsure'?`Last week: clear sorts of up to 20 files, ${wk} files in all.`:a.lv==='Plan Only'?'Nothing is sorted; plans wait in Edit Folders.':'Every change waits for you.'},
 get:()=>({lv:level()}),set:a=>{Plan.setLimits(a.lv);const st=G('st');if(st&&'ask' in st){st.ask=a.lv;rerender()}},done:a=>`Tuck: ${SHORT[a.lv]}`,probe:a=>`Plan.limits()==='${a.lv}'`,say:['turn on ask each time','just sort new files without asking']});
T({id:'set_names',section:'Settings',feature:'Names',tool:'set_names',card:'C6',route:'limits names',status:'missing',tier:'instant',kind:'view',page:'any',maps:'tuckSettings.naming',
 re:/^(?:use|set|switch to) (keep names|tidy names|date first)(?: naming)?$|^don'?t rename my files$/i,args:m=>({v:m[1]?m[1].replace(/\b\w/g,c=>c.toUpperCase()):'Keep Names'}),opts:['Keep Names','Tidy Names','Date First'].map(v=>({label:v,a:{v}})),
 get:()=>({v:cfgVal('naming')}),set:a=>cfgSet('naming',a.v),done:a=>`Names: ${a.v}`,probe:a=>`JSON.parse(localStorage.tuckSettings||'{}').naming==='${a.v}'`,say:["don't rename my files",'use tidy names']});
T({id:'set_ai_limit',section:'Settings',feature:'AI requests limit',tool:'set_ai_limit',card:'C6',route:'limits.today, limits.set',status:'route',tier:'instant',kind:'view',page:'tuck',hash:'prefs/limits',maps:'st.daily · Settings › Limits',
 re:/^(?:use less ai|use more ai|(?:set )?(?:the )?ai (?:limit|requests) (?:to )?(\d+))$/i,args:m=>({v:m[1]?String(+m[1]):/less/i.test(m[0])?'250':'1000'}),opts:['100','250','500','1000'].map(v=>({label:v,a:{v}})),
 preview:()=>{const st=G('st');return st?`${st.used} used today`:''},get:()=>({v:String(G('st').daily)}),set:a=>{G('st').daily=a.v},done:a=>`AI requests: ${a.v} a day`,probe:a=>`String(st.daily)==='${a.v}'`,say:['use less AI','set the ai limit to 100']});
T({id:'private_kind',section:'Settings',feature:'Private kinds',tool:'private_kind',card:'C6 with preview',route:'privateFiles.previewKind/saveKind',status:'built',tier:'instant',kind:'view',page:'tuck',hash:'prefs/privacy',maps:'Settings › Privacy › Private kinds (st.priv)',
 re:new RegExp('^(?:keep (?:anything |all )?|turn (on|off) private )('+['medical','legal','school records','taxes and government ids','bank and pay statements','passwords and keys','photos of documents'].join('|')+')(?: private)?$','i'),
 args:m=>({k:(window.PRIVATE_KINDS||[]).find(x=>lc(x.name)===lc(m[2])).name,on:m[1]?/on/i.test(m[1]):true}),opts:(window.PRIVATE_KINDS||[]).map(k=>({label:k.name,a:{k:k.name,toggle:true}})),
 get:()=>({on:null}),set:a=>{const st=G('st');const r=st.priv.find(x=>x[0]===a.k);if(!r)return;if(a.toggle)r[2]=!r[2];else r[2]=a.on},sel:()=>G('st').priv.filter(r=>r[2]).map(r=>r[0]),
 preview:a=>{const k=(window.PRIVATE_KINDS||[]).find(x=>x.name===a.k);return k?k.ex:''},done:a=>`${a.k}: ${a.on===false?'not private by kind':'private'}`,probe:a=>`st.priv.find(x=>x[0]==='${a.k}')[2]===${a.on}`,say:['keep anything medical private','turn on private photos of documents']});
T({id:'mark_sensitive',section:'Settings',feature:'Make one file private',tool:'mark_sensitive',card:'C7 → done',route:'privateFiles.addItems',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.setLevel(file, private)',intent:'private',say:['make Barnard club budget.xlsx private','keep Budget October.xlsx private'],expect:['C3','C8']});
T({id:'what_was_sent',section:'Settings',feature:'What was sent',tool:'what_was_sent',card:'C8',route:'sent.list',status:'built',tier:'instant',kind:'view',page:'any',maps:'each answer’s sent record',re:/^what (?:did you|have you) sen[dt] (?:to )?(?:the )?ai\??$|^what was sent(?: to ai)?\??$/i,args:()=>({}),run:(a,o)=>sentList(o),say:['what did you send to AI?','what was sent'],expect:['C8']});
T({id:'about_me',section:'Settings',feature:'Memory, About you',tool:'about_me',card:'C10',route:'memory.aboutYou',status:'built',tier:'instant',kind:'view',page:'any',maps:'PROFILE.lines · Memory.forget',re:/^what do you know about me\??$|^about me$|^my memory$/i,args:()=>({}),run:()=>profileCard(),say:['what do you know about me?','about me'],expect:['C10']});
T({id:'remember_rule',section:'Settings',feature:'Rules',tool:'remember_rule',card:'C6 (would catch N)',route:'rules.*',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.addRule(text)',re:/^always (?:put|sort|file) (.+?) (?:in|into|to) (.+)$/i,args:m=>({what:m[1],to:m[2]}),run:a=>ruleCard(a),say:['always put lecture slides in PHYS 1401','always sort receipts into Orders'],expect:['C6','C8']});
T({id:'list_rules',section:'Settings',feature:'List rules',tool:'list_rules',card:'C8',route:'rules.list',status:'built',tier:'instant',kind:'view',page:'any',maps:'Plan.rules()',re:/^(?:what|which) rules do (?:you|i) have\??$|^(?:list|show)(?: me)? (?:my )?rules$/i,args:()=>({}),run:()=>rulesList(),say:['what rules do you have?','show my rules'],expect:['C8']});
T({id:'correct_fact',section:'Settings',feature:'Correct a fact',tool:'correct_fact',card:'C6',route:'memory.correct',status:'built',added:true,tier:'approve',kind:'data',page:'any',maps:'Memory.forget + Memory.remember',
 re:/^correct (.+?) to (.+)$/i,args:m=>({k:m[1],v:m[2]}),say:['correct School to Northfield College'],
 run:a=>{const l=(window.PROFILE?PROFILE.lines:[]).find(x=>lc(x.k)===lc(a.k)||lc(x.v)===lc(a.k));if(!l||!window.Memory){const b0=listCard('About You',[{ic:'question',name:`Nothing Called ${a.k}`,sub:'Say which line'}],{label:'Memory',hash:'prefs/memory'},'I couldn’t find that line.');b0.mood='oops';return b0}
  Memory.forget(l.id);const said=`${l.k}: ${a.v}`;Memory.remember(said);return doneCard('Corrected',`${l.k}: ${a.v}`,[],{say:line('corrected'),fact:said,regone:l.id})}});
T({id:'forget_rule',section:'Settings',feature:'Forget a rule',tool:'forget_rule',card:'C8',route:'rules.forget',status:'built',tier:'instant',kind:'data',page:'any',maps:'Plan.removeRule(text)',re:/^forget (?:the )?rule (?:about )?(.+)$/i,args:m=>({q:m[1]}),
 run:a=>{const r=(Plan.rules?Plan.rules():[]).find(x=>lc(x.text).includes(lc(strip(a.q))));if(!r)return rulesList(`No rule about “${esc(a.q)}”.`);Plan.removeRule(r.text);const b0=doneCard('Rule Forgotten',`Forgot “${r.text}”`,[],{say:line('forgot'),unrule:r.text,open:{label:'Settings',hash:'prefs/you'}});b0.mood='idle';return b0},say:['forget the rule about receipts','forget rule lecture'],expect:['C3','C8']});
T({id:'remember_fact',section:'Settings',feature:'Remember a fact',tool:'remember_fact',card:'C10',route:'memory.add',status:'built',added:true,tier:'instant',kind:'data',page:'any',maps:'Memory.remember(text)',re:/^remember (?:that )?(.+)$/i,args:m=>({t:m[1]}),
 run:a=>{if(!window.Memory||!Memory.remember)return profileCard();Memory.remember(cap(a.t));return doneCard('Remembered',`In Memory: “${cap(a.t)}”`,[],{say:line('remember'),fact:cap(a.t),open:{label:'Settings',hash:'prefs/you'}})},say:['remember that Maya is my lab partner','remember I take PHYS 1401'],expect:['C3','C10']});
T({id:'set_notifications',section:'Settings',feature:'Notifications',tool:'set_notifications',card:'C6',route:'notify.set',status:'missing',tier:'instant',kind:'view',page:'any',maps:'tuckSettings.notify (+ st.notif on Settings)',
 re:/^only tell me when something needs me$|^(?:turn (off|on) notifications|notifications (off|on))$/i,args:m=>({v:/needs me/i.test(m[0])?'Only when needed':/off/i.test(m[1]||m[2]||'')?'Off':'Needs and summary'}),opts:['Only when needed','Needs and summary','Off'].map(v=>({label:v,a:{v}})),
 get:()=>({v:cfgVal('notify')}),set:a=>{cfgSet('notify',a.v);const st=G('st');if(st&&st.notif){st.notif.forEach((n,i)=>{n[2]=a.v==='Off'?false:a.v==='Only when needed'?i===0:i<3});rerender()}},done:a=>`Notifications: ${a.v}`,probe:a=>`JSON.parse(localStorage.tuckSettings||'{}').notify==='${a.v}'`,say:['only tell me when something needs me','turn off notifications']});
T({id:'set_appearance',section:'Settings',feature:'Appearance',tool:'set_appearance',card:'C6',route:'prefs.set',status:'missing',tier:'instant',kind:'view',page:'any',maps:'setTheme(t)',
 re:/^(?:switch to|use|turn on|go) (dark|light)(?: mode| theme)?$|^(dark|light) (?:mode|theme)$|^(?:match the mac|auto) theme$/i,args:m=>({t:lc(m[1]||m[2]||'auto')}),opts:['light','dark','auto'].map(t=>({label:cap(t),a:{t}})),
 get:()=>({t:THEME()}),set:a=>{const f=G('setTheme');if(typeof f==='function')f(a.t);if(a.t==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=a.t;const s=G('syncTheme');typeof s==='function'&&s()},
 done:a=>a.t==='auto'?'Appearance: follows your Mac':`Appearance: ${cap(a.t)}`,probe:a=>`(document.documentElement.dataset.theme||'auto')==='${a.t}'`,say:['dark mode','switch to light']});
T({id:'forget_conversations',section:'Settings',feature:'Data and reset',tool:'forget_conversations',card:'C6 with Confirm',route:'data.forget',status:'built',tier:'ask',kind:'data',page:'any',maps:'TuckChat.clear()',re:/^forget (?:this|our|the|my) chats?$|^clear (?:the )?chat$/i,args:()=>({}),
 run:()=>{const c=mkCard('folders','Forget Chats',{rk:'forget'});grp(c,{k:'chg',chg:true});c.rows.push({id:nid('r'),k:'chg',op:{ty:'forgetChat'},on:true});ROOM.calm=true;return decorate(c,'Nothing of this chat will be kept on this Mac. This can’t be undone.')},say:['forget my chats','clear the chat'],expect:['C2']});
T({id:'read_amount',section:'Settings',feature:'How much Tuck reads',tool:'set_reading',card:'C6',route:'privacy.setItem',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'tuckSettings.read',
 re:/^(?:tuck )?reads? (names only|the first page|first page|every page)$/i,args:m=>{const w=lc(m[1]);return {v:/names/.test(w)?'Names Only':/first/.test(w)?'First Page':'Every Page'}},opts:['Names Only','First Page','Every Page'].map(v=>({label:v,a:{v}})),
 get:()=>({v:cfgVal('read')}),set:a=>cfgSet('read',a.v),done:a=>`Tuck reads: ${a.v}`,probe:a=>`JSON.parse(localStorage.tuckSettings||'{}').read==='${a.v}'`,say:['read names only','tuck reads the first page']});
T({id:'pause',section:'Settings',feature:'Pause sorting',tool:'set_pause',card:'C6',route:'limits.set',status:'route',added:true,tier:'instant',kind:'view',page:'tuck',hash:'prefs/general',maps:'setPaused(on)',
 re:/^(pause|resume|unpause) sorting$/i,args:m=>({on:/^pause/i.test(m[1])}),opts:[{label:'On',a:{on:false}},{label:'Paused',a:{on:true}}],get:()=>({on:G('st').paused}),set:a=>{G('st').paused=a.on},done:a=>a.on?'Sorting: paused':'Sorting: on',probe:a=>`st.paused===${a.on}`,say:['pause sorting','resume sorting']});
T({id:'ai_onoff',section:'Settings',feature:'Use AI to understand files',tool:'set_reading',card:'C6',route:'privacy.setItem',status:'built',added:true,tier:'instant',kind:'view',page:'tuck',hash:'prefs/privacy',maps:'st.ai',
 re:/^turn (on|off) (?:the )?ai$/i,args:m=>({on:/on/i.test(m[1])}),opts:[{label:'On',a:{on:true}},{label:'Off',a:{on:false}}],get:()=>({on:G('st').ai}),set:a=>{G('st').ai=a.on},done:a=>a.on?'AI: on':'AI: off',probe:a=>`st.ai===${a.on}`,say:['turn off the ai','turn on ai']});
/* ---------- Chats */
T({id:'find_files',section:'Chats',feature:'Find a file',tool:'find_files',card:'C7 or C8',route:'search',status:'built',tier:'instant',kind:'view',page:'any',maps:'Plan.find(q)',intent:'qWhere',say:['where is my lease?','find resume'],expect:['C7','C8']});
T({id:'explain_file',section:'Chats',feature:'What is this file',tool:'explain_file, read_item',card:'C7',route:'read',status:'built',tier:'instant',kind:'view',page:'any',maps:'file facts + why',re:/^what(?:'s| is) (?:this|that)(?: (?:pdf|file|photo|doc))?\??$|^what(?:'s| is)\s+(.+\.[a-z]{2,4})\??$|^explain\s+(.+)$/i,args:m=>({q:m[1]||m[2]||''}),run:(a,o)=>explainFile(a,o),say:['what is Lab 3 data.xlsx?','explain Formula sheet.pdf'],expect:['C7','C8']});
T({id:'dates_due',section:'Chats',feature:'What’s due',tool:'dates_due',card:'C8',route:'dates',status:'built',tier:'instant',kind:'view',page:'any',maps:'dates in names and page 1 (readable files only)',re:/^what'?s due(?: this week| soon| next week)?\??$|^(?:any )?due dates\??$/i,args:()=>({}),run:()=>dueCard(),say:["what's due this week?",'due dates'],expect:['C8']});
T({id:'email_draft',section:'Chats',feature:'Draft an email',tool:'email_draft',card:'Draft',route:'mail.draft',status:'built (parked)',tier:'ask',kind:'data',page:'any',maps:'a draft; Tuck never sends',re:/^(?:email|send)\s+(.+?)\s+to\s+(.+)$/i,args:m=>({q:m[1],to:m[2]}),run:a=>draftCard(a),say:['email Lab 3.pdf to Maya','send Invoice 0043.pdf to Dana'],expect:['C8']});
T({id:'q_in',section:'Chats',feature:'What’s in a folder',tool:'find_files',card:'C8',route:'search',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'Plan.view() kids + files',intent:'qIn',say:["what's in Job Search?",'show me PHYS 1401'],expect:['C8']});
T({id:'q_downloads',section:'Chats',feature:'What did I download',tool:'find_files',card:'C8',route:'search',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'Downloads × Plan.dateRange',intent:'qDownloads',say:['what did I download for PHYS this week?','what did I download today?'],expect:['C8']});
T({id:'q_today',section:'Chats',feature:'What came in today',tool:'find_files',card:'C8',route:'search',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'files dated today',intent:'qToday',say:['what came in today?',"what's new"],expect:['C8']});
T({id:'q_size',section:'Chats',feature:'How big is a folder',tool:'find_files',card:'C8',route:'search',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'v.total · v.size',intent:'qSize',say:['how big is Photos?','how many files in Work'],expect:['C8']});
T({id:'q_private',section:'Chats',feature:'What’s private',tool:'private_kind',card:'C8',route:'privateFiles.list',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'v.level(id)',intent:'qPrivate',say:["what's private?",'what is private in Home and Money'],expect:['C8']});
T({id:'q_big',section:'Chats',feature:'Biggest files',tool:'find_files',card:'C8',route:'space.list',status:'built',added:true,tier:'instant',kind:'view',page:'any',maps:'size sort',intent:'qBig',say:['biggest files','largest files in Photos'],expect:['C8']});
T({id:'help',section:'Chats',feature:'What can you do',tool:'—',card:'C8',route:'—',status:'—',added:true,tier:'instant',kind:'view',page:'any',maps:'agent-map.html',intent:'help',say:['help','what can you do'],expect:['C8']});
const PAGES={today:['tuck','today'],'needs you':['tuck','needs'],chats:['tuck','chats'],diary:['tuck','diary'],'edit folders':['tuck','edit'],'re-sort':['tuck','resort'],history:['tuck','history'],'tidy up':['tuck','tidy'],settings:['tuck','prefs'],'settings memory':['tuck','prefs/you'],'settings privacy':['tuck','prefs/privacy'],brain:['brain'],'tuck brain':['brain'],finder:['finder'],'what tuck can do':['map']};
T({id:'open_page',section:'Chats',feature:'Open a page',tool:'open_item',card:'C8',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'any',maps:'location / hash',
 re:new RegExp('^(?:open|go to|show me|show)\\s+(?:the )?('+Object.keys(PAGES).sort((a,b)=>b.length-a.length).join('|')+')(?: page)?$','i'),args:m=>({p:lc(m[1])}),
 run:a=>{const [pg,h]=PAGES[a.p];if(pg==='map')setTimeout(()=>{location.href='agent-map.html'},250);else openIn({page:pg,hash:h});return say(line('opening',{a:esc(cap(a.p))}),{chips:[]})},probe:a=>PAGES[a.p][0]==='tuck'?`location.hash.startsWith('#${PAGES[a.p][1]}')`:`location.pathname.includes('${PAGES[a.p][0]}')`,say:['open history','go to the diary'],expect:['line']});
T({id:'launcher',section:'Chats',feature:'Open a launcher step',tool:'open_item',card:'C8',route:'—',status:'missing',added:true,tier:'instant',kind:'view',page:'any',maps:'TuckLauncher.open(step)',re:/^(?:open|show) (?:the )?(sort new files|clean up|needs you) (?:step|tile|panel)$/i,args:m=>({s:/sort/i.test(m[1])?'sort':/clean/i.test(m[1])?'clean':'needs'}),
 run:a=>{if(!window.TuckLauncher)return no('My menu isn’t on this page.');setTimeout(()=>{TuckChat.close();TuckLauncher.open(a.s)},80);return say('It’s open, just above me.',{chips:[]})},probe:()=>`!!document.querySelector('.tkl.on')`,say:['open the clean up panel','show the needs you tile'],expect:['line']});

/* ---------- card builders for the map's card types */
function listCard(title,rows,open,lead,extra){const c=mkCard('list',title,Object.assign({state:'done',rows,open:open||null,autoChecked:true},extra||{}));return {t:lead||'',card:c,chips:[]}}
function doneCard(title,head,rows,extra){const x=Object.assign({},extra||{});const lead=x.say||'';delete x.say;const c=mkCard('view',title,Object.assign({state:'done',hist:(rows||[]).filter(r=>r&&r.id&&r.id!=='none').map(r=>r.id),res:{head,groups:[]},autoChecked:true,latest:true},x));return {t:lead,card:c,chips:[]}}
const fileRow=(v,f,sub)=>({ic:isPriv(v,f.id)?'lock-simple':Plan.kind(f.name).ic,name:f.name,fid:f.id,sub:sub||`${live(v,f)?v.path(f.node).slice(-1)[0]:'Trash'} · ${fdate(f.id)}${isPriv(v,f.id)?' · private · matched by name':v.level(f.id).level!=='read'?' · matched by name':''}`});
const folderRow=(v,id,sub)=>({ic:'folder-simple',name:v.node(id).name,nid:id,sub:sub||`${v.total(id)} files · ${v.path(id).slice(0,-1).join(' › ')||'Top level'}`});
/* "What did you sort today?" (the map's worked example): one line, C3 sorted today grouped by folder, C8 Needs You */
function sortedToday(){const v=V();const all=Plan.recentSorted?Plan.recentSorted():[];let rs=all.filter(r=>r.day==='Today');const day=rs.length?'today':'in the last day';if(!rs.length)rs=all.filter(r=>r.minsAgo<1440);const by=new Map();
 rs.forEach(r=>r.files.forEach(fid=>{const f=v.file(fid);if(!f||!live(v,f))return;const k=f.node;if(!by.has(k))by.set(k,[]);by.get(k).push({fid,name:f.name,when:r.when,row:r.row||null})}));
 const n=[...by.values()].reduce((a,x)=>a+x.length,0),need=waitingNeeds().length;
 const c=mkCard('today',`Sorted ${tc(day)}, ${Pl(n,'file')}`,{state:'done',groups:[...by].map(([nid,fs])=>({nid,label:v.path(nid).join(' › '),files:fs})),open:{label:'History',hash:'history'},autoChecked:true});
 const out={t:n?line('sorted.day',{n,day,need}):`Nothing sorted ${day} yet. ${need?`${need} ${need===1?'needs':'need'} you.`:'Nothing needs you.'}`,card:c,chips:['Undo the last sort','What’s next?']};
 if(need)out.card2=needsList();return out}
function needsList(){const n=waitingNeeds();const v=V();const c=mkCard('list',`Needs You, ${n.length} Waiting`,{state:'done',rows:n.map(x=>({ic:'hand-tap',name:x.q,sub:`${x.k} · ${pl(x.n||1,'file')}`,need:x.id})),open:{label:'Needs You',hash:'needs'},action:{label:'Review Now',say:'What’s next?'},autoChecked:true});return c}
function attention(){const v=V();const c=Plan.counts();const q=window.TuckQueue?TuckQueue.get():{tidyMB:0};const pend=Plan.pending().length;
 const rows=[{ic:'tray-arrow-down',name:'New Files',sub:c.new?`${c.new} to sort`:'None',say:'Sort my new files',href:{hash:'today'}},{ic:'hand-tap',name:'Needs You',sub:c.needs?`${c.needs} waiting`:'None',say:'What’s next?',href:{hash:'needs'}},
  {ic:'broom',name:'Tidy Up',sub:q.tidyMB?`${q.tidyMB>=1000?(q.tidyMB/1000).toFixed(1)+' GB':q.tidyMB+' MB'} can go`:'Nothing',say:'What can I clean up?',href:{hash:'tidy'}},{ic:'folders',name:'Edit Folders',sub:pend?`${pl(pend,'change')} waiting`:'No changes waiting',say:pend?'Apply my changes':'',href:{hash:'edit'}}];
 const b0=listCard('What Needs You',rows,{label:'Today',hash:'today'},line('attn',{needs:c.needs,nw:c.new}));b0.chips=c.needs?['What’s next?']:c.new?['Sort new files']:['What came in today?'];return b0}
/* C5: one Needs You decision, as on the Needs You page: files, Now in → Goes to, Why, Yes / No / Choose another folder / Skip */
function decisionReply(lead,id){const W=waitingNeeds();const n=(id&&W.find(x=>x.id===id))||W[0];if(!n)return listCard('Needs You',[{ic:'check-circle',name:'Nothing Waiting',sub:'Every decision is answered'}],{label:'Needs You',hash:'needs'},line('needs.none'));
 const v=V();let files=[],from=[],to=[],isNew=false;
 if(n.node&&v.node(n.node)){const nd=v.node(n.node);files=v.files(n.node,true).map(f=>f.id);if(nd.sug){from=v.path(nd.parent);to=v.path(n.node);isNew=true}else{from=v.path(n.node);to=v.path(n.node)}}
 if(n.file&&v.file(n.file)){const f=v.file(n.file);files=[f.id];from=v.path(f.node);to=f.hint&&v.node(f.hint)?v.path(f.hint):from}
 const c=mkCard('decision',n.q,{state:'ready',need:n.id,type:n.k,files,on:files.slice(),from,to,isNew,facts:[['Why',n.why||''],n.dateLine?['Dates',n.dateLine]:null,['Confidence',`${n.pct||''}%`]].filter(Boolean),yes:n.yes||'Yes',no:n.no||'No',pos:`Decision ${W.indexOf(n)+1} of ${W.length}`,open:{label:'Needs You',hash:'needs',need:n.id},autoChecked:true});
 return {t:lead||line('next'),card:c,chips:['Yes to all of them','What needs me?']}}
function goBack(){const h=(Plan.history?Plan.history():[]).filter(r=>!r.undone&&(r.ops||[]).length).slice(0,6);if(!h.length)return listCard('Earlier Layouts',[{ic:'clock-counter-clockwise',name:'No Changes Yet',sub:'Your folders are as I first sorted them'}],{label:'History',hash:'history'},'Nothing to go back to.');
 return listCard('Earlier Layouts',h.map(r=>({ic:'clock-counter-clockwise',name:r.text,sub:Plan.when(Math.round((Date.now()-r.at)/6e4)),undoRow:r.id})),{label:'History',hash:'history'},'Pick a change to go back before it.')}
function outline(){const v=V();const lines=[];const walk=(id,d)=>{const n=v.node(id);if(!n||n.hidden||n.sug)return;lines.push('  '.repeat(d)+n.name+(v.total(id)?` (${v.total(id)})`:''));if(d<1)v.kids(id).forEach(k=>walk(k,d+1))};v.roots().forEach(r=>walk(r,0));
 return listCard('Your Folders',lines.map(l=>({ic:'folder-simple',name:l.trim(),sub:l.startsWith('  ')?'':'Top folder',indent:l.startsWith('  ')})),{label:'Edit Folders',hash:'edit'},line('tree'),{copy:lines.join('\n')})}
function estimate(a){const v=V();const id=a.q?nodeArg(a.q):null;const sc=window.Resort&&Resort._scope?Resort._scope(id?{scope:'folder_tree',nodeId:id}:{scope:'everything'}):{files:allFiles(v)};const n=sc.files.length;
 return listCard(`Re-sort ${id?v.node(id).name:'Everything'}`,[{ic:'files',name:'Files',sub:String(n)},{ic:'sparkle',name:'AI Requests',sub:`about ${Math.ceil(n/10)} (names only for private files)`},{ic:'timer',name:'Time',sub:`about ${Math.max(1,Math.round(n*.25/60))} min`}],{label:'Re-sort',hash:'resort'},line('estimate',{mins:Math.max(1,Math.round(n*.25/60)),req:Math.ceil(n/10)}),{action:{label:'Re-sort Now',say:`re-sort ${id?v.node(id).name:'Studying'}`}})}
function compareCopies(){const g=(window.TIDY_GROUPS||[]).find(x=>x.id==='dup');if(!g||!tidyLeft('dup'))return listCard('Exact Copies',[{ic:'copy',name:'No Copies Left',sub:'Tidy Up found none'}],{label:'Tidy Up',hash:'tidy'},'No copies left.');
 const c=mkCard('compare','Exact Copies',{state:'done',sides:g.items.map(([n,mb,w])=>({a:n,b:String(w).replace(/^Same as /,''),mb})),open:{label:'Tidy Up',hash:'tidy'},action:{label:'Put the Copies in the Trash',say:'clean up duplicates'},autoChecked:true});return {t:line('copies',{n:g.items.length}),card:c,chips:[]}}
function compareVersions(a){const v=V();const fs=allFiles(v).filter(f=>normN(f.name).includes(normN(a.q).replace(/s$/,''))).sort((x,y)=>y.at-x.at);if(fs.length<2)return listCard('Versions',[{ic:'files',name:`Only ${fs.length} file named like “${a.q}”`}],{label:'Edit Folders',hash:'edit'},'Nothing to put away.');
 const c=mkCard('compare',`Versions of ${cap(a.q)}`,{state:'done',newest:fs[0].id,older:fs.slice(1).map(f=>f.id),open:{label:'Edit Folders',hash:'edit',sel:{type:'file',id:fs[0].id}},action:{label:'Put Old Ones Away',ver:true},autoChecked:true});return {t:line('versions',{n:fs.length,a:esc(fs[0].name)}),card:c,chips:[]}}
function versionsPlan(c){const v=V();const ids=c.older.filter(id=>v.file(id)&&!plannable(v,id));if(!ids.length)return say('Nothing to put away.');const par=v.file(c.newest).node;const k='new:'+nid('g');
 const p=mkCard('arrange','Put Old Versions Away',{req:null,open:{label:'Edit Folders',hash:'edit',sel:{type:'node',id:par}}});const sugOld=v.kids(par).find(x=>v.node(x).sug&&/old/i.test(v.node(x).name));
 if(sugOld){const kk='acc:'+sugOld;grp(p,{k:kk,acc:sugOld,nw:{name:v.node(sugOld).name,parent:par}});ids.forEach(id=>{const r=rowFile(p,v.file(id).node===sugOld?kk:kk,id);if(r)r.from=v.node(par).name})}
 else{grp(p,{k,nw:{name:'Old '+cap(normN(v.file(c.newest).name).split(' ')[0])+'s',parent:par}});ids.forEach(id=>rowFile(p,k,id))}return decorate(p,line('versions.plan',{n:ids.length,a:esc(v.file(c.newest).name)}))}
function related(a){const v=V();const t=target(a.q);const base=t?(t.ty==='file'?v.file(t.id):t.ty==='files'?v.file(t.ids[0]):null):null;const words=normN((base?base.name:a.q).replace(/\.[^.]+$/,'')).split(' ').filter(w=>w.length>1&&!/^(pdf|the|and)$/.test(w));
 const fs=allFiles(v).filter(f=>!base||f.id!==base.id).map(f=>[f,words.filter(w=>normN(f.name).split(' ').includes(w)).length]).filter(x=>x[1]>=Math.min(2,words.length)).sort((x,y)=>y[1]-x[1]).slice(0,8).map(x=>x[0]);
 return listCard(`Goes with ${base?base.name:cap(a.q)}`,fs.length?fs.map(f=>fileRow(v,f)):[{ic:'graph',name:'Nothing Named Alike'}],{label:'Tuck Brain',page:'brain',focus:base?base.node:a.q},fs.length?line('related',{n:fs.length}):'Nothing else has a name like that.')}
function linkCard(a){const v=V();const x=findFiles(a.a)[0],y=findFiles(a.b)[0];if(!x||!y){const b0=listCard('Link Files',[{ic:'link-break',name:'Couldn’t Find Both Files'}],null,'I couldn’t find both files.');b0.mood='oops';return b0}
 const c=mkCard('list','Link These Files',{state:'done',rows:[fileRow(v,v.file(x)),fileRow(v,v.file(y))],link:[x,y],open:{label:'Tuck Brain',page:'brain',focus:v.file(x).node},action:{label:'Accept Link',link:true},autoChecked:true});return {t:'A link shows on the map and in Related.',card:c,chips:[]}}
function readingCard(a){const v=V();const id=nodeArg(a.q)||findFiles(a.q)[0];if(!id)return say(noFolder(a.q));const x=v.node(id)||v.file(id);const cur=v.level(id).level;
 const c=mkCard('setting',`What My AI May Read in ${x.name}`,{state:'done',tool:'__level',target:id,opts:[['read','Read Everything'],['names','Names Only'],['private','Private']].map(([l,label])=>({label,a:{l}})),cur:{l:cur},prev:{l:cur},preview:me(Plan.LEVELS[cur].line),open:{label:'Edit Folders',hash:'edit',sel:{type:v.node(id)?'node':'file',id}},autoChecked:true});
 const lead=a.deny?cur==='private'?'It’s already private, so it never goes to AI.':'Pick Private to stop it. Making something readable again always asks first.':'';return {t:lead,card:c,chips:[]}}
function sentList(o){const ms=o&&o.thread?o.thread.msgs():[];const rows=ms.filter(m=>m.bot&&m.bot.sent).slice(-8).reverse().map(m=>({ic:'paper-plane-tilt',name:`“${m.bot.sent.q}”`,sub:`${pl(m.bot.sent.names,'name')} · no contents · ${m.bot.sent.priv?pl(m.bot.sent.priv,'private file')+' held back':'no private files'}`}));
 return listCard('What Was Sent to AI',rows.length?rows:[{ic:'shield-check',name:'Nothing Yet in This Chat'}],{label:'Settings',hash:'prefs/privacy'},'Names and your words only. Private files never leave this Mac.')}
function profileCard(){const lines=(window.PROFILE?PROFILE.lines:[]).filter(l=>!(window.MEMSTATE&&MEMSTATE.gone&&MEMSTATE.gone.has(l.id)));const told=(window.MEMSTATE&&MEMSTATE.told)||[];
 const c=mkCard('profile','About You',{state:'done',rows:[...lines.map(l=>({id:l.id,k:l.k,v:l.v,src:(window.SRC&&SRC[l.src])||l.src,g:l.g})),...told.map(t=>({id:'t:'+t,k:'You told me',v:t,src:'Chat',g:'Told'}))],open:{label:'Settings',hash:'prefs/you'},autoChecked:true});return {t:line('about'),card:c,chips:['What rules do you have?']}}
function rulesList(lead){const r=Plan.rules?Plan.rules():[];return listCard('Rules',r.length?r.map(x=>({ic:'arrow-bend-down-right',name:x.text,sub:Plan.when(Math.round((Date.now()-x.at)/6e4)),rule:x.text})):[{ic:'list-checks',name:'No Rules Yet',sub:'Say “always put … in …”'}],{label:'Settings',hash:'prefs/you'},lead||(r.length?line('rules'):'No rules yet. Teach me one any time.'))}
function ruleCard(a){const v=V();const id=nodeArg(a.to);if(!id)return say(noFolder(a.to));const what=strip(a.what);const t=`${cap(what)} → ${v.path(id).join(' › ')}`;
 const words=normN(what).split(' ').filter(w=>w.length>2).map(w=>w.replace(/s$/,''));const catches=allFiles(v).filter(f=>f.node!==id&&words.some(w=>normN(f.name).includes(w)));
 return listCard('New Rule',[{ic:'arrow-bend-down-right',name:t,sub:`Would catch ${pl(catches.length,'file')} now`},...catches.slice(0,5).map(f=>fileRow(v,f,`Now in ${v.path(f.node).slice(-1)[0]} · would go to ${v.node(id).name}`))],{label:'Settings',hash:'prefs/you'},line('rule.lead'),{action:{label:'Save Rule',saveRule:t}})}
function dayCard(a){const v=V();const y=new Date(Plan.NOW).getFullYear();const from=new Date(a.mo>new Date(Plan.NOW).getMonth()?y-1:y,a.mo,a.d).getTime(),to=from+864e5;const fs=allFiles(v).filter(f=>f.at>=from&&f.at<to).sort((p,q)=>q.at-p.at);
 const label=`${a.d} ${MON3[a.mo]}`;return listCard(`Saved on ${label}`,fs.length?fs.map(f=>fileRow(v,f)):[{ic:'calendar-blank',name:'Nothing Saved That Day'}],{label:'Diary',hash:'diary'},fs.length?`${pl(fs.length,'file')} on ${label}.`:`Nothing saved on ${label}.`)}
function placePhotos(a){const D=G('D')||[];const ps=D.filter(p=>lc(p.place+' '+p.cap).includes(lc(strip(a.q)))).slice(0,8);
 return listCard(`Photos from ${cap(strip(a.q))}`,ps.length?ps.map(p=>({ic:'image',name:p.cap,sub:`${p.d.getDate()} ${MON3[p.d.getMonth()]} ${p.d.getFullYear()} · ${p.place}`,photo:p.i})):[{ic:'image',name:PG()==='tuck'?'No Photos From There':'Open the Diary to Look',sub:''}],{label:'Diary',hash:'diary',photo:ps[0]&&ps[0].i},ps.length?`${pl(ps.length,'photo')} from ${esc(cap(strip(a.q)))}.`:'')}
function explainFile(a,o){const v=V();let id=a.q?(findFiles(a.q)[0]||null):null;if(!id&&ctxSel&&ctxSel.type==='file')id=ctxSel.id;if(!id)return say('Which file? Name it, or use Ask Tuck ⌄ on the file.');return fileCardReply(id,line('explain'))}
function fileCardReply(id,lead){const v=V(),f=v.file(id);const c=mkCard('file',f.name,{state:'done',fid:id,open:{label:'Edit Folders',hash:'edit',sel:{type:'file',id}},autoChecked:true});return {t:lead||'',card:c,chips:[`What goes with ${f.name}?`]}}
function dueCard(){const v=V();const rows=[];const lab=allFiles(v).find(f=>/Lab4_handout|Lab 4 handout/i.test(f.name));if(lab)rows.push(Object.assign(fileRow(v,lab),{sub:'Due Fri 6 Nov · page 1 of the handout'}));
 allFiles(v).filter(f=>/Problem Set|PS\d/i.test(f.name)&&f.age<8).slice(0,3).forEach(f=>rows.push(Object.assign(fileRow(v,f),{sub:`No date in its name · ${v.path(f.node).slice(-1)[0]}`})));
 ROOM.calm=true;return listCard('Due Soon',rows.length?rows:[{ic:'calendar-blank',name:'Nothing Due That I Can See'}],{label:'Today',hash:'today'},line('due'))}
function draftCard(a){const v=V();const id=findFiles(a.q)[0];const f=id&&v.file(id);ROOM.calm=true;const c=mkCard('list','Draft Email',{state:'done',rows:[{ic:'user',name:`To: ${cap(strip(a.to))}`,sub:'Pick their address in Mail'},{ic:'paperclip',name:f?f.name:strip(a.q),sub:f?sizeTxt(f.size):'Not found'},{ic:'text-aa',name:`Subject: ${f?f.name.replace(/\.[^.]+$/,''):strip(a.q)}`,sub:'Hi, here it is.'}],copy:`Hi ${cap(strip(a.to))},\n\nHere is ${f?f.name:strip(a.q)}.\n`,autoChecked:true});
 return {t:line('draft'),card:c,chips:[]}}
/* typing while a card is on screen edits that card first (plan_change), the same as clicking on it */
function planChange(a){const th=window.TuckChat&&TuckChat.thread();let c=th&&lastReady(th);const d=th&&lastDone(th);
 /* the newest card on screen is the one being edited */
 if(c&&d){const ms=th.msgs(),at=x=>ms.findIndex(m=>m.bot&&m.bot.card===x);if(at(d)>at(c))c=null}
 if(!c){if(d)return resultChange(d,a,th);return no('There’s no plan on screen to change. Ask for one first, like “organise Trips”.',{chips:['Organise Trips']})}
 let msg='';if(a.name){const g=c.groups.find(x=>x.nw)||c.groups.find(x=>x.chg);if(g&&g.nw){g.nw.name=cap(String(a.name).trim().replace(/^["“]+|["”.!]+$/g,''));checkClash(c,g);msg=`It’s called ${esc(g.nw.name)} now.`}else{const r=c.rows.find(x=>x.op&&(x.op.ty==='rename'||x.op.ty==='newFolder'));if(r){r.op.name=cap(String(a.name).trim().replace(/^["“]+|["”.!]+$/g,''));clashRow(r);msg=`It’s called ${esc(r.op.name)} now.`}else msg='This card has no new folder to name.'}}
 else if(a.fm){if(a.fm==='fewer')refine(c,th,'fewer');else refine(c,th,'again');msg=a.fm==='fewer'?'Fewer new folders, up on the card.':'Planned again with more folders.'}
 else{const want=lc(strip(a.leave||a.only)).replace(/s$/,'');const ext={pdf:'pdf',doc:'docx',word:'docx',sheet:'xlsx',spreadsheet:'xlsx',photo:'heic',image:'png',screenshot:'screenshot'}[want]||null;
  const hit=r=>r.name&&(ext?(ext==='screenshot'?/^screenshot/i.test(r.name):lc(r.name).endsWith('.'+ext)||(ext==='heic'&&/\.(heic|png)$/i.test(r.name))):lc(r.name).includes(want));
  const rs=c.rows.filter(r=>!r.gone&&!blocked(c,r));const n=rs.filter(hit).length;if(!n)return no(`Nothing on the card matches “${esc(a.leave||a.only)}”.`,{chips:[]});
  rs.forEach(r=>{if(a.only)r.on=hit(r);else if(hit(r))r.on=false});msg=a.only?`Only ${pl(n,'file')} ticked.`:`Left out ${pl(n,'file')}.`}
 th.paint();th.save();return say(/no new folder|nothing|up on the card/i.test(msg)?msg:`${msg} The card above shows it.`,{chips:[],quiet:true})}

/* ---------- Open in [page]: lands on the same item (history row, folder, file, decision, photo, node) */
let ctxSel=null;
function openIn(o){if(!o)return;const pg=o.page||'tuck';if(pg!==PG()){try{sessionStorage.setItem('tuckBot.openin',JSON.stringify(o))}catch(e){}location.href=PAGEURL[pg]+(o.hash?'#'+o.hash:'');return}landOn(o)}
function landOn(o){const pg=o.page||'tuck';if(pg==='brain'){if(o.focus&&window.brain)brain.focus(o.focus);return}
 if(pg==='finder')return;
 if(o.need){const st=G('st'),D=G('DEC');if(st&&D){const i=D.findIndex(x=>x.id===o.need);if(i>=0)st.di=i}}
 if(o.photo!=null){const st=G('st');if(st&&st.dy){st.dy.f='All';st.dy.i=o.photo}}
 if(o.hash&&location.hash.slice(1)!==o.hash)location.hash=o.hash;else rerender();
 setTimeout(()=>{if(o.sel&&typeof window.wbSelect==='function')wbSelect(o.sel,true);
  if(o.hist){const H=G('H')||[];const h=H.find(x=>x.planId===o.hist);const el=h&&document.querySelector(`[data-undo="${h.id}"],[data-redo="${h.id}"]`);const row=el&&(el.closest('li,.hrow,.row,div'));if(row){row.classList.add('tkb-hl');row.scrollIntoView({block:'center'})}}},200)}
addEventListener('load',()=>{let o=null;try{o=JSON.parse(sessionStorage.getItem('tuckBot.openin')||'null');sessionStorage.removeItem('tuckBot.openin')}catch(e){}if(o)setTimeout(()=>landOn(o),PG()==='brain'?1300:500)});
function openOf(c){return openOf0(c)||{label:'Today',hash:'today'}}
function openOf0(c){if(c.open)return c.open;if(c.kind==='trash')return {label:'Tidy Up',hash:'tidy'};
 if(c.state==='done'||c.state==='undone'){const h=(c.hist||[])[0];if(h)return {label:'History',hash:'history',hist:h}}
 if(c.kind==='sort'||c.kind==='move'||c.kind==='arrange'||c.kind==='folders'){const g=c.groups.find(x=>x.to)||c.groups.find(x=>x.nw);const id=c.scope||(g&&(g.to||g.nw&&g.nw.parent));return {label:'Edit Folders',hash:'edit',sel:id?{type:'node',id}:null}}
 if(c.kind==='view'&&c.tool){const t=TOOL[c.tool];return {label:PAGENAME[t.page]==='Tuck'?(t.hash||'').split('/')[0].replace(/^\w/,x=>x.toUpperCase()).replace('Prefs','Settings').replace('Edit','Edit Folders'):PAGENAME[t.page]||'Settings',page:t.page==='any'?'tuck':t.page,hash:t.hash||'prefs'}}
 return null}
const openHtml=c=>{const o=openOf(c);if(!o)return '';return `<button type="button" class="btn sm ghost tkb-open" data-tkb-openin="${esc(JSON.stringify(o))}">Open in ${esc(o.label)}<i class="ph ph-arrow-up-right" aria-hidden="true"></i></button>`};

/* ---------- drawing the new card types */
function listHtml(c){const v=V();const rows=c.rows||[];const flt=rows.length>6;
 return `<div class="tkb-card done tkb-list" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b><small>${rows.length>1?rows.length:''}</small></div>${flt?`<input class="tkb-flt" data-tkb-flt placeholder="Filter" aria-label="Filter the list">`:''}
 <ul class="tkb-lr">${rows.map((r,i)=>`<li data-q="${esc(lc(r.name+' '+(r.sub||'')))}"${r.indent?' class="in"':''}><i class="ph ph-${esc(r.ic||'dot')}" aria-hidden="true"></i><span class="tkb-n"><button type="button" class="tkb-lname" ${r.fid?`data-tkb-file="${esc(r.fid)}"`:r.nid?`data-tkb-folder="${esc(r.nid)}"`:r.say?`data-tkb-say="${esc(r.say)}"`:r.need?`data-tkb-need="${esc(r.need)}"`:r.photo!=null?`data-tkb-photo="${r.photo}"`:''}>${esc(r.name)}</button>${r.sub?`<small>${esc(r.sub)}</small>`:''}</span>${r.undoRow?`<button class="btn sm ghost" type="button" data-tkb-backto="${esc(r.undoRow)}">Go Back</button>`:''}${r.rule?`<button class="btn sm ghost" type="button" data-tkb-forgetrule="${esc(r.rule)}">Forget</button>`:''}</li>`).join('')}</ul>
 ${c.peek?peekHtml(v,c.peek):''}<div class="tkb-acts">${c.copy?`<button class="btn sm" type="button" data-tkb-copy>${c.copied?'Copied':'Copy'}</button>`:''}${c.action?`<button class="btn sm${c.action.link||c.action.ver||c.action.saveRule?' pri':''}" type="button" data-tkb-act>${esc(c.linked?'Linked':c.action.label)}</button>`:''}<span class="sp"></span>${openHtml(c)}</div></div>`}
function todayHtml(c){const v=V();return `<div class="tkb-card done" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b></div><div class="tkb-res-g">${c.groups.map(g=>`<div class="tkb-rg"><h4><i class="ph-fill ph-folder-simple tkb-fi" aria-hidden="true"></i><span>${esc(g.label)}</span><small>${g.files.length}</small></h4><ul class="tkb-tb">${g.files.map(f=>{const back=(c.back||{})[f.fid];return `<li class="${back?'off':''}"><span>${esc(f.name)}</span><small>${esc(f.when)}</small>${back?'<small>Put back</small>':`<button class="tkb-ib" type="button" data-tkb-putback="${esc(f.fid)}" title="Put it back in No folder yet" aria-label="Undo ${esc(f.name)}"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i></button>`}</li>`}).join('')}</ul></div>`).join('')}</div>
 ${c.disk?'<p class="tkb-disk">My folders are a view. Nothing moved on disk.</p>':''}<div class="tkb-acts"><button class="btn sm" type="button" data-tkb-undoall>${c.allBack?'Redo All':'Undo All'}</button><span class="sp"></span>${openHtml(c)}</div></div>`}
function decisionHtml(c){const v=V();const n=c.on.length;const pathH=(p,nw)=>`<span class="tkb-path">${p.map(esc).join(' › ')}</span>${nw?'<em class="tkb-new">New Folder</em>':''}`;
 if(c.state!=='ready')return `<div class="tkb-card done" data-tkb-card="${esc(c.id)}"><p class="tkb-res"><i class="ph ph-check-circle" aria-hidden="true"></i><span>${esc(c.doneMsg||'Answered')}</span></p><div class="tkb-acts">${c.state==='done'&&c.row?`<button class="btn sm" type="button" data-tkb-decundo>Undo</button>`:''}<button class="btn sm ghost" type="button" data-tkb-say="What’s next?">Next Decision</button><span class="sp"></span>${openHtml(c)}</div></div>`;
 return `<div class="tkb-card tkb-dec" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><span class="tkb-tag">${esc(c.type)}</span><small>${esc(c.pos)}</small></div><b class="tkb-dq">${esc(c.title)}</b>
 <div class="tkb-box"><h5>Files <small>${n} of ${c.files.length} included</small></h5><ul class="tkb-lr">${c.files.slice(0,8).map(id=>{const f=v.file(id);return f?`<li><input type="checkbox" data-tkb-dfile="${esc(id)}"${c.on.includes(id)?' checked':''} aria-label="Include ${esc(f.name)}"><span class="tkb-n"><span class="tkb-nm1">${esc(f.name)}</span><small>${esc(Plan.kind(f.name).label)} · ${esc(fdate(id))}</small></span></li>`:''}).join('')}${c.files.length>8?`<li class="more"><small>and ${c.files.length-8} more</small></li>`:''}</ul></div>
 <dl class="tkb-facts"><dt>Now in</dt><dd>${pathH(c.from)}</dd><dt>Goes to</dt><dd>${c.dest?pathH(v.path(c.dest)):pathH(c.to,c.isNew)}</dd>${c.facts.map(([k,x])=>`<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>
 <div class="tkb-acts"><button class="btn sm pri" type="button" data-tkb-dec="yes"${n||!c.files.length?'':' disabled'}>${esc(c.yes)}</button><button class="btn sm" type="button" data-tkb-dec="no">${esc(c.no)}</button><button class="btn sm" type="button" data-tkb-decpick aria-haspopup="menu" aria-expanded="false">Choose Another Folder<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button><span class="sp"></span><button class="btn sm ghost" type="button" data-tkb-dec="skip">Skip for Now</button></div>
 <div class="tkb-acts"><span class="sp"></span>${openHtml(c)}</div></div>`}
function settingHtml(c){const tt=c.tool==='__level'?c.title:tc(c.title);const t=TOOL[c.tool];const sel=t&&t.sel?(PG()===(t.page==='any'?PG():t.page)?t.sel():[]):null;const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const on=o=>sel?sel.includes(o.a.n||o.a.k):c.cur&&same(Object.assign({},o.a),Object.assign({},c.cur));
 const pv=c.preview||(t&&t.preview?t.preview(c.cur||{}):'');
 return `<div class="tkb-card done tkb-set" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(tt)}</b></div><div class="tkb-seg" role="group" aria-label="${esc(tt)}">${(c.opts||[]).map((o,i)=>`<button type="button" class="${on(o)?'on':''}" aria-pressed="${!!on(o)}" data-tkb-opt="${i}">${esc(tc(o.label))}</button>`).join('')}</div>
 ${c.confirmA?`<div class="tkb-clash"><i class="ph ph-warning-circle" aria-hidden="true"></i><span>${esc(tc((c.opts.find(o=>JSON.stringify(o.a)===JSON.stringify(c.confirmA))||{}).label||''))}: I do or read more on my own.</span><button class="btn sm pri" type="button" data-tkb-confirm>Confirm</button></div>`:''}${c.head?`<p class="tkb-res"><i class="ph ph-check-circle" aria-hidden="true"></i><span>${esc(c.head)}</span></p>`:''}${pv?`<p class="tkb-disk">${esc(me(pv))}</p>`:''}<div class="tkb-acts">${c.prev&&c.changed?`<button class="btn sm" type="button" data-tkb-setundo>Undo</button>`:''}<span class="sp"></span>${openHtml(c)}</div></div>`}
function fileHtml(c){const v=V(),f=v.file(c.fid);if(!f)return '';const pv=isPriv(v,f.id),inF=live(v,f);
 return `<div class="tkb-card done tkb-file" data-tkb-card="${esc(c.id)}"><div class="tkb-pk-h"><i class="ph ph-${pv?'lock-simple':Plan.kind(f.name).ic}" aria-hidden="true"></i><b>${esc(f.name)}</b></div>
 <dl class="tkb-facts"><dt>Kind</dt><dd>${esc(Plan.kind(f.name).label)}</dd><dt>Size</dt><dd>${esc(sizeTxt(f.size))}</dd><dt>Date</dt><dd>${esc(Plan.fileDate(f.id,true))}</dd><dt>In My Folders</dt><dd>${inF?esc(v.path(f.node).join(' › ')):'Trash'}</dd><dt>On Disk</dt><dd>${esc(f.where||f.from||'')}</dd><dt>Why Here</dt><dd>${esc(inF?whyHere(v,f.id,f.node):'')}</dd>${pv?'<dt>Private</dt><dd>Never sent to AI</dd>':v.level(f.id).level!=='read'?'<dt>Read</dt><dd>Matched by name</dd>':''}</dl>
 <div class="tkb-acts">${c.ok?'<small>Noted</small>':`<button class="btn sm" type="button" data-tkb-fok>That’s Right</button>`}<button class="btn sm" type="button" data-tkb-fmove aria-haspopup="menu" aria-expanded="false">Put in Folder<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>${pv?'':'<button class="btn sm ghost" type="button" data-tkb-fpriv>Make Private</button>'}<button class="btn sm ghost" type="button" data-tkb-finder="${esc(f.id)}">Show in Finder</button><span class="sp"></span>${openHtml(c)}</div></div>`}
function compareHtml(c){const v=V();if(c.sides)return `<div class="tkb-card done" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b><small>${c.sides.length}</small></div><table class="tkb-cmp"><thead><tr><th>Copy</th><th>Kept</th></tr></thead><tbody>${c.sides.map(s=>`<tr><td>${esc(s.a)}</td><td>${esc(s.b)}</td></tr>`).join('')}</tbody></table><div class="tkb-acts"><button class="btn sm pri" type="button" data-tkb-act>${esc(c.action.label)}</button><span class="sp"></span>${openHtml(c)}</div></div>`;
 const nf=v.file(c.newest);return `<div class="tkb-card done" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b></div><div class="tkb-cmpv"><div class="nw"><em class="tkb-new">Newest</em><b>${esc(nf.name)}</b><small>${esc(fdate(nf.id))}</small></div>${c.older.slice(0,3).map(id=>{const f=v.file(id);return f?`<div><b>${esc(f.name)}</b><small>${esc(fdate(id))}</small></div>`:''}).join('')}</div>${c.older.length>3?`<p class="tkb-disk">And ${c.older.length-3} Older</p>`:''}
 <div class="tkb-acts"><button class="btn sm pri" type="button" data-tkb-act>${esc(c.action.label)}</button><span class="sp"></span>${openHtml(c)}</div></div>`}
function profileHtml(c){const gs=[...new Set(c.rows.map(r=>r.g))];return `<div class="tkb-card done" data-tkb-card="${esc(c.id)}"><div class="tkb-hd"><b>${esc(c.title)}</b><small>${c.rows.length}</small></div><div class="tkb-body">${gs.map(g=>`<div class="tkb-rg"><h4><span>${esc(g)}</span></h4><ul class="tkb-tb">${c.rows.filter(r=>r.g===g).map(r=>`<li><span><b>${esc(r.k)}</b> ${esc(r.v)}</span><small>${esc(r.src||'')}</small><button class="btn sm ghost" type="button" data-tkb-fill="correct ${esc(r.k)} to ">Correct</button><button class="btn sm ghost" type="button" data-tkb-memforget="${esc(r.id)}">Forget</button></li>`).join('')}</ul></div>`).join('')}</div><div class="tkb-acts"><button class="btn sm" type="button" data-tkb-fill="remember that ">Add</button><span class="sp"></span>${openHtml(c)}</div></div>`}
const KINDHTML={list:listHtml,today:todayHtml,decision:decisionHtml,setting:settingHtml,file:fileHtml,compare:compareHtml,profile:profileHtml};
/* which of the map's card types a reply is (C1…C10), for the checks and agent-map.html */
function ctypeOf(b){const c=b&&b.card;if(b&&b.ask)return 'ask';if(!c)return 'line';const k=c.kind;
 if(k==='list')return 'C8';if(k==='today')return 'C3';if(k==='decision')return 'C5';if(k==='setting')return 'C6';if(k==='file')return 'C7';if(k==='compare')return 'C9';if(k==='profile')return 'C10';
 if(c.state==='running')return 'C4';if(c.state==='done'||c.state==='undone')return 'C3';if(k==='sort'||k==='trash'||k==='move')return 'C1';return 'C2'}

/* ---------- run a tool: on its page (going there first: the chat keeps the request and finishes it there) */
const PEND='tuckBot.pending';
function settingCard(t,a,prev){const c=mkCard('setting',t.feature,{state:'done',tool:t.id,opts:t.opts,cur:a,prev,page:t.page,hash:t.hash||'',head:t.done(a),changed:true,autoChecked:true});return c}
function runTool(t,a,o){if(t.run)return t.run(a,o);
 if(t.page!=='any'&&PG()!==t.page){try{sessionStorage.setItem(PEND,JSON.stringify({id:t.id,a}))}catch(e){}setTimeout(()=>{location.href=PAGEURL[t.page]+(t.hash?'#'+t.hash:'')},250);return say(line('opening.to',{a:esc(PAGENAME[t.page])}),{chips:[]})}
 const prev=t.get?t.get():null;
 if(t.raise&&t.raise(a,prev)){const c=settingCard(t,prev,prev);c.changed=false;c.head='';c.confirmA=a;ROOM.calm=true;return {t:line('setting.raise'),card:c,chips:[],mood:'listen'}}
 t.set(a);if(t.hash)toHash(t.hash);else rerender();
 return {t:settingLine(t,a),card:settingCard(t,a,prev),chips:VIEWCHIPS[t.section]||[]}}
/* a setting changed: a word in the bubble, plain for anything about privacy or what I may read */
const CALMSET=new Set(['never_look','read_amount','ai_onoff','private_kind','set_ai_limit','set_watching','set_retention','set_autonomy']);
function settingLine(t,a){if(CALMSET.has(t.id))ROOM.calm=true;if(t.id==='set_appearance')return line(a.t==='dark'?'setting.dark':a.t==='light'?'setting.light':'setting.auto');if(t.id==='pause')return line(a.on?'setting.pause':'setting.resume');return line('setting')}
const VIEWCHIPS={'Tuck Brain':['Colour the brain by file type','Show only unsure','Fit the map to view'],Diary:['Only pets in the diary','Open the Diary at October 2025'],'Edit Folders':['Switch to the graph view','Show 3 levels in edit folders'],Finder:['Show sorted by Tuck in finder','Finder as list'],Settings:[],History:['Show only undone in history','Undo the last sort']};
/* specific phrasings first; the broad ones (edits to the card on screen, "show X on the map") last, and card edits only while a card waits */
const LATE=new Set(['show_in_brain','plan_change','fewer_folders']);
function matchTool(raw){const {text}=mentions(withThis(cleanT(raw)));const t0=text.replace(/[.!]+$/,'').trim();const ready=()=>{try{return !!(window.TuckChat&&lastReady(TuckChat.thread()))}catch(e){return false}};
 for(const t of [...TOOLS.filter(x=>!LATE.has(x.id)),...TOOLS.filter(x=>LATE.has(x.id))]){if(!t.re)continue;if((t.id==='plan_change'||t.id==='fewer_folders')&&!ready()&&!(window.TuckChat&&lastDone(TuckChat.thread()))&&!/^(call it|name it|rename it|leave|fewer|more)\b/i.test(t0))continue;const m=t.re.exec(t0);if(m)return {t,a:t.args?t.args(m):{}}}return null}
function runPending(){let p=null;try{p=JSON.parse(sessionStorage.getItem(PEND)||'null');sessionStorage.removeItem(PEND)}catch(e){}if(!p||!TOOL[p.id]||!window.TuckChat)return;
 const t=TOOL[p.id];if(t.page!==PG()&&t.page!=='any')return;
 setTimeout(()=>{TuckChat.open({});const th=TuckChat.thread();if(p.setOf){const c=findCard(th,p.setOf);t.set(p.a);if(t.hash)toHash(t.hash);else rerender();if(c){c.cur=p.a;c.head=t.done(p.a);c.changed=true}th.paint();th.save();return}
  const b=runTool(t,p.a,{thread:th});b.tool=t.id;b.sent={q:t.say[0],names:0,priv:0};th.push(b);th.mood&&th.mood(moodOf(b))},PG()==='brain'?1300:500)}
addEventListener('load',runPending);
/* a setting card's options: apply on its page (go there first if needed) */
function applyOpt(c,i,th){const o=c.opts[i];if(!o)return;
 if(c.tool==='__level'){const v=V();const cur=v.level(c.target).level;if(o.a.l===cur)return;
  if(cur==='private'&&o.a.l!=='private'&&!c.confirm){c.confirm=o.a.l;c.head=`Its contents can be sent to AI. Click ${o.label} again to confirm`;th.paint();return}
  const row=Plan.setLevel(c.target,o.a.l);c.hist=(c.hist||[]).concat(row?[row.id]:[]);c.cur={l:o.a.l};c.confirm=null;c.changed=true;c.head=`${(v.node(c.target)||v.file(c.target)).name}: ${o.label}`;c.preview=me(Plan.LEVELS[o.a.l].line);th.paint();th.save();return}
 const t=TOOL[c.tool];if(!t)return;if(t.raise&&t.raise(o.a,c.cur)&&JSON.stringify(c.confirmA)!==JSON.stringify(o.a)){c.confirmA=o.a;th.paint();th.save();return}c.confirmA=null;
 if(t.page!=='any'&&PG()!==t.page){try{sessionStorage.setItem(PEND,JSON.stringify({id:t.id,a:o.a,setOf:c.id}))}catch(e){}location.href=PAGEURL[t.page]+(t.hash?'#'+t.hash:'');return}
 t.set(o.a);if(t.hash)toHash(t.hash);else rerender();c.cur=o.a;c.head=t.done(o.a);c.changed=true;th.paint();th.save()}
function undoSetting(c,th){if(c.tool==='__level'){histRows(c).slice().reverse().forEach(r=>{if(!r.undone)Plan.undoApply(r.id)});c.cur=c.prev;c.head='Back As It Was';c.changed=false;th.paint();th.save();return}
 const t=TOOL[c.tool];if(!t||!c.prev)return;if(c.prev.on===null&&c.cur){if(c.cur.toggle){t.set(c.cur)}else t.set(Object.assign({},c.cur,{on:!c.cur.on}))}else{if(t.page!=='any'&&PG()!==t.page){try{sessionStorage.setItem(PEND,JSON.stringify({id:t.id,a:c.prev,setOf:c.id}))}catch(e){}location.href=PAGEURL[t.page]+(t.hash?'#'+t.hash:'');return}t.set(c.prev)}
 if(t.hash)toHash(t.hash);else rerender();c.cur=c.prev;c.head='Back As It Was';c.changed=false;th.paint();th.save()}
/* clicks on the new card types */
function handleX(e,th){const el=e.target;const c=cardOfEl(th,el);
 const oi=el.closest('[data-tkb-openin]');if(oi){openIn(JSON.parse(oi.dataset.tkbOpenin));return true}
 const fl=el.closest('[data-tkb-fill]');if(fl){th.fill&&th.fill(fl.dataset.tkbFill);return true}
 const nd=el.closest('[data-tkb-need]');if(nd){th.send('What’s next?');return true}
 const ph=el.closest('[data-tkb-photo]');if(ph){openIn({hash:'diary',photo:+ph.dataset.tkbPhoto});return true}
 if(!c)return false;
 const lf=el.closest('[data-tkb-file]');if(lf&&(c.kind==='list'||c.kind==='today')){c.peek=c.peek===lf.dataset.tkbFile?null:lf.dataset.tkbFile;th.paint();th.save();return true}
 const op=el.closest('[data-tkb-opt]');if(op){applyOpt(c,+op.dataset.tkbOpt,th);return true}
 if(el.closest('[data-tkb-setundo]')){undoSetting(c,th);return true}
 if(el.closest('[data-tkb-confirm]')&&c.confirmA){const i=c.opts.findIndex(o=>JSON.stringify(o.a)===JSON.stringify(c.confirmA));if(i>=0)applyOpt(c,i,th);return true}
 const ru=el.closest('[data-tkb-rowundo]');if(ru){const r=c.rows.find(x=>x.id===ru.dataset.tkbRowundo);if(r&&r.fromNode&&V().node(r.fromNode)){const row=Plan.applyNow([{ty:'moveFiles',files:[r.fid],to:r.fromNode}],`Put back ${r.name}`,'chat');if(row){c.rowBack=c.rowBack||{};c.rowBack[r.id]=row.id}rerender();th.paint();th.save()}return true}
 const pb=el.closest('[data-tkb-putback]');if(pb){const fid=pb.dataset.tkbPutback;const row=Plan.applyNow([{ty:'moveFiles',files:[fid],to:'loose'}],`Put back ${V().file(fid).name}`,'chat');if(row){c.back=c.back||{};c.back[fid]=row.id}rerender();th.paint();th.save();return true}
 if(el.closest('[data-tkb-undoall]')){if(c.allBack){Plan.undoApply(c.allBack);c.allBack=null;c.back={}}else{const fids=c.groups.flatMap(g=>g.files.map(f=>f.fid)).filter(f=>!(c.back||{})[f]);const row=fids.length?Plan.applyNow([{ty:'moveFiles',files:fids,to:'loose'}],`Put back ${pl(fids.length,'file')} sorted today`,'chat'):null;if(row){c.allBack=row.id;c.back={};fids.forEach(f=>c.back[f]=row.id)}}rerender();th.paint();th.save();return true}
 const bt=el.closest('[data-tkb-backto]');if(bt){const r=(Plan.history?Plan.history():[]).find(x=>x.id===bt.dataset.tkbBackto);if(r&&r.at<Plan.NOW&&c.confirmBack!==r.id){c.confirmBack=r.id;bt.textContent='Undo Older Change';return true}if(r&&!r.undone){Plan.undoApply(r.id);fire();rerender()}th.push(Object.assign(doneCard('Went Back',`Undid “${r?r.text:''}”`,[],{say:'Gone back. That change is undone.',redoOf:r&&r.id,open:{label:'History',hash:'history',hist:r&&r.id}}),{mood:'idle'}));return true}
 const fr=el.closest('[data-tkb-forgetrule]');if(fr){const t=fr.dataset.tkbForgetrule;Plan.removeRule(t);c.rows=c.rows.filter(r=>r.rule!==t);th.paint();th.save();th.push(Object.assign(doneCard('Forgot a Rule',`Forgot “${t}”`,[],{say:'Forgotten. Undo brings it back.',unrule:t}),{mood:'idle'}));return true}
 const mf=el.closest('[data-tkb-memforget]');if(mf){const id=mf.dataset.tkbMemforget;if(id.startsWith('t:')){window.Memory&&Memory.unremember&&Memory.unremember(id.slice(2))}else window.Memory&&Memory.forget&&Memory.forget(id);const gone=c.rows.find(r=>r.id===id);c.rows=c.rows.filter(r=>r.id!==id);th.paint();th.save();
  th.push(Object.assign(doneCard('Forgot',`Forgot ${gone?`${gone.k}: ${gone.v}`:'That'}`,[],Object.assign({say:'Forgotten. Undo brings it back.'},id.startsWith('t:')?{retell:id.slice(2)}:{regone:id})),{mood:'idle'}));return true}
 if(el.closest('[data-tkb-copy]')){try{navigator.clipboard&&navigator.clipboard.writeText(c.copy)}catch(x){}c.copied=true;th.paint();return true}
 if(el.closest('[data-tkb-act]')){const a=c.action||{};if(a.say){th.send(a.say);return true}if(a.link){try{const L=JSON.parse(localStorage.getItem('tuckLinks')||'[]');L.push(c.link);localStorage.setItem('tuckLinks',JSON.stringify(L))}catch(x){}c.linked=true;c.win=withRoom(c,th,()=>line('linked'));th.mood&&th.mood('happy');th.paint();th.save();return true}if(a.ver){th.push(versionsPlan(c));return true}if(a.saveRule){if(!c.saved){Plan.addRule(a.saveRule);c.saved=true;c.action={label:'Undo Save',unRule:a.saveRule};c.win=withRoom(c,th,()=>line('rule.saved'));th.mood&&th.mood('happy')}th.paint();th.save();return true}if(a.unRule){Plan.removeRule(a.unRule);c.saved=false;c.action={label:'Save Rule',saveRule:a.unRule};c.win='';th.mood&&th.mood('idle');th.paint();th.save();return true}return true}
 if(c.kind==='decision'){const dfl=el.closest('[data-tkb-dfile]');if(dfl){const id=dfl.dataset.tkbDfile;c.on=dfl.checked?[...new Set([...c.on,id])]:c.on.filter(x=>x!==id);th.paint();th.save();return true}
  const dc=el.closest('[data-tkb-dec]');if(dc){decide(c,dc.dataset.tkbDec,th);return true}
  const dp=el.closest('[data-tkb-decpick]');if(dp){pickFolder(dp,'Choose another folder').then(t=>{if(!t||!V().node(t))return;c.dest=t;decide(c,'yes',th)});return true}
  if(el.closest('[data-tkb-decundo]')){(c.rows2||[c.row]).forEach(id=>{const r=(Plan.history()||[]).find(x=>x.id===id);if(r&&!r.undone)Plan.undoApply(id)});c.state='undone';c.doneMsg='Waiting in Needs You Again';c.undoSay=withRoom(c,th,()=>line('undo'));th.mood&&th.mood('idle');rerender();th.paint();th.save();return true}}
 if(c.kind==='file'){if(el.closest('[data-tkb-fok]')){c.ok=true;th.paint();th.save();return true}
  if(el.closest('[data-tkb-fpriv]')){th.send(`make ${V().file(c.fid).name} private`);return true}
  const fm=el.closest('[data-tkb-fmove]');if(fm){pickFolder(fm,`Put ${mid(V().file(c.fid).name,24)} in`).then(t=>{if(t&&V().node(t))th.send(`put ${V().file(c.fid).name} in ${V().node(t).name}`)});return true}}
 return false}
function decide(c,a,th){const n=(Plan.needs?Plan.needs():[]).find(x=>x.id===c.need);if(!n||n.done){c.state='done';c.doneMsg='Already Answered';th.paint();return}
 if(a==='skip'){window.TuckQueue&&TuckQueue.answer(c.need,'skip');c.state='skipped';c.doneMsg='Skipped: Waiting at the End';rerender();th.paint();th.save();return}
 const row=Plan.answerNeed(c.need,a==='yes');const rows=[row&&row.id].filter(Boolean);
 if(a==='yes'){const off=c.files.filter(id=>!c.on.includes(id));const v=V();if(c.dest&&c.on.length){const r2=Plan.applyNow([{ty:'moveFiles',files:c.on,to:c.dest}],`Put ${pl(c.on.length,'file')} in ${v.node(c.dest).name}`,'needs');r2&&rows.push(r2.id)}
  if(off.length){const back=v.file(off[0])&&c.from.length?v.all().find(id=>v.path(id).join('›')===c.from.join('›')):null;if(back){const r3=Plan.applyNow([{ty:'moveFiles',files:off,to:back}],`Left ${pl(off.length,'file')} where they were`,'needs');r3&&rows.push(r3.id)}}}
 c.row=rows[0];c.rows2=rows;c.state='done';c.doneMsg=a==='yes'?`${c.yes}${c.dest?` → ${V().path(c.dest).join(' › ')}`:''}${c.files.length?` · ${pl(c.on.length,'file')}`:''}`:`${c.no}`;c.win=withRoom(c,th,()=>{ROOM.calm=ROOM.calm||HEAVY.test(c.title);return line(a==='yes'?'win.decision':'no.decision')});th.mood&&th.mood(a==='yes'?'happy':'idle');rerender();th.paint();th.save()}
/* the chat follows the pages: a change made anywhere redraws the cards (Undo in History shows here too) */
if(window.Plan&&Plan.subscribe){let tm=0;Plan.subscribe(()=>{clearTimeout(tm);tm=setTimeout(()=>{if(!window.TuckChat||!TuckChat.isOpen())return;const a=document.activeElement;if(a&&a.closest&&a.closest('.tkchat')&&a.matches('input'))return;const th=TuckChat.thread();th.msgs().forEach(m=>{const c=m.bot&&m.bot.card;if(c)syncState(c)});th.paint()},120)})}

/* ---------- rows the research report adds (Tuck chatbot feature surfacing.md) */
T({id:'watching_status',section:'Today',feature:'Watching status',tool:'set_watching',card:'C6',route:'watch.set',status:'missing',tier:'instant',kind:'view',page:'any',maps:'tuckSettings + st.watch',
 re:/^is tuck on\??$|^(?:what (?:does|is) tuck watch(?:ing)?|watching status)\??$/i,args:()=>({}),run:()=>{const st=G('st');const w=st&&st.watch?st.watch.filter(x=>x.on).map(x=>x.n):['Downloads','Desktop'];return listCard('Watching',[...w.map(n=>({ic:'eye',name:n,sub:'Watched'})),{ic:st&&st.paused?'pause-circle':'play-circle',name:st&&st.paused?'Sorting Paused':'Sorting On',sub:''},{ic:'prohibit',name:'Never Look In',sub:cfgVal('never').join(', ')}],{label:'Settings',hash:'prefs/watching'},line('watch'))},say:['is Tuck on?','what does Tuck watch'],expect:['C8']});
T({id:'files_unfiled',section:'Edit Folders',feature:'Files without a folder',tool:'rearrange_area (scope unfiled)',card:'C1',route:'resort.start scope unfiled',status:'built',tier:'card',kind:'data',page:'any',maps:'Resort._planFor(loose) → card',
 re:/^(?:sort|re-?sort) (?:the )?(?:files without a folder|no folder yet|loose files|leftovers)$/i,args:()=>({}),run:()=>{const r0=cardResort('loose');return r0.say?say(r0.say,{chips:['What came in today?']}):decorate(r0,'These files have no folder yet. Here’s where I’d put them.')},say:['sort the files without a folder','re-sort no folder yet'],expect:['C2','line']});
T({id:'set_cleanup',section:'Tidy Up',feature:'Clean Up thresholds',tool:'set_cleanup',card:'C6',route:'limits.set',status:'missing',tier:'instant',kind:'view',page:'any',maps:'tuckSettings.cleanAt',
 re:/^(?:tell me|nudge me) (?:to clean up )?(?:when )?(?:it'?s )?(?:over|at|above) (\d+(?:\.\d)?) ?(gb|mb)$|^clean ?up threshold (\d+(?:\.\d)?) ?(gb|mb)$/i,args:m=>({v:`${m[1]||m[3]} ${(m[2]||m[4]).toUpperCase()}`}),opts:['500 MB','1 GB','5 GB'].map(v=>({label:v,a:{v}})),
 get:()=>({v:cfgVal('cleanAt')||'1 GB'}),set:a=>cfgSet('cleanAt',a.v),done:a=>`Clean Up: nudges over ${a.v}`,probe:a=>`JSON.parse(localStorage.tuckSettings||'{}').cleanAt==='${a.v}'`,say:['tell me when over 5 GB','clean up threshold 500 MB']});
T({id:'set_retention',section:'History',feature:'Undo-history retention',tool:'set_retention',card:'C6',route:'prefs.set',status:'missing',tier:'instant',kind:'view',page:'any',maps:'tuckSettings.keep',
 re:/^keep (?:undo )?history (?:for )?(7 days|30 days|90 days|a week|a month|forever)$/i,args:m=>({v:{'a week':'7 Days','a month':'30 Days'}[lc(m[1])]||m[1].replace(/\b\w/g,c=>c.toUpperCase())}),opts:['7 Days','30 Days','90 Days','Forever'].map(v=>({label:v,a:{v}})),
 raise:(a,p)=>['7 Days','30 Days','90 Days','Forever'].indexOf(a.v)<['7 Days','30 Days','90 Days','Forever'].indexOf((p||{}).v||'30 Days'),
 get:()=>({v:cfgVal('keep')||'30 Days'}),set:a=>cfgSet('keep',a.v),done:a=>`History kept: ${a.v}`,probe:a=>`JSON.parse(localStorage.tuckSettings||'{}').keep==='${a.v}'`,say:['keep history for 90 days','keep undo history for 7 days']});
T({id:'export_memory',section:'Settings',feature:'Export rules and memory',tool:'export_memory',card:'C8 (Copy)',route:'memory.export',status:'missing',tier:'instant',kind:'view',page:'any',maps:'Plan.rules() + PROFILE.lines as text',
 re:/^(?:export|back up|copy) (?:my )?(?:rules and memory|memory|rules)$/i,args:()=>({}),run:()=>{const r=(Plan.rules?Plan.rules():[]).map(x=>'Rule: '+x.text);const m=(window.PROFILE?PROFILE.lines:[]).map(l=>`${l.k}: ${l.v}`);return listCard('Rules and Memory',[{ic:'list-checks',name:`${Pl(r.length,'rule')}`},{ic:'user',name:`${Pl(m.length,'fact')}`}],{label:'Settings',hash:'prefs/you'},'',{copy:[...r,...m].join('\n')})},say:['export my rules and memory','back up my memory'],expect:['C8']});
T({id:'connections',section:'Settings',feature:'Connections (MCP)',tool:'—',card:'C6',route:'—',status:'not built',tier:'instant',kind:'view',page:'any',maps:'none yet',re:/^(?:connect (?:to )?(?:other )?(?:ai )?apps|connections|mcp)\??$/i,args:()=>({}),
 run:()=>listCard('Connections',[{ic:'plugs',name:'Other AI Apps (MCP)',sub:'Not built yet'}],{label:'Settings',hash:'prefs'},'I can’t connect to other apps yet.'),say:['connections','connect to other ai apps'],expect:['C8']});
T({id:'private_describe',section:'Settings',feature:'Describe it (private in my words)',tool:'private_kind (describe)',card:'C1 → Lock N files',route:'privateFiles.previewKind',status:'built',tier:'card',kind:'data',page:'any',maps:'matching files → Plan.setLevel(…, private)',
 re:/^keep (?:anything|everything|files) (?:about|named|with|called) (.+?) private$/i,args:m=>({q:m[1]}),run:a=>{const ids=findFiles(a.q).filter(id=>!isPriv(V(),id)).slice(0,20);ROOM.calm=true;if(!ids.length)return listCard('Make Private',[{ic:'lock-simple',name:`No files named like “${a.q}” that aren’t private already`}],{label:'Settings',hash:'prefs/privacy'},'');
  const c=cardFolders(ids.map(id=>({ty:'private',target:id})),`Lock ${pl(ids.length,'file')}`,'privdesc');return decorate(c,`${pl(ids.length,'file')} named like “${esc(a.q)}”. Untick any to leave out.`)},say:['keep anything about therapy private','keep files named budget private'],expect:['C2','C8']});
/* the confirm tier each feature gets (the report's R / A / B / C / Q), chosen by code */
const TIER={sort_new:'A',what_changed:'R',attention:'R',next_questions:'R',answer_question:'B',skip_question:'A',accept_all:'B',organise:'Q → A',plan_change:'A',arrange_by:'A',rename_folder:'A',move_folder:'A',merge:'A',new_folder:'A',hide_folder:'A',split:'A',fewer_folders:'—',set_depth:'A',why_here:'R',place_files:'A',folder_setting:'A',unkeep:'A',go_back:'C if older',list_folders:'R',
 edit_view:'R',edit_levels:'R',edit_open:'R',edit_apply:'B',edit_discard:'C',finder_mode:'A',finder_view:'R',finder_preview:'R',finder_place:'R',rearrange_area:'Q → A',resort_new:'A',estimate:'R',stop:'A',resort_wizard:'R',cleanup:'Q → C',clean_kind:'C',show_copies:'R',remove_empty:'A',old_versions:'A',trash_files:'C',delete_empty:'C',
 show_in_brain:'R',list_related:'R',graph_links:'A',set_reading:'A / C to open',make_private:'A',release:'C',brain_colour:'R',brain_files:'R',brain_people:'R',brain_unsure:'R',brain_key:'R',brain_zoom:'R',brain_time:'R',files_on_day:'R',photos_place:'R',diary_filter:'R',diary_jump:'R',diary_fav:'A',diary_step:'R',
 undo:'A / C if older',undo_kind:'A',redo:'A',history_filter:'R',set_watching:'A / C',never_look:'A',set_autonomy:'A / C to raise',set_names:'A',set_ai_limit:'A',private_kind:'A',mark_sensitive:'A',what_was_sent:'R',about_me:'R',remember_rule:'B',list_rules:'R',forget_rule:'A',remember_fact:'A',set_notifications:'A',set_appearance:'A',forget_conversations:'C',read_amount:'A / C to raise',trash_asks:'A',pause:'A',ai_onoff:'A / C to turn on',
 find_files:'R',explain_file:'R',dates_due:'R',email_draft:'C',q_in:'R',q_downloads:'R',q_today:'R',q_size:'R',q_private:'R',q_big:'R',help:'R',open_page:'R',launcher:'R',watching_status:'R',files_unfiled:'A',set_cleanup:'A',set_retention:'A / C if shorter',export_memory:'R',connections:'R',private_describe:'A'};
TOOLS.forEach(t=>{t.tierR=TIER[t.id]||'R';
 /* the owner's rule: tier A shows only the result; the before card stays for B, C, Q and Ask each time */
 if(t.kind==='data'&&/^(A|Q → A)/.test(t.tierR)&&!/^(C6|C8|C10)/.test(t.card)){t.card=t.tierR.startsWith('Q')?'Question → C3':'C3';t.maps=String(t.maps).replace(/^card → /,'')}});
/* raising what Tuck does or reads is tier C: the setting card asks for a confirm click */
const RANK={'Ask About Everything':0,'Plan Only':0,'Ask When Unsure':1,'Just Do It':2};
TOOL.set_autonomy.raise=(a,p)=>RANK[a.lv]>RANK[(p||{}).lv];
TOOL.read_amount.raise=(a,p)=>['Names Only','First Page','Every Page'].indexOf(a.v)>['Names Only','First Page','Every Page'].indexOf((p||{}).v);
TOOL.ai_onoff.raise=(a,p)=>a.on&&!(p||{}).on;


/* ================= Ask Tuck ⌄ on every object (Needs You decision, Today and History rows, Tidy Up groups, Diary photo,
   Settings rows, Edit Folders panel, Brain inspector, Finder selection). A pop-up button with the 3–5 tools that fit the object
   and "Ask about this…", which opens the side chat scoped to it (@chip). The chat knows the page and the selection, so
   "move this to Work" works. */
function curSel(){if(ctxSel)return ctxSel;const pg=PG();
 if(pg==='tuck'){const W=G('WB');if(location.hash.startsWith('#edit')&&W&&W.sel)return W.sel}
 if(pg==='brain'){const tt=document.querySelector('#insp.on #ititle');if(tt){const nm=tt.textContent.trim();const id=findNode(nm);if(id)return {type:'node',id};const f=findFiles(nm)[0];if(f)return {type:'file',id:f}}}
 if(pg==='finder'){const S=G('S'),N=G('N');if(S&&S.sel&&S.sel.size===1){const n=N[[...S.sel][0]];const v=V();if(n&&n.pf&&v.file(n.pf))return {type:'file',id:n.pf};if(n&&n.pid&&v.node(n.pid))return {type:'node',id:n.pid}}}
 return null}
const selName=s=>{const v=V();return s?(s.type==='node'?(v.node(s.id)||{}).name:s.type==='file'?(v.file(s.id)||{}).name:s.label):''};
/* "this" and "it" point at the scoped or selected item */
function withThis(text){const s=curSel();if(!s||(s.type!=='node'&&s.type!=='file'))return text;if(!/\b(this|it)\b/i.test(text))return text;
 return text.replace(/\b(this|it)\b(?:\s+(?:file|folder))?/i,s.type==='node'?'«'+s.id+'»':'«f:'+s.id+'»')}
function askItems(o){const v=V();const send=t=>()=>{TuckChat.open({});setTimeout(()=>TuckChat.send(t),60)};const nm=selName(o);const it=[];
 if(o.type==='node'&&v.node(o.id)){it.push([`What’s in ${nm}?`],[`Arrange ${nm}`],[`Re-sort ${nm}`],[isPriv(v,o.id)?`Let Tuck read ${nm}`:`Make ${nm} private`],[Plan.isKept(o.id)?`Let Tuck change ${nm} again`:`Keep ${nm} as is`])}
 else if(o.type==='file'&&v.file(o.id)){const f=v.file(o.id);it.push([`Why is ${f.name} in ${v.node(f.node)?v.node(f.node).name:'here'}?`],[`What goes with ${f.name}?`],[isPriv(v,o.id)?`Let Tuck read ${f.name}`:`Make ${f.name} private`],[`Show ${v.node(f.node)?v.node(f.node).name:'it'} in edit folders`])}
 else if(o.type==='need'){/* every item acts on THIS decision (by id), shown as its own decision card in the chat */
  const act=a=>()=>{TuckChat.open({});const th=TuckChat.thread();const r=decisionFor(o.id);if(!r||!r.card||r.card.kind!=='decision')return;th.push(r);if(a)setTimeout(()=>decide(r.card,a,th),30)};
  const nd=(Plan.needs?Plan.needs():[]).find(x=>x.id===o.id)||{};it.push(['Review in Chat',act(null)],[nd.yes||'Yes',act('yes')],[nd.no||'No',act('no')],['Skip for Now',act('skip')],['Yes to all of them'])}
 else if(o.type==='hist'){it.push(['Undo This',()=>{const r=(Plan.history()||[]).find(x=>x.id===o.id);if(r&&!r.undone){Plan.undoApply(r.id);rerender()}TuckChat.open({});TuckChat.thread().push(Object.assign(doneCard('Undone',`Undid “${r?r.text:''}”`,[],{say:'Undone.',open:{label:'History',hash:'history',hist:o.id}}),{mood:'idle'}))}],['What changed today'],['Show only undone in history'])}
 else if(o.type==='tidy'){const k={ins:'old installers',dup:'duplicates',zip:'zips'}[o.id]||'duplicates';it.push([`Clean up ${k}`],o.id==='dup'?['Show me copies']:['What can I clean up?'],['Biggest files'])}
 else if(o.type==='photo'){const D=G('D')||[];const p=D.find(x=>x.i===o.id);it.push(['Favourite this photo'],p?[`Photos from ${p.place.split(',')[0]}`]:null,p?[`What did I save on ${p.d.getDate()} ${MON3[p.d.getMonth()]}?`]:null,['Only pets in the diary'])}
 else if(o.type==='section'){sectionItems(o).forEach(x=>it.push(x))}
 else if(o.type==='setting'){const words=normN(o.label).split(' ').filter(w=>w.length>3);TOOLS.filter(t=>t.section==='Settings'&&words.some(w=>normN(t.feature).includes(w))).slice(0,2).forEach(t=>t.say.slice(0,2).forEach(x=>it.push([cap(x)])));it.push(['What was sent'],['What do you know about me?'])}
 return it.filter(Boolean).slice(0,5).map(([label,fn])=>({label,fn:fn||send(label)})).concat(['-',{label:'Ask About This…',sub:'Opens the chat scoped to it',fn:()=>askAbout(o)}])}
/* a Settings section's own Ask Tuck ⌄ (the heading), for rows with no room for a button of their own: that section's tools */
const SECTION_TOOLS={'Right now':['watching_status','pause','what_was_sent'],'Folders Tuck watches':['watching_status','set_watching','never_look'],'Before sorting':['pause','watching_status','set_watching'],'Never look in':['never_look','watching_status','q_private'],
 'How much Tuck does on its own':['set_autonomy','pause'],'Folders and names':['set_depth','set_names','list_folders'],'Limits':['set_ai_limit','estimate','what_was_sent'],privacy:['read_amount','ai_onoff','what_was_sent','q_private'],'Private kinds':['private_kind','q_private','private_describe'],
 'Your private list':['q_private','make_private','release'],'Add something private in your words':['private_describe','mark_sensitive','q_private'],'What Clean Up looks for':['cleanup','clean_kind','show_copies','remove_empty'],'The Trash':['set_cleanup','cleanup'],
 notifications:['set_notifications','attention','what_changed'],appearance:['set_appearance','open_page','help'],'Where it lives':['export_memory','what_was_sent','set_retention'],'Start over':['forget_conversations','export_memory','about_me']};
/* tools that need a name you choose: the chat waits for it instead of acting on a sample */
const FILLS={never_look:['Never look in…','never look in '],private_describe:['Keep anything about…','keep anything about '],make_private:['Make something private…','make '],mark_sensitive:['Make a file private…','make '],release:['Let Tuck read…','let tuck read '],open_page:['Open a page…','open ']};
function sectionItems(o){const ids=SECTION_TOOLS[o.id]||[];const send=t=>()=>{TuckChat.open({});setTimeout(()=>TuckChat.send(t),60)};const fill=t=>()=>{TuckChat.open({});setTimeout(()=>TuckChat.thread().fill(t),120)};
 const items=ids.map(id=>TOOL[id]).filter(Boolean).map(t=>FILLS[t.id]?[FILLS[t.id][0],fill(FILLS[t.id][1])]:[cap(t.say[0]),send(t.say[0])]);
 if(items.length<3)items.push(['What was sent',send('what was sent')],['What do you know about me?',send('what do you know about me?')]);return items.slice(0,5)}
function decisionFor(id){return decisionReply('',id)}
function askAbout(o){ctxSel=o;TuckChat.open({});const nm=selName(o);setTimeout(()=>{const th=TuckChat.thread();if(o.type==='node'||o.type==='file')th.fill('@'+nm+' ');else th.fill(`About ${nm}: `)},120)}
function askBtn(o,cls){const b=document.createElement('button');b.type='button';const ic=/tkb-askset/.test(cls||'');b.className=(ic?'ib ':'btn sm ghost ')+'tkb-askbtn'+(cls?' '+cls:'');b.setAttribute('aria-label','Ask Tuck');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.title=`Ask Tuck about ${selName(o)||'this'}`;
 b.innerHTML=`<i class="ph ph-sparkle" aria-hidden="true"></i>${ic?'':'Ask Tuck'}<i class="ph ph-caret-down pcaret" aria-hidden="true"></i>`;b.onclick=e=>{e.stopPropagation();e.preventDefault();const obj=typeof o==='function'?o():o;if(!obj)return;menu(b,askItems(obj))};return b}
function placeAsk(host,key,o,cls,before){if(!host||host.querySelector(':scope > .tkb-askbtn[data-k="'+key+'"]'))return;host.querySelectorAll(':scope > .tkb-askbtn').forEach(x=>x.remove());const b=askBtn(o,cls);b.dataset.k=key;before&&before.parentElement===host?host.insertBefore(b,before):host.appendChild(b)}
function injectAsk(){if(!window.TuckChat)return;const pg=PG();
 if(pg==='tuck'){const h=location.hash.slice(1).split('/')[0]||'today';const B=document.getElementById('body');if(!B)return;
  if(h==='today'||h==='history'){const H=G('H')||[];B.querySelectorAll('[data-undo],[data-redo]').forEach(btn=>{const row=btn.parentElement;const e=H.find(x=>String(x.id)===String(btn.dataset.undo||btn.dataset.redo));if(!e||!e.planId)return;placeAsk(row,'h'+e.planId,{type:'hist',id:e.planId,label:e.text},'tkb-askrow',btn)})}
  if(h==='needs'){const hd=B.querySelector('.nydh .row1');const st=G('st'),D=G('DEC');if(hd&&st&&D&&D[st.di]){const d=D[st.di];placeAsk(hd,'n'+d.id,()=>({type:'need',id:(G('DEC')[G('st').di]||{}).id,label:(G('DEC')[G('st').di]||{}).q}),'tkb-askrow')}}
  if(h==='tidy')B.querySelectorAll('.grp .gh [data-trash]').forEach(btn=>placeAsk(btn.parentElement,'t'+btn.dataset.trash,{type:'tidy',id:btn.dataset.trash,label:btn.parentElement.querySelector('b').textContent},'tkb-askrow',btn));
  if(h==='diary'){const a=B.querySelector('.sacts')||B.querySelector('.acts');const st=G('st');if(a&&st)placeAsk(a,'p'+st.dy.i,()=>({type:'photo',id:G('st').dy.i,label:'this photo'}),'')}
  if(h==='prefs')B.querySelectorAll('.srow[data-skey]').forEach(r=>{const l=r.querySelector('.stx b');if(!l)return;/* only rows with their own control, so the button sits before it and the row keeps its height */if(r.classList.contains('wide')||![...r.children].some(x=>x!==r.firstElementChild&&!x.classList.contains('stx')&&!x.classList.contains('tkb-askbtn')))return;const tools=TOOLS.filter(t=>t.section==='Settings'&&normN(l.textContent).split(' ').filter(w=>w.length>3).some(w=>normN(t.feature).includes(w)));if(!tools.length)return;placeAsk(r,'s'+r.dataset.skey,{type:'setting',id:r.dataset.skey,label:l.textContent},'tkb-askset',[...r.children].find(x=>x!==r.firstElementChild&&!x.classList.contains('stx')&&!x.classList.contains('tkb-askbtn'))||null)});
  /* a section with any row that has no button of its own gets one in its heading (a section with no heading: the page heading) */
  if(h==='prefs'&&!/how$/.test(location.hash))B.querySelectorAll('.sgrp').forEach(g=>{const rows=[...g.querySelectorAll('.srow')];if(!rows.length)return;const need=rows.some(r=>!r.querySelector(':scope > .tkb-askbtn'));const h4=g.querySelector(':scope > h4');const pane=(location.hash.split('/')[1]||'general');const id=h4?h4.textContent.trim():pane;const host=h4||B.querySelector('.phead');if(!host)return;
   if(!need){host.querySelectorAll(':scope > .tkb-asksec').forEach(x=>x.remove());return}
   if(!h4&&!SECTION_TOOLS[id])return;host.classList.add('tkb-sech');placeAsk(host,'sec'+id,{type:'section',id,label:h4?id:cap(pane)},'tkb-askset tkb-asksec')});
  if(h==='edit'){const hd=document.querySelector('#wbpanel .fp-hd');const W=G('WB');if(hd&&W&&W.sel)placeAsk(hd,'w'+W.sel.id,()=>Object.assign({},G('WB').sel),'tkb-askrow')}}
 if(pg==='brain'){const hd=document.querySelector('#insp.on .ihead');const tt=document.querySelector('#insp.on #ititle');if(hd&&tt){const name=tt.textContent.trim();placeAsk(hd,'b'+name,()=>{const nm=(document.querySelector('#insp.on #ititle')||{}).textContent||'';const v=V();const id=findNode(nm.trim());if(id)return {type:'node',id};const f=findFiles(nm.trim())[0];return f?{type:'file',id:f}:{type:'none',label:nm.trim()}},'tkb-askrow')}}
 if(pg==='finder'){const tb=document.getElementById('tagBtn');if(tb&&tb.parentElement)placeAsk(tb.parentElement,'f',()=>curSel()||{type:'none',label:'this'},'tkb-askset tkb-askfinder',tb.nextSibling)}}
if(PG()!=='map'){let t=0;const mo=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{mo.disconnect();try{injectAsk()}catch(e){console.error(e)}mo.observe(document.body,{childList:true,subtree:true})},80)});addEventListener('load',()=>{setTimeout(()=>{injectAsk();mo.observe(document.body,{childList:true,subtree:true})},300)})}

window.TuckBot={miss:(q,n)=>{openRoom(q,null);return line('miss',{q:esc(q),n})},talk,moodOf,thinking:q=>{openRoom(q,null);return line('think')},voice:{line,me,HEAVY},injectAsk,curSel,askAbout,TOOLS,TOOL,matchTool,runTool,PG,ctypeOf,openIn,setContext:s=>{ctxSel=s},context:()=>ctxSel,decisionReply,reply,html,handle,started,attach,after,disclosure,chipsFor,parse,auto,css,closeMenu,undoCard:undo,
 levels:()=>LEVELS.map(l=>({key:l[0],label:l[1]})),_cards:th=>th.msgs().map(m=>m.bot&&m.bot.card).filter(Boolean)};
})();
