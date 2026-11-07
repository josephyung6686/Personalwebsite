/* resort.js: the one "Re-sort with Tuck" sheet and the one plan preview, openable from any page.
   Needs plan.js and folderpanel.js (thumbnails). Loads its own CSS. Wording follows the real app
   (pages/tuck/resort.js, pages/sortview.js); routes: resort.estimate, resort.start {scope, nodeId | fileIds, reach},
   resort.ask / resort.answer (thing | year | kind | own words), plan.suggest, plan.apply, plan.undo.

   API
     Resort.open({scope, nodeId, nodeIds, fileIds, reach, go, inline, onClose})   the setup, pre-filled with where it was opened.
        What to re-sort is picked directly: quick picks (Everything · Without a folder · New since last sort · This folder ·
        Selected) set the ticks of a checklist of your folders (parts of life, then their folders). The ticks are the scope.
        scope: 'pick' {nodeIds, fileIds}: each ticked folder brings its own files (and those in Tuck's suggested subfolders
          inside it, which are not folders yet); fileIds adds single files (a selection, or the new files). Exactly these are planned.
        Old scopes still work and only pre-fill the ticks: 'folder' (that folder) | 'folder_tree' (it and its folders) |
          'selection' (fileIds) | 'loose' (No folder yet) | 'everything'. go: true skips the setup (Sort Again) and plans the old scope.
        reach: 'place_only' | 'suggest_subfolders' | 'redesign'
        inline: an element to draw in instead of a sheet. A wide one (the Re-sort page) gets the setup; the plan preview is a sheet.
          A narrow one (under 480 px, a right-hand column) gets everything in it: the setup, the plan as a before → after list,
          Use and Undo. onClose: called by the column's Back.
     Resort.arrange({nodeId, way})     Arrange…: organise INSIDE one folder. Ways: Tuck’s pick (first; its own best idea), then by what
                                       they’re for, kind, week, month, drafts and finals, year. Then the plan preview, Use, Undo.
     Resort.suggest({nodeId})          an alias: Arrange with Tuck’s pick chosen (Suggest Subfolders is no longer its own item)
     Resort.split({nodeId})            Split…: separate folders next to it
     Every tool asks Plan.can first; when it may not act (Keep As Is, private, Never Look In) it says why instead of opening.
     Resort.preview({extra, title, use, onUse, back})  the shared before/after preview.
        No extra: the Workbench's pending changes (Apply). With extra (ops): a plan to Use (one History row, Undo).
     Resort.close()   Resort.isOpen()
     Resort.config({toast(msg, undo), limits() -> 'Ask About Everything' | 'Ask When Unsure' | 'Just Do It' | 'Plan Only', history(row), depth() -> 3..8})
   Your own folders, Keep as My Folder folders, pins and Never Look In folders stay as they are. Private files are left out. */
(function(){
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pl=(n,w,ws)=>`${n.toLocaleString()} ${n===1?w:(ws||w+'s')}`;
const mid=(s,n=34)=>s.length<=n?s:s.slice(0,Math.ceil(n*.55))+'…'+s.slice(-Math.floor(n*.4));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const CFG={toast:(m)=>console.log(m),limits:()=>Plan.limits(),history:()=>{},depth:()=>4};

const CSS=`
.rs-back{position:fixed;inset:0;z-index:var(--z-sheet);display:grid;place-items:center;padding:24px;background:rgba(15,20,40,.32);animation:rsf .18s var(--ease)}
@keyframes rsf{from{opacity:0}}@keyframes rsin{from{opacity:0;transform:translateY(10px) scale(.99)}}
.rs{width:min(640px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;border-radius:16px;background:var(--win);box-shadow:var(--sh-pop);animation:rsin .24s var(--ease) both;font:500 13px/1.45 var(--f);color:var(--ink);overflow:hidden}
.rs.wide{width:min(1040px,100%)}
.rs-hd{display:flex;align-items:flex-start;gap:12px;padding:20px 24px 12px}.rs-hd>div{flex:1;min-width:0}.rs-hd h2{font:650 16px/1.3 var(--f)}.rs-hd p{margin-top:4px;color:var(--ink2)}
.rs-bd{overflow:auto;padding:4px 24px 16px;display:grid;gap:16px;min-height:0}
.rs-ft{display:flex;align-items:center;gap:8px;padding:12px 24px 16px;border-top:1px solid var(--line)}.rs-ft .sp{flex:1}.rs-ft .note{font:500 12px var(--f);color:var(--ink3)}
.rs-g h3{font:600 12px var(--f);color:var(--ink2);margin-bottom:8px}
.rs-opts{display:grid;gap:4px}
.rs-opt{display:flex;align-items:flex-start;gap:12px;padding:8px 12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);cursor:pointer;transition:box-shadow .15s var(--ease),background .15s var(--ease)}
.rs-opt:hover{background:var(--soft)}.rs-opt.on{box-shadow:inset 0 0 0 1.5px var(--ac);background:var(--ac-fill)}.rs-opt.dis{opacity:.45;pointer-events:none}
.rs-opt input{margin-top:3px;accent-color:var(--ac)}.rs-opt b{display:block;font:600 13px var(--f)}.rs-opt small{display:block;font:500 12px var(--f);color:var(--ink2)}.rs-opt .ct{margin-left:auto;font:500 12px var(--f);color:var(--ink3);white-space:nowrap}
.rs-row3{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.rs-row3 .rs-opt{flex-direction:column;gap:2px}.rs-row3 .rs-opt input{position:absolute;opacity:0}
.rs-keep{display:flex;gap:8px;align-items:flex-start;margin-top:8px;font:500 12px var(--f);color:var(--ink2)}.rs-keep .ph{color:var(--ac);margin-top:2px}
.rs-more summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;font:600 12px var(--f);color:var(--ac-ink)}.rs-more summary::-webkit-details-marker{display:none}
.rs-more[open] summary .ph{transform:rotate(90deg)}.rs-more summary .ph{transition:transform .15s var(--ease)}
.rs-more .in{display:grid;gap:8px;margin-top:8px}
.rs-chips{display:flex;flex-wrap:wrap;gap:4px}.rs-chips button{height:28px;padding:0 10px;border-radius:8px;background:var(--soft);font:600 12px var(--f);color:var(--ink2)}.rs-chips button.on{background:var(--ac-fill);color:var(--ac-ink);box-shadow:inset 0 0 0 1.5px var(--ac)}
.rs-cover{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:var(--soft)}.rs-cover .ph{font-size:20px;color:var(--ac-ink)}.rs-cover b{display:block;font:600 13px var(--f)}.rs-cover small{display:block;font:500 12px var(--f);color:var(--ink2)}
.rs-work{display:grid;gap:12px;justify-items:center;text-align:center;padding:40px 24px}.rs-work b{font:600 13px var(--f)}.rs-work small{color:var(--ink2)}
.rs-bar{width:240px;height:6px;border-radius:3px;background:var(--soft2);overflow:hidden}.rs-bar i{display:block;height:100%;width:100%;transform:scaleX(0);transform-origin:left;background:var(--ac);border-radius:3px;transition:transform 1.1s linear}
.rs-q{display:grid;gap:8px;padding:12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line)}.rs-q>b{font:600 13px var(--f)}.rs-q>small{color:var(--ink2);font-size:12px}
.rs-ways{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.rs-way{display:grid;gap:4px;align-content:start;padding:8px 10px;border-radius:10px;background:var(--soft);text-align:left;box-shadow:inset 0 0 0 1px transparent;min-width:0}.rs-way.on{box-shadow:inset 0 0 0 1.5px var(--ac);background:var(--ac-fill)}
.rs-way b{font:600 12px var(--f)}.rs-way ul{list-style:none;padding:0;margin:0;display:grid;gap:1px}.rs-way li{display:flex;gap:6px;align-items:center;font:500 12px var(--f);color:var(--ink2);white-space:nowrap;overflow:hidden}.rs-way li span{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}.rs-way li em{font-style:normal;color:var(--ink3)}
.rs-way .ph-fill{font-size:12px;color:var(--k-folder);flex:none}
/* the plan preview (sortview) */
.pv-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 16px;border-radius:12px;background:var(--soft);font:500 12px var(--f);color:var(--ink2)}.pv-strip b{color:var(--ink);font-weight:600}.pv-strip .ph{color:var(--ink3)}.pv-strip>span{display:inline-flex;gap:6px;align-items:center}
.pv-strip .safe{margin-left:auto;color:var(--ink2)}.pv-strip .safe .ph{color:var(--ink3)}
.pv-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.05fr);gap:12px;min-height:0}
.pv-side{min-width:0;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line);padding:8px;max-height:min(52vh,460px);overflow:auto}
.pv-side h3{position:sticky;top:-8px;z-index:1;margin:-8px -8px 4px;padding:10px 12px 8px;background:var(--win);font:600 12px var(--f);color:var(--ink2);display:flex;gap:8px;border-radius:12px 12px 0 0}.pv-side h3 small{margin-left:auto;font:500 12px var(--f);color:var(--ink3)}
.pv-n{display:flex;align-items:center;gap:6px;width:100%;height:28px;padding:0 8px 0 calc(8px + var(--d)*14px);border-radius:7px;text-align:left;font:500 13px var(--f);color:var(--ink)}
.pv-n:hover{background:var(--hov)}.pv-n.on{background:var(--sel);color:var(--sel-ink)}.pv-n .ph-fill{font-size:14px;flex:none}.pv-n>span:not(.tag){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pv-n em{font-style:normal;color:var(--ink3);font-variant-numeric:tabular-nums}
.pv-n.hit span{background:color-mix(in srgb,var(--warn) 22%,transparent);border-radius:3px}.pv-n.ch{font-weight:600}
.pv-n.dim{color:var(--ink3)}
.pv-card{min-width:0;border-radius:12px;background:var(--soft);padding:12px;max-height:min(52vh,460px);overflow:auto;display:flex;flex-direction:column;gap:8px}
.pv-card .cr{font:500 12px var(--f);color:var(--ink3)}.pv-card h4{font:650 13px var(--f)}.pv-card .meta{font:500 12px var(--f);color:var(--ink2)}
.pv-pills{display:flex;flex-wrap:wrap;gap:4px}.pv-pills button{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border-radius:7px;background:var(--win);box-shadow:0 0 0 1px var(--line2);font:600 12px var(--f);color:var(--ink)}.pv-pills button:hover{box-shadow:0 0 0 1.5px var(--ac)}.pv-pills b{font-weight:500;color:var(--ink3)}
.pv-files{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:2px}.pv-files li{min-width:0;display:flex;align-items:center;gap:8px;min-height:32px;padding:2px 0;font:500 12px/1.35 var(--f)}.pv-files li .n{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--ink)}
.pv-chip{flex:none;white-space:nowrap;padding:2px 6px;border-radius:6px;background:var(--win);font:500 12px var(--f);color:var(--ink2);box-shadow:0 0 0 1px var(--line)}
.pv-empty{display:grid;place-items:center;text-align:center;gap:8px;padding:32px 16px;color:var(--ink2)}.pv-empty .ph{font-size:28px;color:var(--ac)}
.pv-search{width:220px}
.rs.inline{width:100%;max-height:none;box-shadow:0 0 0 1px var(--line);animation:none;overflow:visible}.rs.inline .rs-bd{overflow:visible}.rs.inline [data-rsx]{display:none}
/* the scope picker: quick picks, then a checklist of your folders */
.rs-gh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.rs-gh h3{margin:0;flex:1}
.rs-find{min-width:0;width:200px;height:28px}
.rs-presets{margin-bottom:8px}.rs-presets button{display:inline-flex;align-items:center;gap:5px}.rs-presets button .ph{font-size:13px}.rs-presets button em{font-style:normal;font-weight:500;color:var(--ink3)}.rs-presets button.on em{color:inherit}
.rs-tree{position:relative;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);padding:4px;max-height:260px;overflow:auto}.rs.inline .rs-tree{max-height:none}
.rs-tr{display:flex;align-items:center;gap:2px;min-height:30px;padding-left:calc(var(--d)*20px);border-radius:7px}
.rs-tr:hover{background:var(--hov)}
.rs-tw{flex:none;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--ink3)}.rs-tw:hover{background:var(--soft2);color:var(--ink)}.rs-tw .ph{font-size:12px;transition:transform .15s var(--ease)}.rs-tw[aria-expanded="true"] .ph{transform:rotate(90deg)}
.rs-tw.none{visibility:hidden}
.rs-tr label{flex:1;display:flex;align-items:center;gap:8px;min-width:0;min-height:30px;padding-right:8px;cursor:pointer}
.rs-tr input{flex:none;appearance:none;-webkit-appearance:none;display:grid;place-items:center;width:16px;height:16px;margin:0;border-radius:4px;background:var(--win);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--ink3) 75%,transparent);cursor:pointer;transition:background .12s var(--ease),box-shadow .12s var(--ease)}
.rs-tr input:checked,.rs-tr input:indeterminate{background:var(--ac);box-shadow:none}
.rs-tr input:checked::after{content:'';width:8px;height:4px;margin-top:-2px;border:2px solid #fff;border-top:0;border-right:0;transform:rotate(-45deg)}
.rs-tr input:indeterminate::after{content:'';width:8px;height:2px;border-radius:1px;background:#fff}
.rs-tr input:disabled{background:var(--soft2);box-shadow:inset 0 0 0 1.5px var(--line)}
.rs-tr input:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.rs-tr .ph-fill{flex:none;font-size:15px}
.rs-tr .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rs-tr.part .nm{font-weight:600}
.rs-tr .nm mark{background:color-mix(in srgb,var(--warn) 26%,transparent);color:inherit;border-radius:3px}
.rs-tr em{flex:none;font-style:normal;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
.rs-tr.dis label{cursor:not-allowed;color:var(--ink3)}.rs-tr.dis input{cursor:not-allowed}.rs-tr .lk{flex:none;font-size:13px;color:var(--lock)}
.rs-tr .rs-pvt{flex:none;font-size:12px;color:var(--ink3)}
.rs-none{padding:12px;color:var(--ink2);font-size:12px}
.rs-fl{display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 6px 6px 10px;border-radius:9px;background:var(--ac-fill);color:var(--ac-ink);font:600 12px var(--f)}.rs-fl .ph{font-size:14px}.rs-fl span{flex:1;min-width:0}
.rs-fl .ib{width:24px;height:24px;color:var(--ac-ink)}
.rs-sum{flex:1;min-width:0;display:flex;align-items:center;gap:10px}.rs-sum>.ph{font-size:18px;color:var(--ac-ink);flex:none}.rs-sum b{display:block;font:650 13px var(--f)}.rs-sum small{display:block;font:500 12px var(--f);color:var(--ink2)}
.rs-sum.empty>.ph,.rs-sum.empty b{color:var(--ink3)}
.rs-dep{display:flex;align-items:center;gap:8px;font:500 12px var(--f);color:var(--ink2)}
.rs-menu{position:fixed;z-index:calc(var(--z-sheet) + 5);min-width:170px;padding:4px;border-radius:10px;background:var(--win);box-shadow:var(--sh-pop);font:500 13px var(--f);color:var(--ink)}
.rs-menu button{display:flex;align-items:center;gap:8px;width:100%;height:28px;padding:0 10px;border-radius:7px;text-align:left}.rs-menu button:hover,.rs-menu button:focus-visible{background:var(--sel);color:var(--sel-ink);outline:0}.rs-menu button .ph{width:14px;font-size:13px;visibility:hidden}.rs-menu button[aria-checked="true"] .ph{visibility:visible}
.rs .tag{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:6px;font:650 11px/1 var(--f);flex:none}.rs .tag.new{background:var(--ac-fill);color:var(--ac-ink)}
/* the narrow right-hand column: everything stacks, the plan is a before → after list */
.rs.col{height:100%;display:flex;flex-direction:column;border-radius:0;box-shadow:none;background:var(--win);overflow:hidden}
.rs.col .rs-hd{padding:12px 16px 8px;align-items:center;gap:6px}.rs.col .rs-hd h2{font-size:15px}.rs.col .rs-hd p{font-size:12px}
.rs.col .rs-bk{height:28px;padding:0 8px 0 4px;margin-left:-6px;color:var(--ink2)}
.rs.col .rs-sub{padding:0 16px 8px;font:500 12px/1.4 var(--f);color:var(--ink2)}
.rs.col .rs-bd{flex:1;overflow:auto;padding:4px 16px 12px;gap:14px;align-content:start}
.rs.col .rs-find{width:100%;margin-bottom:8px}.rs.col .rs-gh{margin-bottom:6px}
.rs.col .rs-tree{max-height:none}
.rs.col .rs-row3{grid-template-columns:1fr}.rs.col .rs-row3 .rs-opt{flex-direction:row;align-items:baseline;gap:8px;padding:6px 10px}.rs.col .rs-row3 .rs-opt small{font-size:11.5px}
.rs.col .rs-ways{grid-template-columns:1fr}
.arr-ways{grid-template-columns:repeat(3,minmax(0,1fr))}.arr-way[disabled]{opacity:.55;cursor:default}.arr-way .arr-why{color:var(--ink3);font-size:12px;line-height:1.35}
.arr-way li.arr-ex{display:block;padding-left:22px;margin-top:-2px;color:var(--ink3);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arr-way li.arr-rest span{color:var(--ink3)}.arr-all{font-size:12px;color:var(--ink3)}.arr-details{gap:10px}
.arr-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.arr-opt>span{font-size:12.5px;color:var(--ink2)}
.arr-seg{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:var(--soft)}.arr-seg button{height:26px;padding:0 10px;border-radius:7px;font:500 12px var(--f);color:var(--ink2)}
.arr-seg button.on{background:var(--win);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.rs.col .arr-ways{grid-template-columns:1fr}
.rs-steps{display:grid;gap:8px;padding:0 24px 12px}.rs.col .rs-steps,.rs-steps.col{padding:0 0 10px}.rs-steps ol{display:flex;gap:4px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.rs-steps li>button,.rs-steps li>span{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px 0 3px;border-radius:999px;font:500 12px var(--f);color:var(--ink3)}
.rs-steps li>*>i{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--soft);font:600 10.5px var(--f);font-style:normal;color:var(--ink2)}
.rs-steps li.on>*{color:var(--ink)}.rs-steps li.on>*>i{background:var(--ac);color:#fff}.rs-steps li.done>*>i{background:var(--ac-fill);color:var(--ac-ink)}.rs-steps li>button{cursor:pointer}.rs-steps li>button:hover{background:var(--hov);color:var(--ink)}
.rs-steps li+li::before{content:'';display:inline-block;width:10px;height:1px;background:var(--line2,var(--line));vertical-align:middle;margin-right:4px}
.rs-prog{display:block;width:100%;height:3px;border-radius:2px;background:var(--soft2);overflow:hidden}.rs-prog i{display:block;height:100%;background:var(--ac);border-radius:2px;transition:width .3s var(--ease)}
.rs-sn{font:500 12px var(--f);color:var(--ink2)}.rs-sn b{color:var(--ink)}
.rs-pbar{display:flex;align-items:center;gap:10px}.rs-pbar .rs-bar{width:260px}.rs-pbar .rs-bar i{transition:none}.rs-pbar em{font:600 12px var(--f);font-style:normal;color:var(--ink2);min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.rs-stg{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:4px;text-align:left}.rs-stg li{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink3)}.rs-stg li.on{color:var(--ink)}.rs-stg li.done{color:var(--ink2)}.rs-stg li.done i{color:var(--ac)}
.rs-arr h3 small{font:400 12px var(--f);color:var(--ink3);margin-left:6px}.rs-now{font-size:12.5px}
@media (prefers-reduced-motion:reduce){.rs-prog i{transition:none}}
.pv-ttl{display:flex;align-items:center;gap:6px}.pv-ttl input{flex:1;min-width:0;height:32px;font:650 15px var(--f)}.pv-ttl .ph{color:var(--ink3)}
.pv-acts{display:flex;flex-wrap:wrap;gap:6px}.pv-side h3 .pv-add{margin-left:auto;height:24px}.pv-files li .sp-mv{margin-left:6px}
.pc-ed{display:grid;gap:6px}.pc-nf{display:flex;align-items:center;gap:6px}.pc-nf input{flex:1;min-width:0;height:28px;font:600 13px var(--f)}.pc-nf>.ph-fill{color:var(--k-folder,var(--ac))}.pc-list li .sp-mv{margin-left:auto;flex:none}
.rs .tag.new{background:var(--ac-fill);color:var(--ac-ink)}.rs .safe,.rs .safe i{color:var(--ink2)}.rs .pc-done i,.rs .pv-empty .ph-check-circle{color:var(--ac)}.rs.col .arr-seg{display:grid;grid-template-columns:1fr;width:100%}.rs.col .arr-seg button{height:auto;min-height:28px;padding:5px 10px;text-align:left}
.sp-ways{display:flex;flex-wrap:wrap;gap:6px}.sp-way{height:28px;padding:0 10px;border-radius:8px;background:var(--soft);font:500 12.5px var(--f);color:var(--ink2)}.sp-way.on{background:var(--ac-fill);color:var(--ac-ink);box-shadow:inset 0 0 0 1.5px var(--ac)}.sp-way[disabled]{opacity:.5;cursor:default}
.sp-parts,.sp-files{list-style:none;margin:0;padding:0}.sp-parts{display:grid;gap:6px}.sp-part{border-radius:10px;background:var(--soft);padding:6px 8px}.sp-row{display:flex;align-items:center;gap:6px;min-width:0}.sp-row>.ph-fill,.sp-row>.ph{color:var(--k-folder,var(--ac));flex:none}
.sp-exp{width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--ink3);flex:none}.sp-exp:hover{background:var(--hov)}
.sp-name{flex:1;min-width:0;height:28px;padding:0 8px;font:600 13px var(--f);background:var(--win)}.sp-row em{font-style:normal;color:var(--ink3);font-size:12px;min-width:18px;text-align:right}
.sp-stay{background:transparent;box-shadow:inset 0 0 0 1px var(--line)}.sp-stayname{flex:1;font:500 13px var(--f);color:var(--ink2)}
.sp-files{display:grid;gap:2px;margin:6px 0 2px 28px!important}.rs.col .sp-files{margin-left:20px!important}.rs.col .sp-row{flex-wrap:wrap}.rs.col .sp-row .sp-name{order:5;flex-basis:100%;margin-top:4px}.rs.col .sp-part{padding:6px}.sp-files li{display:flex;align-items:center;gap:6px;min-width:0}.sp-files label{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-size:12.5px}
.sp-files input[type=checkbox]{accent-color:var(--ac);flex:none}.sp-fn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sp-empty{color:var(--ink3);font-size:12px}
.sp-mv{flex:none;display:inline-flex;align-items:center;height:22px;padding:0 6px;border-radius:6px;font:500 11.5px var(--f);color:var(--ink2);box-shadow:inset 0 0 0 1px var(--line);background:var(--win)}.sp-mv:hover{background:var(--soft2)}
.sp-add{justify-self:start}.rs.col .rs-hd{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;row-gap:6px}.rs.col .rs-hd .rs-bk{grid-column:1/-1;justify-self:start;margin-left:-6px}.rs.col .arr-opt{flex-direction:column;align-items:flex-start;gap:6px}
@media (max-width:900px){.arr-ways{grid-template-columns:1fr 1fr}}
.rs.col .rs-ft{flex-wrap:wrap;padding:10px 16px 14px;gap:8px}.rs.col .rs-ft .rs-sum{flex-basis:100%}.rs.col .rs-ft .grow{flex:1}
.pc-strip{display:grid;gap:4px;padding:10px 12px;border-radius:10px;background:var(--soft);font:500 12px var(--f);color:var(--ink2)}.pc-strip b{color:var(--ink);font-weight:650}.pc-strip .safe{color:var(--ink2);display:flex;gap:6px;align-items:center}
.pc-news{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font:500 12px var(--f);color:var(--ink2)}
.pc-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.pc-list li{display:flex;align-items:center;gap:8px;min-width:0;padding:4px 0}
.pc-list .pc-t{flex:1;min-width:0;display:grid}
.pc-list .n{font:500 12.5px/1.3 var(--f);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pc-list .ft{display:flex;align-items:center;gap:4px;min-width:0;font:500 11.5px/1.3 var(--f);color:var(--ink3)}.pc-list .ft span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.pc-list .ft b{color:var(--ac-ink);font-weight:600;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.pc-list .ft .ph{flex:none;font-size:11px}
.pc-done{display:grid;justify-items:center;gap:8px;text-align:center;padding:28px 8px;color:var(--ink2)}.pc-done .ph-fill{font-size:30px;color:var(--ac)}.pc-done b{color:var(--ink);font:650 13px/1.4 var(--f)}
@media (max-width:900px){.pv-grid{grid-template-columns:1fr 1fr}.pv-card{grid-column:1/-1}.rs-ways{grid-template-columns:1fr}}
`;
if(!document.getElementById('rs-css')){const s=document.createElement('style');s.id='rs-css';s.textContent=CSS;document.head.appendChild(s)}

/* ---------- sheet frame */
let back=null,prevFocus=null,timer=null,host=null;
const inlineOn=()=>!!(host&&host.isConnected);
/* a narrow host is a right-hand column: everything, the plan too, is drawn in it */
const isCol=()=>inlineOn()&&host.getBoundingClientRect().width<480;
function frame(inner,wide){
 const col=isCol();
 if((!wide||col)&&inlineOn()){if(back){back.remove();back=null}host.innerHTML=`<div class="rs inline${col?' col':''}" role="region">${inner}</div>`;const d=host.firstChild;const h2=d.querySelector('h2');if(h2){h2.id='rs-t';d.setAttribute('aria-labelledby','rs-t')}return d}
 const again=!!back;if(!back){prevFocus=document.activeElement;back=document.createElement('div');back.className='rs-back';document.body.appendChild(back);
  back.addEventListener('pointerdown',e=>{if(e.target===back)close()});back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close()}
   if(e.key==='Tab'){const f=[...back.querySelectorAll('button:not([disabled]),input,textarea,select,summary')].filter(x=>x.offsetParent);if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}})}
 back.innerHTML=`<div class="rs${wide?' wide':''}" role="dialog" aria-modal="true">${inner}</div>`;const d=back.firstChild;if(again)d.style.animation='none';const h2=d.querySelector('h2');if(h2){h2.id='rs-t';d.setAttribute('aria-labelledby','rs-t')}
 setTimeout(()=>{const f=d.querySelector('[autofocus]')||d.querySelector('.btn.pri:not([disabled])')||d.querySelector('button');f&&f.focus()},0);return d}
function close(){clearTimeout(timer);menuOff();if(back){back.remove();back=null;prevFocus&&prevFocus.focus&&prevFocus.focus()}
 /* on the Re-sort page the setup stays on the page, fresh, after a plan is used or closed */
 if(inlineOn()&&S){if(S.only)leave();else setup()}}

/* ---------- what a re-sort covers (resort.estimate) */
const V=()=>Plan.view();
/* the folders the picker lists: real folders only. Tuck's suggested subfolders (dashed, like Labs) and hidden ones are not
   folders you can tick; their files belong to the folder around them. */
const shown=(v,id)=>{const n=v.node(id);return !!n&&!n.sug&&!n.hidden};
const kidsOf=(v,id)=>v.kids(id).filter(k=>shown(v,k));
function ownFiles(v,id){const out=v.files(id).slice();const go=x=>v.kids(x).filter(k=>!shown(v,k)&&v.node(k)).forEach(k=>{out.push(...v.files(k));go(k)});go(id);return out}
function scopeFiles(o){const v=V();let fs=[];
 if(o.scope==='pick'){const seen=new Set();const add=f=>{if(f&&!seen.has(f.id)){seen.add(f.id);fs.push(f)}};
  (o.nodeIds||[]).forEach(id=>{if(v.node(id))ownFiles(v,id).forEach(add)});(o.fileIds||[]).forEach(id=>add(v.file(id)))}
 else if(o.scope==='folder'&&o.nodeId)fs=v.files(o.nodeId);else if(o.scope==='folder_tree'&&o.nodeId)fs=v.files(o.nodeId,true);
 else if(o.scope==='selection')fs=(o.fileIds||[]).map(v.file).filter(Boolean);else if(o.scope==='loose')fs=v.files('loose');
 else fs=v.all().flatMap(id=>v.files(id));
 const priv=fs.filter(f=>v.level(f.id).level==='private');let pins=new Set();try{pins=new Set(JSON.parse(localStorage.getItem('tuckPins')||'[]'))}catch(e){}
 const keptIn=f=>pins.has(f.id)||v.pathIds(f.node).some(id=>{const n=v.node(id);return n.kept||n.own||pins.has(id)})||(f.node!=='loose'&&Plan.neverIn&&Plan.neverIn(f.node));
 const kept=fs.filter(f=>!priv.includes(f)&&keptIn(f));const ok=fs.filter(f=>!priv.includes(f)&&!kept.includes(f));
 const loose=ok.filter(f=>f.node==='loose').length;
 /* the folder count is the same one the plan's header uses (m6, rule 16): Everything = every folder in the plan; a folder and
    everything inside = it and its real subfolders (an open suggestion such as Labs is not a folder yet); otherwise the folders the files are in */
 const realKids=id=>v.kids(id).filter(k=>{const n=v.node(k);return n&&!n.sug&&!n.hidden}).flatMap(k=>[k,...realKids(k)]);
 const folders=o.scope==='everything'?{size:Plan.folderCount?Plan.folderCount(v):v.all().filter(id=>{const n=v.node(id);return !n.sug&&!n.special&&!n.hidden}).length}
  :o.scope==='folder_tree'&&o.nodeId?new Set([o.nodeId,...realKids(o.nodeId)]):new Set(ok.filter(f=>f.node!=='loose').map(f=>{let n=v.node(f.node);while(n&&n.sug&&n.parent)n=v.node(n.parent);return n?n.id:f.node}));
 /* the parts add up to the whole: "283 files: 273 in 38 folders, 10 without a folder" */
 let line=!ok.length?'No files Tuck can re-sort here':loose&&folders.size?`${pl(ok.length,'file')}: ${ok.length-loose} in ${pl(folders.size,'folder')}, ${loose} without a folder`:folders.size?`${pl(ok.length,'file')} in ${pl(folders.size,'folder')}`:`${pl(ok.length,'file')} without a folder`;
 return {files:ok,priv:priv.length,kept:kept.length,folders:folders.size,loose,line}}

/* ---------- Tuck's plan for a scope (the prototype's planner; the app's is resort.start) */
const WAYS=[['thing','By what they’re for'],['year','By year'],['kind','By kind of file']];
const wayOf=t=>/year|date|when|old|new/i.test(t||'')?'year':/kind|type|pdf|photo|image/i.test(t||'')?'kind':'thing';
const ANSWERS={};
function planFor(o){const v=V();const sc=scopeFiles(o);const set=new Set(sc.files.map(f=>f.id));const ops=[];const reach=o.reach||'place_only';const cap=o.depth||CFG.depth();
 const own=id=>{const n=v.node(id);return !n||n.kept||n.own||n.special||n.hidden||v.level(id).level==='private'||(Plan.isKept&&Plan.isKept(id))||(Plan.neverIn&&Plan.neverIn(id))};
 /* 1. place: each file goes where it fits best among your folders */
 const moves={};sc.files.forEach(f=>{if(f.hint&&f.hint!==f.node&&v.node(f.hint)){(moves[f.hint]=moves[f.hint]||[]).push(f.id)}});
 /* a folder's re-sort also takes in the files in No folder yet that belong inside it */
 const inScope=id=>o.nodeId&&(o.scope==='folder'?id===o.nodeId:o.scope==='folder_tree'&&v.node(id)&&v.pathIds(id).includes(o.nodeId));
 if(o.nodeId)v.files('loose').forEach(f=>{if(f.hint&&inScope(f.hint)&&v.level(f.id).level!=='private'){(moves[f.hint]=moves[f.hint]||[]).push(f.id)}});
 /* Tuck's own suggested folders inside the scope (dashed, like Labs) are part of its plan, so the preview shows them */
 if(o.nodeId)new Set(Object.keys(moves).concat(o.scope==='folder_tree'?v.kids(o.nodeId):[])).forEach(id=>{const n=v.node(id);if(n&&n.sug&&n.parent&&inScope(id))ops.push({ty:'accept',node:id})});
 /* a pick: Tuck's suggested subfolders inside a ticked folder are part of its plan; nothing outside the pick is touched */
 if(o.scope==='pick'){const picked=new Set(o.nodeIds||[]);const ac=new Set(Object.keys(moves));sc.files.forEach(f=>ac.add(f.node));
  ac.forEach(id=>{const n=v.node(id);if(n&&n.sug&&n.parent&&v.pathIds(id).some(x=>picked.has(x)))ops.push({ty:'accept',node:id})})}
 Object.entries(moves).forEach(([to,files])=>ops.push({ty:'moveFiles',files,to}));
 /* 2. new subfolders inside the scope */
 if(reach!=='place_only'){const cand=new Set();sc.files.forEach(f=>cand.add(f.node));
  [...cand].filter(id=>!own(id)&&v.node(id)).forEach(id=>{if(v.node(id).sug){if(v.node(id).parent&&!ops.some(x=>x.ty==='accept'&&x.node===id))ops.push({ty:'accept',node:id});return}});
  const big=[...cand].filter(id=>!own(id)&&v.node(id)&&!v.node(id).sug&&v.files(id).filter(f=>set.has(f.id)).length>=8).sort((a,b)=>v.files(b).length-v.files(a).length).slice(0,o.scope==='everything'||o.scope==='pick'?4:3);
  big.forEach(id=>{if(v.depth(id)+2>cap)return;const way=ANSWERS[v.area(id).name]||ANSWERS[id]||o.way||'thing';const parts=Plan.draftBest(id,way).filter(p=>p.files.length>=2&&!v.kids(id).some(k=>v.node(k).name.toLowerCase()===p.name.toLowerCase()));/* no second Labs next to the suggested Labs */
   if(parts.length<2)return;parts.forEach(p=>{const nid=Plan.uid('n');ops.push({ty:'newFolder',node:nid,parent:id,name:p.name},{ty:'moveFiles',files:p.files.filter(x=>set.has(x)),to:nid})})})}
 /* 3. redesign: very small folders join the folder around them */
 if(reach==='redesign'){const cand=new Set(sc.files.map(f=>f.node));[...cand].forEach(id=>{const n=v.node(id);if(!n||own(id)||n.sug||v.depth(id)<1||v.kids(id).length)return;if(v.files(id).length<=3&&v.node(n.parent))ops.push({ty:'merge',nodes:[id],into:n.parent})})}
 const unsure=sc.files.filter(f=>f.node==='loose'&&!f.hint).length;
 return {ops,sc,unsure}}

/* ---------- the setup: what to re-sort (picked directly), how far Tuck may go, then the plan */
let S=null;
const REACH=[['place_only','Only Place Files','Keep my folders as they are'],['suggest_subfolders','Suggest New Subfolders','May add folders inside'],['redesign','Redesign','May rename, merge or split']];
const PRIV_WHY='Private: Tuck’s AI never plans this folder';
const isPriv=(v,id)=>v.level(id).level==='private';
function subtree(v,id){const out=[id];kidsOf(v,id).forEach(k=>out.push(...subtree(v,k)));return out}
const pickable=(v,id)=>subtree(v,id).filter(x=>!isPriv(v,x));
/* the files a row would bring: everything under it that Tuck may plan */
const rowN=(v,id)=>v.files(id,true).filter(f=>v.level(f.id).level!=='private').length;
/* the quick picks. Each one sets the ticks, so the checklist always shows exactly what is in scope. */
function presets(){const v=V();const looseN=v.node('loose')?v.files('loose').length:0;const nf=Plan.newFiles?Plan.newFiles(v):[];const n=S.from&&v.node(S.from);
 const all=[];v.roots().forEach(r=>all.push(...pickable(v,r)));
 return [{k:'everything',l:'Everything',ic:'stack',nodes:all,files:[]},
  looseN&&{k:'loose',l:'Without a folder',n:looseN,ic:'tray',nodes:['loose'],files:[]},
  nf.length&&{k:'new',l:'New since last sort',n:nf.length,ic:'sparkle',nodes:[],files:nf.map(f=>f.id),fl:'New since last sort'},
  n&&!isPriv(v,n.id)&&{k:'here',l:'This folder',ic:'folder-simple',title:n.name,nodes:S.fromScope==='folder'?[n.id]:pickable(v,n.id),files:[]},
  S.sel.length&&{k:'sel',l:'Selected',n:S.sel.length,ic:'cursor-click',nodes:[],files:S.sel.slice(),fl:'Selected files'}].filter(Boolean)}
function setPick(p){const v=V();S.nodes=new Set(p.nodes);S.files=new Set(p.files);if(p.fl)S.fl=p.fl;
 /* open the parts that hold the pick, so its ticks can be seen */
 if(p.k==='here')v.pathIds(S.from).forEach(id=>S.open.add(id));
 p.files.forEach(id=>{const f=v.file(id);if(f&&v.node(f.node))v.pathIds(f.node).slice(0,-1).forEach(x=>S.open.add(x))})}
/* a row is ticked when every folder under it that holds files is ticked; partly when some are, or some of its files are picked one by one */
function stateOf(v,id){const ids=pickable(v,id);const real=ids.filter(x=>ownFiles(v,x).length);const base=real.length?real:ids;const t=base.filter(x=>S.nodes.has(x)).length;
 if(base.length&&t===base.length)return 'on';if(t)return 'mixed';
 for(const fid of S.files){const f=v.file(fid);if(f&&v.node(f.node)&&v.pathIds(f.node).includes(id))return 'mixed'}return 'off'}
function toggle(id){const v=V();const ids=pickable(v,id);
 if(stateOf(v,id)==='on'){ids.forEach(x=>S.nodes.delete(x));[...S.files].forEach(fid=>{const f=v.file(fid);if(f&&v.node(f.node)&&v.pathIds(f.node).includes(id))S.files.delete(fid)})}
 else ids.forEach(x=>S.nodes.add(x))}
/* the biggest ticked rows: a part of life when all of it is ticked, otherwise the folders inside it */
function pickTops(){const v=V();const out=[];const go=id=>{const s=stateOf(v,id);if(isPriv(v,id))return;if(s==='on'&&ownFilesDeep(v,id))out.push(id);else if(s==='mixed')kidsOf(v,id).forEach(go)};v.roots().forEach(go);return out}
const ownFilesDeep=(v,id)=>pickable(v,id).some(x=>S.nodes.has(x)&&ownFiles(v,x).length);
const pickScope=()=>({scope:'pick',nodeId:null,nodeIds:[...S.nodes],fileIds:[...S.files]});
const nothing=()=>!S.files.size&&![...S.nodes].some(id=>V().node(id)&&ownFiles(V(),id).length);

function open(o={}){const v0=V();
 /* re-sorting one folder (or one file) that may not be planned: say why */
 if(o.nodeId&&v0.node(o.nodeId)&&!v0.node(o.nodeId).special&&refused(o,'resort',`Re-sort ${v0.node(o.nodeId).name}`,()=>open(o)))return;
 if(o.scope==='selection'&&(o.fileIds||[]).length===1&&v0.file(o.fileIds[0])&&refused(Object.assign({},o,{nodeId:o.fileIds[0]}),'resort',`Re-sort ${v0.file(o.fileIds[0]).name}`))return;
 const v=V();menuOff();host=o.inline||null;const looseN=v.node('loose')?v.files('loose').length:0;
 const sc=o.scope||(o.nodeId?(kidsOf(v,o.nodeId).length?'folder_tree':'folder'):o.fileIds&&o.fileIds.length?'selection':looseN?'loose':'everything');
 const fromN=o.nodeId&&v.node(o.nodeId);
 S={scope:sc,nodeId:o.nodeId||null,fileIds:o.fileIds||[],reach:o.reach||'place_only',way:o.way||null,text:'',depth:CFG.depth(),onClose:o.onClose||null,go:!!o.go,
  from:fromN&&!fromN.special&&!fromN.sug?o.nodeId:null,fromScope:sc,sel:sc==='selection'?(o.fileIds||[]).slice():[],nodes:new Set(),files:new Set(),open:new Set(),q:'',fl:'Selected files'};
 if(sc==='pick'){S.sel=(o.fileIds||[]).slice();setPick({k:'pick',nodes:(o.nodeIds||[]).filter(id=>v.node(id)&&!isPriv(v,id)),files:S.sel,fl:'Selected files'});(o.nodeIds||[]).forEach(id=>v.node(id)&&v.pathIds(id).slice(0,-1).forEach(x=>S.open.add(x)))}
 else{const k=sc==='selection'?'sel':sc==='loose'?'loose':sc==='everything'?'everything':S.from?'here':null;const p=presets().find(x=>x.k===k);if(p)setPick(p)}
 if(o.go)return run();setup()}
/* the column's Back: hand the column back to the page */
function leave(){const fn=S&&S.onClose;clearTimeout(timer);menuOff();if(host)host.innerHTML='';host=null;S=null;fn&&fn()}

function treeRows(){const v=V();const q=(S.q||'').trim().toLowerCase();const out=[];
 const hit=id=>!!q&&v.node(id).name.toLowerCase().includes(q);const has=id=>hit(id)||kidsOf(v,id).some(has);
 const mark=s=>{const i=s.toLowerCase().indexOf(q);return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+q.length))+'</mark>'+esc(s.slice(i+q.length))};
 const go=(id,d)=>{if(q&&!has(id))return;const n=v.node(id);const ks=kidsOf(v,id);const opn=ks.length&&(q?ks.some(has):S.open.has(id));const priv=isPriv(v,id);const st=priv?'off':stateOf(v,id);const t=tileOfV(v,id);
  out.push(`<div class="rs-tr${d===0?' part':''}${priv?' dis':''}" style="--d:${d}" data-tid="${id}"${priv?` title="${PRIV_WHY}"`:''}>${ks.length?`<button type="button" class="rs-tw" data-rstog="${id}" aria-expanded="${!!opn}" aria-label="${opn?'Close':'Open'} ${esc(n.name)}"><i class="ph ph-caret-right"></i></button>`:'<span class="rs-tw none"></span>'}<label><input type="checkbox" data-rspk="${id}"${st==='on'?' checked':''}${st==='mixed'?' data-mixed="1"':''}${priv?' disabled':''}><i class="ph-fill ph-${t.ic}" style="color:var(${t.hue})" aria-hidden="true"></i><span class="nm">${q?mark(n.name):esc(n.name)}</span>${priv?`<i class="ph ph-lock-simple lk" aria-hidden="true"></i><span class="rs-pvt">Private</span>`:`<em>${rowN(v,id)}</em>`}</label></div>`);
  if(opn)ks.forEach(k=>go(k,d+1))};
 v.roots().filter(r=>!v.node(r).special).forEach(r=>go(r,0));v.roots().filter(r=>v.node(r).special).forEach(r=>go(r,0));
 return out.join('')||`<p class="rs-none">No folder called “${esc(S.q.trim())}”.</p>`}
/* everything that follows the ticks: the quick picks, the checklist, the picked-files line, the summary and Preview Plan */
function paintPick(d){const v=V();const $=s=>d.querySelector(s);const eq=(a,b)=>a.size===b.length&&b.every(x=>a.has(x));
 if($('[data-rspresets]')){$('[data-rspresets]').innerHTML=presets().map(p=>{const on=eq(S.nodes,p.nodes)&&eq(S.files,p.files);return `<button type="button" class="${on?'on':''}" data-rspre="${p.k}" aria-pressed="${on}"${p.title?` title="${esc(p.title)}"`:''}><i class="ph ph-${p.ic}"></i>${p.l}${p.n!=null?` <em>(${p.n})</em>`:''}</button>`}).join('');
 const tr=$('[data-rstree]');const top=tr.scrollTop;tr.innerHTML=treeRows();tr.scrollTop=top;tr.querySelectorAll('[data-mixed]').forEach(i=>{i.indeterminate=true});
 $('[data-rsfl]').innerHTML=S.files.size?`<div class="rs-fl"><i class="ph ph-cursor-click"></i><span>${esc(S.fl)} (${S.files.size})</span><button type="button" class="ib" data-rsdropfl aria-label="Remove ${esc(S.fl)}" title="Remove"><i class="ph ph-x"></i></button></div>`:''}
 const c=scopeFiles(pickScope());const none=nothing();const lim=CFG.limits()==='Just Do It'?'Just Do It is on in Limits: the plan is used straight away, with Undo':'Nothing changes until you use the plan';
 const sm=$('[data-rssum]');sm.classList.toggle('empty',none||!c.files.length);
 sm.innerHTML=none?`<i class="ph ph-selection"></i><span><b>Nothing picked yet</b><small>Tick folders, or use a quick pick.</small></span>`
  :`<i class="ph ph-files"></i><span><b>${c.files.length?esc('Re-sort '+c.line):'No files Tuck can re-sort here'}</b><small>${[c.priv&&`${pl(c.priv,'private file')} left out`,c.kept&&`${pl(c.kept,'file')} in your own folders stay`,lim].filter(Boolean).join(' · ')}.</small></span>`;
 d.querySelectorAll('[data-rsgo],[data-rsnext]').forEach(b=>{b.disabled=none||!c.files.length})}
/* Re-sort is one short flow: What → How far → Arrange → Tuck plans → Review. The bar shows where you are; finished steps
   (and ones you have seen) can be reopened. */
const STEPS=['What','How far','Arrange','Tuck plans','Review'];
function stepBar(n,col){const seen=S&&S.seen||n;const w=Math.round(n/STEPS.length*100);
 return `<div class="rs-steps${col?' col':''}" data-rssteps data-step="${n}" aria-label="Step ${n} of ${STEPS.length}: ${STEPS[n-1]}">${col?`<span class="rs-sn">Step ${n} of ${STEPS.length} · <b>${STEPS[n-1]}</b></span>`:`<ol>${STEPS.map((l,i)=>{const k=i+1,can=k<=3&&k<=Math.max(seen,n)&&k!==n&&n<=3;return `<li class="${k<n?'done':k===n?'on':''}">${can?`<button type="button" data-rsstepgo="${k}">`:'<span>'}<i>${k<n?'<i class="ph ph-check"></i>':k}</i>${l}${can?'</button>':'</span>'}</li>`}).join('')}</ol>`}<span class="rs-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w}"><i style="width:${w}%"></i></span></div>`}
function setup(){menuOff();const col=isCol();const v=V();const from=S.from&&v.node(S.from);S.step=S.step||1;S.seen=Math.max(S.seen||1,S.step);const st=S.step;
 const find=`<label class="search rs-find"><i class="ph ph-magnifying-glass"></i><input id="rsq" value="${esc(S.q)}" placeholder="Find a folder" aria-label="Find a folder" autocomplete="off"></label>`;
 const d=frame(`<div class="rs-hd">${col?`<button class="btn ghost rs-bk" data-rsclose><i class="ph ph-arrow-left"></i>Back</button><div><h2>Re-sort with Tuck</h2></div>`:`<div><h2>Re-sort with Tuck</h2><p>${from?`From ${esc(from.name)}. `:''}Pick what Tuck looks at again. It makes a plan; you see it before anything changes.</p></div>`}<button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>
 ${col?`<p class="rs-sub">Pick what Tuck looks at again. You see the plan before anything changes.</p>`:''}
 <div class="rs-bd">
  ${stepBar(st,col)}
  ${st===1?`<section class="rs-g rs-pick" aria-label="What to re-sort"><div class="rs-gh"><h3>What to re-sort</h3>${col?'':find}</div>${col?find:''}
   <div class="rs-chips rs-presets" role="group" aria-label="Quick picks" data-rspresets></div>
   <div class="rs-tree" role="group" aria-label="Your folders" data-rstree></div>
   <div data-rsfl></div></section>`:''}
  ${st===2?`<section class="rs-g"><h3>How far Tuck may go</h3><div class="rs-row3" role="radiogroup" aria-label="How far Tuck may go">${REACH.map(([k,l,s])=>`<label class="rs-opt${S.reach===k?' on':''}"><input type="radio" name="rsreach" value="${k}" ${S.reach===k?'checked':''}><b>${l}</b><small>${s}</small></label>`).join('')}</div>
   <p class="rs-keep"><i class="ph ph-shield-check"></i><span>Nothing moves on disk. Private files are left out. Your own folders, Keep as My Folder folders, pins and Never Look In folders stay as they are.</span></p></section>`:''}
  ${st===3?`<section class="rs-g rs-arr"><h3>How should these be arranged? <small>Optional: Tuck decides if you skip it</small></h3><div class="in">
   <div class="rs-chips" role="radiogroup">${[['','Let Tuck Decide'],...WAYS].map(([k,l])=>`<button type="button" class="${(S.way||'')===k?'on':''}" data-rsway="${k}">${l}</button>`).join('')}</div>
   <input class="field" id="rstext" value="${esc(S.text)}" placeholder="Or say it in your words, like “by year, newest first”" aria-label="How should these be arranged">
   <div class="rs-dep"><span>Folder depth for this</span><button type="button" class="popchip" data-rsdepth aria-haspopup="menu" aria-expanded="false">Up to ${S.depth} levels<i class="ph ph-caret-down pcaret"></i></button></div></div></section>`:''}
 </div>
 <div class="rs-ft"><div class="rs-sum rs-cover" aria-live="polite" data-rssum></div>${st>1?'<button class="btn ghost" data-rsprev><i class="ph ph-arrow-left"></i>Back</button>':col?'':'<button class="btn" data-rsx>Cancel</button>'}
  ${st<3?`<button class="btn ghost rs-now" data-rsgo title="Make the plan now: Tuck uses its defaults for the remaining steps">Make the plan now</button><button class="btn pri${col?' grow':''}" data-rsnext>Next: ${STEPS[st]}<i class="ph ph-arrow-right"></i></button>`:`<button class="btn pri${col?' grow':''}" data-rsgo><i class="ph ph-sparkle"></i>Make the plan</button>`}</div>`);
 /* step navigation: Next, Back, and finished steps in the bar */
 d.addEventListener('click',e=>{const nx=e.target.closest('[data-rsnext]'),pv=e.target.closest('[data-rsprev]'),sg=e.target.closest('[data-rsstepgo]');
  if(nx&&!nx.disabled){e.stopImmediatePropagation();S.step=Math.min(3,st+1);setup();return}
  if(pv){e.stopImmediatePropagation();S.step=Math.max(1,st-1);setup();return}
  if(sg){e.stopImmediatePropagation();S.step=+sg.dataset.rsstepgo;setup()}},true);
 paintPick(d);
 /* the first ticked row is in view when the setup opens */
 if(st===1){const tr=d.querySelector('[data-rstree]'),f=tr.querySelector('input:checked,[data-mixed]');const r=f&&f.closest('.rs-tr');if(r&&r.offsetTop+r.offsetHeight>tr.scrollTop+tr.clientHeight)tr.scrollTop=r.offsetTop-8}
 const refocus=sel=>{const f=d.querySelector(sel);f&&f.focus()};
 d.onchange=e=>{const t=e.target;
  if(t.dataset.rspk){toggle(t.dataset.rspk);if(S.q.trim())V().pathIds(t.dataset.rspk).slice(0,-1).forEach(x=>S.open.add(x));paintPick(d);refocus(`[data-rspk="${t.dataset.rspk}"]`);return}
  if(t.name==='rsreach'){S.reach=t.value;setup();const n=host&&host.isConnected?host:back;const f=n&&n.querySelector('input[name=rsreach]:checked');f&&f.focus()}};
 d.oninput=e=>{if(e.target.id==='rstext'){S.text=e.target.value;S.way=S.text?wayOf(S.text):S.way}
  if(e.target.id==='rsq'){S.q=e.target.value;const tr=d.querySelector('[data-rstree]');tr.innerHTML=treeRows();tr.querySelectorAll('[data-mixed]').forEach(i=>{i.indeterminate=true})}};
 const det=d.querySelector('.rs-more');if(det)det.ontoggle=()=>{S.more=det.open};
 d.onclick=e=>{const t=e.target;if(t.closest('[data-rsx]'))return close();if(t.closest('[data-rsclose]'))return leave();
  const p=t.closest('[data-rspre]');if(p){const ps=presets().find(x=>x.k===p.dataset.rspre);if(ps){setPick(ps);paintPick(d);refocus(`[data-rspre="${ps.k}"]`)}return}
  const tg=t.closest('[data-rstog]');if(tg){const id=tg.dataset.rstog;S.open.has(id)?S.open.delete(id):S.open.add(id);paintPick(d);refocus(`[data-rstog="${id}"]`);return}
  if(t.closest('[data-rsdropfl]')){S.files.clear();paintPick(d);refocus('#rsq');return}
  const dp=t.closest('[data-rsdepth]');if(dp)return depthMenu(dp);
  const w=t.closest('[data-rsway]');if(w){S.way=w.dataset.rsway||null;S.text='';setup();return}
  if(t.closest('[data-rsgo]')){const o=pickScope();return S.reach==='redesign'&&!S.asked&&pickTops().some(id=>!V().node(id).special)?askAreas(o):run()}};
 d.onkeydown=e=>{if(e.target.id==='rstext'&&e.key==='Enter'){e.preventDefault();d.querySelector('[data-rsgo]').click()}
  if(e.target.id==='rsq'&&e.key==='Escape'&&S.q){e.preventDefault();e.stopPropagation();e.target.value='';S.q='';paintPick(d)}}}
/* the depth pop-up menu */
let menuEl=null;
function menuAway(e){if(menuEl&&!menuEl.contains(e.target)&&!e.target.closest('[data-rsdepth]'))menuOff()}
function menuOff(){if(!menuEl)return;menuEl.remove();menuEl=null;document.removeEventListener('pointerdown',menuAway,true);document.querySelectorAll('[data-rsdepth][aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function depthMenu(btn){if(menuEl){menuOff();return}
 const m=menuEl=document.createElement('div');m.className='rs-menu';m.setAttribute('role','menu');m.setAttribute('aria-label','Folder depth');
 m.innerHTML=[3,4,5,6,7,8].map(x=>`<button type="button" role="menuitemradio" aria-checked="${S.depth===x}" data-dv="${x}"><i class="ph ph-check"></i>Up to ${x} levels</button>`).join('');
 document.body.appendChild(m);const r=btn.getBoundingClientRect(),h=m.offsetHeight;
 m.style.left=Math.max(8,Math.min(r.left,innerWidth-m.offsetWidth-8))+'px';m.style.top=(r.bottom+4+h>innerHeight-8?Math.max(8,r.top-4-h):r.bottom+4)+'px';btn.setAttribute('aria-expanded','true');
 m.onclick=e=>{const b=e.target.closest('[data-dv]');if(!b)return;S.depth=+b.dataset.dv;menuOff();setup();const n=(inlineOn()?host:back);const f=n&&n.querySelector('[data-rsdepth]');f&&f.focus()};
 m.onkeydown=e=>{const bs=[...m.querySelectorAll('button')];const i=bs.indexOf(document.activeElement);
  if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopPropagation();menuOff();btn.focus()}else if(e.key==='ArrowDown'){e.preventDefault();bs[(i+1)%bs.length].focus()}else if(e.key==='ArrowUp'){e.preventDefault();bs[(i-1+bs.length)%bs.length].focus()}};
 (m.querySelector('[aria-checked="true"]')||m.querySelector('button')).focus();
 setTimeout(()=>document.addEventListener('pointerdown',menuAway,true),0)}

/* before a redesign: one question per large part of life (resort.ask), with example trees from real files */
/* a way's groups cover every file in the folder (rule 21): existing subfolders keep their own count, a draft group with the
   same name joins them ("Labs 12 + 3"), and the rest is "Other". plan.js Plan.suggestGroups when it is there. */
function groupsFor(id,way){const v=V();
 if(Plan.suggestGroups){const r=Plan.suggestGroups(id,way)||{groups:[]};return r.groups.map(g=>({name:g.name,n:g.n,now:g.now,files:g.files}))}
 const kids=v.kids(id).filter(k=>!v.node(k).hidden&&!v.node(k).gone).map(k=>({name:v.node(k).name,n:v.total(k),now:v.total(k),files:v.files(k,true).map(f=>f.id),kid:1}));
 const parts=Plan.draftArrange(id,way);const out=kids.slice();
 parts.forEach(p=>{const k=out.find(g=>g.kid&&g.name.toLowerCase()===p.name.toLowerCase());if(k){k.n+=p.files.length;k.files=k.files.concat(p.files)}else out.push({name:p.name,n:p.files.length,now:null,files:p.files.slice()})});
 const used=out.reduce((a,g)=>a+g.n,0),rest=v.total(id)-used;out.sort((a,b)=>b.n-a.n);if(rest>0)out.push({name:'Other',n:rest,now:null,files:[]});return out}
function exampleTrees(id){return WAYS.map(([k,l])=>({k,l,parts:Plan.draftArrange(id,k).length>=2?groupsFor(id,k):[]})).filter(w=>w.parts.filter(p=>p.name!=='Other').length>=2)}
function sees(id){const v=V();const top=groupsFor(id,'thing').filter(p=>p.name!=='Other').slice(0,3).map(p=>p.name.toLowerCase());return `I see ${pl(v.total(id),'file')} in ${v.node(id).name}${top.length?`: ${top.join(', ')}`:''}.`}
/* every group shows, so the counts add up to the folder; past 5 the smallest join Other */
function wayCard(w,on){let g=w.parts.filter(p=>p.name!=='Other'),oth=w.parts.find(p=>p.name==='Other');if(g.length>5){const tail=g.slice(4);g=g.slice(0,4);oth={name:'Other',n:tail.reduce((a,p)=>a+p.n,0)+(oth?oth.n:0)}}
 const rows=g.concat(oth?[oth]:[]);return `<button type="button" class="rs-way${on?' on':''}" data-rsw="${w.k}"><b>${w.l}</b><ul>${rows.map(p=>`<li><i class="ph-fill ph-folder-simple"></i><span>${esc(p.name)}</span><em>${p.now!=null&&p.now!==p.n?`${p.now} + ${p.n-p.now}`:p.n}</em></li>`).join('')}</ul></button>`}
function askAreas(o){const v=V();const scopeIds=o.scope==='everything'?v.roots():o.scope==='pick'?pickTops().filter(id=>!v.node(id).special):[o.nodeId];
 const leaf=id=>{let best=null;const go=x=>{if(v.files(x).filter(f=>v.level(f.id).level!=='private').length>=8&&(!best||v.files(x).length>v.files(best).length))best=x;v.kids(x).forEach(go)};go(id);return best};
 const qs=scopeIds.map(leaf).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>v.files(b).length-v.files(a).length).slice(0,3);
 if(!qs.length){S.asked=true;return run()}
 const ans={};const draw=()=>{const d=frame(`<div class="rs-hd"><div><h2>Before Tuck designs your folders</h2><p>How do you want these arranged? Tuck asks, it doesn’t guess. Nothing moves now.</p></div><button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>
  <div class="rs-bd">${qs.map(id=>`<section class="rs-q" data-q="${id}"><b>${esc(sees(id))}</b><small>How should the files in ${esc(v.path(id).join(' › '))} be arranged?</small><div class="rs-ways">${exampleTrees(id).map(w=>wayCard(w,ans[id]===w.k)).join('')}</div>
   <input class="field" data-qt="${id}" value="${esc(ans['t'+id]||'')}" placeholder="Or say how you want ${esc(v.node(id).name)} arranged" aria-label="How you want ${esc(v.node(id).name)} arranged"></section>`).join('')}</div>
  <div class="rs-ft"><button class="btn ghost" data-rsback><i class="ph ph-arrow-left"></i>Back</button><span class="sp"></span><button class="btn" data-rsdecide>Let Tuck Decide</button><button class="btn pri" data-rsdesign>Design My Folders</button></div>`,true);
  d.onclick=e=>{if(e.target.closest('[data-rsx]'))return close();if(e.target.closest('[data-rsback]'))return setup();const w=e.target.closest('[data-rsw]');if(w){const q=w.closest('[data-q]').dataset.q;ans[q]=w.dataset.rsw;draw();return}
   if(e.target.closest('[data-rsdecide]')){S.asked=true;run();return}
   if(e.target.closest('[data-rsdesign]')){qs.forEach(id=>{const t=ans['t'+id];const way=t?wayOf(t):ans[id];if(way)ANSWERS[id]=way});S.asked=true;run()}};
  d.oninput=e=>{const q=e.target.dataset.qt;if(q){ans['t'+q]=e.target.value}}};draw()}

/* planning, with Stop */
function run(){/* Sort Again (go) plans the scope it was given; otherwise exactly what is ticked */
 const o=Object.assign({},S,S.go?{}:pickScope());S.go=false;S.seen=3;const col=isCol();const sc=scopeFiles(o),n=sc.files.length;
 /* step 4: what Tuck is doing, with a percentage that moves through named stages, and Stop */
 const stages=[`Reading ${pl(n,'file name')}`,'Matching them to your folders',o.reach&&o.reach!=='place_only'?'Drafting new folders':'Checking where each one fits best','Checking your rules and private files'];
 const T=reduce()?150:1600;
 const d=frame(`<div class="rs-hd"><div><h2>Re-sort with Tuck</h2></div></div>${stepBar(4,col)}<div class="rs-work"><b data-rsstage>${esc(stages[0])}…</b><small>${esc(sc.line)}. File names only; nothing moves on disk.</small>
  <div class="rs-pbar"><span class="rs-bar"><i></i></span><em data-rspct>0%</em></div><ol class="rs-stg">${stages.map((x,i)=>`<li data-stg="${i}"${i===0?' class="on"':''}><i class="ph ph-circle"></i>${esc(x)}</li>`).join('')}</ol></div>
 <div class="rs-ft"><span class="sp"></span><button class="btn" data-rsstop><i class="ph ph-stop"></i>Stop</button></div>`);
 const t0=performance.now();let iv=setInterval(()=>{if(!d.isConnected){clearInterval(iv);return}const f=Math.min(1,(performance.now()-t0)/T),k=Math.min(stages.length-1,Math.floor(f*stages.length));
  const b=d.querySelector('.rs-bar i');b&&(b.style.transform=`scaleX(${f})`);const pc=d.querySelector('[data-rspct]');pc&&(pc.textContent=Math.round(f*100)+'%');
  const sg=d.querySelector('[data-rsstage]');sg&&(sg.textContent=stages[k]+'…');d.querySelectorAll('[data-stg]').forEach(li=>{const i=+li.dataset.stg;li.className=i<k?'done':i===k?'on':'';li.querySelector('i').className='ph '+(i<k?'ph-check-circle':'ph-circle')})},60);
 d.onclick=e=>{if(e.target.closest('[data-rsstop]')){clearTimeout(timer);clearInterval(iv);CFG.toast('Stopped. Nothing changed.');S.step=3;setup()}};
 timer=setTimeout(()=>{clearInterval(iv);const p=planFor(o);const label=labelFor(o,p.ops);
  if(!p.ops.length)return preview({extra:[],title:'Tuck’s Plan for Sorting Again',empty:true,back:()=>{S.step=3;setup()},flow:true});
  const op={ty:'batch',label,ops:p.ops};
  if(CFG.limits()==='Just Do It'){if(isCol())return done(use([op],label),label);close();use([op],label);return}
  preview({extra:[op],title:'Tuck’s Plan for Sorting Again',unsure:p.unsure,back:()=>{S.step=3;setup()},label,reach:o.reach,scopeN:p.sc.files.length,scopeName:scopeName(o),flow:true})},T)}
/* a pick, in words: one part or folder by name, Everything, the files picked one by one, or "what you picked" */
function pickWords(o){const v=V();if(!S)return null;const ev=presets().find(p=>p.k==='everything');const ids=new Set(o.nodeIds||[]);
 if(ev&&!(o.fileIds||[]).length&&ev.nodes.length===ids.size&&ev.nodes.every(x=>ids.has(x)))return {k:'everything'};
 const tops=pickTops(),files=(o.fileIds||[]).length;
 if(!tops.length)return {k:'files',n:files};
 if(!files&&tops.length<=2)return {k:'names',names:tops.map(id=>id==='loose'?null:v.node(id).name),tops};
 return {k:'mixed'}}
function scopeName(o){if(o.scope==='pick'){const w=pickWords(o)||{k:'mixed'};return w.k==='everything'?'your folders':w.k==='files'?(S.fl==='New since last sort'?'your new files':'your selection'):w.k==='names'?w.names.map(x=>x||'No folder yet').join(' and '):'what you picked'}
 const n=o.nodeId&&V().node(o.nodeId);return o.scope==='loose'?'No folder yet':o.scope==='everything'?'your folders':o.scope==='selection'?'your selection':n?n.name:'this folder'}
function labelFor(o,ops){const v=V();const adds=(ops||[]).some(x=>x.ty==='newFolder'),merges=(ops||[]).some(x=>x.ty==='merge');const n=o.nodeId&&v.node(o.nodeId);const w=o.scope==='pick'&&(pickWords(o)||{k:'mixed'});
 const what=w?(w.k==='everything'?'everything':w.k==='files'?(S.fl==='New since last sort'?pl(w.n,'new file'):pl(w.n,'file')):w.k==='names'?w.names.map(x=>x||'Files Without a Folder').join(' and '):pl(scopeFiles(o).files.length,'file')):o.scope==='loose'?'Files Without a Folder':o.scope==='everything'?'everything':o.scope==='selection'?pl((o.fileIds||[]).length,'file'):n?n.name:'a folder';
 return `Re-sorted ${what}${o.reach==='redesign'&&(adds||merges)?', redesigned':adds?', with new subfolders':''}`}
function use(ops,label){const row=Plan.applyNow(ops,label);if(!row)return null;CFG.history(row);CFG.toast(`${label}.`,()=>Plan.undoApply(row.id));return row}

/* after Use in the column: what happened, with Undo right there */
function done(row,label){const draw=undone=>{const d=frame(`<div class="rs-hd"><div><h2>${undone?'Undone':'Plan used'}</h2></div></div>
  <div class="rs-bd"><div class="pc-done"><i class="ph-fill ph-${undone?'arrow-counter-clockwise':'check-circle'}"${undone?' style="color:var(--ink3)"':''}></i><b>${undone?'Your folders in Tuck are back as they were.':esc(label)+'.'}</b><span>${undone?'Nothing moved on disk.':'Nothing moved on disk. It’s one row in History, with Undo.'}</span></div></div>
  <div class="rs-ft">${undone?'':'<button class="btn" data-rsundo><i class="ph ph-arrow-counter-clockwise"></i>Undo</button>'}<span class="sp"></span><button class="btn pri" data-rsdone>Done</button></div>`,true);
  d.onclick=e=>{if(e.target.closest('[data-rsundo]')){const r=Plan.history().find(x=>x.id===row.id);if(r&&!r.undone)Plan.undoApply(row.id);CFG.history();draw(true);return}
   if(e.target.closest('[data-rsdone]'))return S&&!S.only?setup():leave()};
  setTimeout(()=>{const f=d.querySelector('[data-rsdone]');f&&f.focus()},0)};draw(false)}

/* ---------- a tool that may not act here says why (Plan.can), in the same sheet or column */
function refused(o,tool,title,again){const c=Plan.can?Plan.can(tool,o.nodeId):{ok:true};if(c.ok)return false;menuOff();host=o.inline||null;S={only:true,onClose:o.onClose||null};const kept=Plan.isKept&&Plan.isKept(o.nodeId)&&again;
 const col=isCol();const d=frame(`<div class="rs-hd">${col?'<button class="btn ghost rs-bk" data-rsclose><i class="ph ph-arrow-left"></i>Back</button>':''}<div><h2>${esc(title)}</h2></div><button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>
  <div class="rs-bd"><div class="pc-done rs-refused"><i class="ph ph-info"></i><b>${esc(c.why)}</b></div></div><div class="rs-ft"><span class="sp"></span>${kept?'<button class="btn" data-rsunkeep>Turn Off Keep As Is</button>':''}<button class="btn pri" data-rsx>OK</button></div>`,false);
 d.onclick=e=>{if(e.target.closest('[data-rsx]'))return close();if(e.target.closest('[data-rsclose]'))return leave();if(e.target.closest('[data-rsunkeep]')){Plan.setKeep(o.nodeId,false);close();again()}};return true}
/* ---------- Arrange */
/* inline / onClose work as in open(): a narrow column gets the question and the plan, Back calls onClose. only: no setup to go back to */
/* Suggest Subfolders is gone as its own item: it is Arrange's first way, Tuck's pick. Resort.suggest still works (callers, checks). */
function suggest(o){return arrange(Object.assign({},o,{way:'pick'}))}
/* Arrange This Folder…: a small Re-sort for one folder. Every way shows (one that doesn't fit says why), each with the folders it
   would make and example files; details tune it (the smallest folder, what happens to the rest, a second level); a live summary
   says what it makes; then the same before/after preview with Use and Undo. Your choice is kept: the next sort follows it. */
const MON3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE=[[/cad|bracket|design|sketch|prototype|\.(step|stl|f3d|dwg)$/i,'Designs'],[/charter|gantt|timeline|plan\b|bill of materials|\bbom\b|budget|meeting/i,'Planning'],[/\b(pre)?labs?\b|prelab/i,'Labs'],[/problem ?sets?|\bps ?\d|homework|\bhw ?\d/i,'Problem sets'],[/lecture|slides?\b/i,'Lectures'],
 [/midterm|final exam|exam|quiz|review|study guide/i,'Exams and review'],[/\bnotes?\b|week ?\d/i,'Notes'],[/draft|outline|wip/i,'Drafts'],
 [/report|essay|paper|proposal|brief/i,'Writing'],[/data|results|\.(xlsx|csv)$/i,'Data'],
 [/syllabus|schedule|handbook|rubric/i,'Course info']];
const fdate=f=>{const t=Plan.fileAt&&Plan.fileAt(f.id);return new Date(t||Date.now()-(f.age||0)*864e5)};
const ARR=[
 ['pick','Tuck’s pick',null],
 ['thing','By what they’re for',f=>{const m=ROLE.find(([r])=>r.test(f.name));return m?m[1]:null}],
 ['kind','By kind of file',f=>{const k=Plan.kind(f.name).label;return ({PDF:'PDFs',Word:'Documents',Spreadsheet:'Spreadsheets',Image:'Images',Photo:'Photos',Slides:'Slides',Code:'Code',CAD:'CAD',Audio:'Audio',Text:'Notes',Zip:'Zips'})[k]||null}],
 ['week','By week',f=>{const d=fdate(f),m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));return 'Week of '+m.getDate()+' '+MON3[m.getMonth()]}],
 ['month','By month added',f=>{const d=fdate(f);return MON3[d.getMonth()]+' '+d.getFullYear()}],
 ['stage','Drafts and finals',f=>/draft|outline|wip|\bv\d|\(\d\)|old|copy/i.test(f.name)?'Drafts':/final|submitted|signed/i.test(f.name)?'Finals':null],
 ['year','By year',f=>String(fdate(f).getFullYear())]];
const ARRS=ARR.filter(a=>a[0]!=='pick');/* Split starts from a way, not from Tuck's pick (that makes subfolders inside) */
function arrGroups(id,way,o){const v=V();const fs=v.files(id,!!o.deep).filter(f=>v.level(f.id).level!=='private');let g;
 /* Tuck's pick: its own best idea (what Suggest Subfolders did): the folders it already suggests inside, then its best grouping of the rest */
 if(way==='pick'){const sug=v.kids(id).filter(k=>v.node(k)&&v.node(k).sug).map(k=>({name:v.node(k).name,files:v.files(k,true).filter(f=>v.level(f.id).level!=='private').map(f=>f.id),sug:k}));
  const own=new Set(fs.map(f=>f.id));const best=Plan.draftBest(id,ANSWERS[id]&&ANSWERS[id]!=='pick'?ANSWERS[id]:'thing').map(p=>({name:p.name,files:p.files.filter(x=>own.has(x))}));
  g=[...sug,...best.filter(p=>!sug.some(x=>x.name.toLowerCase()===p.name.toLowerCase()))].filter(x=>x.files.length>=Math.max(o.min,x.sug?1:2)).slice(0,6);
  const inG=new Set(g.flatMap(x=>x.files));return {groups:g,rest:fs.filter(f=>!inG.has(f.id)).map(f=>f.id),all:fs.concat(sug.flatMap(x=>v.files(x.sug,true)))}}
 {const fn=ARR.find(a=>a[0]===way)[2],m=new Map();fs.forEach(f=>{const k=fn(f);if(!k)return;if(!m.has(k))m.set(k,[]);m.get(k).push(f.id)});g=[...m].map(([name,files])=>({name,files}))}
 g=g.filter(x=>x.files.length>=o.min).sort((a,b)=>b.files.length-a.files.length).slice(0,6);
 const inG=new Set(g.flatMap(x=>x.files)),rest=fs.filter(f=>!inG.has(f.id)).map(f=>f.id);return {groups:g,rest,all:fs}}
function whyNot(id,way,o){const v=V(),fs=v.files(id,!!o.deep).filter(f=>v.level(f.id).level!=='private');if(fs.length<4)return 'Too few files to arrange';
 const ys=new Set(fs.map(f=>fdate(f).getFullYear()));
 if(way==='year'&&ys.size<2)return `All ${fs.length} are from ${[...ys][0]}`;
 if(way==='month')return 'Only one month has enough files';
 if(way==='kind')return `Every file is the same kind (${Plan.kind(fs[0].name).label})`;
 if(way==='stage')return 'No drafts or finals found in the names';
 if(way==='pick')return 'Tuck has no better idea for it yet';
 if(way==='week')return 'Only one week has enough files';
 return 'Only one kind of work has enough files'}
function arrange(o){const v=V();const id=o.nodeId,n=v.node(id);if(!n)return;if(refused(o,'arrange',`Arrange ${n.name}`,()=>arrange(o)))return;menuOff();host=o.inline||null;S={only:true,onClose:o.onClose||null};
 const pass={inline:o.inline,onClose:o.onClose};const kids=v.kids(id).length;
 const st={way:o.way||ANSWERS[id]||null,min:2,rest:'stay',then:'none',deep:false,text:''};
 /* "I see 8 files in ENGI 1006, mostly designs and planning." from what they're for */
 const seen=()=>{const g=arrGroups(id,'thing',{min:2,deep:st.deep}).groups.slice(0,3).map(x=>x.name.toLowerCase());const t=v.files(id,!!st.deep).length;
  return `I see ${pl(t,'file')} in ${n.name}${g.length?`, mostly ${g.length>1?g.slice(0,-1).join(', ')+' and '+g.at(-1):g[0]}`:''}.`};
 const fits=()=>ARR.map(([k,l])=>{const r=arrGroups(id,k,st);return {k,l,r,ok:r.groups.length>=2||(k==='pick'&&r.groups.some(g=>g.sug))}});
 const ops=()=>{const r=arrGroups(id,st.way,st);const out=[];const add=(parent,name,files)=>{const nid=Plan.uid('n');out.push({ty:'newFolder',node:nid,parent,name});return nid};
  r.groups.forEach(gp=>{if(gp.sug){out.push({ty:'accept',node:gp.sug});return}const nid=add(id,gp.name);
   if(st.then!=='none'&&gp.files.length>=3){const sub=new Map(),fn=ARR.find(a=>a[0]===st.then)[2],byId=new Map(r.all.map(f=>[f.id,f]));gp.files.forEach(fid=>{const k=fn(byId.get(fid))||'Other';if(!sub.has(k))sub.set(k,[]);sub.get(k).push(fid)});
    if(sub.size>=2){[...sub].forEach(([nm,fl])=>{const sid=add(nid,nm);out.push({ty:'moveFiles',files:fl,to:sid})});return}}
   out.push({ty:'moveFiles',files:gp.files,to:nid})});
  if(st.rest==='other'&&r.rest.length){const oid=add(id,'Other');out.push({ty:'moveFiles',files:r.rest,to:oid})}
  return {out,r}};
 const summary=()=>{const {out,r}=ops();const nf=out.filter(x=>x.ty==='newFolder').length,moved=out.filter(x=>x.ty==='moveFiles').reduce((a,x)=>a+x.files.length,0);
  const inner=out.filter(x=>x.ty==='newFolder'&&x.parent!==id).length,left=st.rest==='other'?0:r.rest.length,by=st.then==='month'?'month':'kind of file';
  return `Makes ${pl(nf-inner,'folder')} in ${esc(n.name)}${st.then==='none'?'':inner?`, then ${inner} inside them by ${by}`:`; none is big enough to sort inside by ${by} (3 or more files)`} and files ${pl(moved,'file')}${left?`; ${left} stay${left===1?'s':''} in ${esc(n.name)}`:st.rest==='other'&&r.rest.length?`, ${r.rest.length} in Other`:''}.`};
 const seg=(key,label,opts)=>`<div class="arr-opt" data-arropt="${key}" role="radiogroup" aria-label="${esc(label)}"><span>${esc(label)}</span><div class="arr-seg">${opts.map(([v2,l])=>`<button type="button" role="radio" aria-checked="${String(st[key])===String(v2)}" class="${String(st[key])===String(v2)?'on':''}" data-v="${v2}">${esc(l)}</button>`).join('')}</div></div>`;
 const card=w=>{const on=st.way===w.k&&w.ok;const byId=new Map(w.r.all.map(f=>[f.id,f]));
  return `<button type="button" class="rs-way arr-way${on?' on':''}" data-arrway="${w.k}" ${w.ok?'':'aria-disabled="true" disabled'}><b>${esc(w.l)}</b>${w.ok?`<ul>${w.r.groups.slice(0,on?6:4).map(gp=>`<li><i class="ph-fill ph-folder-simple"></i><span>${esc(gp.name)}</span><em>${gp.files.length}</em></li>${on?`<li class="arr-ex">${gp.files.slice(0,2).map(fid=>esc((byId.get(fid)||{}).name||'')).join(' · ')}</li>`:''}`).join('')}${w.r.rest.length?`<li class="arr-rest"><span>Doesn’t fit</span><em>${w.r.rest.length}</em></li>`:''}</ul>`:`<small class="arr-why">${esc(whyNot(id,w.k,st))}</small>`}</button>`};
 const draw=()=>{const col=isCol();const ws=fits();if(st.way&&!ws.find(w=>w.k===st.way&&w.ok))st.way=null;if(!st.way){const f=ws.find(w=>w.ok);st.way=f?f.k:null}
  const d=frame(`<div class="rs-hd">${col?'<button class="btn ghost rs-bk" data-rsclose><i class="ph ph-arrow-left"></i>Back</button>':''}<div><h2>Arrange ${esc(n.name)}</h2><p>${esc(seen())}</p></div><button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>
  <div class="rs-bd"><section class="rs-q"><b>How should the files in ${esc(n.name)} be arranged?</b>
   <div class="rs-ways arr-ways">${ws.map(card).join('')}</div>
   <input class="field" id="rsat" value="${esc(st.text)}" placeholder="Or say how you want ${esc(n.name)} arranged, like “by assignment, then by week”" aria-label="How you want ${esc(n.name)} arranged"></section>
   <section class="rs-q arr-details"><b>Details</b>
    ${seg('min','Smallest folder',[[2,'2 files'],[3,'3 files'],[5,'5 files']])}
    ${st.way&&!arrGroups(id,st.way,st).rest.length?`<div class="arr-opt" data-arropt="rest"><span>Files that don’t fit</span><small class="arr-all">Every file fits a folder</small></div>`:seg('rest','Files that don’t fit',[['stay','Stay in '+n.name],['other','Go in Other']])}
    ${seg('then','Then inside each folder',[['none','Nothing'],['month','By month'],['kind','By kind of file']])}
    ${kids?seg('deep','Include files in subfolders',[[false,'No'],[true,'Yes']]):''}</section></div>
  <div class="rs-ft"><span class="note" data-arrsum>${st.way?summary():'Nothing picked yet.'}</span><span class="sp"></span><button class="btn" data-rsx>Not Now</button><button class="btn pri" data-arrgo ${st.way?'':'disabled'}><i class="ph ph-eye"></i>Preview Plan</button></div>`,true);
  d.onclick=e=>{if(e.target.closest('[data-rsx]'))return close();if(e.target.closest('[data-rsclose]'))return leave();
   const w=e.target.closest('[data-arrway]');if(w&&!w.disabled){st.way=w.dataset.arrway;st.text='';draw();return}
   const b=e.target.closest('[data-arropt] [data-v]');if(b){const key=b.closest('[data-arropt]').dataset.arropt;let val=b.dataset.v;st[key]=key==='min'?+val:key==='deep'?val==='true':val;draw();return}
   if(e.target.closest('[data-arrgo]')){ANSWERS[id]=st.way;const {out}=ops();const label=st.way==='pick'?`Arranged ${n.name}: Tuck’s pick`:`Arranged ${n.name} ${ARR.find(a=>a[0]===st.way)[1].toLowerCase()}`;
    const again=()=>{S={only:true,onClose:pass.onClose};host=o.inline||null;draw()};
    if(CFG.limits()==='Just Do It'){const row=use([{ty:'batch',label,ops:out}],label);if(row&&isCol())done(row,label);return}
    preview({extra:[{ty:'batch',label,ops:out}],title:`Tuck’s Plan for ${n.name}`,label,back:again})}};
  d.oninput=e=>{if(e.target.id==='rsat'){st.text=e.target.value;const k=st.text?wayOf2(st.text):null;if(k&&k!==st.way){st.way=k;const s2=d.querySelector('[data-arrsum]');d.querySelectorAll('[data-arrway]').forEach(x=>x.classList.toggle('on',x.dataset.arrway===k));s2&&(s2.innerHTML=summary())}}};
  d.onkeydown=e=>{if(e.target.id==='rsat'&&e.key==='Enter'){const g=d.querySelector('[data-arrgo]');g&&!g.disabled&&g.click()}}};draw()}
/* Split…: break one folder into separate folders. Where they go (next to it, in its parent, by default; or inside it), which
   way to start from (the same six as Arrange), every part named and editable with its files (move one file to another part,
   untick it to stay, add or remove a part), names that stay clear next to their siblings, what happens to the original,
   a live summary, then the same before/after preview with Use and Undo. */
function split(o){const v=V();const id=o.nodeId,n=v.node(id);if(!n)return;if(refused(o,'split',`Split ${n.name}`,()=>split(o)))return;menuOff();host=o.inline||null;S={only:true,onClose:o.onClose||null};
 const pass={inline:o.inline,onClose:o.onClose};const par=n.parent&&v.node(n.parent);
 const fsAll=v.files(id).filter(f=>v.level(f.id).level!=='private'),byId=new Map(fsAll.map(f=>[f.id,f])),priv=v.files(id).length-fsAll.length;
 const st={where:par?'next':'inside',prefix:!!par,orig:'keep',way:null,parts:[],open:new Set()};
 const fill=way=>{st.way=way;st.parts=arrGroups(id,way,{min:2}).groups.map(g=>({name:g.name,files:g.files.slice()}));st.open=new Set()};
 {const f=ARRS.find(([k])=>arrGroups(id,k,{min:2}).groups.length>=2);if(f)fill(f[0])}
 const label=pt=>pt.raw?pt.name:(st.where==='next'&&st.prefix?`${n.name} ${pt.name}`:pt.name);
 const placed=()=>new Set(st.parts.flatMap(pt=>pt.files)),stays=()=>fsAll.filter(f=>!placed().has(f.id));
 const canRemove=()=>!stays().length&&!priv&&!v.kids(id).length;
 const ops=()=>{const out=[],to=st.where==='next'?n.parent:id;st.parts.filter(pt=>pt.files.length).forEach(pt=>{const nid=Plan.uid('n');out.push({ty:'newFolder',node:nid,parent:to,name:label(pt)},{ty:'moveFiles',files:pt.files.slice(),to:nid})});
  if(st.orig==='remove'&&canRemove())out.push({ty:'deleteEmpty',node:id});return out};
 const summary=()=>{const ps=st.parts.filter(pt=>pt.files.length),moved=ps.reduce((a,pt)=>a+pt.files.length,0),left=stays().length;if(!ps.length)return 'Nothing picked yet: give a part some files.';
  const where=st.where==='next'?`next to ${n.name}, in ${par.name},`:`inside ${n.name}`;
  return `Makes ${pl(ps.length,'folder')} ${where} and moves ${pl(moved,'file')}. ${st.orig==='remove'&&canRemove()?`${n.name} is removed once it’s empty.`:left?`${pl(left,'file')} stay${left===1?'s':''} in ${n.name}.`:`${n.name} stays, empty.`}${priv?` ${pl(priv,'private file')} stay${priv===1?'s':''} where ${priv===1?'it is':'they are'}.`:''}`};
 const seg=(key,lab,opts,dis)=>`<div class="arr-opt" data-spopt="${key}"><span>${esc(lab)}</span><div class="arr-seg">${opts.map(([v2,l,d])=>`<button type="button" class="${String(st[key])===String(v2)?'on':''}" data-v="${v2}" ${d?`disabled title="${esc(d)}"`:''}>${esc(l)}</button>`).join('')}</div></div>`;
 const fileRow=(fid,pi)=>{const f=byId.get(fid);return `<li data-spfile="${fid}"><label><input type="checkbox" ${pi>=0?'checked':''} aria-label="Move ${esc(f.name)}"><span class="sp-fn">${esc(f.name)}</span></label><button type="button" class="sp-mv" data-spmove="${fid}" aria-haspopup="menu" title="Move to another part">Move<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button></li>`};
 const draw=()=>{const col=isCol();menuOff();const left=stays();
  const d=frame(`<div class="rs-hd">${col?'<button class="btn ghost rs-bk" data-rsclose><i class="ph ph-arrow-left"></i>Back</button>':''}<div><h2>Split ${esc(n.name)}</h2><p>Separate folders next to it. You choose what goes where.</p></div><button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>
  <div class="rs-bd">
   <section class="rs-q">${seg('where','Where the new folders go',[['next',par?`Next to it, in ${par.name}`:'Next to it',par?'':'It is a top folder'],['inside',`Inside ${n.name}`]])}</section>
   <section class="rs-q"><b>Start from</b><div class="sp-ways">${ARRS.map(([k,l])=>{const ok=arrGroups(id,k,{min:2}).groups.length>=2;return `<button type="button" class="sp-way${st.way===k?' on':''}" data-spway="${k}" ${ok?'':`disabled title="${esc(whyNot(id,k,{min:2}))}"`}>${esc(l)}</button>`}).join('')}</div><small>Tuck fills the parts from this way. Then change anything.</small></section>
   <section class="rs-q"><b>Parts</b><ul class="sp-parts">${st.parts.map((pt,i)=>`<li class="sp-part" data-sppart="${i}" data-files="${pt.files.join(',')}" data-names="${esc(pt.files.map(f=>byId.get(f).name).join(' | '))}">
     <div class="sp-row"><button type="button" class="sp-exp" data-spexp="${i}" aria-expanded="${st.open.has(i)}" aria-label="Show files"><i class="ph ph-caret-${st.open.has(i)?'down':'right'}"></i></button><i class="ph-fill ph-folder-simple"></i><input class="field sp-name" data-spname="${i}" value="${esc(label(pt))}" aria-label="Part name"><em>${pt.files.length}</em><button type="button" class="ib sm" data-sprm="${i}" aria-label="Remove this part" title="Remove this part: its files stay in ${esc(n.name)}"><i class="ph ph-x"></i></button></div>
     ${st.open.has(i)?`<ul class="sp-files">${pt.files.map(fid=>fileRow(fid,i)).join('')||'<li class="sp-empty">No files yet. Move some here.</li>'}</ul>`:''}</li>`).join('')}
    <li class="sp-part sp-stay" data-spstay><div class="sp-row"><button type="button" class="sp-exp" data-spexp="stay" aria-expanded="${st.open.has('stay')}" aria-label="Show files"><i class="ph ph-caret-${st.open.has('stay')?'down':'right'}"></i></button><i class="ph ph-folder-simple"></i><span class="sp-stayname">Stays in ${esc(n.name)}</span><em>${left.length}</em></div>
     ${st.open.has('stay')?`<ul class="sp-files">${left.map(f=>fileRow(f.id,-1)).join('')||'<li class="sp-empty">Every file goes to a part.</li>'}</ul>`:''}</li></ul>
    <button type="button" class="btn sm ghost sp-add" data-spadd><i class="ph ph-plus"></i>Add a part</button></section>
   <section class="rs-q arr-details"><b>Details</b>
    ${st.where==='next'?seg('prefix','Names next to its siblings',[[true,`${n.name} Designs`],[false,'Designs']]):''}
    ${seg('orig',`What happens to ${n.name}`,[['keep','Keep it for what stays'],['remove','Remove it once it’s empty',canRemove()?'':(v.kids(id).length?`${n.name} has subfolders`:'Some files still stay in it')]])}</section></div>
  <div class="rs-ft"><span class="note" data-spsum>${summary()}</span><span class="sp"></span><button class="btn" data-rsx>Not Now</button><button class="btn pri" data-spgo ${st.parts.some(pt=>pt.files.length)?'':'disabled'}><i class="ph ph-eye"></i>Preview Plan</button></div>`,true);
  const moveTo=(fid,to)=>{st.parts.forEach(pt=>{pt.files=pt.files.filter(x=>x!==fid)});if(to>=0)st.parts[to].files.push(fid);if(st.orig==='remove'&&!canRemove())st.orig='keep';draw()};
  d.onclick=e=>{const t=e.target;if(t.closest('[data-rsx]'))return close();if(t.closest('[data-rsclose]'))return leave();
   const w=t.closest('[data-spway]');if(w&&!w.disabled){fill(w.dataset.spway);draw();return}
   const b=t.closest('[data-spopt] [data-v]');if(b&&!b.disabled){const key=b.closest('[data-spopt]').dataset.spopt,val=b.dataset.v;st[key]=key==='prefix'?val==='true':val;draw();return}
   const x=t.closest('[data-spexp]');if(x){const k=x.dataset.spexp==='stay'?'stay':+x.dataset.spexp;st.open.has(k)?st.open.delete(k):st.open.add(k);draw();return}
   const rm=t.closest('[data-sprm]');if(rm){st.parts.splice(+rm.dataset.sprm,1);st.open=new Set();if(st.orig==='remove'&&!canRemove())st.orig='keep';draw();return}
   if(t.closest('[data-spadd]')){st.parts.push({name:'New part',files:[]});st.open.add(st.parts.length-1);draw();const ins=d.querySelectorAll('.sp-name');const last=ins[ins.length-1];last&&(last.focus(),last.select());return}
   const mv=t.closest('[data-spmove]');if(mv){const fid=mv.dataset.spmove,cur=st.parts.findIndex(pt=>pt.files.includes(fid));
    const items=st.parts.map((pt,i)=>i===cur?null:[i,label(pt)]).filter(Boolean);if(cur>=0)items.push([-1,`Keep in ${n.name}`]);
    menuOff();menuEl=document.createElement('div');menuEl.className='menu';menuEl.setAttribute('role','menu');menuEl.innerHTML=items.map(([i,l])=>`<button role="menuitem" data-to="${i}"><i class="ph ph-${i<0?'arrow-u-up-left':'folder-simple'}"></i>${esc(l)}</button>`).join('');
    document.body.appendChild(menuEl);const r=mv.getBoundingClientRect(),mw=menuEl.offsetWidth;menuEl.style.cssText=`position:fixed;z-index:var(--z-menu,90);left:${Math.max(8,Math.min(r.right-mw,innerWidth-mw-8))}px;top:${r.bottom+4}px`;mv.setAttribute('aria-expanded','true');
    menuEl.onclick=ev=>{const bb=ev.target.closest('[data-to]');if(bb){moveTo(fid,+bb.dataset.to)}};setTimeout(()=>document.addEventListener('pointerdown',function away(ev){if(menuEl&&!menuEl.contains(ev.target)){menuOff();document.removeEventListener('pointerdown',away,true)}},true),0);return}
   if(t.closest('[data-spgo]')){const out=ops();const lab=`Split ${n.name} into ${pl(st.parts.filter(pt=>pt.files.length).length,'folder')}`;const again=()=>{S={only:true,onClose:pass.onClose};host=o.inline||null;draw()};
    if(CFG.limits()==='Just Do It'){const row=use([{ty:'batch',label:lab,ops:out}],lab);if(row&&isCol())done(row,lab);return}
    preview({extra:[{ty:'batch',label:lab,ops:out}],title:`Tuck’s Plan for ${n.name}`,label:lab,back:again})}};
  d.onchange=e=>{const t=e.target;const cb=t.closest('[data-spfile] input[type=checkbox]');if(cb){const fid=t.closest('[data-spfile]').dataset.spfile,cur=st.parts.findIndex(pt=>pt.files.includes(fid));
    if(!cb.checked&&cur>=0)moveTo(fid,-1);else if(cb.checked&&cur<0){const best=st.parts.findIndex(pt=>pt.files.length)||0;moveTo(fid,best<0?0:best)}return}
   const nm=t.closest('[data-spname]');if(nm){const i=+nm.dataset.spname,val=nm.value.trim(),pre=n.name+' ';if(!val){draw();return}
    if(st.where==='next'&&st.prefix&&val.startsWith(pre)){st.parts[i].name=val.slice(pre.length);st.parts[i].raw=false}else{st.parts[i].name=val;st.parts[i].raw=!(st.where==='next'&&st.prefix)?false:true}draw()}};
  d.onkeydown=e=>{if(e.target.closest('[data-spname]')&&e.key==='Enter'){e.preventDefault();e.target.blur()}}};
 draw()}

/* what someone typed, to a way: "by assignment, then by week" picks kind of work */
const wayOf2=t=>/assign|homework|lab|lecture|work|exam|type of work|for\b/i.test(t)?'thing':/draft|final|version/i.test(t)?'stage':/week/i.test(t)?'week':/month|when|date/i.test(t)?'month':/year/i.test(t)?'year':/kind|type|pdf|photo|image|file/i.test(t)?'kind':'thing';

/* ---------- the one plan preview: Where They Are Now | Tuck's Folders */
/* a small pop-up menu for the preview and Split: items [[label, fn, icon]] */
function rsMenu(btn,items){menuOff();menuEl=document.createElement('div');menuEl.className='menu';menuEl.setAttribute('role','menu');
 menuEl.innerHTML=items.map(([l,,ic],i)=>l==='-'?'<hr>':`<button role="menuitem" data-mi="${i}"><i class="ph ph-${ic||'folder-simple'}"></i>${esc(l)}</button>`).join('');document.body.appendChild(menuEl);
 const r=btn.getBoundingClientRect(),mw=menuEl.offsetWidth,mh=menuEl.offsetHeight;let y=r.bottom+4;if(y+mh>innerHeight-8)y=Math.max(8,r.top-mh-4);
 menuEl.style.cssText=`position:fixed;z-index:var(--z-menu,90);left:${Math.max(8,Math.min(r.right-mw,innerWidth-mw-8))}px;top:${y}px`;btn.setAttribute('aria-expanded','true');
 menuEl.onclick=ev=>{const b=ev.target.closest('[data-mi]');if(b){const f=items[+b.dataset.mi][1];menuOff();btn.setAttribute('aria-expanded','false');f&&f()}};
 setTimeout(()=>document.addEventListener('pointerdown',function away(ev){if(menuEl&&!menuEl.contains(ev.target)){menuOff();btn.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',away,true)}},true),0)}
/* Tuck's plan, editable before you use it: rename a folder, move one file to another folder or keep it where it is, drop a
   new folder (its files go back), add a folder. Every edit redraws the same preview, so the counts and Use follow it. */
const flatOps=ops=>ops.flatMap(x=>x.ty==='batch'?flatOps(x.ops):[Object.assign({},x,x.files?{files:x.files.slice()}:{},x.nodes?{nodes:x.nodes.slice()}:{})]);
function preview(o){if(o.extra&&o.extra.length&&!o._ed){o._ed=flatOps(o.extra);o._label=(o.extra[0]&&o.extra[0].label)||o.label}
 if(o._ed)o.extra=[{ty:'batch',label:o._label||o.label||'Tuck’s plan',ops:o._ed}];
 const cmp=Plan.compare(o.extra&&o.extra.length?o.extra:o.extra?[]:undefined);const {before:B,after:A,moves,newNodes,eff}=cmp;const pendingMode=!o.extra;
 const changed=new Set();moves.forEach(m=>{if(m.from){changed.add('b:'+m.from);if(A.node(m.from))changed.add('a:'+m.from)}if(m.to){changed.add('a:'+m.to);if(B.node(m.to)&&!B.node(m.to).sug)changed.add('b:'+m.to)}});newNodes.forEach(id=>changed.add('a:'+id));
 A.all().forEach(id=>{const b=B.node(id),a=A.node(id);if(b&&a&&!a.sug&&(b.name!==a.name||b.parent!==a.parent||b.hidden!==a.hidden)){changed.add('a:'+id);changed.add('b:'+id)}});
 B.all().forEach(id=>{if(!A.node(id)&&!B.node(id).sug)changed.add('b:'+id)});
 const rel=(V,side)=>{const s=new Set();[...changed].filter(k=>k[0]===side).forEach(k=>{const id=k.slice(2);if(V.node(id))V.pathIds(id).forEach(x=>s.add(x))});return s};
 const relB=rel(B,'b'),relA=rel(A,'a');
 const dests=new Set(moves.map(m=>m.to).filter(Boolean));newNodes.forEach(id=>dests.add(id));
 const folderCount=V=>Plan.folderCount?Plan.folderCount(V):V.all().filter(id=>{const n=V.node(id);return !n.sug&&!n.special&&!n.hidden}).length;const deepest=V=>Math.max(...V.all().filter(id=>!V.node(id).sug).map(id=>V.depth(id)+1));
 const subs=V=>V.all().filter(id=>!V.node(id).sug&&V.depth(id)>0).length;
 /* the header counts the same set as the lists under it (rule 21): the files where they are now, then how many of them move */
 const froms=[...new Set(moves.map(m=>m.from||'loose'))].filter(id=>B.node(id));const tops=froms.filter(id=>!B.pathIds(id).slice(0,-1).some(x=>froms.includes(x)));
 const hereN=o.scopeN!=null?o.scopeN:tops.reduce((a,id)=>a+B.total(id),0);
 const hereName=o.scopeName||(tops.length===1?(tops[0]==='loose'?'No folder yet':B.node(tops[0]).name):pl(tops.length,'folder'));
 const notSure=o.unsure!=null?o.unsure:0,noHome=o.unsure!=null?0:A.files('loose').length;
 /* the third column opens on the folder that changes most, so the before and after are visible at once */
 const firstDest=(()=>{const c={};moves.forEach(m=>{if(m.to)c[m.to]=(c[m.to]||0)+1});const best=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return best?best[0]:newNodes[0]||null})();
 let sel=o._sel!==undefined&&(o._side==='b'?B:A).node(o._sel)?o._sel:A.node(firstDest)?firstDest:null,side=o._side||'a',q=o._q||'';
 const editable=!pendingMode&&!!o._ed;const isNewN=id=>editable&&o._ed.some(x=>x.ty==='newFolder'&&x.node===id);
 const redraw=(extra)=>{menuOff();preview(Object.assign(o,{_sel:sel,_side:side,_q:q},extra||{}))};
 const ed={rename:(id,name)=>{name=String(name||'').trim();if(!name)return;const nf=o._ed.find(x=>x.ty==='newFolder'&&x.node===id);if(nf)nf.name=name;else{o._ed=o._ed.filter(x=>!(x.ty==='rename'&&x.node===id));if(B.node(id)&&B.node(id).name!==name)o._ed.push({ty:'rename',node:id,name})}redraw()},
  drop:id=>{const gone=new Set([id]);let grew=true;while(grew){grew=false;o._ed.forEach(x=>{if(x.ty==='newFolder'&&gone.has(x.parent)&&!gone.has(x.node)){gone.add(x.node);grew=true}})}
   o._ed=o._ed.filter(x=>!(x.ty==='newFolder'&&gone.has(x.node))&&!(x.ty==='moveFiles'&&gone.has(x.to))&&!(x.ty==='accept'&&gone.has(x.node)));if(gone.has(sel)){sel=null}redraw()},
  move:(fid,to)=>{o._ed.forEach(x=>{if(x.ty==='moveFiles')x.files=x.files.filter(f=>f!==fid)});o._ed=o._ed.filter(x=>!(x.ty==='moveFiles'&&!x.files.length));
   if(to){const m=o._ed.find(x=>x.ty==='moveFiles'&&x.to===to);if(m)m.files.push(fid);else o._ed.push({ty:'moveFiles',files:[fid],to})}redraw()},
  add:parent=>{const nid=Plan.uid('n');o._ed.push({ty:'newFolder',node:nid,parent,name:'New Folder'});sel=nid;side='a';redraw({_focus:nid})}};
 const destsAll=()=>[...new Set([...newNodes,...moves.map(m=>m.to).filter(Boolean)])].filter(id=>A.node(id));
 const moveMenu=(btn,fid)=>{const m=moves.find(x=>x.file===fid);const from=m&&m.from;const items=destsAll().filter(id=>!m||id!==m.to).map(id=>[A.path(id).slice(-2).join(' › '),()=>ed.move(fid,id),isNewN(id)?'folder-plus':'folder-simple']);
  items.push(['-'],[`Keep in ${from&&B.node(from)?B.node(from).name:'No folder yet'}`,()=>ed.move(fid,null),'arrow-u-up-left'],['Somewhere else…',()=>{window.FolderPanel&&FolderPanel.pick&&FolderPanel.pick(btn,{title:'Move this file to',newFolder:true}).then(t=>{if(t)ed.move(fid,t)})},'dots-three']);rsMenu(btn,items)};
 const addParent=()=>{if(sel&&side==='a'&&A.node(sel)){return isNewN(sel)?A.node(sel).parent:sel}const n0=newNodes[0];return n0&&A.node(n0)?A.node(n0).parent:(destsAll()[0]||null)};
 const outline=(V,R,sd)=>{const rows=[];const go=(id,d)=>{const n=V.node(id);if(!n||n.sug||!R.has(id))return;rows.push([id,d]);V.kids(id).forEach(k=>go(k,d+1))};
  V.roots().filter(r=>!V.node(r).special).forEach(r=>go(r,0));V.roots().filter(r=>V.node(r).special).forEach(r=>go(r,0));
  return rows.map(([id,d])=>{const n=V.node(id),t=FolderPanel.tile?tileOfV(V,id):{hue:'--k-folder',ic:'folder-simple'};const ch=changed.has(sd+':'+id);const hit=q&&(n.name.toLowerCase().includes(q)||V.files(id).some(f=>f.name.toLowerCase().includes(q)));
   const isNew=sd==='a'&&newNodes.includes(id),ren=sd==='a'&&B.node(id)&&B.node(id).name!==n.name;const gone=sd==='b'&&!A.node(id);
   return `<button class="pv-n${ch?' ch':''}${hit?' hit':''}${sel===id&&side===sd?' on':''}${n.special?' dim':''}" data-pvn="${id}" data-side="${sd}" style="--d:${d}"><i class="ph-fill ph-${t.ic}" style="color:var(${t.hue})"></i><span>${esc(n.name)}</span>${isNew?'<span class="tag new">New</span>':''}${ren?'<span class="tag ren">renamed</span>':''}${gone?'<span class="tag rem">goes away</span>':''}${n.hidden&&sd==='a'?'<span class="tag rem">hidden</span>':''}<em>${V.total(id)}</em></button>`}).join('')||`<p class="pv-empty" style="padding:16px">No folders change here.</p>`};
 const card=()=>{if(!sel)return `<div class="pv-empty"><i class="ph ph-cursor-click" style="color:var(--deco)"></i><span>Click a folder on either side to see what comes in and goes out.</span></div>`;
  const V=side==='a'?A:B,n=V.node(sel);if(!n)return '';const direct=V.files(sel).filter(f=>!q||f.name.toLowerCase().includes(q));
  const inn=moves.filter(m=>m.to===sel),out=moves.filter(m=>m.from===sel);const grp=(arr,key)=>{const g={};arr.forEach(m=>g[m[key]||'']=(g[m[key]||'']||0)+1);return Object.entries(g)};
  const nm=(Vx,id)=>id&&Vx.node(id)?Vx.node(id).name:'No folder yet';
  const pills=side==='a'?grp(inn,'from').map(([id,c])=>`<button data-jump="${id}" data-to="b">${esc(nm(B,id))} <b>${c}</b></button>`).join(''):grp(out,'to').map(([id,c])=>`<button data-jump="${id}" data-to="a">${esc(nm(A,id))} <b>${c}</b></button>`).join('');
  const list=(side==='a'?inn.map(m=>[A.file(m.file),m.from==='loose'||!m.from?'from No folder yet':`from ${nm(B,m.from)}`]):out.map(m=>[B.file(m.file),`to ${nm(A,m.to)}`])).concat(direct.filter(f=>!moves.some(m=>m.file===f.id&&(m.to===sel||m.from===sel))).map(f=>[f,'stays']));
  const isNew=side==='a'&&newNodes.includes(sel);
  const canEd=editable&&side==='a'&&!n.special;
  return `<div class="cr">${esc(V.path(sel).join(' › '))}</div>${canEd?`<div class="pv-ttl"><input class="field" data-pvrename="${sel}" value="${esc(n.name)}" aria-label="Folder name"><i class="ph ph-pencil-simple" aria-hidden="true"></i></div>`:`<h4>${esc(n.name)}</h4>`}<div class="meta">${(()=>{/* one set (m6): a suggestion is not a folder yet, so its files count as directly in this folder and the three numbers add up */const ks=V.kids(sel).filter(k=>!V.node(k).sug);const inKids=ks.reduce((a,k)=>a+V.total(k),0);return `${pl(V.total(sel),'file')} · ${pl(ks.length,'subfolder')} · ${V.total(sel)-inKids} directly in it`})()}</div>
   <div class="meta">${isNew?'A new folder in Tuck.':n.special?'Files with no folder yet.':`An existing folder. ${esc(V.mostly(sel))} in Finder.`}</div>
   ${canEd?`<div class="pv-acts">${isNew?`<button class="btn sm" data-pvdrop="${sel}"><i class="ph ph-x"></i>Don’t make this folder</button>`:''}<button class="btn sm ghost" data-pvaddin="${sel}"><i class="ph ph-folder-plus"></i>Add a folder inside</button></div>`:''}
   ${pills?`<div class="meta">${side==='a'?'Comes from':'Goes to'}</div><div class="pv-pills">${pills}</div>`:''}
   <ul class="pv-files">${list.slice(0,50).map(([f,c])=>`<li>${FolderPanel.thumb(f,'sm')}<span class="n" title="${esc(f.name)}">${esc(mid(f.name,24))}</span><span class="pv-chip">${esc(c)}</span>${canEd&&moves.some(m=>m.file===f.id&&m.to===sel)?`<button class="sp-mv" data-pvmove="${f.id}" aria-haspopup="menu" title="Send this file somewhere else, or keep it where it is">Move<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`:''}</li>`).join('')}</ul>${list.length>50?`<div class="meta">and ${list.length-50} more</div>`:''}`};
 const blocked=CFG.limits()==='Plan Only';
 const useLabel=pendingMode?`Apply ${pl(Plan.pending().length,'Change')}`:newNodes.length===1?'Use This New Folder':newNodes.length?`Use These ${pl(newNodes.length,'New Folder')}`:`Use This Plan`;
 /* asked for new subfolders but none were needed: say so, instead of a plan that pretends */
 const noNew=!pendingMode&&o.reach&&o.reach!=='place_only'&&!newNodes.length;
 /* in a narrow column the plan is a before → after list: each file, where it is now, where Tuck puts it */
 if(isCol()){const nm=(X,id)=>id&&X.node(id)?X.node(id).name:'No folder yet';const goBack=()=>o.back?o.back():S&&!S.only?setup():leave();
  const list=moves.slice().sort((a,b)=>nm(A,a.to).localeCompare(nm(A,b.to))||nm(B,a.from).localeCompare(nm(B,b.from)));const MAX=80;
  const d=frame(`<div class="rs-hd"><div><h2>${esc(o.title||(pendingMode?'Your changes, before and after':'Tuck’s Plan'))}</h2></div></div>${o.flow?stepBar(5,true):''}
   <p class="rs-sub">${pendingMode?'Nothing changes until you apply. One History row, one Undo.':'Look before anything changes. Using it makes one History row with one Undo.'}</p>
   <div class="rs-bd">${o.empty?`<div class="pc-done"><i class="ph-fill ph-check-circle"></i><b>Your folders already fit these files. Nothing to change.</b></div>`:`
    <div class="pc-strip"><span><b>${pl(moves.length,'file')}</b> ${moves.length===1?'moves':'move'} in Tuck, of ${pl(hereN,'file')} in ${esc(hereName)}</span>${notSure?`<span>${notSure} not sure yet: they stay in No folder yet</span>`:''}${noHome?`<span>${noHome} still in No folder yet</span>`:''}${noNew?'<span>No new subfolders needed: your folders already fit</span>':''}<span class="safe"><i class="ph ph-shield-check"></i>Nothing moves on disk</span></div>
    ${newNodes.length?(editable?`<div class="pc-news pc-ed"><span class="tag new">${pl(newNodes.length,'new folder')}</span>${newNodes.map(id=>`<div class="pc-nf"><i class="ph-fill ph-folder-simple"></i><input class="field" data-pvrename="${id}" value="${esc(nm(A,id))}" aria-label="Folder name"><button class="ib sm" data-pvdrop="${id}" aria-label="Don’t make ${esc(nm(A,id))}" title="Don’t make this folder: its files go back"><i class="ph ph-x"></i></button></div>`).join('')}<button class="btn sm ghost" data-pvadd><i class="ph ph-plus"></i>Add a folder</button></div>`:`<div class="pc-news"><span class="tag new">${pl(newNodes.length,'new folder')}</span><span>${newNodes.map(id=>esc(nm(A,id))).join(', ')}</span></div>`):''}
    <ul class="pc-list" aria-label="Before and after">${list.slice(0,MAX).map(m=>{const f=A.file(m.file)||B.file(m.file);return f?`<li>${window.FolderPanel?FolderPanel.thumb(f,'sm'):''}<span class="pc-t"><span class="n" title="${esc(f.name)}">${esc(f.name)}</span><span class="ft"><span>${esc(nm(B,m.from))}</span><i class="ph ph-arrow-right" aria-label="to"></i><b>${esc(nm(A,m.to))}</b></span></span>${editable?`<button class="sp-mv" data-pvmove="${m.file}" aria-haspopup="menu" title="Send it somewhere else, or keep it where it is">Move<i class="ph ph-caret-down pcaret" aria-hidden="true"></i></button>`:''}</li>`:''}).join('')}</ul>${list.length>MAX?`<p class="rs-none">and ${list.length-MAX} more</p>`:''}`}</div>
   <div class="rs-ft"><button class="btn ghost" data-rsback><i class="ph ph-arrow-left"></i>Back</button><span class="sp"></span>${o.empty?'':blocked?'<span class="note">Plan Only is on in Limits.</span>':`<button class="btn pri grow" data-rsuse><i class="ph ph-check"></i>${useLabel}</button>`}</div>`,true);
  d.onchange=e=>{const r=e.target.closest('[data-pvrename]');if(r)ed.rename(r.dataset.pvrename,r.value)};
  d.addEventListener('keydown',e=>{const r=e.target.closest('[data-pvrename]');if(r&&e.key==='Enter'){e.preventDefault();e.stopPropagation();r.blur()}});
  if(o._focus){const f=d.querySelector(`[data-pvrename="${o._focus}"]`);o._focus=null;f&&setTimeout(()=>{f.focus();f.select()},0)}
  d.onclick=e=>{if(e.target.closest('[data-rsback]'))return goBack();
   const dr=e.target.closest('[data-pvdrop]');if(dr)return ed.drop(dr.dataset.pvdrop);if(e.target.closest('[data-pvadd]'))return ed.add(addParent());
   const mv=e.target.closest('[data-pvmove]');if(mv)return moveMenu(mv,mv.dataset.pvmove);
   if(e.target.closest('[data-rsuse]')){if(pendingMode){o.onUse&&o.onUse();return goBack()}const label=o.label||'Used Tuck’s plan';const row=use(o.extra,label);if(!row)return;o.onUse&&o.onUse(row);done(row,label)}};
  return}
 const draw=()=>{const d=frame(`<div class="rs-hd"><div><h2>${esc(o.title||(pendingMode?'Your changes, before and after':'Tuck’s Plan'))}</h2><p>${pendingMode?'Nothing changes until you apply. One History row, one Undo.':'Look before anything changes. Using it makes one History row with one Undo.'}</p></div><label class="search pv-search"><i class="ph ph-magnifying-glass"></i><input id="pvq" value="${esc(q)}" placeholder="Search both sides" aria-label="Search both sides"></label><button class="ib" data-rsx aria-label="Close"><i class="ph ph-x"></i></button></div>${o.flow?stepBar(5,false):''}
  <div class="rs-bd">${o.empty?`<div class="pv-empty"><i class="ph-fill ph-check-circle"></i><b>Your folders already fit these files. Nothing to change.</b></div>`:`
   <div class="pv-strip"><span><i class="ph ph-files"></i><span><b>${pl(hereN,'file')}</b> in ${esc(hereName)} now</span></span><i class="ph ph-arrow-right"></i><span><span><b>${pl(folderCount(A),'folder')}</b>, ${pl(subs(A),'subfolder')}, ${deepest(A)} deep</span></span>
    <span><b>${pl(moves.length,'file')}</b> ${moves.length===1?'moves':'move'}</span>${newNodes.length?`<span><span class="tag new">${pl(newNodes.length,'new folder')}</span></span>`:noNew?'<span>No new subfolders needed: your folders already fit</span>':''}${notSure?`<span>${notSure} not sure yet</span>`:''}${noHome?`<span>${noHome} still in No folder yet</span>`:''}<span class="safe"><i class="ph ph-shield-check"></i>Nothing moves on disk</span></div>
   <div class="pv-grid"><section class="pv-side" aria-label="Where They Are Now"><h3>Where They Are Now<small>${pl(folderCount(B),'folder')}</small></h3>${outline(B,relB,'b')}</section>
    <section class="pv-side" aria-label="Tuck’s Folders"><h3>${pendingMode?'After Apply':'Tuck’s Folders'}<small>${pl(folderCount(A),'folder')}</small>${editable?'<button class="btn sm ghost pv-add" data-pvadd><i class="ph ph-plus"></i>Add a folder</button>':''}</h3>${outline(A,relA,'a')}</section>
    <section class="pv-card" aria-live="polite">${card()}</section></div>`}</div>
  <div class="rs-ft">${o.back?'<button class="btn ghost" data-rsback><i class="ph ph-arrow-left"></i>Back</button>':''}<span class="note">${blocked&&!o.empty?'Plan Only is on in Limits and Permissions.':''}</span><span class="sp"></span><button class="btn" data-rsx>${o.empty?'Done':'Not Now'}</button>${o.empty||blocked?'':`<button class="btn pri" data-rsuse><i class="ph ph-check"></i>${useLabel}</button>`}</div>`,true);
  d.onclick=e=>{if(e.target.closest('[data-rsx]'))return close();if(e.target.closest('[data-rsback]'))return o.back();
   const n=e.target.closest('[data-pvn]');if(n){sel=n.dataset.pvn;side=n.dataset.side;draw();return}
   const dr=e.target.closest('[data-pvdrop]');if(dr)return ed.drop(dr.dataset.pvdrop);
   const ai=e.target.closest('[data-pvaddin]');if(ai)return ed.add(ai.dataset.pvaddin);
   if(e.target.closest('[data-pvadd]'))return ed.add(addParent());
   const mv=e.target.closest('[data-pvmove]');if(mv)return moveMenu(mv,mv.dataset.pvmove);
   const j=e.target.closest('[data-jump]');if(j){sel=j.dataset.jump||'loose';side=j.dataset.to;draw();return}
   if(e.target.closest('[data-rsuse]')){close();if(pendingMode){o.onUse&&o.onUse()}else{const row=use(o.extra,o.label||'Used Tuck’s plan');if(row)o.onUse&&o.onUse(row)}}};
  d.onchange=e=>{const r=e.target.closest('[data-pvrename]');if(r)ed.rename(r.dataset.pvrename,r.value)};
  d.addEventListener('keydown',e=>{const r=e.target.closest('[data-pvrename]');if(r&&e.key==='Enter'){e.preventDefault();e.stopPropagation();r.blur()}});
  if(o._focus){const f=d.querySelector(`[data-pvrename="${o._focus}"]`);o._focus=null;f&&setTimeout(()=>{f.focus();f.select()},0)}
  const qi=d.querySelector('#pvq');qi.oninput=()=>{q=qi.value.trim().toLowerCase();const pos=qi.selectionStart;draw();const n2=back.querySelector('#pvq');n2.focus();n2.setSelectionRange(pos,pos)}};
 draw()}
/* the panel's look (rule 28): the part's colour and icon from sample.js partStyle; private keeps the colour and gets the lock icon */
function tileOfV(V,id){const n=V.node(id),a=V.area(id);const priv=V.level(id).level==='private';const ps=window.partStyle?partStyle(n.special?'loose':V.pathIds(id)[0]):null;if(ps)a.ic=ps.ic;return {hue:ps?ps.hue:a.hue,ic:V.depth(id)===0?(n.special?'tray':a.ic||'folder-simple'):priv?'folder-simple-lock':'folder-simple'}}

window.Resort={open,suggest,arrange,split,preview,close,isOpen:()=>!!back||inlineOn(),config:c=>Object.assign(CFG,c),_planFor:planFor,_scope:scopeFiles,
 _picked:()=>S?{nodeIds:[...S.nodes],fileIds:[...S.files]}:null};
})();
