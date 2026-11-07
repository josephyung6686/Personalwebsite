/* The one "tell Tuck" box (findings item 30). Used by Needs You, Edit Folders, the right panel, Brain, the launcher and
   the side chat. A rounded field with send on the right; Return sends; 2 or 3 suggestion chips under it.
   Tuck lives inside the right end of the field: he slides up with a hop when you focus or type (listening: head tilted),
   sways while the answer is worked out (thinking), then answers in a small bubble just under the field (it takes the chips' place, so it never covers the card), with Undo when the
   reply gives one. Undo stays until the next send. A real change: he hops, happy. A refusal or a failure: his own oops pose, then back to idle.
   Reduce Motion: no slide, hop or sway; each mood is simply its pose, and the bubble still shows.

   Composer.mount(host, {placeholder, chips, onSend(text, context) -> Promise<{reply, undo?, tone?}|void>, context, label, onMood(mood)})
   returns {el, input, focus, clear, setChips, setPlaceholder, setContext, say(text, {undo, tone}), mood(k), destroy}.
   Moods: idle, listen, think, happy, oops. Tones for say: happy, oops, error (oops, and the words in red).
   If onSend resolves with nothing, no bubble shows (the side chat writes its answer into its own log). */
window.Composer=(function(){
  const RM=matchMedia('(prefers-reduced-motion: reduce)');
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const P=k=>(window.POSES||{})[k]||(window.POSES||{}).idle||'';
  const UNDONE=['Undone.','Undone. Back as it was.','All back where it was.'],SORRY=/^(I couldn’t|I can’t|That didn’t|That couldn’t|Nothing is waiting)/;
  function css(){if(document.getElementById('tkccss'))return;const st=document.createElement('style');st.id='tkccss';st.textContent=`
.tkc{position:relative;display:grid;gap:8px;min-width:0}
.tkc-box{position:relative;display:flex;align-items:center;height:40px;padding:0 4px 0 0;border-radius:12px;background:var(--soft);overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--line);transition:background .2s var(--ease),box-shadow .2s var(--ease)}
.tkc-box:focus-within{background:var(--win);box-shadow:inset 0 0 0 1px var(--ac),0 0 0 3px var(--ac-fill)}
.tkc-in{flex:1;min-width:0;height:100%;border:0;background:none;outline:0;padding:0 40px 0 14px;font:500 14px var(--f);color:var(--ink);text-overflow:ellipsis}
.tkc-in::placeholder{color:var(--ink3)}
.tkc-send{flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--ac-btn);color:#fff;font-size:16px;transition:background .15s var(--ease),transform .15s var(--ease)}
.tkc-send:hover{background:var(--ac-btn-hi)}.tkc-send:active{transform:translateY(1px)}
.tkc-send:disabled{background:var(--soft2);color:var(--ink3)}
.tkc-tk{position:absolute;right:40px;bottom:-3px;width:30px;height:33px;pointer-events:none;transform:translateY(105%);transition:transform .38s var(--spring)}
.tkc-tk img{display:block;width:100%;height:100%;transform-origin:50% 90%;transition:transform .25s var(--ease)}
.tkc.up .tkc-tk{transform:translateY(0)}
.tkc.think .tkc-tk img{animation:tkcthink 1.3s ease-in-out infinite}
@keyframes tkcthink{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) translateY(-1px)}}
.tkc-chips{display:flex;flex-wrap:wrap;gap:8px}
.tkc-chips:empty{display:none}
.tkc-chips button{height:24px;max-width:100%;padding:0 8px;border-radius:8px;background:var(--soft);color:var(--ink2);font:500 12px/24px var(--f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s var(--ease),color .15s var(--ease)}
.tkc-chips button:hover{background:var(--soft2);color:var(--ink)}
.tkc-bub{display:none;position:relative;justify-self:end;align-items:center;gap:8px;max-width:100%;margin-top:4px;padding:8px 8px 8px 12px;border-radius:12px;background:var(--win);
  box-shadow:var(--sh-pop);font:500 14px/1.4 var(--f);color:var(--ink)}
.tkc-bub::before{content:"";position:absolute;top:-5px;right:44px;width:10px;height:10px;background:inherit;transform:rotate(45deg);border-radius:2px 0 0 0;box-shadow:-1px -1px 0 0 var(--line)}
.tkc.say .tkc-bub{display:flex}.tkc.say .tkc-chips{display:none}
.tkc-bub span{flex:1;min-width:0}
.tkc-bub.err span{color:var(--danger)}
.tkc-bub .btn{flex:none}
.tkc-bub:not(:has(.btn)){padding-right:12px}
@media (prefers-reduced-motion:reduce){.tkc-tk,.tkc-tk img{transition:none!important}.tkc.think .tkc-tk img{animation:none}}`;document.head.appendChild(st)}

  function mount(host,o={}){
    css();if(typeof host==='string')host=document.querySelector(host);
    let ctx=o.context,busy=false,bubT=0,hideT=0,blinkT=0,moodT=0,cur='idle',undoSaid=0;
    const el=document.createElement('div');el.className='tkc';
    el.innerHTML=`<div class="tkc-box"><input class="tkc-in" type="text" autocomplete="off" spellcheck="false" aria-label="${esc(o.label||'Tell Tuck')}"><span class="tkc-tk" aria-hidden="true"><img alt="" src="${P('idle')}"></span><button class="tkc-send" type="button" aria-label="Send" disabled><i class="ph ph-arrow-up"></i></button></div><div class="tkc-chips"></div><div class="tkc-bub" role="status" aria-live="polite"><span></span></div>`;
    host.appendChild(el);
    const inp=el.querySelector('.tkc-in'),send=el.querySelector('.tkc-send'),tk=el.querySelector('.tkc-tk'),img=tk.querySelector('img'),bub=el.querySelector('.tkc-bub'),chipsEl=el.querySelector('.tkc-chips');
    const pose=k=>{img.src=P(k)};
    /* one mood at a time. Happy and oops pass; listening and thinking stay until something changes. Reduce Motion: the pose alone */
    function mood(k){clearTimeout(moodT);cur=k;el.classList.toggle('listen',k==='listen');el.classList.toggle('think',k==='think');
      if(k!=='idle')up();pose(k);
      if(k==='happy'&&!RM.matches)img.animate([{transform:'none'},{transform:'translateY(-5px)'},{transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.8,.3,1)'});
      if(k==='oops'&&!RM.matches)img.animate([{transform:'none'},{transform:'rotate(-5deg)'},{transform:'rotate(4deg)'},{transform:'none'}],{duration:360,easing:'ease-out'});
      if(k==='happy'||k==='oops')moodT=setTimeout(()=>{if(cur===k)mood(document.activeElement===inp?'listen':'idle')},k==='oops'?2400:1600);
      if(k==='idle'&&!busy){clearTimeout(hideT);hideT=setTimeout(down,400)}
      if(o.onMood)o.onMood(k)}
    function setPlaceholder(t){inp.placeholder=t||'Tell Tuck what you want…'}
    function setChips(list){chipsEl.innerHTML=(list||[]).slice(0,3).map(c=>`<button type="button">${esc(c)}</button>`).join('')}
    setPlaceholder(o.placeholder);setChips(o.chips);

    /* Tuck pops up: slide + hop on the way in, head tilted while he listens, a blink now and then */
    function up(){clearTimeout(hideT);if(el.classList.contains('up'))return;el.classList.add('up');pose('idle');
      if(!RM.matches)tk.animate([{transform:'translateY(105%)'},{transform:'translateY(-7px)',offset:.62},{transform:'translateY(1px)',offset:.84},{transform:'translateY(0)'}],{duration:440,easing:'cubic-bezier(.2,.8,.3,1)'});
      blink()}
    function blink(){clearTimeout(blinkT);blinkT=setTimeout(()=>{if(el.classList.contains('listen')&&!busy){pose('blink');setTimeout(()=>{if(!busy&&img.src===P('blink'))pose(cur)},140)}if(el.classList.contains('up'))blink()},2600+Math.random()*2400)}
    function down(){if(busy||el.classList.contains('say')||document.activeElement===inp||inp.value)return;el.classList.remove('up','listen');clearTimeout(blinkT)}
    const listen=()=>{if(busy||cur==='listen')return;up();mood('listen')};
    inp.addEventListener('focus',listen);
    inp.addEventListener('blur',()=>{if(cur==='listen')mood('idle');hideT=setTimeout(down,220)});
    inp.addEventListener('input',()=>{send.disabled=!inp.value.trim()||busy;if(inp.value)listen()});
    inp.addEventListener('keydown',e=>{if(e.key!=='Escape')e.stopPropagation();if(e.key==='Enter'&&!e.isComposing){e.preventDefault();go(inp.value)}});
    send.addEventListener('click',()=>go(inp.value));
    chipsEl.addEventListener('click',e=>{const b=e.target.closest('button');b&&go(b.textContent)});
    bub.addEventListener('pointerenter',()=>clearTimeout(bubT));bub.addEventListener('pointerleave',()=>schedule(3000));

    function schedule(ms){clearTimeout(bubT);bubT=setTimeout(()=>{el.classList.remove('say');if(cur!=='listen')mood('idle');hideT=setTimeout(down,250)},ms)}
    function say(text,{undo,tone}={}){up();el.classList.remove('think');
      bub.classList.toggle('err',tone==='error');bub.innerHTML=`<span>${esc(text)}</span>${undo?'<button class="btn sm" type="button">Undo</button>':''}`;
      const u=bub.querySelector('.btn');if(u)u.onclick=async()=>{u.disabled=true;let res;try{res=await undo()}catch(e){say((e&&e.message)||'I couldn’t undo that. Nothing changed.',{tone:'error'});return}
        if(res&&res.ok===false){say(res.reason||'I couldn’t undo that. Nothing changed.',{tone:'error'});return}say(UNDONE[undoSaid++%UNDONE.length]);schedule(1600)};
      const was=el.classList.contains('say');el.classList.add('say');if(!was&&!RM.matches)bub.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(.16,1,.3,1)'});
      mood(tone==='error'||tone==='oops'?'oops':tone==='happy'?'happy':document.activeElement===inp?'listen':'idle');
      if(undo)clearTimeout(bubT);else schedule(4200)}

    async function go(text){text=String(text||'').trim();if(!text||busy||!o.onSend)return;
      busy=true;inp.value='';send.disabled=true;clearTimeout(bubT);el.classList.remove('say');up();mood('think');
      let r;try{r=await o.onSend(text,ctx)}catch(e){busy=false;say((e&&e.message)||'I couldn’t do that. Nothing changed.',{tone:'error'});return}
      busy=false;
      if(r&&r.reply)say(r.reply,{undo:r.undo,tone:r.tone||(r.undo?'happy':SORRY.test(r.reply)?'oops':'')});else if(o.hostMood){if(cur==='idle'&&document.activeElement===inp)mood('listen')}else if(cur==='think')mood(document.activeElement===inp?'listen':'idle')}

    return {el,input:inp,focus:()=>inp.focus(),clear:()=>{inp.value='';send.disabled=true},setChips,setPlaceholder,setContext:c=>{ctx=c},say,
      send:go,mood,destroy:()=>{clearTimeout(bubT);clearTimeout(hideT);clearTimeout(blinkT);clearTimeout(moodT);el.remove()}}}
  return {mount}})();
