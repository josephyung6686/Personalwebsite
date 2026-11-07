/* One sample life for every page of prototype 38: Finder, Tuck, Tuck Brain and Edit Folders all read this.
   Each top folder is a part of your life (its colour and icon are the same everywhere); topics are the folders inside.
   Private files stay in their own folder with a lock (Taxes 2025), they don't get a folder of their own. */
window.LIFE_AREAS=[
 {id:'study',name:'Studying',hue:'--a-study',ic:'graduation-cap',topics:[
  {id:'phys',name:'PHYS 1401',files:26},{id:'econ',name:'ECON 2257',files:15},{id:'coms',name:'COMS 1004',files:14},
  {id:'engi',name:'ENGI 1006',files:8},{id:'writ',name:'Writing Seminar',files:9},{id:'reg',name:'Registration',files:5,priv:true,pkind:'School records'}]},
 {id:'work',name:'Work',hue:'--a-work',ic:'briefcase',topics:[
  {id:'grc',name:'GRC Associates',files:17,kids:[{id:'wp',name:'Website Proposal',files:14}]},
  {id:'inv',name:'Invoices',files:12},{id:'meet',name:'Meeting notes',files:9},{id:'time',name:'Timesheets',files:8}]},
 {id:'job',name:'Job Search',hue:'--a-job',ic:'paper-plane-tilt',topics:[
  {id:'res',name:'Resumes',files:9},{id:'cov',name:'Cover letters',files:7},{id:'apps',name:'Applications',files:10},{id:'intv',name:'Interview prep',files:8}]},
 {id:'home',name:'Home and Money',hue:'--a-home',ic:'house-line',topics:[
  {id:'tax',name:'Taxes 2025',files:8,priv:true,pkind:'Taxes and government IDs'},{id:'ids',name:'IDs',files:2,priv:true,pkind:'Taxes and government IDs'},{id:'lease',name:'Lease',files:5,priv:true,pkind:'Legal'},{id:'bills',name:'Bills',files:12},{id:'orders',name:'Orders',files:9}]},
 {id:'photo',name:'Photos',hue:'--a-photo',ic:'image',topics:[
  {id:'trips',name:'Trips',files:26},{id:'wb',name:'Whiteboards',files:8},{id:'shots',name:'Screenshots',files:22},{id:'fam',name:'Family',files:14}]},
 {id:'proj',name:'Projects',hue:'--a-proj',ic:'cube',topics:[
  {id:'port',name:'Portfolio site',files:12},{id:'robo',name:'Robotics club',files:10},{id:'music',name:'Music',files:6}]},
 {id:'health',name:'Health',hue:'--a-health',ic:'heartbeat',priv:true,pkind:'Medical',topics:[
  {id:'ins',name:'Insurance',files:5},{id:'appt',name:'Appointments',files:4},{id:'fit',name:'Fitness',files:3}]}];

/* file counts are never typed in: once plan.js has loaded, every topic's .files (and EXTRA_TOP's) is the plan's live count,
   so Finder, Tuck, Brain and onboarding show the same number. The numbers above are only the fallback before plan.js. */
(function(){const live=(o,id)=>{const n0=o.files;Object.defineProperty(o,'files',{configurable:true,enumerable:true,
  get(){try{const v=window.Plan&&Plan.view();return v&&v.node(id)?v.total(id):n0}catch(e){return n0}},set(x){}})};
 LIFE_AREAS.forEach(a=>a.topics.forEach(t=>{live(t,t.id);(t.kids||[]).forEach(k=>live(k,k.id))}));
 window.lifeTotal=id=>{try{return Plan.view().total(id)}catch(e){const a=LIFE_AREAS.find(x=>x.id===id);return a?a.topics.reduce((s,t)=>s+t.files,0):0}}})();

/* the one list of private kinds (Settings › Privacy and onboarding use these names). On = private by default. */
window.PRIVATE_KINDS=[
 {id:'school',name:'School records',ex:'Transcripts, tuition bills, financial aid',on:true,folders:['reg']},
 {id:'tax',name:'Taxes and government IDs',ex:'W-2, 1098-T, passport scans',on:true,folders:['tax','ids']},
 {id:'bank',name:'Bank and pay statements',ex:'Statements, pay stubs, card letters',on:true,folders:[]},
 {id:'medical',name:'Medical',ex:'Insurance cards, visit notes, vaccination records',on:true,folders:['health']},
 {id:'legal',name:'Legal',ex:'Leases, contracts, signed agreements',on:true,folders:['lease']},
 {id:'keys',name:'Passwords and keys',ex:'Recovery codes, key files',on:true,folders:[]},
 {id:'docphotos',name:'Photos of documents',ex:'Phone photos of IDs or forms',on:false,folders:[]}];

/* the one folder look: a filled folder in the colour of the part of life it belongs to; private folders get the lock */
window.lifeOfPath=path=>{const top=(Array.isArray(path)?path[0]:String(path||'').split('/')[0]);return LIFE_AREAS.find(a=>a.name===top)||null};
window.folderIc=(path,{priv=false,cls=''}={})=>{const a=lifeOfPath(path);
 return `<i class="ph-fill ph-${priv?'folder-simple-lock':'folder-simple'} fold-ic ${cls}" style="color:var(${priv?'--lock':a?a.hue:'--k-folder'})" aria-hidden="true"></i>`};

/* files that are private by kind (school records, money and tax, IDs): they stay in their topic folder with a lock.
   Private means never sent to AI. The person can still open and preview them everywhere. */
window.PRIVATE_FILES=new Set(['Unofficial transcript.pdf','1098-T Columbia 2025.pdf','Tuition bill Fall 2026.pdf','Financial aid award 2026.pdf',
 'Form 1040 draft 2025.pdf','W-2 GRC Associates 2025.pdf','Passport scan.pdf','Student ID.png',
 'Insurance card.pdf','Vaccination record.pdf','Lease signed 2026.pdf']);
window.PRIVATE_LABEL='Private: never sent to AI';
/* top folders that are not a part of life: installers get their own folder; Needs a Home stays as small as possible */
window.EXTRA_TOP=[{id:'inst',name:'Installers',ic:'package',files:2,note:'Installers for apps you already have. Tidy Up can move them to the Trash.'}];

/* one colour and one icon per part of life and per special folder (rule 28), used by every page.
   PART_STYLE[id] -> {name, hue (a CSS var name), ic (a phosphor icon, ph-fill)}. Private never changes the colour: keep hue, add the lock.
   partStyle(x): x is a part id, a top-folder name, a plan node or file id (its part), or a path ('Studying › PHYS 1401' or an array). */
window.PART_STYLE=Object.assign({},...LIFE_AREAS.map(a=>({[a.id]:{name:a.name,hue:a.hue,ic:a.ic}})),
 {inst:{name:'Installers',hue:'--a-none',ic:'package'},loose:{name:'No folder yet',hue:'--a-none',ic:'tray'},folder:{name:'Folder',hue:'--a-none',ic:'folder-simple'}});
window.LOCK_STYLE={ic:'lock-simple',hue:'--lock'};
window.partStyle=x=>{const S=PART_STYLE;if(x==null)return S.folder;
 if(Array.isArray(x))x=x[0];x=String(x);if(S[x])return S[x];
 const top=x.split(/\s*›\s*|\//)[0].trim();const byName=Object.values(S).find(s=>s.name.toLowerCase()===top.toLowerCase());if(byName)return byName;
 try{const v=window.Plan&&Plan.view();if(v){const f=v.file(x),id=f?f.node:x;if(v.raw(id)){const r=v.pathIds(id)[0];if(S[r])return S[r]}}}catch(e){}
 return S.folder};

/* what Tuck remembers about you: ONE profile, shown in Tuck Brain (the You node) and in Settings › About You.
   Every line says where it came from and can be edited or forgotten. Restricted things (health, money, IDs) are never kept here. */
window.SRC={told:'You told Tuck',files:'From your files',answer:'From an answer'};
window.PROFILE={first:'Joseph',initials:'JY',instructions:'',
 lines:[
  {id:'school',g:'School',k:'University',v:'Columbia University',src:'told',from:'Setup, About You'},
  {id:'year',g:'School',k:'Year',v:'Third year',src:'told',from:'Setup, About You'},
  {id:'study',g:'School',k:'Study',v:'Economics, minor in Physics',src:'told',from:'Setup, About You'},
  ...LIFE_AREAS[0].topics.filter(t=>t.id!=='reg').map(t=>({id:'c-'+t.id,g:'Classes',k:'Class',v:t.name,src:'files',node:t.id,from:`${t.files} files in Studying › ${t.name}`})),
  {id:'job',g:'Work',k:'Job',v:'Intern at GRC Associates since June 2026',src:'answer',from:'You answered “GRC Associates is my employer”'},
  {id:'search',g:'Work',k:'Looking for',v:'Summer 2027 internships',src:'files',node:'job',from:'34 files in Job Search'},
  {id:'p-alv',g:'People',k:'Prof. Alvarez',v:'teaches PHYS 1401',src:'files',from:'Lecture 1 Kinematics.pdf'},
  {id:'p-maya',g:'People',k:'Maya Chen',v:'your lab partner',src:'answer',from:'You answered a question on Oct 14'},
  {id:'p-dana',g:'People',k:'Dana Ruiz',v:'your manager at GRC',src:'files',from:'1-on-1 with Dana.docx'},
  {id:'p-theo',g:'People',k:'Theo',v:'a friend',src:'told',from:'Setup, About You'},
  {id:'pl-lib',g:'Places',k:'Butler Library',v:'where you study',src:'files',from:'Photo locations'},
  {id:'pl-grc',g:'Places',k:'GRC office, Midtown',v:'where you work',src:'answer',from:'You answered a question on Oct 9'},
  {id:'find',g:'How you look for files',k:'First',v:'by what it’s for, then by year',src:'told',from:'Setup, How you look for things'},
  {id:'h-dl',g:'Patterns',k:'Mondays',v:'lecture handouts land in Downloads',src:'files',from:'Downloads, last 6 weeks'},
  {id:'h-ss',g:'Patterns',k:'Desktop',v:'about 5 screenshots a day stay there',src:'files',from:'Desktop, last 30 days'},
  {id:'h-res',g:'Patterns',k:'Resumes',v:'you keep every version; Resume (6).pdf is the newest',src:'files',from:'Job Search › Resumes'}]};
/* a line learned from a folder says the plan's live count ("26 files in Studying › PHYS 1401"), until you fix it yourself */
PROFILE.lines.forEach(l=>{if(!l.node)return;let own=null;const n0=l.from;
 Object.defineProperty(l,'from',{configurable:true,enumerable:true,set(x){own=x},get(){if(own!==null)return own;
  try{const v=window.Plan&&Plan.view();if(v&&v.node(l.node)){const c=v.total(l.node);return `${c} file${c===1?'':'s'} in ${v.path(l.node).join(' › ')}`}}catch(e){}return n0}})});
/* what Tuck sorted lately, in minutes before the page loaded (never a typed-in clock time). plan.js Plan.recentSorted() turns these into
   Today's and History's rows, and drops any file the plan doesn't really have in a folder (a file still in No folder yet is never "sorted"). */
/* the screenshots Tuck sorted into Photos › Screenshots, one per October day, each at its own waking-hours time (never all at 09.30) */
window.shotName=d=>{const p=n=>String(n).padStart(2,'0');return `Screenshot 2026-10-${p(d)} at ${p(8+(d*7)%14)}.${p((d*23+11)%60)}.${p((d*37+5)%60)}.png`};
window.SORTED_LOG=[
 {files:['Lecture 6 Gravity.pdf'],mins:8,from:'Downloads'},
 {files:[30,29,28,27,26].map(shotName),mins:34,from:'Desktop',noun:'screenshots'},
 {files:['Week 6 notes.pdf'],mins:71,from:'Downloads'},
 {files:['Invoice 0042.pdf','Invoice 0041.pdf'],mins:118,from:'Downloads',noun:'GRC invoices'},
 {files:['Resume (6).pdf'],mins:164,from:'Downloads'},
 {files:['1098-T Columbia 2025.pdf'],mins:212,from:'Downloads'},
 {files:['Standup Oct 28.docx','Client call notes Oct.docx'],mins:1210,from:'Downloads',noun:'meeting notes'},
 {files:['HW5 hashing.py','COMS Lecture 6.pdf','Week 5 notes.pdf','Problem Set 5.pdf'],mins:1390,from:'Downloads',noun:'class files'}];

/* Clean Up / Tidy Up groups, the same on every page. Installers are exactly the files in the Installers folder (plan sizes).
   items: [name, MB, where]. TIDY_MB is the total. */
window.TIDY_GROUPS=[
 {id:'ins',leg:'Installers',ic:'package',title:'Installers for apps you already have',why:'Each app is installed. Only the installer file goes; the app stays.',noun:'installer',
  items:[['Zoom.dmg',94.1,'Downloads · Sep 2026'],['Notion-3.2.dmg',121.4,'Downloads · Oct 2026']]},
 {id:'zip',leg:'Opened zips',ic:'file-zip',title:'Zip files you already opened',why:'The unpacked folder sits right next to each one.',noun:'zip file',
  items:[['GRC_brand_assets.zip',310,'Downloads · Jul 2026'],['photos-oct-2025.zip',290,'Downloads · Nov 2025'],['PHYS1401_Lab3_starter.zip',42,'Downloads · Oct 2026']]},
 {id:'dup',leg:'Copies',ic:'copy',title:'Exact copies',why:'Same file, byte for byte. Tuck keeps the one in your sorted folder.',noun:'copy',
  items:[['GRC onboarding deck copy.pptx',18,'Same as the one in Work › GRC Associates'],['IMG_1840 2.HEIC',3.1,'Same as IMG_1840.HEIC in Photos'],['Lab 2 (1).pdf',1.4,'Same as Lab 2.pdf in PHYS 1401'],['ECON 2257 Syllabus (1).pdf',.48,'Same as the one in ECON 2257'],['Resume (3) copy.pdf',.22,'Same as Resume (3).pdf']]}];
window.TIDY_MB=Math.round(TIDY_GROUPS.reduce((a,g)=>a+g.items.reduce((b,i)=>b+i[1],0),0));
