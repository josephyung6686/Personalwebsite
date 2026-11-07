/* plan.js: ONE folder plan for every page of prototype 38 (Workbench, Finder, Brain, Needs You, chat).
   The tree is built from sample.js (LIFE_AREAS, EXTRA_TOP, PRIVATE_FILES) plus the files inside each folder.
   It is a VIEW: Desktop › Studying › PHYS 1401 is how Tuck shows your files. Nothing moves on disk.

   State lives in localStorage 'tuckPlan', so a change made in one page (or tab) shows in the others at once.
     applied: batches already used (each is one History row with one Undo)
     pending: changes waiting for Apply (the Workbench's bottom bar)
     levels:  what the AI may read, per folder or file ('read' | 'names' | 'private'); written at once, with Undo

   API
     Plan.view()            the plan with pending changes  -> View (see below)
     Plan.before()          the plan as last applied (no pending changes) -> View
     Plan.change(op)        add one pending change; returns the op (with .id and .text). Ops:
                              {ty:'rename', node, name}            {ty:'putInside', nodes:[], parent|null}
                              {ty:'merge', nodes:[], into}         {ty:'hide', nodes:[]} / {ty:'show', nodes:[]}
                              {ty:'deleteEmpty', node}             {ty:'keep', node}
                              {ty:'newFolder', node?, parent|null, name}
                              {ty:'split', node, parts:[{name, files:[fileIds]}]}
                              {ty:'accept', node} / {ty:'reject', node}   (Tuck's suggested folders: ✓ / ✕)
                              {ty:'moveFiles', files:[], to}
                              {ty:'batch', label, ops:[...]}       (a re-sort plan: one change)
     Plan.pending()         pending ops, newest last      Plan.summary() -> {changes, files, line}
     Plan.undo()            take back the newest pending change      Plan.revert(opId)    Plan.discard()
     Plan.apply(text?)      use every pending change: one History row; returns the row
     Plan.applyMine(ops, text)  the person's own edits from the chat, with the rules for your own changes (chatbot.js). Op {ty:'trash', files, names}: to the Trash, Undo puts back
     Plan.applyNow(ops, text)  use these ops straight away (Re-sort with Just Do It, Use These Folders)
     Plan.undoApply(rowId)  Undo (and Redo, called again) for one History row; Plan.undoLevel(rowId) for a setLevel row      Plan.history() -> rows, newest first
     Plan.setLevel(target, level|'inherit')  what the AI may read (target = node id or file id); one History row
     Plan.compare(extraOps) {before, after, moves:[{file, from, to}], newNodes:[ids], text}
                            (no extraOps: last applied vs pending; with extraOps: pending vs pending + these)
     Plan.subscribe(fn)     fn(reason) on every change here or in another tab; returns unsubscribe
     Plan.reset()           back to the sample (tests)
     Plan.kind(name)        {ic, c, label}       Plan.LEVELS    Plan.ago(days) -> 'Today' | 'Oct 29'
     Plan.draftSplit(id)    Tuck's split draft: [{name, files}]
     Plan.draftArrange(id, way)  [{name, files}] for way 'thing' | 'year' | 'kind' (resort.ask's ways); [] if that way doesn't fit
     Plan.draftBest(id, way)     that way, else the next that fits
     Plan.counts()          {all, folders, noFolder, new, newBy, needs}: folders = Plan.folderCount() (no open suggestions, not No folder yet, not hidden)
     Plan.smallTalk(text)   {type:'talk', text, html, starters} for hi / thanks / help, else null. Plan.answer() returns it first.
     Plan.recentSorted()    [{id, text, path, node, from, n, priv, minsAgo, at, when, day, files}] newest first: only files the plan has sorted now
     Plan.when(minsAgo)     'Just now' | '8 min ago' | '2:15 PM' (today) | 'Yesterday' | '29 Oct'      Plan.NOW  page-load time (ms)
     Plan.arrived(fileIdOrName)  {minsAgo, at, when, day}: when a file in No folder yet came in
     Plan.sortNew(ids?)     Sort New Files, the one state (rule 27): a History row {id, at, text, kind:'sortNew', n, files, ops} | null. Plan.sortedNew() -> {row, n, at, minsAgo, when, files, undone} | null
                            Plan.undoSortNew(); Plan.isSortRow(row). Mirror: localStorage 'tuckSortedNew'. recentSorted() includes these rows (kind:'sortNew', row)
     Plan.realFolder(name)  files really in that folder on disk ('Downloads', 'Desktop', 'Desktop › School › PHYS 1401'), newest first, each with where and isNew (rule 26)
                            Plan.realWhere(file) -> real folder path   Plan.realFolders() -> {folder: count}
     Plan.READ_TOTAL        4402 items read in setup; Plan.readLine() / Plan.READ_LINE: the honest line about 4,402 read and the sample sorted (rule 31)
     Plan.can(tool, id)     {ok, why}: may this tool act on it? ('rename' 'move' 'merge' 'split' 'arrange' 'resort' 'delete'). Every menu,
                            panel, Brain, the chat and resort.js ask this, and show why when not.
     Plan.guard(op, tuck)   '' or why an op breaks a rule. Plan.change and Plan.applyNow refuse such ops (return null, set Plan.lastRefusal,
                            fire a 'tuckrefused' event that folderpanel.js shows). The rules: private files are never planned; Keep As Is
                            folders are never renamed, moved, merged, split or reshaped; Keep As Is items never move; Never Look In folders
                            (hidden, or named in Settings) are skipped.
     Plan.sortPlan()        Sort New Files' checklist rows [{id, name, from, to, path, sure, why, stay}]; Plan.sortNew(ids, {fileId: folderId})
     Plan.isKept(id)  Plan.setKeep(id, on)   Keep As Is, one setting: the plan's keep op and localStorage 'tuckPins'; one History row, Undo
     Plan.limits()          'Ask About Everything' | 'Ask When Unsure' | 'Just Do It' | 'Plan Only' (localStorage 'tuckLimits')
   View
     v.node(id) v.file(id) v.roots() v.kids(id) v.files(id, deep) v.total(id) v.path(id) v.pathIds(id) v.depth(id)
     v.area(id) -> {id,name,hue,ic}   v.level(id) -> {level, own, from}   v.lastAdded(id) -> days
     v.mostly(id) -> 'Mostly from Downloads and Desktop'   v.find(q) -> [{type, id}]   v.all() -> node ids
   Backend routes these map to (b6 db71b66d): folder.edit (rename, putInside, merge, hide, deleteEmpty),
   plan.edit (keep, new_folder, split, move_file, accept), plan.suggest, resort.start/estimate/ask/answer,
   plan.apply, plan.undo, privacy.setItem. Staged Apply of several edits has no route yet (see report). */
(function(){
const KEY='tuckPlan',LKEY='tuckLimits',QKEY='tuckQueue';
const KIND={pdf:['file-pdf','--k-pdf','PDF'],docx:['file-doc','--k-doc','Word'],xlsx:['file-xls','--k-xls','Spreadsheet'],pptx:['presentation','--k-pdf','Slides'],
 png:['image','--k-img','Image'],heic:['image','--k-img','Photo'],txt:['file-text','--k-txt','Text'],py:['file-code','--k-code','Code'],html:['file-code','--k-code','Code'],css:['file-code','--k-code','Code'],js:['file-code','--k-code','Code'],
 step:['cube','--k-code','CAD'],m4a:['music-notes','--k-img','Audio'],dmg:['package','--k-txt','Installer'],zip:['file-zip','--k-txt','Zip']};
const extOf=n=>(String(n).split('.').pop()||'').toLowerCase();
const kind=n=>{const k=KIND[extOf(n)]||KIND.txt;return {ic:k[0],c:k[1],label:k[2]}};
const S=(tpl,a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(tpl.replace('{n}',i).replace('{nn}',String(i).padStart(2,'0')));return o};

/* the files inside each folder: real-looking names, the same on every page */
const NAMES={
 phys:[...['Kinematics','Forces','Energy','Momentum','Rotation','Gravity'].map((t,i)=>`Lecture ${i+1} ${t}.pdf`),...S('Problem Set {n}.pdf',1,3),'Midterm review.pdf','Formula sheet.pdf'],
 lb:['Lab 1.pdf','Lab 2.pdf','Lab 3.pdf','Lab 3 data.xlsx','Lab 4 handout.pdf','Lab 4 data.xlsx','Lab 5 prelab.pdf','Lab 5.pdf','Lab 6.pdf','Lab 6 data.xlsx','Lab 7.pdf','Lab safety form.pdf'],
 econ:[...S('Problem Set {n}.pdf',1,6),...S('Week {n} notes.pdf',1,6),'ECON 2257 syllabus.pdf','Midterm 1 study guide.pdf','Problem Set 5 notes.docx'],
 coms:['HW1 binary search.py','HW2 linked lists.py','HW3 recursion.py','HW4 trees.py','HW5 hashing.py',...S('COMS Lecture {n}.pdf',1,6),'Lab 1 lists.py','Lab 2 sorting.py','COMS 1004 syllabus.pdf'],
 engi:['Design brief.pdf','CAD bracket v1.step','CAD bracket v2.step','Team charter.docx','Gantt chart.xlsx','Design review slides.pptx','Bill of materials.xlsx','Sketches week 3.png'],
 writ:['Essay 1 draft.docx','Essay 1 final.docx','Essay 2 draft.docx','Essay 2 final.docx','Essay 3 outline.docx','Reading list.pdf','Annotated bibliography.docx','Peer review notes.docx','Writing Seminar syllabus.pdf'],
 reg:['Unofficial transcript.pdf','Tuition bill Fall 2026.pdf','Financial aid award 2026.pdf','Fall 2026 schedule.pdf','Add drop form.pdf'],
 grc:['Offer letter GRC.pdf','GRC onboarding deck.pptx'],
 wp:['Website Proposal.docx','Website Proposal v2.docx','Sitemap.pdf','Budget.xlsx','Wireframes v1.png','Wireframes v2.png','Wireframes v3.png','Client brief.pdf','Timeline.xlsx','Competitor review.docx','Homepage copy.docx','Moodboard.png','Kickoff notes.docx','Proposal feedback.docx'],
 inv:S('Invoice 00{n}.pdf',32,43).reverse(),
 meet:['Standup Oct 28.docx','Standup Oct 21.docx','Standup Oct 14.docx','Standup Oct 7.docx','Client call notes Oct.docx','Client call notes Sep.docx','Team retro Sep.docx','Planning meeting Q4.docx','1-on-1 with Dana.docx'],
 time:S('Timesheet week {n}.xlsx',1,8).reverse(),
 res:['Resume (6).pdf','Resume (5).pdf','Resume (4).pdf','Resume (3).pdf','Resume (2).pdf','Resume (1).pdf','Resume final.pdf'],
 cov:['Cover letter GRC.docx','Cover letter Stripe.docx','Cover letter Google.docx','Cover letter Jane Street.docx','Cover letter Deloitte.docx','Cover letter template.docx'],
 apps:['Applications tracker.xlsx','Stripe offer.pdf','Google application.pdf','Jane Street application.pdf','Deloitte application.pdf','References.docx','Writing sample.pdf','Stripe onsite schedule.pdf','Portfolio link.txt'],
 intv:['Interview prep Stripe.docx','STAR stories.docx','Case practice 1.pdf','Case practice 2.pdf','Behavioral questions.docx','Salary research.xlsx','Thank you note Stripe.docx','Mock interview notes.docx'],
 tax:['Form 1040 draft 2025.pdf','W-2 GRC Associates 2025.pdf','1098-T Columbia 2025.pdf','1099-INT Chase 2025.pdf','Charity receipt 2025.pdf','Tax checklist 2025.xlsx','State return draft 2025.pdf','Estimated payments 2025.xlsx'],
 ids:['Passport scan.pdf','Student ID.png'],
 lease:['Lease signed 2026.pdf','Renters insurance.pdf','Move-in checklist.pdf','Roommate agreement.docx','Utility setup.pdf'],
 bills:[...['Oct','Sep','Aug','Jul','Jun'].map(m=>`Con Ed ${m} 2026.pdf`),...['Oct','Sep','Aug','Jul','Jun'].map(m=>`Verizon ${m} 2026.pdf`)],
 orders:['Amazon order 113-4471.pdf','Amazon order 113-3820.pdf','Amazon order 113-2954.pdf','Apple receipt.pdf','Best Buy receipt.pdf','IKEA order.pdf','Amazon order 113-1736.pdf','Target receipt.pdf','Uniqlo order.pdf'],
 trips:S('IMG_44{nn}.HEIC',1,24).reverse(),wb:S('IMG_22{nn}.HEIC',3,10).reverse(),fam:S('IMG_30{nn}.HEIC',1,14).reverse(),
 shots:Array.from({length:20},(_,i)=>shotName(30-i)),
 port:['index.html','about.html','styles.css','main.js','Portfolio copy.docx','Headshot.png','Project shot 1.png','Project shot 2.png','Project shot 3.png','Project shot 4.png','Case study GRC.docx','Domain receipt.pdf'],
 robo:['Robot arm wiring.pdf','Sensor test.xlsx','Meeting minutes Oct.docx','Meeting minutes Sep.docx','Motor specs.pdf','Arm CAD v3.step','Competition rules 2026.pdf','Budget request.xlsx','Build log.docx','Team photo.HEIC'],
 music:['Demo 3.m4a','Demo 2.m4a','Demo 1.m4a','Lyrics.txt','Chord charts.pdf','Mix notes.txt'],
 ins:['Insurance card.pdf','Student health plan.pdf','Claim form.pdf','Coverage summary 2026.pdf','EOB Sep.pdf'],
 appt:['Dentist Nov 4.pdf','Vaccination record.pdf','Physical form 2026.pdf','Eye exam receipt.pdf'],
 fit:['Running log.xlsx','Gym membership.pdf','Half marathon plan.pdf'],
 inst:['Zoom.dmg','Notion-3.2.dmg'],
 loose:['Lab 8 prelab.pdf','Cover letter Two Sigma.docx','Invoice 0044.pdf','IMG_5120.HEIC','Notes.txt']};
/* the real files Finder shows (finder.html REAL) are part of the same library, so every page counts the same files.
   Added at the end of each folder, so earlier file ids (phys.0 …) stay the same. */
Object.entries({phys:['Lab 3 Pendulum.pdf','Lab 2 Projectile Motion.pdf','Lab 3 draft.docx'],shots:['Screenshot 2026-10-22 at 14.03.11.png','Screenshot 2026-10-28 at 09.41.52.png'],
 res:['Joseph Yung Resume 2026.pdf','Resume (old).docx'],cov:['Cover Letter GRC Associates.docx'],bills:['Budget October.xlsx','Barnard club budget.xlsx'],grc:['GRC onboarding packet.pdf'],
 apps:['Offer letter GRC Associates.pdf'],trips:['Spring trip plan.docx','IMG_4377.HEIC'],
 loose:['PHYS1401_Lab4_handout.pdf','ECON 2257 PS6.pdf','Screenshot 2026-11-01 at 00.41.12.png','Screenshot 2026-10-30 at 18.22.40.png','Screenshot 2026-10-31 at 11.05.17.png']}).forEach(([k,a])=>NAMES[k].push(...a));
/* where Tuck would put a file if asked again (the prototype's stand-in for the placer) */
const HINT={'PHYS1401_Lab4_handout.pdf':'phys','ECON 2257 PS6.pdf':'econ','Screenshot 2026-11-01 at 00.41.12.png':'shots','Screenshot 2026-10-30 at 18.22.40.png':'shots','Screenshot 2026-10-31 at 11.05.17.png':'shots','Lab 8 prelab.pdf':'lb','Cover letter Two Sigma.docx':'cov','Invoice 0044.pdf':'inv','IMG_5120.HEIC':'trips','IMG_4419.HEIC':'wb',[shotName(29)]:'phys','Sensor test.xlsx':'engi'};
/* why Tuck made each folder: from file names and kinds only (private folders never quote words from inside) */
const WHY={phys:'Mostly lectures, problem sets and labs for PHYS 1401, plus a midterm review and a formula sheet',lb:'Files named Lab 1 to Lab 7, with their data sheets and a safety form',econ:'Problem sets and weekly notes named for ECON 2257',coms:'Python homework and lectures for COMS 1004',engi:'Design files and CAD drawings for ENGI 1006',writ:'Essay drafts and readings for Writing Seminar',
 reg:'A transcript, a tuition bill, an aid award and your schedule, by name and kind',grc:'Your offer letter and onboarding deck from GRC Associates',wp:'Files named Website Proposal, Wireframes and Sitemap',inv:'Invoices numbered 0032 to 0043, billed to GRC',meet:'Standups and client calls, named by date',time:'Weekly timesheets, one per week since June',
 res:'Every version of your resume, by name',oldres:'Resume (1) to (5) and Resume final are earlier versions of Resume (6)',cov:'Cover letters, one per company',apps:'Applications and offers, named by company',intv:'Interview prep and practice cases',
 tax:'Tax forms by name: W-2, 1098-T, 1099-INT and a 1040 draft',ids:'A passport scan and your student ID, by name',lease:'Your lease and renters papers',bills:'Monthly Con Ed and Verizon bills',orders:'Order receipts from shops',
 trips:'Photos taken away from home, grouped by date',wb:'Photos of whiteboards taken during lectures',shots:'Screenshots from your Desktop',fam:'Photos with family, by date',port:'Pages and images for your portfolio site',robo:'Wiring, sensor tests and minutes for Robotics club',music:'Demos, lyrics and chord charts',
 ins:'An insurance card, your health plan and claim forms, by name',appt:'Dentist, eye exam and vaccination papers, by name',fit:'A running log, a gym membership and a race plan, by name',
 study:'Course files named for PHYS 1401, ECON 2257, COMS 1004, ENGI 1006 and Writing Seminar, plus registration papers',work:'Files that name GRC Associates: the website project, invoices, meeting notes and timesheets',job:'Resumes, cover letters, applications and interview prep, by name',home:'Tax forms, IDs, your lease, bills and order receipts, by name',photo:'Photos and screenshots, grouped by date and place',proj:'Your portfolio site, the robotics club and music',health:'Insurance cards, a health plan, dentist and eye exam papers, by name',inst:'Installers for apps you already have',loose:'Tuck isn’t sure where these go yet'};
/* how sure Tuck is about a folder (rule 24): one word and one number everywhere, from Plan.conf(). Thresholds: >=90 Sure, >=75 Leaning, else Not sure */
const SURE={wb:'leaning',robo:'unsure',lb:'sure',fit:'leaning',oldres:'leaning'};
const PCT={lb:92,oldres:88,robo:64,wb:80,fit:78};
const FROM={png:'Desktop',heic:'Pictures',dmg:'Downloads',py:'Documents',step:'Documents',html:'Documents',css:'Documents',js:'Documents',m4a:'Music'};
const SIZE={pdf:[180,1400],docx:[30,90],xlsx:[40,120],pptx:[2400,9000],png:[600,2200],heic:[1800,3200],txt:[2,8],py:[3,12],step:[800,3000],m4a:[3000,7000],dmg:[90000,140000],html:[4,20],css:[3,9],js:[5,30]};
const hash=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h};
/* one clock (rule 18): the moment the page loaded. TODAY is the start of that real day, never a typed-in date */
const NOW=Date.now();
const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
const TODAY=new Date(dayStart(new Date(NOW)));
/* midnight k days before today (calendar days, safe across clock changes) */
const daysBack=k=>{const d=new Date(TODAY);d.setDate(d.getDate()-k);return d.getTime()};
/* one date style everywhere: '28 Oct', 'Tuesday 27 Oct', '9:30 AM' (never the locale's 'Sept') */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WDAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DM=d=>`${d.getDate()} ${MON[d.getMonth()]}`,WDM=d=>`${WDAY[d.getDay()]} ${DM(d)}`;
const clock=d=>d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const ago=d=>d<=0?'Today':d===1?'Yesterday':DM(new Date(daysBack(d)));
const LEVELS={read:{label:'Read everything',short:'Can read',line:'Tuck’s AI may read every page of these files to sort them.'},
 names:{label:'Names only',short:'Names only',line:'Only the file name and kind are sent to AI. Nothing from inside.'},
 private:{label:'Private',short:'Private',line:'Never sent to AI. You can still open and preview them.'}};

/* ---------- the sample, built once */
function seed(){const nodes={},files={};const order=[];
 const add=(id,name,parent,extra)=>{nodes[id]=Object.assign({id,name,parent,sug:false,kept:false,hidden:false,gone:false,isNew:false,own:false,why:WHY[id]||'',sure:SURE[id]||'sure'},extra);order.push(id)};
 const addFiles=(id,names,base)=>names.forEach((n,i)=>{const e=extOf(n),fid=id+'.'+i,sz=SIZE[e]||[20,80],h=hash(n);
  const age=base+i*(id==='trips'||id==='fam'?17:id==='shots'||id==='loose'?1:id==='bills'||id==='inv'?12:4)+(h%3);
  files[fid]={id:fid,name:n,node:id,home:id,age,size:Math.round(sz[0]+(h%100)/100*(sz[1]-sz[0])),from:FROM[e]||(h%5===0?'Desktop':h%7===0?'Documents':'Downloads'),priv:PRIVATE_FILES.has(n),hint:HINT[n]||null}});
 LIFE_AREAS.forEach((a,ai)=>{add(a.id,a.name,null,{areaOf:a.id,priv:!!a.priv,pkind:a.pkind||null});
  a.topics.forEach((t,ti)=>{add(t.id,t.name,a.id,{priv:!!t.priv,pkind:t.pkind||null});addFiles(t.id,NAMES[t.id]||[],ai+ti);(t.kids||[]).forEach(k=>{add(k.id,k.name,t.id);addFiles(k.id,NAMES[k.id]||[],ti+1)})})});
 /* Tuck's suggested folders: dashed until you say ✓ or ✕ */
 add('lb','Labs','phys',{sug:true});addFiles('lb',NAMES.lb,0);
 add('oldres','Old Resumes','res',{sug:true});Object.values(files).filter(f=>f.node==='res'&&!/\(6\)|Resume 2026/.test(f.name)).forEach(f=>{f.node='oldres';f.home='oldres'});
 EXTRA_TOP.forEach(x=>{add(x.id,x.name,null,{extra:true,ic:x.ic});addFiles(x.id,NAMES[x.id]||[],12)});
 add('loose','No folder yet',null,{special:true});addFiles('loose',NAMES.loose,0);
 /* files that arrived this week are New; some older files have not been opened in a while (Older) */
 return {nodes,files,order}}
const SEED=seed();
/* Finder's real files keep their real size, date and place on every page (finder.html REAL): [KB, days ago, where] */
const REALF={"Lab 3 Pendulum.pdf":[1240,18,"Desktop › School › PHYS 1401"],"Lab 2 Projectile Motion.pdf":[982,32,"Desktop › School › PHYS 1401"],"Lab 3 data.xlsx":[64,19,"Desktop › School › PHYS 1401"],"Midterm review.pdf":[2310,12,"Desktop › School › PHYS 1401"],"Problem Set 4.pdf":[410,23,"Desktop › School › ECON 2257"],"Problem Set 5.pdf":[455,9,"Desktop › School › ECON 2257"],"Problem Set 5 notes.docx":[38,7,"Desktop › School › ECON 2257"],"Screenshot 2026-10-22 at 14.03.11.png":[812,10,"Desktop"],"Screenshot 2026-10-28 at 09.41.52.png":[1104,4,"Desktop"],"Lab 3 draft.docx":[52,20,"Desktop"],"Screenshot 2026-10-30 at 18.22.40.png":[760,2,"Desktop"],"Screenshot 2026-10-31 at 11.05.17.png":[690,1,"Desktop"],"Joseph Yung Resume 2026.pdf":[188,13,"Documents › Resume"],"Resume (old).docx":[61,244,"Documents › Resume"],"Cover Letter GRC Associates.docx":[44,50,"Documents › Resume"],"Form 1040 draft 2025.pdf":[730,207,"Documents › Tax 2025"],"W-2 GRC Associates 2025.pdf":[220,273,"Documents › Tax 2025"],"1098-T Columbia 2025.pdf":[160,275,"Documents › Tax 2025"],"Notes.txt":[3,2,"Documents"],"Passport scan.pdf":[1900,151,"Documents"],"Budget October.xlsx":[41,1,"Documents"],"PHYS1401_Lab4_handout.pdf":[640,0,"Downloads"],"ECON 2257 PS6.pdf":[398,0,"Downloads"],"Screenshot 2026-11-01 at 00.41.12.png":[930,0,"Downloads"],"GRC onboarding packet.pdf":[3400,26,"Downloads"],"Invoice 0043.pdf":[96,5,"Downloads"],"Offer letter GRC Associates.pdf":[210,65,"Downloads"],"Unofficial transcript.pdf":[350,59,"Downloads"],"Tuition bill Fall 2026.pdf":[284,79,"Downloads"],"Financial aid award 2026.pdf":[312,102,"Downloads"],"IMG_4412.HEIC":[2800,14,"Downloads"],"IMG_4415.HEIC":[3100,14,"Downloads"],"IMG_4420.HEIC":[2600,8,"Downloads"],"Zoom.dmg":[94100,61,"Downloads"],"Notion-3.2.dmg":[121400,30,"Downloads"],"Barnard club budget.xlsx":[58,3,"iCloud Drive"],"Spring trip plan.docx":[27,21,"iCloud Drive"],"IMG_4377.HEIC":[2400,27,"iCloud Drive"]};
/* the files with no folder yet arrived in Downloads (an AirDropped photo lands there too); Notes.txt sits in Documents (see REALF) */
Object.values(SEED.files).forEach(f=>{if(f.node==='loose'&&!REALF[f.name]){f.from='Downloads';f.where='Downloads'}});
Object.values(SEED.files).forEach(f=>{const r=REALF[f.name];if(!r)return;f.size=r[0];f.age=r[1];f.where=r[2];f.from=r[2].split(' › ')[0]});
/* files that arrived today in No folder yet: minutes before the page loaded (Needs You's Updates, Finder and Edit Folders say the same day) */
const ARRIVED={'Lab 8 prelab.pdf':5,'PHYS1401_Lab4_handout.pdf':42,'ECON 2257 PS6.pdf':75};
/* the older resumes were saved from March to September (Needs You's Old Resumes card quotes these dates) */
const RES_AGE={'Resume (1).pdf':226,'Resume (2).pdf':198,'Resume (3).pdf':168,'Resume (4).pdf':137,'Resume (5).pdf':106,'Resume final.pdf':55};
/* IMG_2210.HEIC: taken during the last PHYS 1401 lecture (Tuesdays and Thursdays, 10:10 to 11:25) at least 2 days ago, at 10:12 */
const LECT=(()=>{for(let k=2;k<9;k++){const d=new Date(daysBack(k));if(d.getDay()===2||d.getDay()===4)return k}return 5})();
const FIXED_AT={'IMG_2210.HEIC':daysBack(LECT)+(10*60+12)*6e4};
/* the date and time written in a name ("Screenshot 2026-10-22 at 14.03.11.png"), when it is not in the future */
const nameAt=n=>{const m=/(\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})(?:\.(\d{2}))?/.exec(n);if(!m)return null;const t=new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)).getTime();return t<=NOW?t:null};
const sortedMins=n=>{for(const r of (window.SORTED_LOG||[]))if(r.files.includes(n))return r.mins;return null};
/* when a file came in, in ms, never after NOW. Order: a date-time in its name, a fixed moment, today's arrivals, Tuck's sort log
   (files without Finder data), else its age in days at a time of day taken from its name */
function atOf(f){const n=f.name;let t=nameAt(n);if(t!==null)return t;if(FIXED_AT[n])return FIXED_AT[n];
 if(ARRIVED[n]!==undefined)return NOW-ARRIVED[n]*6e4;
 const sm=!REALF[n]?sortedMins(n):null;if(sm!==null)return NOW-sm*6e4;
 const h=hash(n),off0=x=>x%60===0?x+7:x;
 /* today's files: earlier this morning (after 6:30 when the page loads later than that), never after NOW */
 if(f.age<=0){const lo=NOW-TODAY.getTime()>(6.5*60+10)*6e4?TODAY.getTime()+6.5*36e5:TODAY.getTime();const span=Math.max(1,Math.floor((NOW-lo)/6e4)-1);
  let t=NOW-(1+h%span)*6e4;if(new Date(t).getMinutes()===0)t-=6e4;return Math.max(TODAY.getTime(),t)}
 /* older files: a daytime moment between 8:00 AM and 10:59 PM, never on the hour */
 return daysBack(f.age)+off0(8*60+h%(15*60))*6e4}
Object.values(SEED.files).forEach(f=>{if(RES_AGE[f.name]!==undefined)f.age=RES_AGE[f.name];if(ARRIVED[f.name]!==undefined)f.age=0;
 f.at=Math.min(NOW,atOf(f));f.age=Math.max(0,Math.round((TODAY.getTime()-dayStart(new Date(f.at)))/864e5))});
/* dates follow the sequence (rule 25): in a numbered series (Lab 1 to 8, Lecture 1 to 6, Problem Set 1 to 6, Week N notes, invoices,
   monthly bills), a higher number is newer. Files whose time is known (Finder's real files, today's arrivals, dates in names) are anchors;
   the others are placed between them, or a series step before the first and after the last, at a daytime moment. */
(function(){const MI={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
 const SER=[[/^Lecture (\d+)\b/,'lec',3.5],[/^COMS Lecture (\d+)\b/,'lec',3.5],[/^Problem Set (\d+)\b/,'ps',7],[/^ECON 2257 PS(\d+)\b/,'ps',7],[/^Lab (\d+)\b/,'lab',7],
  [/^Week (\d+) notes/,'week',7],[/^HW(\d+)\b/,'hw',7],[/^Essay (\d+)\b/,'essay',14],[/^Timesheet week (\d+)\b/,'ts',7],[/^Invoice 00(\d+)\b/,'inv',13],
  [/^Demo (\d+)\b/,'demo',12],[/^Case practice (\d+)\b/,'case',4],[/^Wireframes v(\d+)\b/,'wf',6],[/^CAD bracket v(\d+)\b/,'cad',8],[/^Meeting minutes (\w{3})\b/,'mm',30,1],
  [/^(?:Con Ed|Verizon) (\w{3}) 20\d\d/,'bill',30.4,1],[/^Client call notes (\w{3})\b/,'call',30,1],
  [/^Project shot (\d+)\b/,'shot',3],[/^IMG_22(\d\d)\.HEIC$/,'wbimg',3.5]];
 const course=f=>{let h=f.home==='loose'?(f.hint||'loose'):f.home;if(h==='lb')h='phys';return h};
 const hard=f=>!!(REALF[f.name]||ARRIVED[f.name]!==undefined||RES_AGE[f.name]!==undefined||FIXED_AT[f.name]||nameAt(f.name)!==null);
 const soft=f=>!REALF[f.name]&&sortedMins(f.name)!==null;
 const G={};Object.values(SEED.files).forEach(f=>{for(const [re,key,step,mon] of SER){const m=re.exec(f.name);if(!m)continue;const num=mon?MI[m[1]]:+m[1];if(num===undefined)continue;
  const g=G[course(f)+'|'+key+'|'+(key==='bill'?f.name.split(' ')[0]:'')]||(G[course(f)+'|'+key+'|'+(key==='bill'?f.name.split(' ')[0]:'')]={step,ms:[]});g.ms.push({f,num,cap:NOW});break}});
 const D=864e5,daytime=(t,f)=>{const h=hash(f.name),m=8*60+h%(15*60);let x=dayStart(new Date(t))+(m%60===0?m+7:m)*6e4;return x};
 Object.values(G).forEach(g=>{const ms=g.ms;if(ms.length<2)return;
  let anc=ms.filter(m=>hard(m.f)||soft(m.f));const hd=anc.filter(m=>hard(m.f));
  /* a sort time that would put a file after a newer-numbered real file is only when Tuck sorted it, not when it came: it may move earlier */
  anc=anc.filter(m=>hard(m.f)||!hd.some(h=>(h.num>m.num&&h.f.at<m.f.at)||(h.num<m.num&&h.f.at>m.f.at)));
  ms.forEach(m=>{if(!anc.includes(m)&&soft(m.f))m.cap=m.f.at});
  if(!anc.length){const top=ms.slice().sort((a,b)=>b.num-a.num||b.f.at-a.f.at)[0];top.f.at=Math.max(...ms.map(m=>m.f.at));anc=[top]}
  const pts={};anc.forEach(a=>{(pts[a.num]=pts[a.num]||[]).push(a.f.at)});const P=Object.keys(pts).map(Number).sort((a,b)=>a-b).map(n=>{const s=pts[n].sort((a,b)=>a-b);return [n,s[Math.floor((s.length-1)/2)]]});
  const at=n=>{const lo=P[0],hi=P[P.length-1];
   if(n<lo[0])return lo[1]-(lo[0]-n)*g.step*D;
   if(n>hi[0]){const t=hi[1]+(n-hi[0])*g.step*D;return t<NOW-36e5?t:hi[1]+(NOW-hi[1])*(n-hi[0])/(n-hi[0]+1)}
   for(let i=0;i<P.length;i++){if(P[i][0]===n){const t=P[i][1],d0=dayStart(new Date(t));return t-2*36e5>=d0+7*36e5?t-2*36e5:Math.max(d0,t-25*6e4)}if(P[i][0]>n){const a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*(n-a[0])/(b[0]-a[0])}}return hi[1]};
  ms.forEach(m=>{if(anc.includes(m))return;let t=P.some(q=>q[0]===m.num)?at(m.num):daytime(at(m.num),m.f);if(t>Math.min(NOW-6e4,m.cap))t=Math.min(NOW-6e4,m.cap,at(m.num));m.f.at=t});
  /* no two files of the series out of order, even by the hour */
  ms.sort((a,b)=>a.num-b.num||a.f.at-b.f.at);for(let i=1;i<ms.length;i++){const p=ms[i-1],m=ms[i];if(m.num>p.num&&m.f.at<=p.f.at&&!hard(m.f))m.f.at=Math.min(NOW-6e4,p.f.at+37*6e4)}
  ms.forEach(m=>{m.f.age=Math.max(0,Math.round((TODAY.getTime()-dayStart(new Date(m.f.at)))/864e5))})})})();

/* ---------- state */
let S0=null;const subs=new Set();
const blank=()=>({v:3,seq:1,pending:[],applied:[],levels:{},rules:[]});
function load(){try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.v===3)return j}catch(e){}return blank()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S0))}catch(e){}}
function st(){return S0||(S0=load())}
const uid=p=>(p||'n')+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let cache={};const bust=()=>{cache={}};
function emit(reason){bust();if(typeof mirrorSorted==='function')mirrorSorted();subs.forEach(fn=>{try{fn(reason)}catch(e){console.error(e)}})}
addEventListener('storage',e=>{if(e.key===KEY||e.key===null){S0=load();emit('sync')}if(e.key===LKEY)emit('limits');if(e.key===PINK)emit('keep');if(e.key===QKEY||e.key==='tuckAnswers')emit('needs')});

/* ---------- applying ops to a draft */
function draft(){const D={nodes:{},files:{},order:SEED.order.slice()};for(const k in SEED.nodes)D.nodes[k]=Object.assign({},SEED.nodes[k]);for(const k in SEED.files)D.files[k]=Object.assign({},SEED.files[k]);return D}
const live=(D,id)=>id&&D.nodes[id]&&!D.nodes[id].gone;
const under=(D,id,anc)=>{let c=D.nodes[id];while(c){if(c.id===anc)return true;c=D.nodes[c.parent]}return false};
function run(D,op){const N=D.nodes;
 switch(op.ty){
  case 'rename':if(live(D,op.node)&&op.name)N[op.node].name=op.name;break;
  case 'putInside':(op.nodes||[]).forEach(id=>{if(!live(D,id))return;if(op.parent&&(!live(D,op.parent)||under(D,op.parent,id)))return;N[id].parent=op.parent||null});break;
  case 'merge':(op.nodes||[]).forEach(id=>{if(!live(D,id)||!live(D,op.into)||id===op.into||under(D,op.into,id))return;
   for(const f of Object.values(D.files))if(f.node===id)f.node=op.into;for(const n of Object.values(N))if(n.parent===id&&!n.gone)n.parent=op.into;N[id].gone=true;N[id].mergedInto=op.into});break;
  case 'hide':(op.nodes||[]).forEach(id=>{if(live(D,id))N[id].hidden=true});break;
  case 'show':(op.nodes||[]).forEach(id=>{if(live(D,id))N[id].hidden=false});break;
  case 'deleteEmpty':if(live(D,op.node)&&!Object.values(D.files).some(f=>f.node===op.node)&&!Object.values(N).some(n=>n.parent===op.node&&!n.gone))N[op.node].gone=true;break;
  case 'keep':if(live(D,op.node)){N[op.node].kept=true;N[op.node].sug=false}break;
  case 'unkeep':if(live(D,op.node))N[op.node].kept=false;break;
  case 'newFolder':if(!N[op.node]&&(!op.parent||live(D,op.parent))){N[op.node]={id:op.node,name:op.name||'untitled folder',parent:op.parent||null,sug:false,kept:false,hidden:false,gone:false,isNew:true,own:true,why:'You made this folder',sure:'sure'};D.order.push(op.node)}break;
  case 'split':if(live(D,op.node))(op.parts||[]).forEach(p=>{run(D,{ty:'newFolder',node:p.id,parent:op.node,name:p.name});N[p.id].own=false;N[p.id].why=p.why||`Split from ${N[op.node].name}`;(p.files||[]).forEach(fid=>{if(D.files[fid])D.files[fid].node=p.id})});break;
  case 'accept':if(live(D,op.node)){N[op.node].sug=false;N[op.node].isNew=true}break;
  case 'reject':if(live(D,op.node)&&N[op.node].sug){const p=N[op.node].parent;for(const f of Object.values(D.files))if(f.node===op.node)f.node=p;N[op.node].gone=true;N[op.node].rejected=true}break;
  case 'moveFiles':if(live(D,op.to))(op.files||[]).forEach(fid=>{if(D.files[fid])D.files[fid].node=op.to});break;
  /* the chat's Clean Up (chatbot.js): files go to the Trash (node 'trash': out of every folder); Undo puts them back. names: what went, for History */
  case 'trash':(op.files||[]).forEach(fid=>{const f=D.files[fid];if(f&&f.node!=='trash'){f.trashedFrom=f.node;f.node='trash'}});break;
  case 'batch':(op.ops||[]).forEach(o=>run(D,o));break;}}
function build(withPending,extra){const s=st();const D=draft();
 s.applied.forEach(b=>{if(!b.undone)b.ops.forEach(o=>run(D,o))});
 if(withPending)s.pending.forEach(o=>run(D,o));(extra||[]).forEach(o=>run(D,o));return mkView(D)}

/* ---------- a read-only view of one state */
function mkView(D){const N=D.nodes,F=D.files;const kidsM={},filesM={};
 D.order.forEach(id=>{const n=N[id];if(!n||n.gone)return;(kidsM[n.parent||'']=kidsM[n.parent||'']||[]).push(id)});
 Object.values(F).forEach(f=>{(filesM[f.node]=filesM[f.node]||[]).push(f)});Object.values(filesM).forEach(a=>a.sort((x,y)=>x.age-y.age));
 const memo={};
 const v={D,
  node:id=>N[id]&&!N[id].gone?N[id]:null,raw:id=>N[id]||null,file:id=>F[id]||null,
  roots:()=>kidsM['']||[],kids:id=>kidsM[id]||[],all:()=>D.order.filter(id=>N[id]&&!N[id].gone),
  files:(id,deep)=>{if(!deep)return filesM[id]||[];const out=[];const go=x=>{out.push(...(filesM[x]||[]));(kidsM[x]||[]).forEach(go)};go(id);return out.sort((a,b)=>a.age-b.age)},
  total:id=>memo['t'+id]??(memo['t'+id]=(filesM[id]||[]).length+(kidsM[id]||[]).reduce((a,k)=>a+v.total(k),0)),
  pathIds:id=>{const p=[];let c=N[id];while(c){p.unshift(c.id);c=N[c.parent]}return p},
  path:id=>v.pathIds(id).map(x=>N[x].name),depth:id=>v.pathIds(id).length-1,
  area:id=>{const top=N[v.pathIds(id)[0]];const a=top&&LIFE_AREAS.find(x=>x.id===top.id);return a?{id:a.id,name:top.name,hue:a.hue,ic:a.ic}:{id:top&&top.id,name:top&&top.name,hue:'--a-none',ic:top&&top.ic||(top&&top.special?'tray':'folder-simple')}},
  level:id=>{const s=st();const f=F[id];
   if(f){if(s.levels[id])return {level:s.levels[id],own:s.levels[id],from:'this file'};if(f.priv)return {level:'private',own:null,from:'a private kind',kind:fileKind(f.name)};return Object.assign(v.level(f.node),{own:null})}
   let c=N[id];const first=c;while(c){if(s.levels[c.id])return {level:s.levels[c.id],own:c===first?s.levels[c.id]:null,from:c===first?'this folder':c.name};
    if(c.priv)return {level:'private',own:null,from:c===first?'a private kind':c.name,kind:c.pkind||null};c=N[c.parent]}
   const a=first&&v.area(first.id);return {level:a&&a.id==='home'?'names':'read',own:null,from:a&&a.id==='home'?'Home and Money':'default'}},
  lastAdded:id=>{const fs=v.files(id,true);return fs.length?fs[0].age:null},
  mostly:id=>{const c={};v.files(id,true).forEach(f=>c[f.from]=(c[f.from]||0)+1);const top=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);return top.length?`Mostly from ${top.slice(0,2).join(' and ')}`:''},
  size:id=>v.files(id,true).reduce((a,f)=>a+f.size,0),
  find:q=>{q=String(q||'').trim().toLowerCase();if(!q)return [];const out=[];v.all().forEach(id=>{if(N[id].name.toLowerCase().includes(q))out.push({type:'node',id})});
   Object.values(F).forEach(f=>{if(N[f.node]&&!N[f.node].gone&&f.name.toLowerCase().includes(q))out.push({type:'file',id:f.id})});return out}};
 return v}

/* ---------- describing a change in one line, before it happens */
function describe(op,v){const nm=id=>{const n=v.raw(id);return n?n.name:'a folder'};const cnt=id=>v.total(id);const pl=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
 switch(op.ty){
  case 'rename':return {ic:'textbox',ty:'ren',text:`${nm(op.node)} → ${op.name}`,sub:'Same files, new name'};
  case 'putInside':return {ic:'arrow-bend-down-right',ty:'mov',text:op.nodes.length>1?`${pl(op.nodes.length,'folder')} go inside ${op.parent?nm(op.parent):'the top level'}`:`${nm(op.nodes[0])} goes inside ${op.parent?nm(op.parent):'the top level'}`,sub:`${pl(op.nodes.reduce((a,x)=>a+cnt(x),0),'file')} come along`};
  case 'merge':return {ic:'arrows-merge',ty:'rem',text:`${op.nodes.map(nm).join(', ')} into ${nm(op.into)}`,sub:`${pl(op.nodes.reduce((a,x)=>a+cnt(x),0),'file')} join ${nm(op.into)}; ${op.nodes.length>1?'those folders go':'the folder goes'} away`};
  case 'hide':return {ic:'eye-slash',ty:'rem',text:`Hide ${op.nodes.map(nm).join(', ')}`,sub:'Hidden from your folders and the sidebar. Show Again any time'};
  case 'show':return {ic:'eye',ty:'new',text:`Show ${op.nodes.map(nm).join(', ')} again`,sub:'Back in your folders'};
  case 'deleteEmpty':return {ic:'folder-minus',ty:'rem',text:`Delete ${nm(op.node)}`,sub:'An empty folder. No files change'};
  case 'keep':return {ic:'push-pin',ty:'new',text:`Keep ${nm(op.node)} as is`,sub:'Tuck won’t rename, move or reshape it'};
  case 'unkeep':return {ic:'push-pin',ty:'mov',text:`Tuck may change ${nm(op.node)} again`,sub:''};
  case 'newFolder':return {ic:'folder-plus',ty:'new',text:`New folder ${op.name}`,sub:`Inside ${op.parent?nm(op.parent):'the top level'}`};
  case 'split':return {ic:'arrows-split',ty:'new',text:`Split ${nm(op.node)} into ${op.parts.map(p=>p.name).join(', ')}`,sub:`${pl(op.parts.reduce((a,p)=>a+p.files.length,0),'file')} move into ${pl(op.parts.length,'new folder')}`};
  case 'accept':return {ic:'check',ty:'new',text:`Make ${nm(op.node)} in ${nm((v.raw(op.node)||{}).parent)}`,sub:`Tuck’s suggestion. ${pl(cnt(op.node),'file')} go in`};
  case 'reject':return {ic:'x',ty:'rem',text:`Not making ${nm(op.node)}`,sub:'Its files stay where they are. Tuck won’t suggest it again'};
  case 'moveFiles':{const f=v.file(op.files[0]);return {ic:'file-arrow-up',ty:'mov',text:op.files.length>1?`${pl(op.files.length,'file')} to ${nm(op.to)}`:`${f?f.name:'A file'} to ${nm(op.to)}`,sub:'Shown in its new folder. Nothing moves on disk'}}
  case 'batch':return {ic:'arrows-clockwise',ty:'mov',text:op.label||'Tuck’s plan',sub:op.sub||`${pl((op.ops||[]).length,'change')}`};
  case 'trash':{const n=(op.names||op.files||[]).length;return {ic:'trash',ty:'rem',text:`${pl(n,'file')} to the Trash`,sub:'Undo puts them back'}}}
 return {ic:'dot',ty:'mov',text:op.ty,sub:''}}

/* ---------- comparing two states (Preview, re-sort plans, the bottom bar) */
function compare(extra){const before=extra?build(true):build(false),after=extra?build(true,extra):build(true);
 /* an open suggestion is not a folder yet: its files count as being in the folder around it */
 const eff=(v,id)=>{let n=v.node(id);while(n&&n.sug)n=v.node(n.parent);return n?n.id:null};
 const moves=[];Object.values(after.D.files).forEach(f=>{const b=before.D.files[f.id];const from=eff(before,b.node),to=eff(after,f.node);if(from!==to)moves.push({file:f.id,from,to})});
 const newNodes=after.all().filter(id=>!after.node(id).sug&&(!before.node(id)||before.node(id).sug));
 return {before,after,moves,newNodes,eff}}

/* ---------- Tuck's drafts: split, arrange (thing / year / kind), the re-sort placer */
const stem=n=>n.replace(/\.[^.]+$/,'').replace(/\s*\(\d+\)$/,'').replace(/\s+(v?\d+|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s\d+)?|data|handout|prelab|draft|final|notes|outline)$/i,'').replace(/\s+\d+.*$/,'').trim();
const KGROUP={PDF:'PDFs',Word:'Documents',Spreadsheet:'Spreadsheets',Image:'Images',Photo:'Photos',Slides:'Slides',Code:'Code',CAD:'CAD',Audio:'Audio',Text:'Notes',Installer:'Installers',Zip:'Zips'};
const plural=w=>/s$/.test(w)?w:/y$/.test(w)?w.slice(0,-1)+'ies':w+'s';
function groupBy(fs,key){const g={};fs.forEach(f=>{const k=key(f);(g[k]=g[k]||[]).push(f.id)});return Object.entries(g).map(([name,files])=>({name,files})).sort((a,b)=>b.files.length-a.files.length)}
function draftArrange(id,way){const v=build(true);const fs=v.files(id,false).filter(f=>!f.priv);if(fs.length<4)return [];
 let parts;
 if(way==='year')parts=groupBy(fs,f=>String(new Date(f.at).getFullYear()));
 else if(way==='kind')parts=groupBy(fs,f=>KGROUP[kind(f.name).label]||'Other');
 else parts=groupBy(fs,f=>{const s=stem(f.name);return s.length>2?(/^Week\b/i.test(s)?'Weekly notes':plural(s.replace(/^(Lecture)\b.*/i,'$1'))):'Other'});
 parts=parts.filter(p=>p.files.length>=2);const rest=fs.length-parts.reduce((a,p)=>a+p.files.length,0);
 if(parts.length<2)return [];return parts.slice(0,5).map(p=>Object.assign(p,{rest}))}
/* the way asked for first, then the others: what Suggest Subfolders and Split use */
function draftBest(id,way){for(const w of [way||'thing','thing','kind','year']){const p=draftArrange(id,w);if(p.length>=2)return p}return []}
function draftSplit(id){return draftBest(id,'thing')}
/* Plan.suggestGroups(folderId, way?) -> {total, way, groups:[{name, n, files:[ids], existing:nodeId|null, now:number|null}]} (rule 21).
   Covers every file in the folder: each subfolder is its own group (now = its count today); loose files are grouped by
   way ('thing' | 'kind' | 'year'); a loose group named like a subfolder joins it; groups of one go to "Other" (always last).
   The groups' n add up to total, which is v.total(folderId). */
const thingKey=f=>{const s=stem(f.name);return s.length>2?(/^Week\b/i.test(s)?'Weekly notes':plural(s.replace(/^(Lecture)\b.*/i,'$1'))):'Other'};
function suggestGroups(id,way){const v=build(true);way=way||'thing';if(!v.node(id))return {total:0,way,groups:[]};
 const key=way==='year'?f=>String(new Date(f.at).getFullYear()):way==='kind'?f=>KGROUP[kind(f.name).label]||'Other':thingKey;
 const groups=v.kids(id).map(k=>({name:v.node(k).name,files:v.files(k,true).map(f=>f.id),existing:k,now:v.total(k)}));
 const other=[],fresh={};
 v.files(id,false).forEach(f=>{const k=key(f);if(k==='Other'){other.push(f.id);return}
  const ex=groups.find(g=>g.name.toLowerCase()===k.toLowerCase());if(ex){ex.files.push(f.id);return}(fresh[k]=fresh[k]||[]).push(f.id)});
 Object.entries(fresh).forEach(([name,files])=>{if(files.length<2)other.push(...files);else groups.push({name,files,existing:null,now:null})});
 groups.forEach(g=>g.n=g.files.length);groups.sort((a,b)=>b.n-a.n);
 if(other.length)groups.push({name:'Other',files:other,n:other.length,existing:null,now:null});
 return {total:v.total(id),way,groups}}


/* ---------- Needs You: the one queue (tuck.html's cards q0…q5 are these, in this order) */
const NEEDS=[
 {id:'q0',yes1:'Yes, make Labs',k:'New folder',q:'Make a Labs folder in PHYS 1401?',why:'Files named Lab 1 to Lab 7 sit loose next to your lecture notes.',node:'lb',yes:[{ty:'accept',node:'lb'}],no:[{ty:'reject',node:'lb'}],yesText:'You made Labs in PHYS 1401',noText:'You said no to a Labs folder'},
 {id:'q1',yes1:'Yes, file it there',pct:71,k:'Where does this go?',q:'Is IMG_2210.HEIC your PHYS 1401 whiteboard?',why:'A photo of equations taken during your PHYS 1401 lecture. Tuck could not read the board clearly.',file:'IMG_2210.HEIC',yes:f=>[{ty:'moveFiles',files:[f],to:'phys'}],no:[],yesText:'You filed IMG_2210.HEIC in PHYS 1401',noText:'You said IMG_2210.HEIC is not from PHYS 1401'},
 {id:'q2',yes1:'Yes, move them',k:'Old versions',q:'Move your older resumes into Old Resumes?',why:'Resume (6).pdf is your newest. The others are earlier versions of it.',node:'oldres',yes:[{ty:'accept',node:'oldres'}],no:[{ty:'reject',node:'oldres'}],yesText:'You made Old Resumes in Resumes',noText:'You kept every resume together'},
 {id:'q3',yes1:'Yes, merge them',pct:96,k:'Merge',q:'Merge the two Website Proposal folders?',why:'A copy of Website Proposal you downloaded from email holds the same files.',node:'wp',yes:[],no:[],yesText:'You merged the two Website Proposal folders',noText:'You kept both Website Proposal folders'},
 {id:'q4',yes1:'Yes, keep it private',pct:74,k:'Private check',q:'Keep Barnard club budget.xlsx private?',why:'Its name says it is a budget, and budgets often list names and amounts.',file:'Barnard club budget.xlsx',level:'private',yes:[],no:[],yesText:'You kept Barnard club budget.xlsx private',noText:'You let Tuck’s AI read Barnard club budget.xlsx'},
 {id:'q5',yes1:'Yes, it fits',k:'Folder fit',q:'Does Robotics club belong in Projects?',why:'Most of it is your own build log, but some files look like ENGI 1006 lab sheets.',node:'robo',yes:[{ty:'keep',node:'robo'}],no:[],yesText:'You kept Robotics club in Projects',noText:'You said Robotics club is not a project'}];
const fileByName=n=>Object.values(SEED.files).find(f=>f.name===n);
function queue(){try{return JSON.parse(localStorage.getItem(QKEY)||'null')}catch(e){return null}}
/* answered here (a History row, with Undo) or on tuck.html (tuckQueue.waiting: the ids still waiting) */
/* one confidence word (rule 24): Plan.conf(nodeId | pct) -> {key:'sure'|'leaning'|'unsure', word:'Sure'|'Leaning'|'Not sure', pct} */
const CONFW={sure:'Sure',leaning:'Leaning',unsure:'Not sure'},DEFPCT={sure:92,leaning:80,unsure:64};
function conf(x){let pct;if(typeof x==='number')pct=x;else{const n=SEED.nodes[x]||(P.view().raw(x));const k=n&&n.sure||'sure';pct=PCT[x]!=null?PCT[x]:DEFPCT[k]||92}
 const key=pct>=90?'sure':pct>=75?'leaning':'unsure';return {key,word:CONFW[key],pct}}
/* reason texts quote the files' real plan dates (rule 20) */
function needWhy(d,v){if(d.id==='q1'){const f=fileByName(d.file);const at=new Date(f.at);
  const w=WDM(at)+' at '+clock(at);
  return {why:`A photo of equations taken ${w}, during your PHYS 1401 lecture.`,dateLine:`Taken ${w}`}}
 if(d.id==='q2'&&v.node('oldres')){const fs=v.files('oldres',true),n=fs.length,sp=dateSpan(fs);
  return {q:`Move your ${n} older resume${n===1?'':'s'} into Old Resumes?`,why:`Resume (6).pdf is your newest. The other ${n} are earlier versions of it, saved ${sp}.`,dateLine:'Saved '+sp}}
 if(d.id==='q0'&&v.node('lb')){const fs=v.files('lb',true);return {why:d.why,dateLine:`Saved ${dateSpan(fs)}`}}
 return {why:d.why,dateLine:''}}
function needs(){const s=st(),v=P.view(),q=queue();const rows=s.applied.filter(r=>r.need&&!r.undone);
 const list=NEEDS.map(d=>{const f=d.file&&fileByName(d.file);const r=rows.filter(x=>x.need===d.id).pop();const c=conf(d.pct!=null?d.pct:conf(d.node).pct),w=needWhy(d,v);
  return {id:d.id,k:d.k,q:w.q||d.q,why:w.why,dateLine:w.dateLine,yes:d.yes1,no:'No',sure:c.word,confKey:c.key,pct:c.pct,node:d.node||null,file:f?f.id:null,target:d.node||(f&&f.id),n:d.node?(v.node(d.node)?v.total(d.node):0):1,
   done:r?r.ans:null,row:r?r.id:null,skipped:false}});
/* tuck.html's queue (tuck-art.js TuckQueue): the ids still waiting, plus answers given on other pages it hasn't read yet */
 let ans=[];try{ans=JSON.parse(localStorage.getItem('tuckAnswers')||'[]')}catch(e){}
 const last={};(Array.isArray(ans)?ans:[]).forEach(x=>{if(x&&x.id)last[x.id]=x.a});
 list.forEach(x=>{if(!x.done&&(last[x.id]==='yes'||last[x.id]==='no'))x.done=last[x.id]});
 /* Skip (rule 19): a skipped card still waits. It goes to the end of the line and counts in every "waiting" number, never as checked */
 const skipped=new Set([...(q&&Array.isArray(q.skipped)?q.skipped:[]),...Object.keys(last).filter(k=>last[k]==='skip')]);
 list.forEach(x=>{if(!x.done&&skipped.has(x.id))x.skipped=true});
 const wait=q&&(Array.isArray(q.waiting)?q.waiting:Array.isArray(q.cards)&&(q.cards.length||q.left===0)?q.cards.map(c=>c.id):null);
 if(wait)list.forEach(x=>{if(!x.done&&!x.skipped&&!wait.includes(x.id))x.done='answered'});
 else if(!wait&&q&&typeof q.left==='number'){let extra=list.filter(x=>!x.done).length-q.left;list.forEach(x=>{if(extra>0&&!x.done&&!x.skipped){x.done='answered';extra--}})}
 return list.filter(x=>!x.skipped||x.done).concat(list.filter(x=>x.skipped&&!x.done))}
function answerNeed(id,yes,extra){const d=NEEDS.find(x=>x.id===id);if(!d)return null;
 const had=st().applied.filter(r=>r.need===id&&!r.undone).pop();if(had)return had;const f=d.file&&fileByName(d.file);
 const ops=(typeof d[yes?'yes':'no']==='function'?d[yes?'yes':'no'](f&&f.id):d[yes?'yes':'no']).map(o=>Object.assign({id:uid('c')},o));
 const s=st();const row={id:uid('h'),at:Date.now(),text:d[yes?'yesText':'noText'],ops,undone:false,kind:'needs',need:id,ans:yes?'yes':'no'};
 /* how many files the answer placed and where, as the card showed them, so Today counts them after a reload too (n2) */
 if(extra){if(extra.n!=null)row.n=extra.n;if(extra.path)row.path=extra.path}
 if(d.level&&f){const lv=yes?d.level:'read';row.level={target:f.id,before:s.levels[f.id]||null,after:lv};s.levels[f.id]=lv}
 s.applied.push(row);save();emit('needs');return row}
/* only Downloads and Desktop are watched (Settings › Watching). A file is new when it waits in No folder yet, came from a
   watched folder and Tuck knows a home for it. */
const WATCHED=['Downloads','Desktop'];
const homeOf=(v,f)=>{let n=f.hint&&v.node(f.hint);while(n&&n.sug)n=v.node(n.parent);return n||null};
function newFiles(v){v=v||P.view();return v.files('loose').filter(f=>WATCHED.includes(f.from)&&homeOf(v,f))}
/* one folder count for every page (rule 16): real folders only. An open suggestion is not a folder yet, No folder yet is not a folder,
   and a hidden folder is out of your folders until you show it again. */
const isFolder=(v,id)=>{const n=v.node(id);return !!n&&!n.sug&&!n.special&&!n.hidden};
function folderCount(v){v=v||P.view();return v.all().filter(id=>isFolder(v,id)).length}
function counts(){const v=P.view(),nf=newFiles(v),by={};WATCHED.forEach(w=>by[w]=0);nf.forEach(f=>by[f.from]++);
 return {all:Object.values(v.D.files).filter(f=>f.node!=='trash').length,folders:folderCount(v),noFolder:v.total('loose'),new:nf.length,newBy:by,needs:needs().filter(x=>!x.done).length}}
/* one answer for "where is my …?" on every page (Finder, Tuck, Brain, the launcher) */
const STOP=new Set(['where','is','are','my','the','a','an','find','me','show','which','folder','file','files','did','do','i','put','keep','locate','what','about','in','of','for','please','can','you','to','it','its','tuck','pdf']);
const norm=x=>String(x).toLowerCase().replace(/\.[a-z0-9]{2,4}$/,'');
const toks=x=>norm(x).split(/[^a-z0-9-]+/).map(w=>w.replace(/^-+|-+$/g,'')).filter(w=>w&&!STOP.has(w));
const stemw=w=>w.replace(/(es|s)$/,'');
function find(q,v){v=v||P.view();const ws=toks(q);if(!ws.length)return [];const out=[];
 const score=name=>{const nt=toks(name).map(stemw),nn=norm(name);let s=0;ws.forEach(w=>{if(nt.includes(stemw(w)))s+=2;else if(w.length>2&&nn.includes(w))s+=1});return s===0?0:s+(nn.includes(ws.join(' '))?3:0)};
 v.all().forEach(id=>{const n=v.node(id);if(n.hidden)return;const s=score(n.name);if(s)out.push({type:'node',id,score:s+.5})});
 Object.values(v.D.files).forEach(f=>{if(!v.node(f.node))return;const s=score(f.name);if(s)out.push({type:'file',id:f.id,score:s})});
 const len=h=>(h.type==='file'?v.file(h.id):v.node(h.id)).name.length;
 return out.sort((a,b)=>b.score-a.score||(a.type==='node'?-1:1)*(a.type!==b.type)||len(a)-len(b))}
/* small talk (rule 14): one reply for hi, thanks and help on every chat (Chats page, side chat, launcher, Brain).
   Returns {type:'talk', text, html, starters} or null. starters: show the 4 starter buttons under the reply. A file search runs only when this is null. */
const TALK=[
 [/^(hi|hey|hello|hiya|yo|howdy|good (morning|afternoon|evening))( there)?( tuck)?$/,{text:'Hi! I’m Tuck. I keep your files sorted. Pick one, or just tell me what you want:',starters:true}],
 [/^(thanks|thank you|thx|ty|cheers|thanks a lot|thank you so much|great thanks|ok thanks|okay thanks)( tuck)?$/,{text:'You’re welcome. I’m here when you need me.',starters:false}],
 [/^(help|help me|what can you do|what do you do|how does this work|what are you|who are you|commands)( tuck)?$/,{text:'I sort new files into your folders, clean up what you don’t need, ask you when I’m unsure, and find any file. Pick one, or ask me where something is:',starters:true}]];
function smallTalk(q){const t=String(q||'').toLowerCase().replace(/[’']/g,'').replace(/[!.?,:;~\s]+/g,' ').trim();if(!t)return null;
 for(const [re,r] of TALK)if(re.test(t))return {type:'talk',text:r.text,html:r.text,starters:r.starters};return null}
function answer(q){const talk=smallTalk(q);if(talk)return talk;const v=P.view(),hits=find(q,v);if(!hits.length)return null;const top=hits[0];
 const escH=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 if(top.type==='file'){const f=v.file(top.id),path=v.path(f.node),priv=v.level(f.id).level==='private';
  const text=`${f.name} is in ${path.join(' › ')}.`+(priv?' It’s private: never sent to AI. You can still open and preview it.':'');
  return {type:'file',text,html:`<b>${escH(f.name)}</b> is in ${escH(path.join(' › '))}.`+(priv?' It’s private: never sent to AI. You can still open and preview it.':''),
   file:{id:f.id,name:f.name,path,node:f.node,priv,size:f.size,age:f.age,where:f.where||f.from},files:hits.filter(h=>h.type==='file').slice(0,4).map(h=>h.id)}}
 const n=v.node(top.id),path=v.path(n.id).slice(0,-1),priv=v.level(n.id).level==='private',c=v.total(n.id);
 const text=`${n.name} ${path.length?'is in '+path.join(' › '):'is a top folder'}: ${c} file${c===1?'':'s'}.`+(priv?' It’s private: never sent to AI. You can still open and preview them.':'');
 return {type:'node',text,html:escH(text).replace(escH(n.name),`<b>${escH(n.name)}</b>`),node:{id:n.id,name:n.name,path,priv,files:c},files:v.files(n.id,true).slice(0,4).map(f=>f.id)}}
function fileKind(name){return /transcript|tuition|financial aid|student id/i.test(name)?'School records':/insurance card|vaccination/i.test(name)?'Medical':/lease|roommate agreement|contract|signed agreement/i.test(name)?'Legal':'Taxes and government IDs'}

/* ---------- times (rule 12): relative to the moment the page loaded, never a typed-in clock time */
function dayOf(at){const d=new Date(at),n=new Date(NOW);const k=Math.round((dayStart(n)-dayStart(d))/864e5);return k<=0?'Today':k===1?'Yesterday':WDM(d)}
function when(mins){mins=Math.max(0,mins||0);const at=NOW-mins*6e4,d=new Date(at),day=dayOf(at),m=Math.round(mins);
 if(m<1)return 'Just now';if(m<60)return `${m} min ago`;if(day==='Today')return clock(d);if(day==='Yesterday')return 'Yesterday';return DM(d)}
/* when a file in No folder yet arrived */
/* when any file came in (one moment per file on every page): {minsAgo, at, when, day} */
const fileOf=x=>{if(x&&typeof x==='object')return x;const v=P.view();return v.file(x)||Object.values(v.D.files).find(f=>f.name===x)||null};
function arrived(x){const f=fileOf(x);if(!f)return null;const at=f.at,m=Math.round((NOW-at)/6e4);return {minsAgo:m,at,when:when(m),day:dayOf(at)}}
function fileAt(x){const f=fileOf(x);return f?f.at:null}
/* the Finder way: 'Today at 9:30 AM' | 'Yesterday at 2:03 PM' | '28 Oct' | '28 Oct 2025'; long: '28 Oct 2026 at 11:12 AM' */
function fileDate(x,long){const f=fileOf(x);if(!f)return '';const d=new Date(f.at),day=dayOf(f.at);
 if(day==='Today'||day==='Yesterday')return `${day} at ${clock(d)}`;
 const dm=DM(d),y=d.getFullYear();
 return long?`${dm} ${y} at ${clock(d)}`:y===new Date(NOW).getFullYear()?dm:`${dm} ${y}`}
/* date words in what someone typed: "only the March ones", "from last week", "2025". null when there are none */
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
function dateRange(text){const t=' '+String(text||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ')+' ';const now=new Date(NOW),Y=now.getFullYear(),day=864e5,T=TODAY.getTime();
 const cap=w=>w.charAt(0).toUpperCase()+w.slice(1);
 if(/ today /.test(t))return {label:'today',from:T,to:NOW+1};
 if(/ yesterday /.test(t))return {label:'yesterday',from:daysBack(1),to:T};
 if(/ this week /.test(t)){const k=(now.getDay()+6)%7;return {label:'this week',from:daysBack(k),to:NOW+1}}
 if(/ last week /.test(t)){const k=(now.getDay()+6)%7;return {label:'last week',from:daysBack(k+7),to:daysBack(k)}}
 if(/ this month /.test(t))return {label:'this month',from:new Date(Y,now.getMonth(),1).getTime(),to:NOW+1};
 if(/ last month /.test(t))return {label:'last month',from:new Date(Y,now.getMonth()-1,1).getTime(),to:new Date(Y,now.getMonth(),1).getTime()};
 for(let i=0;i<12;i++){const full=MONTHS[i],re=new RegExp(' ('+full+'|'+full.slice(0,3)+(full==='september'?'|sept':'')+') ');
  if(full==='may'?/ may (ones|files|one|only|resumes|ones?) | in may | from may | the may /.test(t):re.test(t)){
   const ym=(t.match(/ (20\d\d) /)||[])[1];const y=ym?+ym:(i>now.getMonth()?Y-1:Y);return {label:cap(full)+(ym?' '+ym:''),from:new Date(y,i,1).getTime(),to:new Date(y,i+1,1).getTime()}}}
 const ym=(t.match(/ (20\d\d) /)||[])[1];if(ym)return {label:ym,from:new Date(+ym,0,1).getTime(),to:new Date(+ym+1,0,1).getTime()};
 return null}
/* Plan.filterByDate(files, text) -> null (no date words) or {label, files}: files of the same kind you passed (ids, names or file objects) */
function filterByDate(files,text){const r=dateRange(text);if(!r)return null;
 return {label:r.label,files:(files||[]).filter(x=>{const f=fileOf(x);return f&&f.at>=r.from&&f.at<r.to})}}
/* the dates a set of files spans, for reason texts: 'on 27 Oct' | 'from 2 Sep to 30 Oct' | 'between March and September' */
function dateSpan(files){const ts=(files||[]).map(x=>{const f=fileOf(x);return f&&f.at}).filter(Boolean).sort((a,b)=>a-b);if(!ts.length)return '';
 const a=new Date(ts[0]),b=new Date(ts[ts.length-1]),dm=DM,mo=d=>d.toLocaleDateString('en-GB',{month:'long'});
 if(dayStart(a)===dayStart(b))return 'on '+dm(a);
 if((b-a)/864e5>60)return a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear()?'in '+mo(a):`between ${mo(a)}${a.getFullYear()!==b.getFullYear()?' '+a.getFullYear():''} and ${mo(b)}`;
 return `from ${dm(a)} to ${dm(b)}`}
/* what Tuck sorted lately (sample.js SORTED_LOG): only files the plan really has in a folder now. A file back in No folder yet,
   or under a suggestion you said no to, drops out; a row whose files all dropped out goes away. Newest first. */
function recentSorted(){const v=P.view(),cmp=compare();const eff=id=>cmp.eff(v,id);const byName={};Object.values(v.D.files).forEach(f=>{byName[f.name]=f});
 return (window.SORTED_LOG||[]).map((r,i)=>{const fs=r.files.map(n=>byName[n]).filter(f=>f&&v.node(f.node)&&eff(f.node)&&eff(f.node)!=='loose');if(!fs.length)return null;
  const to=eff(fs[0].node),priv=fs.every(f=>v.level(f.id).level==='private'),n=fs.length,at=NOW-r.mins*6e4;
  const text=priv?`Sorted ${n} private file${n===1?'':'s'}`:n===1?`Sorted ${fs[0].name}`:`Sorted ${n} ${r.noun||'files'}`;
  return {id:'s'+i,text,path:v.path(to),node:to,from:r.from,n,priv,minsAgo:r.mins,at,when:when(r.mins),day:dayOf(at),files:fs.map(f=>f.id)}}).filter(Boolean)
  /* Sort New Files (rule 27): each sort you did, until you undo it, is a row here too, so Today, History and every page agree */
  .concat(st().applied.filter(r=>isSortRow(r)&&!r.undone).map(r=>{const fs=sortFiles(r).map(id=>v.file(id)).filter(Boolean),n=fs.length;if(!n)return null;
   const to=eff(fs[0].node),m=Math.max(0,Math.round((Date.now()-r.at)/6e4)),ws=[...new Set(fs.map(f=>f.from))].filter(w=>WATCHED.includes(w));
   return {id:r.id,row:r.id,kind:'sortNew',text:`Sorted ${n} new file${n===1?'':'s'}`,path:v.path(to),node:to,from:ws.join(' and ')||'Downloads',n,priv:false,minsAgo:m,at:r.at,when:when(m),day:dayOf(r.at),files:fs.map(f=>f.id)}}).filter(Boolean))
  .sort((a,b)=>a.minsAgo-b.minsAgo)}
/* ---------- Sort New Files: one state for every page (rule 27) */
const SKEY='tuckSortedNew';
const isSortRow=r=>!!r&&(r.kind==='sortNew'||/^Sorted \d+ new file/.test(r.text||''));
const sortFiles=r=>r.files||[].concat(...(r.ops||[]).filter(o=>o.ty==='moveFiles').map(o=>o.files||[]));
function sortedNew(){const r=st().applied.filter(isSortRow).pop();if(!r)return null;const files=sortFiles(r),m=Math.max(0,Math.round((Date.now()-r.at)/6e4));
 return {row:r.id,n:r.n||files.length,at:r.at,minsAgo:m,when:when(m),files,undone:!!r.undone}}
function mirrorSorted(){try{const s=sortedNew(),j=s?JSON.stringify({row:s.row,n:s.n,at:s.at,undone:s.undone}):null;
 if(j===null)localStorage.removeItem(SKEY);else if(localStorage.getItem(SKEY)!==j)localStorage.setItem(SKEY,j)}catch(e){}}
/* Sort New Files' checklist (the launcher, every page): one row per new file. sure:false rows start unticked, with why.
   stay: private or Keep As Is files, listed as staying where they are. -> [{id, name, from, to, path, sure, why, stay}] */
function sortPlan(){const v=P.view(),pins=pinSet(),nf=newFiles(v);
 return nf.map(f=>{const h=homeOf(v,f),hn=f.hint&&v.node(f.hint);const priv=v.level(f.id).level==='private',kept=pins.has(f.id);
  let sure=true,why='';if(hn&&hn.sug){sure=false;why=`${hn.name} isn’t a folder yet.`}else if(/^IMG_\d+/i.test(f.name)){sure=false;why='Only a camera name.'}
  return {id:f.id,name:f.name,from:f.from,to:h?h.id:null,path:h?v.path(h.id):[],sure,why,stay:priv?'Private: it stays where it is.':kept?'Keep As Is: it stays where it is.':''}})}
/* ids: which new files (default all); to: {fileId: folderId} to send a file somewhere else than Tuck's pick */
function sortNew(ids,to){const v=P.view(),pins=pinSet();let nf=newFiles(v).filter(f=>!pins.has(f.id)&&v.level(f.id).level!=='private');if(Array.isArray(ids)){const want=new Set(ids);nf=nf.filter(f=>want.has(f.id)||want.has(f.name))}if(!nf.length)return null;
 const dest=f=>{const t=to&&to[f.id];return t&&v.node(t)?t:homeOf(v,f).id};
 const by={};nf.forEach(f=>{const t=dest(f);(by[t]=by[t]||[]).push(f.id)});const n=nf.length,s=st();
 const row={id:uid('h'),at:Date.now(),text:`Sorted ${n} new file${n===1?'':'s'}`,ops:Object.entries(by).map(([to,files])=>({id:uid('c'),ty:'moveFiles',files,to})),undone:false,kind:'sortNew',n,files:nf.map(f=>f.id)};
 s.applied.push(row);save();emit('sorted');return row}
function undoSortNew(){const r=st().applied.filter(x=>isSortRow(x)&&!x.undone).pop();return r?P.undoApply(r.id):null}
/* what Tuck read in setup against what it sorted (rule 31) */
const READ_TOTAL=4402;
const readLine=()=>{const n=Object.keys(SEED.files).length;return `Tuck read ${READ_TOTAL.toLocaleString('en-US')} files on your Mac and has sorted ${n} so far, newest first. The rest stay where they are until it gets to them.`};
/* ---------- the real folders on disk (Finder's normal view, rule 26): the plan is a view, so every file stays where it really is */
const realWhere=x=>{const f=fileOf(x);return f?(f.where||f.from||''):''};
function realFolder(name){const v=P.view(),nw=new Set(newFiles(v).map(f=>f.id));
 return Object.values(v.D.files).filter(f=>f.node!=='trash'&&realWhere(f)===name).sort((a,b)=>b.at-a.at).map(f=>Object.assign({},f,{where:realWhere(f),isNew:nw.has(f.id)}))}
function realFolders(){const c={};Object.values(P.view().D.files).forEach(f=>{const w=realWhere(f);c[w]=(c[w]||0)+1});return c}

/* ---------- the rules every tool honours (one place; Plan.change and Plan.applyNow refuse what breaks them)
   private files are never planned · Keep As Is folders are never renamed, moved, merged, split or reshaped ·
   Keep As Is (pinned) items never move · Never Look In folders (hidden, or named in Settings › Never look in) are skipped.
   Keep As Is is ONE setting: the plan's keep (folders) and localStorage 'tuckPins' (folders and files) together. */
const PINK='tuckPins';
const pinSet=()=>{try{const a=JSON.parse(localStorage.getItem(PINK)||'[]');return new Set(Array.isArray(a)?a:[])}catch(e){return new Set()}};
const savePins=p=>{try{localStorage.setItem(PINK,JSON.stringify([...p]))}catch(e){}};
const neverNames=()=>{try{const c=JSON.parse(localStorage.getItem('tuckSettings')||'null');return new Set(((c&&c.never)||[]).map(x=>String(x).split(/\s*›\s*|\//).pop().trim().toLowerCase()))}catch(e){return new Set()}};
/* Keep As Is: the plan's keep, or a pin. (A folder you made is yours too: Tuck's own plans leave it alone, but you may still change it.) */
function keptU(v,id){const n=v.node(id);return !!n&&(n.kept||pinSet().has(id))}
function keptT(v,id){const n=v.node(id);return !!n&&(n.kept||n.own||pinSet().has(id))}
function isKept(id,v){v=v||P.view();if(v.file(id))return pinSet().has(id);return keptU(v,id)}
function neverIn(v,id){const nn=neverNames();return v.pathIds(id).some(x=>{const n=v.node(x);return n&&(n.hidden||nn.has(n.name.toLowerCase()))})}
const nmOf=(v,id)=>{const n=v.node(id)||v.file(id);return n?n.name:'It'};
const keptMsg=(v,id,verb)=>{const n=v.node(id);return n&&n.own&&!keptU(v,id)?`You made ${n.name}, so Tuck leaves it as it is.`:n?`${n.name} is Keep As Is. Turn it off to change it.`:`${nmOf(v,id)} is Keep As Is, so it stays where it is.`};
/* Plan.can(tool, id) -> {ok, why}: tools 'rename' | 'move' | 'merge' | 'split' | 'arrange' | 'resort' | 'delete' */
function can(tool,id,v){v=v||P.view();const f=v.file(id),n=v.node(id);if(!f&&!n)return {ok:false,why:'It isn’t in your folders any more.'};
 const name=nmOf(v,id),priv=v.level(id).level==='private';
 if(['rename','move','merge','split','arrange','resort'].includes(tool)&&isKept(id,v))return {ok:false,why:keptMsg(v,id,tool==='resort'?'re-sort':tool)};
 if(['split','arrange','resort'].includes(tool)){
  if(priv)return {ok:false,why:`${name} is private. Tuck never plans private files.`};
  if(n&&neverIn(v,id))return {ok:false,why:`Tuck never looks in ${name}.`}}
 if(tool==='delete'&&n&&(v.total(id)||v.kids(id).length))return {ok:false,why:`${name} isn’t empty. Only empty folders can be deleted.`};
 if(tool==='split'&&n&&v.files(id).filter(x=>v.level(x.id).level!=='private').length<4)return {ok:false,why:`${name} has too few files to split.`};
 if(tool==='arrange'&&n&&v.files(id,true).filter(x=>v.level(x.id).level!=='private').length<4)return {ok:false,why:`${name} has too few files to arrange.`};
 return {ok:true,why:''}}
/* why an op would break a rule, or '' when it is fine. tuck: the op is part of Tuck's own plan (Re-sort, Arrange, Split, chat) */
function guard(op,v,tuck){v=v||build(true);const pins=pinSet();const K=tuck?keptT:keptU;
 switch(op.ty){
  case 'batch':{for(const o of op.ops||[]){const w=guard(o,v,true);if(w)return w}return ''}
  case 'rename':return K(v,op.node)?keptMsg(v,op.node,'rename'):'';
  case 'putInside':{const k=(op.nodes||[]).find(id=>K(v,id));return k?keptMsg(v,k,'move'):''}
  case 'merge':{const k=(op.nodes||[]).find(id=>K(v,id));return k?keptMsg(v,k,'merge'):''}
  case 'split':return K(v,op.node)?keptMsg(v,op.node,'split'):tuck&&v.level(op.node).level==='private'?`${nmOf(v,op.node)} is private. Tuck never plans private files.`:'';
  case 'moveFiles':{const fs=(op.files||[]).map(id=>v.file(id)).filter(Boolean);
   const p=fs.find(f=>pins.has(f.id));if(p)return `${p.name} is Keep As Is, so it stays where it is.`;
   if(tuck){const pr=fs.find(f=>v.level(f.id).level==='private');if(pr)return `${pr.name} is private. Tuck never plans private files.`;
    const k=fs.find(f=>f.node!=='loose'&&v.pathIds(f.node).some(id=>K(v,id)));if(k)return keptMsg(v,v.pathIds(k.node).find(id=>K(v,id)),'reshape');
    const nv=fs.find(f=>neverIn(v,f.node));if(nv)return `Tuck never looks in ${v.node(nv.node).name}.`}
   return ''}
  case 'trash':{const fs=(op.files||[]).map(id=>v.file(id)).filter(Boolean);const p=fs.find(f=>pins.has(f.id)||(v.node(f.node)&&v.pathIds(f.node).some(id=>keptU(v,id))));if(p)return `${p.name} is Keep As Is, so it stays where it is.`;
   const pr=fs.find(f=>v.level(f.id).level==='private');return pr?`${pr.name} is private. Tuck never plans private files.`:''}
  case 'newFolder':{if(!tuck||!op.parent||!v.node(op.parent))return '';const k=v.pathIds(op.parent).find(id=>K(v,id));return k?keptMsg(v,k,'reshape'):''}}
 return ''}
/* a refusal: Plan.lastRefusal, and a 'tuckrefused' event (folderpanel.js shows it on every page) */
function refuse(why){P.lastRefusal=why;try{document.dispatchEvent(new CustomEvent('tuckrefused',{detail:{why}}))}catch(e){}return null}
/* Keep As Is on or off: one History row with Undo; sets the plan's keep (folders) and the pin (folders and files) together */
function setKeep(id,on){const s=st(),v=P.view(),n=v.node(id),f=v.file(id);if(!n&&!f)return null;const p=pinSet(),before=p.has(id);
 if(on)p.add(id);else p.delete(id);savePins(p);const name=nmOf(v,id);
 const ops=n?(on?(n.kept?[]:[{id:uid('c'),ty:'keep',node:id}]):(n.kept?[{id:uid('c'),ty:'unkeep',node:id}]:[])):[];
 const row={id:uid('h'),at:Date.now(),text:on?`Keep ${name} as is`:`Tuck may change ${name} again`,ops,undone:false,kind:'keep',pin:{target:id,before,after:on}};
 s.applied.push(row);save();emit('keep');return row}

/* ---------- public */
function change(op){const s=st();op=Object.assign({id:uid('c')},op);
 {const why=guard(op,build(true),op.ty==='batch');if(why)return refuse(why)}if(op.ty==='newFolder'&&!op.node)op.node=uid('n');
 if(op.ty==='split')op.parts=op.parts.map(p=>Object.assign({id:p.id||uid('n')},p));
 if(op.ty==='batch')op.ops=op.ops.map(o=>Object.assign({},o,o.ty==='newFolder'&&!o.node?{node:uid('n')}:{}));
 const d=describe(op,build(true));op.text=op.text||d.text;op.sub=op.sub||d.sub;op.ic=d.ic;op.kind=d.ty;s.pending.push(op);save();emit('change');return op}
function applyRow(ops,text,kind){const s=st();const row={id:uid('h'),at:Date.now(),text,ops,undone:false,kind:kind||'plan'};s.applied.push(row);save();emit('apply');return row}
const P={
 view:()=>cache.v||(cache.v=build(true)),before:()=>cache.b||(cache.b=build(false)),
 change,
 pending:()=>st().pending.slice(),
 summary:()=>{const c=st().pending.length;if(!c)return {changes:0,files:0,line:''};const n=(cache.cmp||(cache.cmp=compare())).moves.length;return {changes:c,files:n,line:`${c} change${c===1?'':'s'} · ${n} file${n===1?'':'s'} move in Tuck`}},
 undo:()=>{const o=st().pending.pop();save();emit('undo');return o||null},
 revert:id=>{const s=st();const k=s.pending.findIndex(o=>o.id===id);if(k<0)return null;const [o]=s.pending.splice(k,1);save();emit('revert');return o},
 restore:op=>{st().pending.push(op);save();emit('change')},
 discard:()=>{const s=st();const was=s.pending;s.pending=[];save();emit('discard');return was},
 apply:text=>{const s=st();if(!s.pending.length)return null;const sm=P.summary();const ops=s.pending;s.pending=[];
  return applyRow(ops,text||`You changed your folders: ${sm.changes} change${sm.changes===1?'':'s'}, ${sm.files} file${sm.files===1?'':'s'} moved`,'plan')},
 /* the person's own edit asked for in chat (rename, merge, new folder…): the rules for your own changes, as in Edit Folders (a folder you made is yours to change) */
 applyMine:(ops,text,kind)=>{const v=build(true);for(const o of ops){const why=guard(o,v,false);if(why)return refuse(why)}return applyRow(ops.map(o=>Object.assign({id:uid('c')},o)),text,kind||'chat')},
 applyNow:(ops,text,kind)=>{const why=guard({ty:'batch',ops},build(true),true);if(why)return refuse(why);return applyRow(ops.map(o=>Object.assign({id:uid('c')},o)),text,kind||'resort')},
 undoApply:id=>{const s=st();const r=s.applied.find(x=>x.id===id);if(!r)return null;r.undone=!r.undone;
  if(r.level){const v=r.undone?r.level.before:r.level.after;if(v)s.levels[r.level.target]=v;else delete s.levels[r.level.target]}
  if(r.pin){const p=pinSet(),on=r.undone?r.pin.before:r.pin.after;on?p.add(r.pin.target):p.delete(r.pin.target);savePins(p)}save();emit('undoApply');return r},
 history:()=>st().applied.slice().reverse(),
 setLevel:(target,level)=>{const s=st();const before=s.levels[target]||null;if(level==='inherit'||!level)delete s.levels[target];else s.levels[target]=level;
  const v=P.view();const name=(v.raw(target)||v.file(target)||{}).name||'';
  const row={id:uid('h'),at:Date.now(),text:`What Tuck may read in ${name}: ${level==='inherit'?'same as its folder':LEVELS[level].label}`,ops:[],undone:false,kind:'level',level:{target,before,after:level==='inherit'?null:level}};
  s.applied.push(row);save();emit('level');return row},
 undoLevel:id=>{const r=st().applied.find(x=>x.id===id);if(r&&!r.undone)P.undoApply(id)},
 addRule:text=>{st().rules.push({text,at:Date.now()});save();emit('rule')},rules:()=>st().rules.slice(),
 removeRule:text=>{const r=st().rules;for(let i=r.length-1;i>=0;i--)if(r[i].text===text){r.splice(i,1);save();emit('rule');return true}return false},
 compare:extra=>extra?compare(extra):(cache.cmp||(cache.cmp=compare())),
 describe:(op,v)=>describe(op,v||P.view()),
 subscribe:fn=>{subs.add(fn);return ()=>subs.delete(fn)},
 reset:()=>{S0=blank();save();emit('reset')},
 limits:()=>{try{return localStorage.getItem(LKEY)||'Ask When Unsure'}catch(e){return 'Ask When Unsure'}},
 setLimits:v=>{try{localStorage.setItem(LKEY,v)}catch(e){}emit('limits')},
 needs,answerNeed,needsLeft:()=>needs().filter(x=>!x.done).length,needsChecked:()=>needs().filter(x=>x.done==='yes'||x.done==='no'||x.done==='answered').length,conf,counts,newFiles,WATCHED,homeOf,find:q=>find(q),answer,
 kind,ext:extOf,ago,LEVELS,draftSplit,draftArrange,draftBest,uid,TODAY,
 smallTalk,folderCount,isFolder:(id,v)=>isFolder(v||P.view(),id),recentSorted,when,arrived,dayOf,NOW,
 fileAt,fileDate,filterByDate,dateSpan,dateRange,suggestGroups,
 can,guard:(op,tuck)=>guard(op,build(true),!!tuck),isKept,setKeep,neverIn:id=>neverIn(P.view(),id),lastRefusal:'',
 sortNew,sortPlan,sortedNew,undoSortNew,isSortRow,READ_TOTAL,readLine,READ_LINE:'',realFolder,realFolders,realWhere};
P.READ_LINE=readLine();
window.Plan=P;
})();
