/* folderpanel.js: the right panel and the right-click menu for a selected folder or file. One system for
   the Folder Workbench, Finder (Sorted by Tuck) and Tuck Brain. Needs plan.js (and resort.js for the Tuck actions).
   Loads its own CSS; uses system.css tokens and Phosphor icons.

   API
     FolderPanel.render(el, sel, hooks)   draw the panel into el.
        sel = {type:'node', id} | {type:'file', id} | {type:'multi', items:[{type, id}]} | null
     FolderPanel.menu(x, y, sel, hooks)   the right-click menu with the same actions
     FolderPanel.actions(sel, hooks)      [{key, ic, label, line, run}] (the one list both use)
     FolderPanel.pick(anchor, {title, exclude:[ids], top, newFolder}) -> Promise<nodeId | null (top level) | undefined (cancel)>
     FolderPanel.thumb(file, size)        a small thumbnail: 'xs' (tree rows), 'sm' (lists), 'lg' (preview)
     FolderPanel.close()                  close an open menu or picker
   hooks (all optional)
     toast(msg, undoFn)  select(sel)  rename(nodeId) (inline rename in the host; otherwise the panel asks)
     ask(text, sel)  open(fileId)  reveal(fileId)  quicklook(fileId)  info(fileId)  why(fileId)  always(question, yesFn)
     tell(text, sel) -> reply html (the composer slot; default parses a few commands)
     hide()  the host's "Hide the side panel" (a sidebar.right button in the panel's top corner; the host keeps the state)
   Every feature sits on the thing it changes (panel v2); More keeps only the rare ones:
     folder: the name renames in place | the path pop-up: Move To…, Merge Into…, Move to the Top Level | "+" on the subfolders
             figure: New Folder Inside | Files › Arrange ⌄: Arrange… (Tuck's pick first), Split…, Re-sort… | What Tuck may do here:
             the read level and ONE switch, Keep As Is | suggested: Add Folder / Not Now | More ⌄: Hide / Show Again, Delete (empty only)
     file:   Open, Quick Look | "In Tuck" pop-up: Move To…, Re-sort… | "On disk": Show in Finder | Why it's here | read level, Keep As Is
     multi:  the row of actions, More ⌄.
   The purpose of each tool (one engine: every tool makes a plan of ops; Use is one History row with Undo):
     Arrange = organise INSIDE one folder (Tuck's pick, or a way you choose) · Split = separate folders next to it ·
     Re-sort = decide again for the files you pick · Merge / Move / Rename / New Folder / Delete (empty) / Hide = direct edits.
   One set of labels on every page (the right-click menu, Finder, the Workbench, Brain):
     folders: Rename…, Move To…, Merge Into…, Split…, New Folder Inside | Arrange…, Re-sort… | ✓ Private, ✓ Keep As Is | Hide, Delete
     files:   Open, Quick Look | Move To…, Re-sort… | ✓ Private, ✓ Keep As Is | Show in Finder
   An unavailable item is greyed with its reason (Plan.can). Keep As Is = Plan.setKeep (the plan's keep + 'tuckPins').
   FolderPanel.why(fileId) -> one plain sentence: why the file is in its folder, from its name and kind only.
   Every edit goes to Plan.change (a pending change, Apply in the bottom bar). What the AI may read goes to
   Plan.setLevel straight away, with Undo (privacy.setItem). Nothing moves on disk. */
(function(){
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pl=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
const fmtKB=k=>k>=1e6?(k/1e6).toFixed(1)+' GB':k>=1000?Math.round(k/100)/10+' MB':Math.round(k)+' KB';
const mid=(s,n=34)=>s.length<=n?s:s.slice(0,Math.ceil(n*.55))+'…'+s.slice(-Math.floor(n*.4));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- CSS (injected once) */
const CSS=`
.tag{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:6px;font:600 11px/1 var(--f);flex:none;white-space:nowrap;background:var(--soft);color:var(--ink2)}
.tag .ph,.tag .ph-fill{font-size:11px}
.tag.new{background:var(--ac-fill);color:var(--ac-ink)}.tag.ren{background:var(--ac-fill);color:var(--ac-ink)}.tag.rem{background:var(--danger-fill);color:var(--danger)}
.tag.mov{background:var(--warn-fill);color:var(--warn)}.tag.lock{background:var(--lock-fill);color:var(--lock)}.tag.sug{background:transparent;box-shadow:inset 0 0 0 1px var(--line2);color:var(--ink2)}
.fpth{position:relative;flex:none;display:grid;place-items:center;border-radius:4px;background:var(--win);box-shadow:0 0 0 1px var(--line2);color:var(--c);overflow:hidden}
.fpth.xs{width:16px;height:20px;border-radius:3px}.fpth.xs .ph{font-size:11px}
.fpth.sm{width:24px;height:30px}.fpth.sm .ph{font-size:14px}
.fpth.md{width:56px;height:68px;border-radius:6px}.fpth.md .ph{font-size:24px}
.fpth.img{box-shadow:0 0 0 1px var(--line)}
.fpth .lk{position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-radius:50%;display:grid;place-items:center;background:var(--lock);color:#fff;font-size:8px}
.fpth.xs .lk{width:10px;height:10px;font-size:7px;right:-1px;bottom:-1px}
.fp{display:flex;flex-direction:column;min-height:100%;font:500 13px/1.45 var(--f);color:var(--ink)}
.fp-hd{--h:var(--k-folder);display:flex;gap:12px;align-items:flex-start;padding:16px 16px 12px}
.fp-tile{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--h);color:#fff;font-size:20px;flex:none;box-shadow:inset 0 -2px 0 rgba(0,0,0,.14)}
.fp-tile.sug{background:transparent;color:var(--h);box-shadow:inset 0 0 0 1.5px var(--h);border:1.5px dashed transparent}
.fp-hd .t{min-width:0;flex:1}.fp-hd h3{font:650 15px/1.3 var(--f);overflow-wrap:break-word}
.fp-path{font:500 12px/1.4 var(--f);color:var(--ink3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.fp-sure{display:flex;align-items:center;gap:8px;font:600 12px var(--f)}.fp-sure i{display:block;width:48px;height:4px;border-radius:2px;background:var(--soft2);overflow:hidden}.fp-sure i b{display:block;height:100%;background:currentColor}
.fp-sure.sure{color:var(--ac-ink)}.fp-sure.leaning{color:var(--ac-ink)}.fp-sure.unsure{color:var(--warn)}
.fp-stats{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,.9fr) minmax(0,1.1fr) minmax(0,1.2fr);border-block:1px solid var(--line)}
.fp-stats span{min-width:0;padding:8px 4px 8px 16px;font:500 12px var(--f);color:var(--ink3)}.fp-stats span+span{border-left:1px solid var(--line);padding-left:12px}
.fp-stats b{display:block;font:650 13px var(--f);color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fp-sec{padding:12px 16px;border-bottom:1px solid var(--line)}
.fp-sh{display:flex;align-items:center;gap:8px;font:600 12px var(--f);color:var(--ink2);margin-bottom:8px}.fp-sh .sp{flex:1}.fp-sh small{font:500 12px var(--f);color:var(--ink3)}
.fp-why{display:flex;gap:8px;align-items:flex-start;color:var(--ink)}.fp-why .ph{color:var(--ink3);margin-top:3px;flex:none}
.fp-why+.fp-why{margin-top:4px}.fp-why.dim{color:var(--ink2)}
.fp-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;border-radius:9px;background:var(--soft2)}
.fp-seg button{height:28px;border-radius:7px;font:600 12px var(--f);color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
.fp-seg button:hover{color:var(--ink)}.fp-seg button.on{background:var(--win);color:var(--ink);box-shadow:0 0 0 .5px var(--line2),0 1px 2px rgba(20,30,60,.12)}
.fp-seg button.on[data-lv=private]{color:var(--lock)}
.fp-eff{margin-top:8px;font:500 12px/1.45 var(--f);color:var(--ink2)}.fp-eff a{color:var(--ac-ink);font-weight:600;text-decoration:none;cursor:pointer}
.fp-files{list-style:none;padding:0;margin:0;display:grid}
.fp-files li{display:flex;align-items:center;gap:8px;min-height:36px;padding:2px 4px;margin:0 -4px;border-radius:8px;cursor:grab}
.fp-files li:hover{background:var(--hov)}.fp-files li.on{background:var(--sel)}.fp-files li.dragging{opacity:.4}
.fp-files .n{flex:1;min-width:0}.fp-files .n b{display:block;font:500 13px/1.3 var(--f);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-files .n small{display:block;font:500 12px/1.3 var(--f);color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fp-files .n small.lk{color:var(--lock)}
.fp-older{display:flex;align-items:center;gap:6px;width:100%;height:28px;font:600 12px var(--f);color:var(--ac-ink)}
.fp-acts{display:grid;gap:0}
.fp-act{display:flex;align-items:center;gap:10px;height:32px;padding:0 8px;margin:0 -8px;border-radius:8px;text-align:left;font:500 13px var(--f);color:var(--ink)}
.fp-act .ph{font-size:16px;color:var(--ink2);width:18px;flex:none}.fp-act:hover,.fp-act:focus-visible{background:var(--hov)}.fp-act:hover .ph{color:var(--ink)}
.fp-act.dis{opacity:.45;pointer-events:none}.fp-act.danger,.fp-act.danger .ph{color:var(--danger)}
.fp-act kbd{margin-left:auto;font:500 12px var(--f);color:var(--ink3)}
.fp-quick{display:grid;grid-template-columns:repeat(var(--n,5),minmax(0,1fr));gap:4px;padding:0 12px 12px}
.fp-q{display:grid;justify-items:center;align-content:start;gap:4px;min-width:0;padding:8px 2px 6px;border-radius:10px;font:500 12px/1.2 var(--f);color:var(--ink2)}
.fp-q .ph{font-size:18px;color:var(--ink)}.fp-q:hover,.fp-q:focus-visible{background:var(--hov);color:var(--ink)}
.fp-q span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fp-q.dis{opacity:.4;pointer-events:none}.fp-q.danger,.fp-q.danger .ph{color:var(--danger)}
.fp-qstep{padding:0 16px}.fp-qstep:empty{display:none}
.fp-line{display:flex;gap:8px;align-items:flex-start;min-height:40px;margin-top:8px;padding:8px 10px;border-radius:9px;background:var(--soft);font:500 12px/1.45 var(--f);color:var(--ink2)}
.fp-line .ph{margin-top:2px;color:var(--ink3);flex:none}
.fp-step{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--soft);display:grid;gap:8px;animation:fpin .2s var(--ease) both}
.fp-step p{font:500 12px/1.45 var(--f);color:var(--ink2)}.fp-step p b{color:var(--ink)}.fp-step .row{display:flex;gap:8px;flex-wrap:wrap}
.fp-step label{display:flex;align-items:center;gap:8px;font:500 13px var(--f)}.fp-step label input[type=checkbox]{accent-color:var(--ac)}.fp-step label small{margin-left:auto;color:var(--ink3);font-size:12px}
.fp-step label .field{height:28px;flex:1;min-width:0;background:var(--win)}
@keyframes fpin{from{opacity:0;transform:translateY(4px)}}
.fp-cmp{margin-top:auto;position:sticky;bottom:0;padding:12px 16px 16px;background:var(--win);box-shadow:0 -1px 0 var(--line)}
.fp-cmp form{display:flex;align-items:center;gap:6px;padding:4px 4px 4px 12px;border-radius:12px;background:var(--win);box-shadow:0 0 0 1px var(--line2),0 8px 20px -14px rgba(20,30,60,.3)}
.fp-cmp form:focus-within{box-shadow:0 0 0 2px var(--ac)}
.fp-cmp input{flex:1;min-width:0;border:0;background:none;outline:0;font:500 13px var(--f);height:32px;color:var(--ink)}
.fp-cmp .send{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--ac-btn);color:#fff;font-size:16px}
.fp-said{margin-bottom:8px;font:500 12px/1.45 var(--f);color:var(--ink2)}.fp-said b{color:var(--ink)}
.fp-pv{display:grid;place-items:center;padding:16px;background:var(--soft);border-bottom:1px solid var(--line)}
.fp-sheet{position:relative;width:120px;height:154px;border-radius:6px;background:#fff;box-shadow:0 0 0 1px var(--line2),0 8px 18px -10px rgba(20,30,60,.45);padding:14px 12px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.fp-sheet b{font:700 9px/1.3 var(--f);color:#1e2131;margin-bottom:4px}.fp-sheet i{display:block;height:3px;border-radius:2px;background:#d9dde6}.fp-sheet i:nth-child(3n){width:70%}.fp-sheet i:nth-child(4n){width:84%}
.fp-sheet.img{padding:0;width:180px;height:132px}
.fp-sheet .pl{position:absolute;left:6px;right:6px;bottom:6px;display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:5px;background:var(--lock);color:#fff;font:600 9px/1.2 var(--f)}
.fp-kv{display:grid;grid-template-columns:88px 1fr;gap:4px 8px;font:500 12px/1.45 var(--f)}.fp-kv dt{color:var(--ink3)}.fp-kv dd{margin:0;color:var(--ink);min-width:0;overflow-wrap:anywhere}
.fp-empty{padding:40px 24px;text-align:center;color:var(--ink3);display:grid;gap:8px;justify-items:center}.fp-empty .ph{font-size:28px;color:var(--deco)}.fp-empty b{color:var(--ink);font:600 13px var(--f)}
.fp-pick{position:fixed;z-index:200;width:280px;max-height:min(420px,calc(100vh - 24px));display:flex;flex-direction:column;border-radius:12px;background:var(--win);box-shadow:var(--sh-pop);overflow:hidden;animation:fpin .16s var(--ease) both}
.fp-pick header{padding:10px 10px 6px;display:grid;gap:6px}.fp-pick header b{font:600 12px var(--f);color:var(--ink2);padding:0 4px}
.fp-pick .list{overflow:auto;padding:0 6px 6px}
.fp-pick button{display:flex;align-items:center;gap:8px;width:100%;height:28px;padding:0 8px;border-radius:7px;text-align:left;font:500 13px var(--f);color:var(--ink);white-space:nowrap}
.fp-pick button span{overflow:hidden;text-overflow:ellipsis}
.fp-pick button:hover,.fp-pick button.kb{background:var(--ac);color:#fff}.fp-pick button:hover .ph-fill,.fp-pick button.kb .ph-fill{color:#fff!important}
.fp-pick hr{border:0;height:1px;background:var(--line);margin:4px 2px}
.menu.fp-menu{min-width:240px}.menu.fp-menu .k{margin-left:auto;padding-left:16px;font:500 12px var(--f);opacity:.6}
.menu.fp-menu button.dis{opacity:1;pointer-events:none;color:var(--ink3)}.menu.fp-menu button.dis .ph{opacity:.5}.menu.fp-menu button.dis small{color:var(--ink3)}
.menu.fp-menu .fp-ck{width:14px;font-size:13px;visibility:hidden;color:var(--ac-ink)}.menu.fp-menu .fp-ck.on{visibility:visible}
.menu.fp-menu button.danger{color:var(--danger)}
.menu.fp-menu.chk button>.ph:not(.fp-ck){display:none}
.fp-refuse{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:var(--z-tip,120);display:flex;align-items:center;gap:8px;max-width:min(460px,calc(100vw - 32px));padding:10px 14px;border-radius:12px;background:var(--ink);color:var(--win);font:500 13px/1.4 var(--f);box-shadow:var(--sh-pop);animation:fpin .16s var(--ease) both}
.fp-refuse .ph{flex:none;font-size:16px}
.menu.fp-menu button.two{height:auto;min-height:26px;padding-block:4px;align-items:flex-start}.menu.fp-menu button.two .ph{margin-top:2px}
.menu.fp-menu button.two span{display:grid;gap:1px}.menu.fp-menu button.two small{font:500 11.5px/1.35 var(--f);white-space:normal;max-width:220px}
/* panel v2: every feature on the thing it changes */
.fp{position:relative}
.fp-tools{position:absolute;top:10px;right:10px;z-index:2;display:flex;align-items:center;gap:2px}
.fp-tools .ib{width:28px;height:28px;border-radius:7px;font-size:16px;color:var(--ink2)}.fp-tools .ib:hover,.fp-tools .ib[aria-expanded="true"]{background:var(--hov);color:var(--ink)}
.fp-tools .ib:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fp-pv~.fp-tools .ib{background:color-mix(in srgb,var(--win) 80%,transparent)}
.fp-hide .ph{transform:scaleX(-1)}
.fp-tools .ib:has(.pcaret){width:auto;min-width:28px;padding:0 6px;gap:0}.fp-name h3{min-width:0}
.fp-hd.fp-tl .t>.fp-name,.fp-hd.fp-tl .t>h3{margin-right:62px}.fp-hd.fp-tl .t>.fp-nmin{width:calc(100% - 58px)}
.fp-name{display:flex;align-items:center;gap:2px;min-width:0;margin-left:-4px}
.fp-nm{min-width:0;max-width:100%;padding:1px 4px;margin:0;border-radius:6px;font:650 15px/1.3 var(--f);color:var(--ink);text-align:left;overflow-wrap:break-word;cursor:text}
.fp-nm:hover{background:var(--hov)}
.fp-pen{flex:none;width:24px;height:24px;margin-left:2px;border-radius:6px;display:grid;place-items:center;color:var(--ink3);font-size:14px}.fp-pen:hover{background:var(--hov);color:var(--ink)}
.fp-nmin{display:block;width:100%;height:28px;margin:-3px 0 -1px -6px;padding:0 6px;border:0;border-radius:6px;outline:0;background:var(--win);box-shadow:0 0 0 2px var(--ac);font:650 15px var(--f);color:var(--ink)}
.fp-nmhint{margin-top:4px;font:500 11.5px var(--f);color:var(--ink3)}
.fp-hd .popchip{height:24px;margin:5px 0 0 -2px;padding:0 6px 0 7px;font-size:12px;color:var(--ink2);max-width:100%}
.fp-hd .popchip .ph:first-child{font-size:13px;color:var(--ink3)}
.fp-sugbar{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;margin:0 12px 12px;padding:10px 12px;border-radius:10px;background:var(--ac-fill);color:var(--ac-ink);font:600 13px/1.3 var(--f)}
.fp-sugbar>.ph{font-size:16px}.fp-sugbar .row{grid-column:2;display:flex;gap:6px}.fp-sugbar .btn.ghost{color:var(--ac-ink)}
.fp-stats b.plus{display:flex;align-items:center;gap:6px}
.fp-plus{flex:none;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-size:12px;color:var(--ac-ink);background:var(--ac-fill)}
.fp-plus:hover{background:var(--ac);color:#fff}.fp-plus:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fp-sh .popchip{height:24px;padding:0 6px 0 8px;font:600 12px var(--f);color:var(--ink)}.fp-sh .popchip .ph:first-child{font-size:13px;color:var(--ink2)}
.fp-deep{display:flex;align-items:center;gap:8px;margin:-2px 0 8px;font:500 12px var(--f);color:var(--ink2);cursor:pointer;width:max-content}
.fp-deep .sw{width:28px;height:16px}.fp-deep .sw::after{width:12px;height:12px}.fp-deep .sw.on::after{left:14px}
.fp-sws{display:grid;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.fp-swr{display:flex;align-items:flex-start;gap:12px;cursor:pointer}.fp-swr>span{flex:1;min-width:0;display:grid;gap:1px}
.fp-swr b{font:500 13px/1.35 var(--f);color:var(--ink)}.fp-swr small{font:500 12px/1.4 var(--f);color:var(--ink3)}
.fp-swr .sw{margin-top:1px}.fp-swr.dis{cursor:default}.fp-swr.dis .sw{opacity:.5;pointer-events:none}
.fp-btns{display:flex;gap:8px;padding:0 16px 12px}.fp-btns .btn{flex:1}
.fp-kv dd .popchip{height:auto;min-height:24px;padding:3px 6px 3px 8px;margin:-3px 0 0 -8px;font-size:12px;line-height:1.35;white-space:normal}
.fp-kv dd .popchip .pth{white-space:normal}
.fp-reveal{display:inline-flex;align-items:flex-start;gap:5px;height:auto;margin:0 0 0 -6px;padding:0 6px;border-radius:6px;font:500 12px/1.45 var(--f);color:var(--ac-ink);text-align:left;white-space:normal}
.fp-reveal .ph{font-size:13px;margin-top:2px;flex:none}.fp-reveal:hover{background:var(--hov);text-decoration:underline}
.fp-page{min-height:100%}
.fp-pagebar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--win);font:600 13px var(--f);color:var(--ink)}
.fp-pagebar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-pagebody{padding:12px}
`;
if(!document.getElementById('fp-css')){const s=document.createElement('style');s.id='fp-css';s.textContent=CSS;document.head.appendChild(s)}

/* ---------- thumbnails (the person can always preview, private or not) */
const PHOTO=['linear-gradient(180deg,#f7b267,#f4845f 45%,#9c5e8e 75%,#3b3561)','linear-gradient(180deg,#a6d8f5 0 46%,#3fa7c0 46% 62%,#ecd6a8 62%)','linear-gradient(180deg,#9ec5e8 0 30%,#6b8f4e 30% 74%,#4a3b2a 74%)',
 'linear-gradient(160deg,#6a8a9c,#2c3e50)','linear-gradient(180deg,#f6d8a8,#e6a57e)','linear-gradient(135deg,#d8cfe6,#a99bbf)'];
const BOARD='linear-gradient(172deg,transparent 40%,rgba(30,60,140,.5) 41% 43%,transparent 44%),linear-gradient(176deg,transparent 58%,rgba(190,40,40,.45) 59% 61%,transparent 62%),linear-gradient(180deg,#f2f4f6,#e3e7ec)';
const SHOT='linear-gradient(#2b2f3a,#2b2f3a) 0 0/100% 12% no-repeat,linear-gradient(#cfd6e4,#cfd6e4) 10% 30%/55% 8% no-repeat,linear-gradient(#e3e8f0,#e3e8f0) 10% 50%/80% 6% no-repeat,linear-gradient(#4c7dff,#4c7dff) 10% 78%/30% 10% no-repeat,#f7f8fb';
const hsh=s=>{let h=3;for(const c of s)h=(h*33+c.charCodeAt(0))>>>0;return h};
function scene(f){const e=Plan.ext(f.name);if(e==='png')return /Screenshot|Wireframe|Sitemap|Project shot/.test(f.name)?SHOT:PHOTO[hsh(f.name)%PHOTO.length];if(e==='heic')return f.node==='wb'||/^IMG_221\d/.test(f.name)?BOARD:PHOTO[hsh(f.name)%PHOTO.length];return null}
function lockOf(f){return Plan.view().level(f.id).level==='private'}
function thumb(f,size='sm'){const k=Plan.kind(f.name),bg=scene(f),lk=lockOf(f)?`<span class="lk"><i class="ph-fill ph-lock-simple"></i></span>`:'';
 return bg?`<span class="fpth ${size} img" style="background:${bg};background-size:cover" aria-hidden="true">${lk}</span>`:`<span class="fpth ${size}" style="--c:var(${k.c})" aria-hidden="true"><i class="ph ph-${k.ic}"></i>${lk}</span>`}

/* ---------- small helpers */
const V=()=>Plan.view();
/* one colour and icon per part of life and special folder (rule 28, sample.js partStyle): private keeps its part's colour and shows the lock */
function tileOf(v,id){const n=v.node(id),a=v.area(id),top=v.depth(id)===0;const lv=v.level(id).level==='private';
 const ps=window.partStyle?partStyle(n.special?'loose':v.pathIds(id)[0]):null;const hue=ps?ps.hue:a.hue;
 return {hue,ic:top?(n.special?'tray':ps?ps.ic:a.ic||'folder-simple'):lv?'folder-simple-lock':n.sug?'folder-simple-dashed':'folder-simple'}}
/* Tuck's folders show inside every place (Desktop, Documents, Downloads, iCloud Drive), so a folder's path has no place;
   a file's does: Downloads › Studying › PHYS 1401 */
const crumb=(v,id)=>v.path(id).join(' › ');
const placeCrumb=(v,f)=>[String(f.where||f.from||'Downloads').split(' › ')[0],...v.path(f.node)].join(' › ');
let step=null,said=null,open={older:false,deep:false},lastSel='';
const H=h=>h||{};
function toast(h,msg,undo){(H(h).toast||((m)=>console.log(m)))(msg,undo)}
function levelSet(h,target,level){const v=V();const name=(v.node(target)||v.file(target)).name;const row=Plan.setLevel(target,level);
 const L=level==='inherit'?'same as its folder':Plan.LEVELS[level].label.toLowerCase();toast(h,`${name}: ${L}.${level==='private'?' Never sent to AI.':''}`,()=>Plan.undoLevel(row.id))}

/* ---------- the one list of actions (panel and menu) */
/* Re-sort, Arrange and Suggest: a page in the panel's column when the panel opened them (h.page), else resort.js's sheet */
function go(h,fn,o,title){if(!window.Resort||typeof Resort[fn]!=='function')return;if(H(h).page)return h.page(fn,o,title);return Resort[fn](o)}
/* the one action list. Short labels; .sub is the menu's one short second line; .why says why it's unavailable (Plan.can).
   check:true|false makes a check item (✓ Private, ✓ Keep As Is). Every run goes to the shared engine. */
const CAN=(tool,id)=>Plan.can?Plan.can(tool,id):{ok:true,why:''};
const gate=(a,tool,id)=>{const c=CAN(tool,id);if(!c.ok){a.dis=true;a.why=c.why;a.line=c.why}return a};
function keepAct(h,id,name){const on=Plan.isKept?Plan.isKept(id):pins().has(id);
 return {key:'keep',ic:'push-pin',label:'Keep As Is',check:on,line:on?'Tuck won’t rename, move or reshape it.':'Tuck may rename, move or reshape it.',run:()=>setKeep(h,id,name,!on)}}
function setKeep(h,id,name,on){const row=Plan.setKeep(id,on);if(!row)return;toast(h,on?`${name}: Keep As Is.`:`${name}: Tuck may change it again.`,()=>Plan.undoApply(row.id));h.refresh&&h.refresh()}
function privAct(h,id,name,isFile){const v=V(),priv=v.level(id).level==='private';const f=isFile&&v.file(id);
 return {key:'private',ic:'lock-simple',label:'Private',check:priv,line:priv?'Never sent to AI.':'Tuck’s AI may read it.',run:()=>levelSet(h,id,priv?(isFile?(f&&f.priv?'read':'inherit'):'names'):'private')}}
function actions(sel,h){h=H(h);const v=V();if(!sel)return [];
 if(sel.type==='multi'){const nodes=sel.items.filter(x=>x.type==='node').map(x=>x.id).filter(id=>v.node(id)),files=sel.items.filter(x=>x.type==='file').map(x=>x.id);
  const out=[];if(nodes.length){const n=nodes.length;const kept=nodes.find(id=>Plan.isKept&&Plan.isKept(id));
   out.push(Object.assign({key:'putInside',ic:'arrow-bend-up-right',label:'Move To…',short:'Move To',line:`${pl(n,'folder')} go inside the folder you pick.`,run:a=>pick(a,{title:`Move ${n} folders to`,exclude:nodes,top:true,newFolder:true}).then(t=>{if(t!==undefined)Plan.change({ty:'putInside',nodes,parent:t})})},kept?{dis:true,line:CAN('move',kept).why}:{}),
    Object.assign({key:'merge',ic:'arrows-merge',label:'Merge Into…',short:'Merge',line:`They join the folder you pick.`,run:a=>pick(a,{title:`Merge ${n} folders into`,exclude:nodes}).then(t=>{if(t)Plan.change({ty:'merge',nodes,into:t})})},kept?{dis:true,line:CAN('merge',kept).why}:{}),
    {key:'hide',ic:'eye-slash',label:'Hide',short:'Hide',line:'Hidden from your folders. Show again any time.',run:()=>Plan.change({ty:'hide',nodes})});}
  if(files.length){const pinned=files.find(id=>Plan.isKept&&Plan.isKept(id));
   out.push(Object.assign({key:'move',ic:'arrow-bend-up-right',label:'Move To…',short:'Move To',line:'Shown in the folder you pick.',run:a=>pick(a,{title:`Move ${files.length} files to`,newFolder:true}).then(t=>{if(t)Plan.change({ty:'moveFiles',files,to:t})})},pinned?{dis:true,line:CAN('move',pinned).why}:{}),
    {key:'private',ic:'lock-simple',label:'Private',short:'Private',line:'Never sent to AI.',run:()=>{const rows=files.map(f=>Plan.setLevel(f,'private'));toast(h,`${pl(files.length,'file')} private.`,()=>rows.forEach(r=>Plan.undoApply(r.id)))}})}
  out.push({key:'resort',ic:'arrows-clockwise',label:'Re-sort…',short:'Re-sort',line:'Tuck decides again where each goes.',run:()=>go(h,'open',{scope:'selection',fileIds:[...files,...nodes.flatMap(id=>v.files(id,true).map(f=>f.id))]},'Re-sort these')});
  return out}
 if(sel.type==='file'){const f=v.file(sel.id);if(!f)return [];
  return [{key:'open',ic:'arrow-square-out',label:'Open',short:'Open',line:'Opens in its app.',run:()=>(h.open||(()=>toast(h,`Opened ${f.name}.`)))(f.id)},
   {key:'quicklook',ic:'eye',label:'Quick Look',line:'A quick preview.',run:()=>(h.quicklook||(()=>toast(h,`Quick Look: ${f.name}.`)))(f.id)},
   '-',gate({key:'move',ic:'arrow-bend-up-right',label:'Move To…',short:'Move To',line:'Shown in the folder you pick.',run:a=>pick(a,{title:`Move ${mid(f.name,28)} to`,exclude:[f.node],newFolder:true}).then(t=>{if(t){if(Plan.change({ty:'moveFiles',files:[f.id],to:t}))alwaysAsk(h,[f.id],t)}})},'move',f.id),
   gate({key:'resort',ic:'arrows-clockwise',label:'Re-sort…',short:'Re-sort',sub:'Tuck decides again where it goes',line:'Tuck decides again where it goes.',run:()=>go(h,'open',{scope:'selection',fileIds:[f.id]},`Re-sort ${f.name}`)},'resort',f.id),
   '-',privAct(h,f.id,f.name,true),keepAct(h,f.id,f.name),
   '-',{key:'reveal',ic:'magnifying-glass',label:'Show in Finder',line:`Really in ${f.where||f.from}.`,run:()=>(h.reveal||(()=>toast(h,`Shown in Finder: ${f.from}.`)))(f.id)}]}
 const id=sel.id,n=v.node(id);if(!n)return [];const cnt=v.total(id),kids=v.kids(id).length;const name=n.name;
 if(n.special)return [gate({key:'resort',ic:'arrows-clockwise',label:'Re-sort…',short:'Re-sort',sub:'Tuck decides where each one goes',line:`Tuck decides where these ${pl(cnt,'file')} go.`,run:()=>go(h,'open',{scope:'loose'},'Re-sort files without a folder')},'resort',id)];
 const out=[];
 if(n.sug)out.push({key:'accept',ic:'check',label:'Add Folder',short:'Add Folder',line:`${name} becomes a folder, with its ${pl(cnt,'file')}.`,run:()=>Plan.change({ty:'accept',node:id})},
  {key:'reject',ic:'x',label:'Not Now',short:'Not Now',line:`Its files stay in ${v.node(n.parent).name}.`,run:()=>Plan.change({ty:'reject',node:id})},'-');
 out.push(gate({key:'rename',ic:'pencil-simple',label:'Rename…',short:'Rename',line:'Same files, new name.',run:()=>h.rename&&!h.page?h.rename(id):(step={k:'rename',id},(h.refresh||lastRefresh)())},'rename',id),
  gate({key:'putInside',ic:'arrow-bend-up-right',label:'Move To…',short:'Move To',line:`${name} goes inside the folder you pick.`,run:a=>pick(a,{title:`Move ${name} to`,exclude:[id],top:v.depth(id)>0,newFolder:true}).then(t=>{if(t!==undefined)Plan.change({ty:'putInside',nodes:[id],parent:t})})},'move',id),
  gate({key:'merge',ic:'arrows-merge',label:'Merge Into…',short:'Merge Into',line:`Its files join the folder you pick.`,run:a=>pick(a,{title:`Merge ${name} into`,exclude:[id]}).then(t=>{if(t)Plan.change({ty:'merge',nodes:[id],into:t})})},'merge',id),
  gate({key:'split',ic:'arrows-split',label:'Split…',sub:'Separate folders next to it',line:`Break ${name} into separate folders next to it.`,run:()=>go(h,'split',{nodeId:id},`Split ${name}`)},'split',id),
  {key:'newInside',ic:'folder-plus',label:'New Folder Inside',short:'New Folder',kb:'⇧⌘N',line:`An empty folder inside ${name}.`,run:()=>{const op=Plan.change({ty:'newFolder',parent:id,name:'untitled folder'});op&&h.rename?h.rename(op.node):0}},
  '-',
  gate({key:'arrange',ic:'sort-ascending',label:'Arrange…',sub:'Subfolders inside it: Tuck’s pick or your way',line:`Organise the files inside ${name}.`,run:()=>go(h,'arrange',{nodeId:id},`Arrange ${name}`)},'arrange',id),
  gate({key:'resort',ic:'arrows-clockwise',label:'Re-sort…',short:'Re-sort',sub:'Tuck decides again for each file',line:`Tuck decides again where each file in ${name} goes.`,run:()=>go(h,'open',{scope:kids?'folder_tree':'folder',nodeId:id},`Re-sort ${name}`)},'resort',id),
  '-',privAct(h,id,name,false));
 if(!n.sug)out.push(keepAct(h,id,name));
 out.push('-',n.hidden?{key:'show',ic:'eye',label:'Show Again',line:`${name} comes back in your folders.`,run:()=>Plan.change({ty:'show',nodes:[id]})}
  :{key:'hide',ic:'eye-slash',label:'Hide',line:'Hidden from your folders. Show again any time.',run:()=>Plan.change({ty:'hide',nodes:[id]})});
 if(!cnt&&!kids)out.push({key:'deleteEmpty',ic:'folder-minus',label:'Delete',danger:1,line:'It’s empty, so nothing else changes.',run:()=>Plan.change({ty:'deleteEmpty',node:id})});
 return out}

/* why a file sits where it is: names and kinds only, never words from inside */
function fileWhy(v,f){const L=v.level(f.id),nd=v.node(f.node),k=Plan.kind(f.name);
 const kindA=/^[A-Z]+$/.test(k.label)?'a '+k.label:/^(Word|Excel|PowerPoint|Keynote|Pages|Numbers)$/.test(k.label)?`a ${k.label} file`:(/^[aeiou]/i.test(k.label)?'an ':'a ')+k.label.toLowerCase();
 /* you moved it here yourself (a pending change or an applied one): say so, not a guess */
 const flat=ops=>ops.flatMap(o=>o.ty==='batch'?flat(o.ops||[]):[o]);const mine=o=>o.ty==='moveFiles'&&(o.files||[]).includes(f.id)&&o.to===f.node;
 if(flat(Plan.pending()).some(mine))return `You moved it here. It waits for Apply.`;
 const row=Plan.history().find(r=>!r.undone&&r.kind!=='resort'&&r.kind!=='needs'&&flat(r.ops||[]).some(mine));
 if(row){const w=Plan.when?Plan.when(Math.max(0,(Date.now()-row.at)/6e4)):'';const t=/^Just now$/.test(w)?' just now':/ago$/.test(w)?' '+w:/^Yesterday$/.test(w)?' yesterday':/\d:\d\d/.test(w)?' at '+w:w?' on '+w:'';return `You moved it here${t}.`}
 if(L.level==='private')return `By its name and kind: ${kindA} named “${esc(mid(f.name,28))}”, like the others in ${esc(nd.name)}.`;
 if(f.hint&&f.hint!==f.node)return `Tuck is unsure: it looks like it belongs in ${esc((v.node(f.hint)||{}).name||'another folder')} too.`;
 const sibs=v.files(f.node).filter(x=>x.id!==f.id);const low=f.name.toLowerCase();
 /* a word of the folder's name (or of a folder above it) in the file's name: say which word, and how many others share it */
 const words=[nd.name,...nd.name.split(/\s+/),...v.path(f.node).slice(0,-1)].map(w=>w.trim()).filter(w=>w.length>=3&&!/^(and|the|for|of)$/i.test(w));
 const w=words.find(x=>low.includes(x.toLowerCase()));
 if(w){const n=sibs.filter(x=>x.name.toLowerCase().includes(w.toLowerCase())).length;return `Its name has “${esc(w)}” in it${n?`, like ${pl(n,'other file')} in ${esc(nd.name)}`:''}.`}
 /* the name's first words, shared with files already here ("Lecture", "Problem Set", "Invoice") */
 const ws=f.name.replace(/\.[^.]+$/,'').split(/[\s_()-]+/).filter(Boolean);
 for(const lead of [ws.slice(0,2).join(' '),ws[0]]){if(!lead||lead.length<3||/^\d+$/.test(lead)||/\d/.test(lead.split(' ').pop()))continue;
  const n=sibs.filter(x=>x.name.toLowerCase().startsWith(lead.toLowerCase())).length;if(n)return `Its name starts with “${esc(lead)}”, like ${n===sibs.length&&n>1?`all ${n} other files`:pl(n,'other file')} in ${esc(nd.name)}.`}
 const same=sibs.filter(x=>Plan.kind(x.name).label===k.label).length;
 if(sibs.length&&same*2>=sibs.length)return `It’s ${kindA}, like ${same===sibs.length&&same>1?`all ${same} other files`:`${same} of the ${pl(sibs.length,'other file')}`} in ${esc(nd.name)}, and it came from ${esc(f.from||'this Mac')}.`;
 return `It came from ${esc(f.from||'this Mac')} with files Tuck filed in ${esc(nd.name)}. Its name alone doesn’t say why, so move it if it’s wrong.`}
/* Pin Here: Tuck keeps it where it is; re-sorts never move it (localStorage 'tuckPins', ids of folders and files) */
const pins=()=>{try{return new Set(JSON.parse(localStorage.getItem('tuckPins')||'[]'))}catch(e){return new Set()}};
/* Keep As Is replaced Pin Here and Keep as My Folder: Plan.setKeep writes both the plan's keep and 'tuckPins' */
const plainWhy=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent};
/* "Always put files like these here?" after a move (real app: Always / Not Now) */
function alwaysAsk(h,files,to){const v=V();const f=v.file(files[0]),t=v.node(to);if(!f||!t)return;const word=Plan.kind(f.name).label.toLowerCase();
 (H(h).always||((q,yes)=>toast(h,q,null)))(`Always put ${word==="photo"?"photos":"files"} like this in ${t.name}?`,()=>{Plan.addRule(`Files like ${f.name} → ${v.path(to).join(' › ')}`);toast(h,`New rule: files like these go to ${t.name}. Stop it in Rules.`)})}

/* ---------- folder picker */
let pickEl=null;
let lastRefresh=()=>{};
function killMenus(){document.querySelectorAll('.fp-menu').forEach(m=>m.remove());document.querySelectorAll('[data-fpopen]').forEach(b=>{b.removeAttribute('data-fpopen');b.setAttribute('aria-expanded','false')})}
function close(){if(pickEl){pickEl.remove();pickEl.done&&pickEl.done(undefined);pickEl=null}killMenus()}
function pick(anchor,o={}){close();return new Promise(res=>{const v=V();const ex=new Set(o.exclude||[]);
 const bad=id=>{if(ex.has(id))return true;return v.pathIds(id).some(a=>ex.has(a))};
 const rows=[];const walk=(id,d)=>{const n=v.node(id);if(!n||n.special||n.sug||n.hidden)return;if(!bad(id))rows.push([id,d]);v.kids(id).forEach(k=>walk(k,d+1))};v.roots().forEach(r=>walk(r,0));
 const p=document.createElement('div');p.className='fp-pick';p.setAttribute('role','dialog');p.setAttribute('aria-label',o.title||'Pick a folder');
 const item=([id,d])=>{const t=tileOf(v,id);return `<button data-pk="${id}" style="padding-left:${8+d*16}px"><i class="ph-fill ph-${d?t.ic:t.ic}" style="color:var(${t.hue})"></i><span>${esc(v.node(id).name)}</span></button>`};
 const draw=q=>{const L=q?rows.filter(([id])=>v.node(id).name.toLowerCase().includes(q.toLowerCase())):rows;
  p.querySelector('.list').innerHTML=(o.top&&!q?`<button data-pk=""><i class="ph ph-arrow-line-up"></i><span>Top Level</span></button><hr>`:'')+L.map(item).join('')+(o.newFolder?`<hr><button data-pknew><i class="ph ph-folder-plus"></i><span>${q?`New Folder “${esc(q)}”`:'New Folder…'}</span></button>`:'')};
 p.innerHTML=`<header><b>${esc(o.title||'Pick a folder')}</b><input class="field" placeholder="Find a folder" aria-label="Find a folder"></header><div class="list" role="listbox"></div>`;
 document.body.appendChild(p);draw('');pickEl=p;p.done=res;
 const r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():{left:innerWidth/2-140,bottom:innerHeight/2-160,top:innerHeight/2-160};
 const ph=p.offsetHeight;let x=Math.min(r.left,innerWidth-292),y=r.bottom+6;if(y+ph>innerHeight-12)y=Math.max(12,r.top-ph-6);p.style.left=Math.max(12,x)+'px';p.style.top=y+'px';
 const inp=p.querySelector('input');inp.focus();inp.oninput=()=>draw(inp.value.trim());
 const finish=val=>{p.done=null;p.remove();pickEl=null;res(val)};
 p.onclick=e=>{const b=e.target.closest('[data-pk]');if(b)return finish(b.dataset.pk||null);
  if(e.target.closest('[data-pknew]')){const name=inp.value.trim()||'untitled folder';pick2(name)}};
 const pick2=name=>{p.innerHTML=`<header><b>Where should “${esc(name)}” go?</b></header><div class="list"></div>`;const L=p.querySelector('.list');
  L.innerHTML=`<button data-pin=""><i class="ph ph-arrow-line-up"></i><span>Top Level</span></button><hr>`+rows.map(([id,d])=>item([id,d]).replace('data-pk','data-pin')).join('');
  p.onclick=e=>{const b=e.target.closest('[data-pin]');if(!b)return;const op=Plan.change({ty:'newFolder',parent:b.dataset.pin||null,name});finish(op.node)}};
 p.onkeydown=e=>{e.stopPropagation();const bs=[...p.querySelectorAll('.list button')];let k=bs.findIndex(b=>b.classList.contains('kb'));
  if(e.key==='Escape'){finish(undefined);anchor&&anchor.focus&&anchor.focus()}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();bs.forEach(b=>b.classList.remove('kb'));k=(k+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;bs[k].classList.add('kb');bs[k].scrollIntoView({block:'nearest'})}
  if(e.key==='Enter'){e.preventDefault();(bs[k]||bs.find(b=>b.dataset.pk!==''))?.click()}}})}
document.addEventListener('pointerdown',e=>{if(pickEl&&!e.target.closest('.fp-pick'))close();if(!e.target.closest('.fp-menu')&&!e.target.closest('[data-fpopen]'))killMenus()},true);
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.fp-menu')){const o=document.querySelector('[data-fpopen]');killMenus();o&&o.focus()}});

/* ---------- right-click menu (every action), and the panel's pop-up menus (a few of them, under their button) */
function menu(x,y,sel,h){return menuOf(x,y,actions(sel,h))}
function menuOf(x,y,acts,opener){close();acts=acts.filter((a,i,L)=>a!=='-'||(i>0&&L[i-1]!=='-'));if(!acts.filter(a=>a!=='-').length)return null;const m=document.createElement('div');m.className='menu fp-menu';m.setAttribute('role','menu');
 const two=!!opener;
 const chk=acts.some(a=>a!=='-'&&a.check!=null);m.classList.toggle('chk',chk);
 /* a check item shows ✓ when on; an unavailable item says why on a second line; pop-up menus give each item one short line */
 const said=new Set();/* one reason is enough: when several items are unavailable for the same reason, only the first says it */
 m.innerHTML=acts.map((a,i)=>{if(a==='-')return '<hr>';const sub=a.dis?(said.has(a.line)?'':(said.add(a.line),a.line)):two?a.sub:'';const isC=a.check!=null;
  return `<button role="${isC?'menuitemcheckbox':'menuitem'}"${isC?` aria-checked="${!!a.check}"`:''} data-i="${i}" data-key="${a.key}" class="${a.dis?'dis':''}${sub?' two':''}${a.danger?' danger':''}" title="${esc(a.line)}"${a.dis?' aria-disabled="true"':''}>${chk?`<i class="ph ph-check fp-ck${a.check?' on':''}" aria-hidden="true"></i>`:''}${isC?'':`<i class="ph ph-${a.ic}"></i>`}${sub?`<span>${esc(a.label)}<small>${esc(sub)}</small></span>`:`<span>${esc(a.label)}</span>`}${a.kb?`<span class="k">${a.kb}</span>`:''}</button>`}).join('').replace(/^(<hr>)+|(<hr>)+$/g,'');
 document.body.appendChild(m);const mw=m.offsetWidth,mh=m.offsetHeight;
 if(opener){const r=opener.getBoundingClientRect();x=r.right-mw>8&&r.left+mw>innerWidth-8?r.right-mw:r.left;y=r.bottom+4;if(y+mh>innerHeight-8)y=Math.max(8,r.top-mh-4);opener.setAttribute('aria-expanded','true');opener.setAttribute('data-fpopen','')}
 m.style.left=Math.max(8,Math.min(x,innerWidth-mw-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-mh-8))+'px';
 const at=opener||{getBoundingClientRect:()=>({left:x,top:y,bottom:y,right:x})};
 m.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const a=acts[+b.dataset.i];killMenus();a.run(at)};
 m.onkeydown=e=>{const bs=[...m.querySelectorAll('button:not(.dis)')],k=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();bs[(k+1)%bs.length].focus()}if(e.key==='ArrowUp'){e.preventDefault();bs[(k-1+bs.length)%bs.length].focus()}if(e.key==='Escape'){e.stopPropagation();killMenus();opener&&opener.focus()}};
 const f=m.querySelector('button:not(.dis)');f&&f.focus();return m}

/* ---------- the panel */
function fileRow(v,f,on){const lk=v.level(f.id).level==='private';
 return `<li draggable="true" data-fpfile="${f.id}" class="${on?'on':''}" tabindex="0">${thumb(f,'sm')}<span class="n"><b title="${esc(f.name)}">${esc(mid(f.name))}</b><small class="${lk?'lk':''}">${lk?'Private: never sent to AI':`${Plan.kind(f.name).label} · ${fmtKB(f.size)} · ${Plan.ago(f.age)}`}</small></span></li>`}
function levelBlock(v,id,isFile,extra){const L=v.level(id),n=isFile?v.file(id):v.node(id);const parentName=isFile?v.node(n.node).name:(v.node(n.parent)||{}).name;
 return `<div class="fp-sec"><div class="fp-sh">What Tuck may do here</div><div class="fp-seg" role="radiogroup" aria-label="What Tuck may read">${['read','names','private'].map(k=>`<button role="radio" aria-checked="${L.level===k}" class="${L.level===k?'on':''}" data-lv="${k}">${k==='private'?'<i class="ph-fill ph-lock-simple"></i>':''}${Plan.LEVELS[k].label}</button>`).join('')}</div>
  <p class="fp-eff">${esc(Plan.LEVELS[L.level].line)}${L.own&&parentName?` <a data-lv="inherit">Use ${esc(parentName)}’s setting</a>`:L.from&&L.from!=='default'&&!L.own?` Set by ${esc(L.from)}.`:''}</p>${extra||''}</div>`}
/* a plain switch, worded in the person's terms */
const swRow=(key,label,on,line,dis)=>`<label class="fp-swr${dis?' dis':''}"><span><b>${esc(label)}</b><small>${esc(line)}</small></span><button class="sw${on?' on':''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-fpsw="${key}"${dis?' aria-disabled="true" tabindex="-1"':''}></button></label>`;
function stepHtml(v,id){if(!step||step.id!==id||step.k!=='split')return '';const n=v.node(id);
 const on=step.parts.filter(p=>p.on);const n2=on.reduce((a,p)=>a+p.files.length,0);
 return `<div class="fp-step"><p>Tuck’s draft for <b>${esc(n.name)}</b>, from file names. Rename or untick a part.</p>${step.parts.map((p,i)=>`<label><input type="checkbox" data-fpsp="${i}" ${p.on?'checked':''}><input class="field" data-fpspn="${i}" value="${esc(p.name)}" aria-label="Folder name"><small>${p.files.length}</small></label>`).join('')}
  <p>${on.length?`${pl(n2,'file')} move into ${pl(on.length,'new folder')} inside ${esc(n.name)}; ${pl(v.files(id).length-n2,'file')} stay.`:'Tick at least one part.'}</p><div class="row"><button class="btn sm pri" data-fpstep="split" ${on.length?'':'disabled'}>Split Into ${pl(on.length,'Folder')}</button><button class="btn sm ghost" data-fpstep="x">Cancel</button></div></div>`}
const CARET='<i class="ph ph-caret-down pcaret" aria-hidden="true"></i>';
/* the top corner: More (rare things) and the host's Hide the side panel */
function toolsHtml(h,more){return (more||H(h).hide)?`<div class="fp-tools">${more?`<button class="ib" data-fpmoreacts aria-haspopup="menu" aria-expanded="false" aria-label="More actions" title="More">${'<i class="ph ph-dots-three-circle"></i>'+CARET}</button>`:''}${H(h).hide?`<button class="ib fp-hide" data-fphide aria-label="Hide the side panel" title="Hide the side panel"><i class="ph ph-sidebar-simple"></i></button>`:''}</div>`:''}
const MORE_KEYS=['hide','show','deleteEmpty'];
function html(sel,h){const v=V();
 if(!sel)return `<div class="fp">${toolsHtml(h)}<div class="fp-empty"><i class="ph ph-cursor-click"></i><b>Pick a folder or a file</b><span>Its details and what you can do with it show here.</span></div></div>`;
 const acts=actions(sel,h);
 /* the one composer (composer.js) when the page has it; the plain field is only a fallback */
 const cmp=window.Composer?`<div class="fp-cmp" data-composer-slot="${sel.type}" data-fpcmp></div>`:`<div class="fp-cmp" data-composer-slot="${sel.type}">${said?`<p class="fp-said">${said}</p>`:''}<form data-fpcmp><input name="q" placeholder="Tell Tuck what you want…" aria-label="Tell Tuck what you want" autocomplete="off"><button class="send" aria-label="Send"><i class="ph ph-arrow-up"></i></button></form></div>`;
 if(sel.type==='multi'){const nN=sel.items.filter(x=>x.type==='node').length,nF=sel.items.length-nN;
  /* several at once: the row of actions, More ⌄ for the rest */
  const qk=acts.map((a,i)=>[a,i]).filter(([a])=>a!=='-').slice(0,3);const rest=acts.filter(a=>a!=='-').length>qk.length;
  const actHtml=`<div class="fp-quick" role="toolbar" aria-label="Actions" style="--n:${qk.length+(rest?1:0)}">${qk.map(([a,i])=>`<button class="fp-q${a.dis?' dis':''}${a.danger?' danger':''}" data-fpa="${i}" data-label="${esc(a.label)}" aria-label="${esc(a.label)}" title="${esc(a.line)}"><i class="ph ph-${a.ic}"></i><span>${esc(a.short||a.label)}</span></button>`).join('')}${rest?`<button class="fp-q" data-fpmoreacts aria-haspopup="menu" aria-expanded="false" aria-label="More actions" title="Every action for these, the same as the right-click menu"><i class="ph ph-dots-three-circle"></i><span>More${CARET}</span></button>`:''}</div>`;
  return `<div class="fp"><div class="fp-hd${H(h).hide?' fp-tl':''}"><span class="fp-tile" style="background:var(--ac)"><i class="ph-fill ph-stack"></i></span><div class="t"><h3>${[nN&&pl(nN,'folder'),nF&&pl(nF,'file')].filter(Boolean).join(' and ')} selected</h3><div class="fp-path">⌘-click or ⇧-click to add more</div></div></div>${toolsHtml(h)}${actHtml}${cmp}</div>`}
 if(sel.type==='file'){const f=v.file(sel.id);if(!f)return html(null,h);const a=v.area(f.node);const L=v.level(f.id);const bg=scene(f);const k=Plan.kind(f.name);
  const why=fileWhy(v,f);const pinned=Plan.isKept?Plan.isKept(f.id):pins().has(f.id);const A=key=>acts.find(x=>x&&x.key===key)||{};
  return `<div class="fp"><div class="fp-pv"><div class="fp-sheet${bg?' img':''}"${bg?` style="background:${bg};background-size:cover"`:''}>${bg?'':`<b>${esc(f.name.replace(/\.[^.]+$/,''))}</b>${'<i></i>'.repeat(9)}`}${L.level==='private'?'<span class="pl"><i class="ph-fill ph-lock-simple"></i>Private: never sent to AI</span>':''}</div></div>${toolsHtml(h)}
   <div class="fp-hd" style="--h:var(${a.hue})"><div class="t"><h3 title="${esc(f.name)}">${esc(f.name)}</h3><div class="fp-path">${k.label} · ${fmtKB(f.size)} · added ${Plan.ago(f.age)}</div></div></div>
   <div class="fp-btns" role="toolbar" aria-label="Actions"><button class="btn sm" data-fpk="open" data-label="Open" title="${esc(A('open').line)}"><i class="ph ph-arrow-square-out"></i>Open</button><button class="btn sm" data-fpk="quicklook" data-label="Quick Look" title="${esc(A('quicklook').line)}"><i class="ph ph-eye"></i>Quick Look</button></div>
   <div class="fp-sec"><div class="fp-sh">Why it’s here</div><p class="fp-why"><i class="ph ph-lightbulb"></i><span>${why}</span></p></div>
   <div class="fp-sec"><dl class="fp-kv"><dt>In Tuck</dt><dd><button class="popchip" data-fppop="shows" aria-haspopup="menu" aria-expanded="false" aria-label="Tuck shows it in ${esc(placeCrumb(v,f))}: move it or re-sort it" title="Move it, or let Tuck re-sort it"><span class="pth">${esc(placeCrumb(v,f))}</span>${CARET}</button></dd>
    <dt>On disk</dt><dd><button class="fp-reveal" data-fpk="reveal" title="Show in Finder"><i class="ph ph-magnifying-glass"></i><span>${esc(f.where||f.from)} › ${esc(f.name)}</span></button></dd></dl></div>
   ${levelBlock(v,f.id,true,`<div class="fp-sws">${swRow('keep','Keep As Is',pinned,pinned?'Tuck won’t move it.':'Tuck may move it to a better folder.')}</div>`)}${cmp}</div>`}
 const id=sel.id,n=v.node(id);if(!n)return html(null,h);const t=tileOf(v,id),a=v.area(id),L=v.level(id);const before=Plan.before();const bn=before.node(id);
 const tags=[];if(n.sug)tags.push('<span class="tag sug"><i class="ph ph-sparkle"></i>suggested</span>');else if(!bn||(bn&&bn.sug))tags.push('<span class="tag new">new</span>');
 if(bn&&bn.name!==n.name)tags.push('<span class="tag ren">renamed</span>');if(bn&&bn.parent!==n.parent)tags.push('<span class="tag mov">moved</span>');if(n.hidden)tags.push('<span class="tag rem"><i class="ph ph-eye-slash"></i>hidden</span>');
 if(L.level==='private')tags.push('<span class="tag lock"><i class="ph-fill ph-lock-simple"></i>private</span>');if(Plan.isKept&&Plan.isKept(id))tags.push('<span class="tag"><i class="ph-fill ph-push-pin"></i>Keep As Is</span>');else if(n.own)tags.push('<span class="tag">yours</span>');
 /* a folder with no files of its own opens with Include Subfolders on, so its header and its Files list agree */
 const deepOn=open.deep==null?(!v.files(id).length&&v.kids(id).length>0):open.deep;open.deepNow=deepOn;
 const deep=deepOn&&v.kids(id).length,fs=v.files(id,deep);const fresh=fs.filter(f=>f.age<=60),older=fs.filter(f=>f.age>60);const show=open.more?fresh:fresh.slice(0,4);const hidden=fresh.length-show.length;
 /* one confidence word and number for a folder, from plan.js (rule 24): the same as its Needs You card */
 const cf=Plan.conf?Plan.conf(id):null,sureK=cf?cf.key:n.sure,sureW=cf?cf.word:({sure:'Sure',leaning:'Leaning',unsure:'Not sure'}[n.sure]||'Sure'),sureP=cf?cf.pct:({sure:92,leaning:80,unsure:60}[n.sure]||80);const la=v.lastAdded(id);
 const all=v.files(id,true),eg=[...new Set(all.map(f=>f.name.replace(/\.[^.]+$/,'')))].slice(0,3);
 const whyLine=n.why||(eg.length?`${pl(v.total(id),'file')}, like ${eg.length>1?eg.slice(0,-1).join(', ')+' and '+eg.at(-1):eg[0]}`:'No files yet');
 const more=!n.special&&acts.some(x=>x&&MORE_KEYS.includes(x.key));
 /* the name renames in place; the path is where it lives (Move To, Merge Into) */
 const nameHtml=n.special?`<h3 title="${esc(n.name)}">${esc(n.name)}</h3>`:step&&step.k==='rename'&&step.id===id?`<input class="fp-nmin" id="fprn" value="${esc(n.name)}" aria-label="Folder name" autocomplete="off" spellcheck="false"><div class="fp-nmhint">Return to rename · Esc to cancel</div>`
  :`<div class="fp-name"><h3 title="${esc(n.name)}"><button class="fp-nm" data-fprn title="Rename ${esc(n.name)}">${esc(n.name)}</button></h3><button class="fp-pen" data-fprn aria-label="Rename ${esc(n.name)}" title="Rename"><i class="ph ph-pencil-simple"></i></button></div>`;
 const where=v.depth(id)===0?'Top level':crumb(v,id);
 const pathHtml=n.special?`<div class="fp-path">${esc(crumb(v,id))}</div>`:`<button class="popchip" data-fppop="path" aria-haspopup="menu" aria-expanded="false" aria-label="Where ${esc(n.name)} is: ${esc(where)}. Move or merge it" title="Move ${esc(n.name)}, or merge it into another folder"><i class="ph ph-folder-simple"></i><span class="pth">${esc(where)}</span>${CARET}</button>`;
 const kids=v.kids(id).length,kept=Plan.isKept?Plan.isKept(id):false;
 const sws=n.special||n.sug?'':`<div class="fp-sws">${swRow('keep','Keep As Is',kept,kept?'Tuck won’t rename, move or reshape it.':n.own?'You made it. Tuck’s plans leave it alone.':'Tuck may rename, move or reshape it.')}</div>`;
 const arrange=n.special?`<button class="btn sm" data-fpk="resort" title="${esc((acts.find(x=>x&&x.key==='resort')||{}).line||'')}"><i class="ph ph-arrows-clockwise"></i>Re-sort…</button>`
  :`<button class="popchip" data-fppop="arrange" aria-haspopup="menu" aria-expanded="false" title="Arrange, split or re-sort ${esc(n.name)}"><i class="ph ph-sort-ascending"></i>Arrange${CARET}</button>`;
 return `<div class="fp"><div class="fp-hd fp-tl" style="--h:var(${t.hue})"><span class="fp-tile${n.sug?' sug':''}"><i class="ph-fill ph-${t.ic}"></i></span><div class="t">${nameHtml}${pathHtml}${tags.length?`<div class="fp-chips">${tags.join('')}</div>`:''}</div></div>${toolsHtml(h,more)}
  ${n.sug?`<div class="fp-sugbar" role="group" aria-label="Suggested folder"><i class="ph ph-sparkle"></i><span>Tuck suggests this folder</span><div class="row"><button class="btn sm pri" data-fpk="accept" data-label="Add Folder"><i class="ph ph-check"></i>Add Folder</button><button class="btn sm ghost" data-fpk="reject" data-label="Not Now">Not Now</button></div></div>`:''}
  <div class="fp-stats"><span><b>${v.total(id)}</b>files</span><span><b class="plus">${kids}${n.special||n.sug?'':`<button class="fp-plus" data-fpk="newInside" aria-label="New Folder Inside ${esc(n.name)}" title="New Folder Inside ${esc(n.name)} (⇧⌘N)"><i class="ph ph-plus"></i></button>`}</b>${kids===1?'subfolder':'subfolders'}</span><span><b>${fmtKB(v.size(id))}</b>size</span>${la==null?'':`<span><b>${Plan.ago(la)}</b>last added</span>`}</div>
  ${n.special?'':levelBlock(v,id,false,sws)}
  <div class="fp-sec"><div class="fp-sh">Why it’s here<span class="sp"></span>${n.special?'':`<span class="fp-sure ${sureK}">${sureW}<i><b style="width:${sureP}%"></b></i></span>`}</div>
   <p class="fp-why"><i class="ph ph-lightbulb"></i><span>${esc(whyLine)}.</span></p>${v.mostly(id)?`<p class="fp-why dim"><i class="ph ph-hard-drives"></i><span>${esc(v.mostly(id))}.</span></p>`:''}</div>
  <div class="fp-sec"><div class="fp-sh">Files<small>${pl(fs.length,'file')}</small><span class="sp"></span>${arrange}</div>
   ${kids?`<label class="fp-deep"><button class="sw${deepOn?' on':''}" role="switch" aria-checked="${!!deepOn}" data-fpdeep aria-label="Include Subfolders"></button>Include subfolders</label>`:''}
   <div class="fp-qstep">${stepHtml(v,id)}</div>
   <ul class="fp-files">${show.map(f=>fileRow(v,f)).join('')||'<li class="none" style="cursor:default;color:var(--ink3)">No files directly in here.</li>'}</ul>
   ${hidden>0?`<button class="fp-older" data-fpmore>Show ${hidden} more</button>`:''}
   ${older.length?`<button class="fp-older" data-fpolder aria-expanded="${open.older}"><i class="ph ph-caret-${open.older?'down':'right'}"></i>Older (${older.length})</button>${open.older?`<ul class="fp-files">${older.map(f=>fileRow(v,f)).join('')}</ul>`:''}`:''}</div>
  ${cmp}</div>`}

/* the composer slot's default reply: a few plain commands, each one pending change (the shared composer replaces this) */
function tell(text,sel,h){const v=V();const t=text.trim();let m;const find=q=>{q=q.trim().replace(/^the\s+/i,'').replace(/\s+folder$/i,'').toLowerCase();return v.all().find(id=>v.node(id).name.toLowerCase()===q)};
 const here=sel&&sel.type==='node'?sel.id:null;const ref=s=>/^(this|it|here)$/i.test(s.trim())?here:find(s);
 if(sel&&sel.type==='file'){const f=v.file(sel.id);if(!f)return 'Pick a file first.';
  if(/^(why|how come)/i.test(t)){const nd=v.node(f.node);return v.level(f.id).level==='private'?`It’s in <b>${esc(nd.name)}</b> by its name and kind, like the files next to it.`:`It’s in <b>${esc(nd.name)}</b> because ${esc((nd.why||'its files are alike').replace(/^./,c=>c.toLowerCase()))}.`}
  if(/^(keep|make)\s+(it|this)\s+private$/i.test(t)){Plan.setLevel(f.id,'private');return `Okay: <b>${esc(f.name)}</b> is private now. Never sent to AI.`}
  if(m=t.match(/^(?:move|put)\s+(?:it|this)\s+(?:in|into|to)\s+(.+)$/i)){const b=find(m[1]);if(!b)return `I couldn’t find “${esc(m[1])}”.`;Plan.change({ty:'moveFiles',files:[f.id],to:b});return `Okay: <b>${esc(f.name)}</b> goes to <b>${esc(v.node(b).name)}</b>.`}
  return 'Try “why is this here?”, “move it to Taxes 2025” or “keep it private”.'}
 if(m=t.match(/^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i)){const id=ref(m[1]);if(!id)return `I couldn’t find “${esc(m[1])}”.`;Plan.change({ty:'rename',node:id,name:m[2].trim()});return `Okay: <b>${esc(v.node(id).name)}</b> becomes <b>${esc(m[2].trim())}</b> when you apply.`}
 if(m=t.match(/^(?:call it|name it)\s+(.+)$/i)){if(!here)return 'Pick a folder first.';Plan.change({ty:'rename',node:here,name:m[1].trim()});return `Okay: renamed to <b>${esc(m[1].trim())}</b> when you apply.`}
 if(m=t.match(/^merge\s+(.+?)\s+(?:into|with)\s+(.+)$/i)){const a=ref(m[1]),b=ref(m[2]);if(!a||!b||a===b)return 'I couldn’t find both folders.';Plan.change({ty:'merge',nodes:[a],into:b});return `Okay: <b>${esc(v.node(a).name)}</b> goes into <b>${esc(v.node(b).name)}</b> when you apply.`}
 if(m=t.match(/^(?:move|put)\s+(.+?)\s+(?:in|into|inside|under)\s+(.+)$/i)){const a=ref(m[1]),b=ref(m[2]);if(!a||!b||a===b)return 'I couldn’t find both folders.';Plan.change({ty:'putInside',nodes:[a],parent:b});return `Okay: <b>${esc(v.node(a).name)}</b> goes inside <b>${esc(v.node(b).name)}</b>.`}
 if(m=t.match(/^(?:make|add|create|new)\s+(?:a\s+)?(?:folder\s+)?(?:called\s+)?["“]?(.+?)["”]?(?:\s+folder)?(?:\s+(?:in|inside|under)\s+(.+))?$/i)){const p=m[2]?ref(m[2]):here;if(m[2]&&!p)return `I couldn’t find “${esc(m[2])}”.`;Plan.change({ty:'newFolder',parent:p||null,name:m[1].trim()});return `Okay: a new <b>${esc(m[1].trim())}</b> folder${p?` inside ${esc(v.node(p).name)}`:''}.`}
 if(m=t.match(/^hide\s+(.+)$/i)){const a=ref(m[1]);if(!a)return `I couldn’t find “${esc(m[1])}”.`;Plan.change({ty:'hide',nodes:[a]});return `Okay: <b>${esc(v.node(a).name)}</b> is hidden when you apply.`}
 if(/^(?:split|sort|arrange|organi[sz]e)\b/i.test(t)&&here){const way=/year/i.test(t)?'year':/kind|type/i.test(t)?'kind':'thing';Resort.arrange({nodeId:here,way});return 'Here’s how I’d arrange it. Have a look first.'}
 if(/^(why|how come)/i.test(t)&&here)return `Because ${esc((v.node(here).why||'its files are alike').replace(/^./,c=>c.toLowerCase()))}. ${esc(v.mostly(here))}.`;
 return 'Try “rename this to Lab Reports”, “merge Jobs into Job Search”, “make Archive in Resumes” or “arrange this by year”.'}

/* One composer per panel host, kept across redraws (the panel redraws on every plan change), so its Tuck and
   its answer bubble stay put. Its reply is the slot's text commands; a change it makes can be undone from the bubble. */
const plain=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent.replace(/\s+/g,' ').trim()};
function chipsFor(sel){const v=V();
 if(sel.type==='node'){const n=v.node(sel.id);if(!n||n.special)return ['Why is this here?'];return v.files(sel.id).length>=4?['Arrange this by year','Why is this here?']:['Why is this here?']}
 if(sel.type==='file')return ['Why is this here?','Keep it private'];return []}
function mountComposer(el,slot,sel,h){const c=el._fpc||(el._fpc=(()=>{const hold=document.createElement('div');
  const comp=Composer.mount(hold,{placeholder:'Tell Tuck what you want…',label:'Tell Tuck what you want',onSend:async text=>{const {sel,h}=el._fpcAt;
   const p0=Plan.pending().map(o=>o.id),h0=(Plan.history()[0]||{}).id;const html=(h.tell||tell)(text,sel,h);
   const added=Plan.pending().filter(o=>!p0.includes(o.id)).map(o=>o.id),row=Plan.history()[0];
   const undo=added.length?()=>{added.forEach(id=>Plan.revert(id))}:row&&row.id!==h0?()=>{Plan.undoApply(row.id)}:undefined;
   if(!added.length&&!undo)setTimeout(()=>h.refresh&&h.refresh(),0);return {reply:plain(html),undo}}});
  return {hold,comp,key:''}})());
 el._fpcAt={sel,h};const key=JSON.stringify(sel);if(c.key!==key){c.key=key;c.comp.setChips(chipsFor(sel))}
 const had=document.activeElement===c.comp.input;slot.appendChild(c.hold);if(had)c.comp.input.focus({preventScroll:true})}

/* Re-sort, Arrange and Suggest as a page in the panel's column: Back (onClose) redraws the panel. resort.js draws its compact
   page into the body when it supports inline; when it still opens a sheet, the panel stays as it was. */
function page(el,h,fn,o,title){
 const back=()=>{el._fpPage=null;h.refresh()};
 el.innerHTML=`<div class="fp fp-page" role="region" aria-label="${esc(title||'Re-sort with Tuck')}"><div class="fp-pagebar"><button class="btn sm ghost" data-fpback aria-label="Back to the panel"><i class="ph ph-caret-left"></i>Back</button><span>${esc(title||'')}</span></div><div class="fp-pagebody"></div></div>`;
 const body=el.querySelector('.fp-pagebody');el._fpPage={key:lastSel};el.scrollTop=0;
 el.onclick=e=>{if(e.target.closest('[data-fpback]'))back()};el.onkeydown=e=>{e.stopPropagation()};el.oninput=el.onchange=el.oncontextmenu=null;
 try{Resort[fn](Object.assign({},o,{inline:body,onClose:back}))}catch(err){back();throw err}
 if(!body.firstElementChild){back();return}
 /* resort.js's own page has a Back button: use it, not a second one */
 if([...body.querySelectorAll('button')].some(b=>/^\s*back\b/i.test(b.textContent)||/^back\b/i.test(b.getAttribute('aria-label')||''))){const bar=el.querySelector('.fp-pagebar');bar&&bar.remove()}}

function render(el,sel,h){h=Object.assign({},h);const key=JSON.stringify(sel);
 /* a Re-sort page is open in this column: plan changes don't redraw over it; picking something else closes it */
 if(el._fpPage){if(el._fpPage.key===key&&el.querySelector('.fp-page'))return;el._fpPage=null}
 if(key!==lastSel){step=null;said=null;open={older:false,deep:null,more:false};lastSel=key}
 h.refresh=()=>render(el,sel,h);lastRefresh=h.refresh;h.page=(fn,o,title)=>page(el,h,fn,o,title);el.innerHTML=html(sel,h);const acts=actions(sel,h);
 const byKey=k=>acts.find(a=>a&&a.key===k);
 const pop=(btn,keys)=>{if(btn.hasAttribute('data-fpopen')){killMenus();return}const L=[];keys.forEach(k=>{if(k==='-'){L.push('-');return}const a=byKey(k);if(a)L.push(a)});menuOf(0,0,L,btn)};
 el.onpointerover=el.onfocusin=null;
 el.onclick=e=>{const T=e.target;
  if(T.closest('[data-fphide]')){h.hide&&h.hide();return}
  const a=T.closest('[data-fpa]');if(a){const x=acts[+a.dataset.fpa];if(x&&!x.dis)x.run(a);return}
  const k=T.closest('[data-fpk]');if(k){const x=byKey(k.dataset.fpk);if(x&&!x.dis)x.run(k);return}
  const mo=T.closest('[data-fpmoreacts]');if(mo){if(sel.type==='node')pop(mo,['show','hide','-','deleteEmpty']);else pop(mo,acts.map(x=>x==='-'?'-':x.key).filter((x,i,L)=>x==='-'||L.indexOf(x)===i));return}
  const pp=T.closest('[data-fppop]');if(pp){const w=pp.dataset.fppop,v=V();
   if(w==='path'){if(pp.hasAttribute('data-fpopen')){killMenus();return}const L=[byKey('putInside'),byKey('merge')].filter(Boolean);
    /* Move to the Top Level, when it isn't there already */
    if(v.depth(sel.id)>0)L.push('-',{key:'toTop',ic:'arrow-line-up',label:'Move to the Top Level',line:`${v.node(sel.id).name} goes to the top level, with its files.`,run:()=>Plan.change({ty:'putInside',nodes:[sel.id],parent:null})});
    menuOf(0,0,L,pp)}
   if(w==='arrange')pop(pp,['arrange','split','resort']);
   if(w==='shows')pop(pp,['move','resort']);return}
  if(T.closest('[data-fprn]')){const c=CAN('rename',sel.id);if(!c.ok){showRefusal(c.why);return}step={k:'rename',id:sel.id};h.refresh();return}
  const sw=T.closest('[data-fpsw]');if(sw){if(sw.getAttribute('aria-disabled')==='true')return;const v=V();
   if(sw.dataset.fpsw==='keep'){const it=v.file(sel.id)||v.node(sel.id);setKeep(h,sel.id,it.name,!(Plan.isKept&&Plan.isKept(sel.id)));return}}
  const lv=T.closest('[data-lv]');if(lv){levelSet(h,sel.id,lv.dataset.lv);return}
  if(T.closest('[data-fpdeep]')){open.deep=!open.deepNow;h.refresh();return}
  if(T.closest('[data-fpolder]')){open.older=!open.older;h.refresh();return}
  if(T.closest('[data-fpmore]')){open.more=true;h.refresh();return}
  const st=T.closest('[data-fpstep]');if(st){const k=st.dataset.fpstep;
   if(k==='split'){const parts=step.parts.filter(p=>p.on).map(p=>({name:p.name,files:p.files}));if(parts.length)Plan.change({ty:'split',node:sel.id,parts})}
   step=null;h.refresh();return}
  const fr=T.closest('[data-fpfile]');if(fr&&h.select)h.select({type:'file',id:fr.dataset.fpfile})};
 el.oninput=e=>{const i=e.target.dataset.fpspn;if(i!=null&&step)step.parts[+i].name=e.target.value};
 el.onchange=e=>{const i=e.target.dataset.fpsp;if(i!=null&&step){step.parts[+i].on=e.target.checked;h.refresh()}};
 el.oncontextmenu=e=>{const fr=e.target.closest('[data-fpfile]');if(fr){e.preventDefault();menu(e.clientX,e.clientY,{type:'file',id:fr.dataset.fpfile},h)}};
 /* rename in place: Return saves (one pending change), Esc cancels, clicking away saves */
 const saveName=inp=>{if(!step||step.k!=='rename')return;const nv=inp.value.trim(),n=V().node(sel.id);step=null;if(n&&nv&&nv!==n.name)Plan.change({ty:'rename',node:sel.id,name:nv});h.refresh()};
 el.onkeydown=e=>{e.stopPropagation();if(e.target.id==='fprn'){if(e.key==='Enter'){e.preventDefault();saveName(e.target)}if(e.key==='Escape'){e.preventDefault();step=null;h.refresh();const b=el.querySelector('.fp-nm');b&&b.focus()}}
  const fr=e.target.closest('[data-fpfile]');if(fr&&e.key==='Enter'&&h.select)h.select({type:'file',id:fr.dataset.fpfile})};
 const slot=el.querySelector('div[data-fpcmp]');if(slot)mountComposer(el,slot,sel,h);
 const form=el.querySelector('form[data-fpcmp]');if(form)form.onsubmit=e=>{e.preventDefault();const q=form.q.value.trim();if(!q)return;said=(h.tell||tell)(q,sel,h);form.q.value='';setTimeout(()=>{h.refresh();const i=el.querySelector('[data-fpcmp] input');i&&i.focus()},0)};
 el.querySelectorAll('[data-fpfile]').forEach(li=>{li.ondragstart=e=>{const id=li.dataset.fpfile;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);e.dataTransfer.setData('application/x-tuck-file',id);window.TUCK_DRAG={type:'file',ids:[id]};li.classList.add('dragging')};li.ondragend=()=>{li.classList.remove('dragging');setTimeout(()=>{window.TUCK_DRAG=null},0)}});
 const ri=el.querySelector('#fprn');if(ri){ri.focus();ri.select();ri.onblur=()=>saveName(ri)}}

/* a refused change (Plan.change / Plan.applyNow broke a rule): one calm line, on every page, so no button does nothing */
let refEl=null,refT=0;
function showRefusal(why){if(!why)return;if(!refEl){refEl=document.createElement('div');refEl.className='fp-refuse';refEl.setAttribute('role','status')}
 refEl.innerHTML=`<i class="ph ph-info"></i><span>${esc(why)}</span>`;document.body.appendChild(refEl);clearTimeout(refT);refT=setTimeout(()=>{refEl&&refEl.remove()},4200)}
document.addEventListener('tuckrefused',e=>showRefusal(e.detail&&e.detail.why));
const why=id=>{const v=V(),f=v.file(id);return f?plainWhy(fileWhy(v,f)):''};
window.FolderPanel={render,menu,actions,refusal:showRefusal,pick,thumb,close,tell,alwaysAsk,why,plainWhy:why,_scene:scene,tile:(id)=>tileOf(V(),id)};
})();
