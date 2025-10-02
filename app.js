// app.js
(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
  } else {
    initApp();
  }

  function initApp() {
    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));
    const toast = (m, t=1600) => {
      const el=$("#toast");
      if(!el) return;
      el.textContent=m;
      el.classList.add("show");
      clearTimeout(el._t);
      el._t=setTimeout(()=>el.classList.remove("show"),t);
    };

    // Tabs
    const tabsList = document.querySelector('.tabs');
    const sections = Array.from(document.querySelectorAll('.section'));
    if (tabsList) {
      tabsList.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab || !tabsList.contains(tab)) return;
        const id = tab.dataset.tab;
        const target = document.getElementById(id);
        if (!target) return;

        tabsList.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        sections.forEach(s => s.classList.remove('active'));

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        target.classList.add('active');
      }, { passive:true });

      const active = tabsList.querySelector('.tab.active') || tabsList.querySelector('.tab');
      if (active) {
        const id = active.dataset.tab;
        const target = document.getElementById(id);
        if (target) {
          sections.forEach(s => s.classList.remove('active'));
          target.classList.add('active');
        }
      }
    }

    // ---------- WORDLE ----------
    const W = {
      len: Number(localStorage.getItem("w.len")||5),
      answer: localStorage.getItem("w.answer")||"",
      daily: localStorage.getItem("w.daily")==="1",
      row: 0, col:0, maxRows:6, board:[], states:[], keyState:{}, finished:false
    };
    const wBoard=$("#w-board"), wKbrd=$("#w-kbrd");
    const wLen=$("#w-len"), wAns=$("#w-answer"), wDaily=$("#w-daily");
    if (wLen) wLen.value=W.len;
    if (wAns) wAns.value=W.answer;
    if (wDaily) wDaily.checked=W.daily;

    const emptyBoard = ()=> Array.from({length:W.maxRows}, ()=> Array.from({length:W.len}, ()=>""));
    const emptyStates= ()=> Array.from({length:W.maxRows}, ()=> Array.from({length:W.len}, ()=>""));
    const setCSSLen=()=>document.documentElement.style.setProperty("--len", W.len);

    const seedDaily=()=>{
      const d=new Date();
      const key=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
      if(!W.answer){
        const pool=["REACT","STATE","HOOKS","ARRAY","PROXY","INPUT","MOUSE","TOUCH","THEME","CACHE","FOCUS"];
        const s=key.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
        W.answer=pool[s%pool.length];
      }
    };

    const buildKeyboard=()=>{
      if(!wKbrd) return;
      wKbrd.innerHTML="";
      const mk=(label,cls="")=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="key "+cls;
        b.textContent=label;
        b.dataset.k=label;
        b.setAttribute("aria-label",label==="⌫"?"Backspace":label);
        b.addEventListener("click",()=>handleKey(label));
        return b;
      };
      [["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["ENTER","Z","X","C","V","B","N","M","⌫"]]
        .forEach(r=>r.forEach(k=>wKbrd.appendChild(mk(k,(k==="ENTER"||k==="⌫")?"wide":""))));
      updateKeyboardStates();
    };

    const renderBoard=()=>{
      if(!wBoard) return;
      wBoard.innerHTML="";
      wBoard.style.gridTemplateRows=`repeat(${W.maxRows}, auto)`;
      for(let r=0;r<W.maxRows;r++){
        const row=document.createElement("div");
        row.className="row-tiles";
        row.style.setProperty("--len", W.len);
        for(let c=0;c<W.len;c++){
          const t=document.createElement("div");
          t.className="tile";
          t.textContent=W.board[r]?.[c]||"";
          const st=W.states[r]?.[c];
          if(st==="correct") t.style.background=getComputedStyle(document.documentElement).getPropertyValue("--green");
          if(st==="present") t.style.background=getComputedStyle(document.documentElement).getPropertyValue("--yellow");
          if(st==="absent") t.style.background=getComputedStyle(document.documentElement).getPropertyValue("--gray");
          row.appendChild(t);
        }
        wBoard.appendChild(row);
      }
    };

    const updateKeyboardStates=()=>{
      document.querySelectorAll(".key").forEach(k=>{
        const ch=k.dataset.k.toUpperCase();
        k.classList.remove("state-absent","state-present","state-correct");
        if(ch.length===1 && W.keyState[ch]) k.classList.add("state-"+W.keyState[ch]);
      });
    };

    const evaluateRow=(guess,answer)=>{
      const res=Array(W.len).fill("absent");
      const counts={};
      for(let i=0;i<W.len;i++){ const a=answer[i]; counts[a]=(counts[a]||0)+1; }
      for(let i=0;i<W.len;i++){ if(guess[i]===answer[i]){ res[i]="correct"; counts[guess[i]]--; } }
      for(let i=0;i<W.len;i++){
        if(res[i]!=="correct"){
          const g=guess[i];
          if(counts[g]>0){ res[i]="present"; counts[g]--; }
        }
      }
      return res;
    };

    const commitRow=()=>{
      const word=W.board[W.row].join("");
      if(word.length!==W.len){ toast("Not enough letters"); return; }
      if(!/^[A-Z]+$/.test(word)){ toast("Only letters A–Z"); return; }
      const ans=(W.answer||"").toUpperCase();
      if(!ans){ toast("Answer not set in Admin"); return; }
      const res=evaluateRow(word,ans);
      W.states[W.row]=res;
      for(let i=0;i<W.len;i++){
        const ch=word[i], st=res[i], prev=W.keyState[ch], rank={absent:0,present:1,correct:2};
        if(!prev || rank[st]>rank[prev]) W.keyState[ch]=st;
      }
      renderBoard(); updateKeyboardStates();
      if(res.every(s=>s==="correct")){ W.finished=true; toast("Solved!"); }
      else if(W.row===W.maxRows-1){ W.finished=true; toast("Answer: "+ans); }
      else { W.row++; W.col=0; }
      persistWordle();
    };

    const handleKey=(k)=>{
      if(W.finished) return;
      if(k==="ENTER") return commitRow();
      if(k==="⌫"||k==="BACKSPACE"){
        if(W.col>0){ W.col--; W.board[W.row][W.col]=""; renderBoard(); }
        return;
      }
      if(k.length===1 && /[A-Za-z]/.test(k)){
        if(W.col<W.len){
          W.board[W.row][W.col]=k.toUpperCase();
          W.col++; renderBoard();
        }
      }
    };

    document.addEventListener("keydown",(e)=>{
      const visible = document.getElementById("wordle")?.classList.contains("active");
      if(!visible) return;
      const k=e.key;
      if(k==="Enter") return handleKey("ENTER");
      if(k==="Backspace") return handleKey("⌫");
      if(k.length===1) return handleKey(k.toUpperCase());
    },{passive:true});

    const persistWordle=()=>{
      localStorage.setItem("w.len", String(W.len));
      localStorage.setItem("w.answer", W.answer||"");
      localStorage.setItem("w.daily", W.daily?"1":"0");
      localStorage.setItem("w.state", JSON.stringify({
        row:W.row,col:W.col,board:W.board,states:W.states,keyState:W.keyState,finished:W.finished
      }));
    };

    const restoreWordle=()=>{
      const state=localStorage.getItem("w.state");
      if(state){
        try{
          const s=JSON.parse(state);
          Object.assign(W,{row:s.row,col:s.col,board:s.board,states:s.states,keyState:s.keyState||{},finished:!!s.finished});
        }catch{}
      }
      if(!W.board?.length){ W.board=emptyBoard(); W.states=emptyStates(); }
    };

    const newWordle=()=>{
      W.len=Math.max(4,Math.min(8,Number(wLen?.value||W.len)||5));
      setCSSLen();
      const inputAns=(wAns?.value||"").toUpperCase().replace(/[^A-Z]/g,"");
      if(W.daily){
        W.answer = inputAns && inputAns.length===W.len ? inputAns : "";
        seedDaily();
      } else {
        W.answer = inputAns && inputAns.length===W.len ? inputAns : "";
        if(!W.answer) toast("Provide an answer matching length");
      }
      W.row=0; W.col=0; W.board=emptyBoard(); W.states=emptyStates(); W.keyState={}; W.finished=false;
      renderBoard(); buildKeyboard(); persistWordle(); toast("Wordle settings committed");
    };

    const resetWordle=()=>{
      W.row=0; W.col=0; W.board=emptyBoard(); W.states=emptyStates(); W.keyState={}; W.finished=false;
      renderBoard(); buildKeyboard(); persistWordle(); toast("Wordle reset");
    };

    $("#w-new")?.addEventListener("click", newWordle);
    $("#w-admin-reset")?.addEventListener("click", resetWordle);
    $("#w-play-reset")?.addEventListener("click", resetWordle);
    $("#w-share")?.addEventListener("click", ()=>{
      const rows=W.board.slice(0, W.row + (W.finished?1:0));
      const em=rows.map((row,i)=> row.map((_,j)=>{
        const st=W.states[i]?.[j];
        return st==="correct"?"🟩":st==="present"?"🟨":"⬛";
      }).join("")).join("\n");
      const txt=`Wordle ${W.len}/${W.maxRows}\n${em}`;
      if(navigator.share){
        navigator.share({text:txt}).catch(()=>{
          navigator.clipboard.writeText(txt);
          toast("Copied result");
        });
      } else {
        navigator.clipboard.writeText(txt);
        toast("Copied result");
      }
    });

    setCSSLen(); buildKeyboard(); restoreWordle(); renderBoard();

    // ---------- CROSSWORD ----------
    const CW={ size:11, cells:[], focus:{row:0,col:0,dir:"across"} };
    const cwGrid=$("#cw-grid"), cwAcross=$("#cw-across"), cwDown=$("#cw-down");
    const cwJSON=$("#cw-json");
    let placedClues=[]; // {dir,row,col,answer,clue,num}

    // Zoom & pan
    const viewport=document.querySelector('.cw-viewport');
    const canvas=document.querySelector('.cw-canvas');
    let zoom=1, minZoom=0.8, maxZoom=2.4;
    let panX=0, panY=0, startDist=0, startZoom=1, isPanning=false, panStart={x:0,y:0};
    const applyTransform=()=>{ canvas.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`; };
    const getDist=(t1,t2)=> Math.hypot(t1.clientX-t2.clientX, t1.clientY-t2.clientY);

    viewport.addEventListener('touchstart',(e)=>{
      if(e.touches.length===2){
        startDist=getDist(e.touches[0], e.touches[1]);
        startZoom=zoom;
      } else if(e.touches.length===1){
        isPanning=true;
        panStart={x:e.touches[0].clientX - panX, y:e.touches[0].clientY - panY};
      }
    },{passive:true});
    viewport.addEventListener('touchmove',(e)=>{
      if(e.touches.length===2){
        const dist=getDist(e.touches[0], e.touches[1]);
        const scale=dist/startDist;
        const prevZoom=zoom;
        zoom=Math.max(minZoom, Math.min(maxZoom, startZoom*scale));
        const vRect=viewport.getBoundingClientRect();
        const mid={x:vRect.left+vRect.width/2,y:vRect.top+vRect.height/2};
        panX = mid.x - (mid.x - panX) * (zoom/prevZoom);
        panY = mid.y - (mid.y - panY) * (zoom/prevZoom);
        applyTransform();
      } else if(e.touches.length===1 && isPanning){
        panX=e.touches[0].clientX - panStart.x;
        panY=e.touches[0].clientY - panStart.y;
        applyTransform();
      }
    },{passive:true});
    viewport.addEventListener('touchend',(e)=>{
      if(e.touches.length<2){ startDist=0; }
      if(e.touches.length===0){ isPanning=false; }
    },{passive:true});

    const centerOnCell=(r,c)=>{
      const grid=document.getElementById('cw-grid');
      const cell=grid?.children[r*CW.size + c];
      if(!cell) return;
      const vRect=viewport.getBoundingClientRect();
      const cRect=cell.getBoundingClientRect();
      const cx = (cRect.left + cRect.right)/2;
      const cy = (cRect.top + cRect.bottom)/2;
      const vx = vRect.left + vRect.width/2;
      const vy = vRect.top + vRect.height/2;
      panX += (vx - cx);
      panY += (vy - cy);
      applyTransform();
    };

    const allocGrid=n=>Array.from({length:n},()=> Array.from({length:n},()=>({char:"",black:false,number:null,disabled:false})));

    const renderCWGrid=()=>{
      if(!cwGrid) return;
      cwGrid.innerHTML="";
      cwGrid.style.gridTemplateColumns=`repeat(${CW.size}, 36px)`;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const cell=CW.cells[r][c];
          const d=document.createElement("div");
          d.className="cw-cell"+(cell.black?" black":"")+(cell.disabled?" disabled":"");
          if(cell.number && !cell.black){
            const n=document.createElement("div");
            n.className="cw-num"; n.textContent=cell.number; d.appendChild(n);
          }
          if(!cell.black){
            const chDiv=document.createElement("div");
            chDiv.className="cw-letter"; chDiv.textContent=cell.char||"";
            d.appendChild(chDiv);
            const inp=document.createElement("input");
            inp.setAttribute("aria-label",`Row ${r+1} Col ${c+1}`);
            inp.disabled = !!cell.disabled;
            d.appendChild(inp);
            ((rr,cc,inputEl,wrap)=>{
              let lastTap=0;
              wrap.addEventListener("click", ()=>{
                if(inputEl.disabled) return;
                const now=Date.now();
                if(CW.focus.row===rr && CW.focus.col===cc && now-lastTap<300){
                  CW.focus.dir = CW.focus.dir==="across" ? "down" : "across";
                }
                lastTap=now;
                CW.focus={row:rr,col:cc,dir:CW.focus.dir};
                highlightFocus(); updateActiveClueHeader(); centerOnCell(rr,cc); highlightActiveWord();
              });
              inputEl.addEventListener("input",(e)=>{
                if(inputEl.disabled) return;
                const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,"");
                if(v){ CW.cells[rr][cc].char=v.slice(-1); moveNextInWord(rr,cc); } else { CW.cells[rr][cc].char=""; }
                persistCW(); drawLettersOnly(); updateActiveClueHeader(); centerOnCell(CW.focus.row,CW.focus.col); highlightActiveWord();
              });
              inputEl.addEventListener("keydown",(e)=>{
                if(inputEl.disabled) return;
                if(e.key==="Backspace"){
                  if(CW.cells[rr][cc].char){ CW.cells[rr][cc].char=""; drawLettersOnly(); persistCW(); }
                  else { movePrevInWord(rr,cc); }
                  e.preventDefault();
                }
                if(e.key==="ArrowRight"){ CW.focus.dir="across"; moveNext(rr,cc,true); e.preventDefault(); }
                if(e.key==="ArrowLeft"){ CW.focus.dir="across"; movePrev(rr,cc,true); e.preventDefault(); }
                if(e.key==="ArrowDown"){ CW.focus.dir="down"; moveNext(rr,cc,true); e.preventDefault(); }
                if(e.key==="ArrowUp"){ CW.focus.dir="down"; movePrev(rr,cc,true); e.preventDefault(); }
                updateActiveClueHeader(); centerOnCell(CW.focus.row,CW.focus.col); highlightActiveWord();
              });
            })(r,c,inp,d);
          }
          cwGrid.appendChild(d);
        }
      }
      numberGrid();
      syncPlacedNumbers();
      markDisabledRuns();
      drawDisabledState();
      highlightFocus();
      updateActiveClueHeader();
      renderClueList();
      highlightActiveWord();
    };

    const drawLettersOnly=()=>{
      const cells=document.querySelectorAll(".cw-cell"); let idx=0;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const div=cells[idx++];
          if(!CW.cells[r][c].black){
            const children=Array.from(div.children);
            const letterDiv = children.find(ch=>ch.classList?.contains("cw-letter"));
            if(letterDiv) letterDiv.textContent=CW.cells[r][c].char||"";
          }
        }
      }
    };

    const numberGrid=()=>{
      let num=1;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const cell=CW.cells[r][c];
          cell.number=null;
          if(cell.black) continue;
          const startAcross=(c===0 || CW.cells[r][c-1].black) && (c+1<CW.size && !CW.cells[r][c+1].black);
          const startDown  =(r===0 || CW.cells[r-1][c].black) && (r+1<CW.size && !CW.cells[r+1][c].black);
          if(startAcross || startDown) cell.number=num++;
        }
      }
    };

    const syncPlacedNumbers=()=>{
      placedClues.forEach(p=>{ p.num = CW.cells[p.row]?.[p.col]?.number ?? null; });
    };

    const escapeHTML=s=>s.replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

    const renderClueList=()=>{
      const acrossEl=$("#cw-across"), downEl=$("#cw-down");
      if(!acrossEl || !downEl) return;
      acrossEl.innerHTML=""; downEl.innerHTML="";
      const A = placedClues.filter(p=>p.dir==="across" && Number.isInteger(p.num)).sort((x,y)=>x.num-y.num);
      const D = placedClues.filter(p=>p.dir==="down"   && Number.isInteger(p.num)).sort((x,y)=>x.num-y.num);

      const mkLI=(p,len)=>{
        const li=document.createElement("li");
        li.innerHTML = `<span class="num">${p.num}.</span> ${escapeHTML(p.clue||"(no clue)")} <span class="hint">(${len})</span>`;
        li.addEventListener("click", ()=>{
          CW.focus={row:p.row,col:p.col,dir:p.dir};
          highlightFocus(); updateActiveClueHeader(); centerOnCell(p.row,p.col); highlightActiveWord();
        });
        return li;
      };

      A.forEach(p=>{
        let len=0; let c=p.col;
        while(c<CW.size && !CW.cells[p.row][c].black){ len++; c++; }
        acrossEl.appendChild(mkLI(p,len));
      });
      D.forEach(p=>{
        let len=0; let r=p.row;
        while(r<CW.size && !CW.cells[r][p.col].black){ len++; r++; }
        downEl.appendChild(mkLI(p,len));
      });
    };

    const markDisabledRuns=()=>{
      for(let r=0;r<CW.size;r++) for(let c=0;c<CW.size)cWloop: {
        CW.cells[r][c].disabled = !CW.cells[r][c].black;
      }
      for(const p of placedClues){
        if(!Number.isInteger(p.num)) continue;
        const {dir,row,col,answer}=p;
        for(let i=0;i<answer.length;i++){
          const rr=dir==="across"? row : row+i;
          const cc=dir==="across"? col+i : col;
          if(!CW.cells[rr][cc].black) CW.cells[rr][cc].disabled=false;
        }
      }
      for(let r=0;r<CW.size;r++) for(let c=0;c<CW.size;c++) if(CW.cells[r][c].disabled) CW.cells[r][c].char="";
    };

    const drawDisabledState=()=>{
      const cells=document.querySelectorAll(".cw-cell"); let idx=0;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const div=cells[idx++];
          if(CW.cells[r][c].black) continue;
          const inp=div.querySelector("input");
          if(inp){ inp.disabled=!!CW.cells[r][c].disabled; }
          div.classList.toggle("disabled", !!CW.cells[r][c].disabled);
        }
      }
    };

    const wordBounds=(r,c,dir)=>{
      if(dir==="across"){
        let start=c; while(start>0 && !CW.cells[r][start-1].black && !CW.cells[r][start-1].disabled) start--;
        let end=c; while(end+1<CW.size && !CW.cells[r][end+1].black && !CW.cells[r][end+1].disabled) end++;
        return {r1:r,c1:start,r2:r,c2:end};
      } else {
        let start=r; while(start>0 && !CW.cells[start-1][c].black && !CW.cells[start-1][c].disabled) start--;
        let end=r; while(end+1<CW.size && !CW.cells[end+1][c].black && !CW.cells[end+1][c].disabled) end++;
        return {r1:start,c1:c,r2:end,c2:c};
      }
    };

    const clearWordHighlight=()=>{ $$(".cw-cell.word").forEach(el=>el.classList.remove("word")); };
    const highlightActiveWord=()=>{
      clearWordHighlight();
      const {row,col,dir}=CW.focus;
      if(CW.cells[row]?.[col]?.black || CW.cells[row]?.[col]?.disabled) return;
      const b=wordBounds(row,col,dir);
      if(dir==="across"){
        for(let cc=b.c1; cc<=b.c2; cc++){
          const idx=row*CW.size+cc; const node=$("#cw-grid").children[idx];
          node && node.classList.add("word");
        }
      } else {
        for(let rr=b.r1; rr<=b.r2; rr++){
          const idx=rr*CW.size+col; const node=$("#cw-grid").children[idx];
          node && node.classList.add("word");
        }
      }
    };

    const moveNext=(r,c)=>{
      let rr=r, cc=c;
      if(CW.focus.dir==="across"){ cc++; while(cc<CW.size && (CW.cells[rr][cc].black || CW.cells[rr][cc].disabled)) cc++; }
      else { rr++; while(rr<CW.size && (CW.cells[rr][cc].black || CW.cells[rr][cc].disabled)) rr++; }
      if(rr>=CW.size || cc>=CW.size) return;
      CW.focus={row:rr,col:cc,dir:CW.focus.dir};
      highlightFocus(); updateActiveClueHeader(); centerOnCell(rr,cc); highlightActiveWord();
    };

    const movePrev=(r,c)=>{
      let rr=r, cc=c;
      if(CW.focus.dir==="across"){ cc--; while(cc>=0 && (CW.cells[rr][cc]?.black || CW.cells[rr][cc]?.disabled)) cc--; }
      else { rr--; while(rr>=0 && (CW.cells[rr]?.[cc]?.black || CW.cells[rr]?.[cc]?.disabled)) rr--; }
      if(rr<0 || cc<0) return;
      CW.focus={row:rr,col:cc,dir:CW.focus.dir};
      highlightFocus(); updateActiveClueHeader(); centerOnCell(rr,cc); highlightActiveWord();
    };

    const moveNextInWord=(r,c)=>{
      const b=wordBounds(r,c,CW.focus.dir);
      if(CW.focus.dir==="across"){
        let cc=c+1; while(cc<=b.c2 && (CW.cells[r][cc].black || CW.cells[r][cc].disabled)) cc++;
        if(cc<=b.c2){ CW.focus={row:r,col:cc,dir:"across"}; }
      } else {
        let rr=r+1; while(rr<=b.r2 && (CW.cells[rr][c].black || CW.cells[rr][c].disabled)) rr++;
        if(rr<=b.r2){ CW.focus={row:rr,col:c,dir:"down"}; }
      }
      highlightFocus(); updateActiveClueHeader(); centerOnCell(CW.focus.row,CW.focus.col); highlightActiveWord();
    };

    const movePrevInWord=(r,c)=>{
      const b=wordBounds(r,c,CW.focus.dir);
      if(CW.focus.dir==="across"){
        let cc=c-1; while(cc>=b.c1 && (CW.cells[r][cc].black || CW.cells[r][cc].disabled)) cc--;
        if(cc>=b.c1){ CW.focus={row:r,col:cc,dir:"across"}; }
      } else {
        let rr=r-1; while(rr>=b.r1 && (CW.cells[rr][c].black || CW.cells[rr][c].disabled)) rr--;
        if(rr>=b.r1){ CW.focus={row:rr,col:c,dir:"down"}; }
      }
      highlightFocus(); updateActiveClueHeader(); centerOnCell(CW.focus.row,CW.focus.col); highlightActiveWord();
    };

    const highlightFocus=()=>{
      document.querySelectorAll(".cw-cell").forEach(el=>el.classList.remove("active-hl"));
      const idx=CW.focus.row*CW.size+CW.focus.col;
      const cell=document.querySelectorAll(".cw-cell")[idx];
      if(cell && !CW.cells[CW.focus.row][CW.focus.col].black && !CW.cells[CW.focus.row][CW.focus.col].disabled){
        cell.classList.add("active-hl");
        const inp=cell.querySelector("input");
        inp && inp.focus({preventScroll:true});
      }
    };

    // Auto-size + placement
    const suggestSizes=(entries)=>{
      const words=entries.map(e=>(e.answer||"").toUpperCase().replace(/[^A-Z]/g,"")).filter(x=>x.length>=2);
      const maxLen = Math.max(...words.map(w=>w.length), 3);
      const totalLetters = words.reduce((a,w)=>a+w.length,0);
      const est = Math.max(maxLen+2, Math.ceil(Math.sqrt(totalLetters*1.6))+1);
      const toOdd = v => v%2===0 ? v+1 : v;
      const cands = [toOdd(est-2), toOdd(est), toOdd(est+2), toOdd(est+4)].map(x=>Math.min(21, Math.max(9, x)));
      return [...new Set(cands)];
    };

    const allocWork=(size)=>Array.from({length:size},()=> Array.from({length:size},()=>({char:"",black:false})));

    const canPlaceFactory=(size, grid)=>{
      return (dir, r, c, word)=>{
        if(dir==="across"){
          if(c<0 || c+word.length>size) return -1;
          if(c>0 && grid[r][c-1].char) return -1;
          if(c+word.length<size && grid[r][c+word.length].char) return -1;
          let score=0;
          for(let i=0;i<word.length;i++){
            const rr=r, cc=c+i, cell=grid[rr][cc];
            if(cell.black) return -1;
            if(cell.char && cell.char!==word[i]) return -1;
            if(cell.char===word[i]) score++;
          }
          return score;
        } else {
          if(r<0 || r+word.length>size) return -1;
          if(r>0 && grid[r-1][c].char) return -1;
          if(r+word.length<size && grid[r+word.length][c].char) return -1;
          let score=0;
          for(let i=0;i<word.length;i++){
            const rr=r+i, cc=c, cell=grid[rr][cc];
            if(cell.black) return -1;
            if(cell.char && cell.char!==word[i]) return -1;
            if(cell.char===word[i]) score++;
          }
          return score;
        }
      };
    };

    const placeWork=(grid, dir, r, c, word)=>{
      if(dir==="across"){ for(let i=0;i<word.length;i++){ grid[r][c+i].char=word[i]; grid[r][c+i].black=false; } }
      else { for(let i=0;i<word.length;i++){ grid[r+i][c].char=word[i]; grid[r+i][c].black=false; } }
    };

    const tryBuildWithSize=(entries, size)=>{
      const grid=allocWork(size);
      const placed=[];
      const words=entries
        .map(e=>({dir:(e.dir||"across").toLowerCase()==="down"?"down":"across",answer:(e.answer||"").toUpperCase().replace(/[^A-Z]/g,""),clue:e.clue||""}))
        .filter(e=>e.answer.length>=2)
        .sort((a,b)=>b.answer.length-a.answer.length);
      if(!words.length) return {score:-1, grid, placed};
      const seed=words.shift();
      const len=seed.answer.length;
      const center=Math.floor(size/2);
      const start=Math.max(0, Math.min(size-len, center-Math.floor(len/2)));
      placeWork(grid,"across",center,start,seed.answer);
      placed.push({dir:"across",row:center,col:start,answer:seed.answer,clue:seed.clue});
      const canPlace=canPlaceFactory(size, grid);
      let attempts=0;
      while(words.length && attempts<words.length*5){
        const item=words.shift();
        let best={dir:item.dir, r:0,c:0,score:-1};
        for(let r=0;r<size;r++){
          for(let c=0;c<size;c++){
            const s1=canPlace(item.dir,r,c,item.answer);
            if(s1>best.score) best={dir:item.dir,r,c,score:s1};
            const alt=item.dir==="across"?"down":"across";
            const s2=canPlace(alt,r,c,item.answer);
            if(s2>best.score) best={dir:alt,r,c,score:s2};
          }
        }
        if(best.score>=0){
          placeWork(grid, best.dir, best.r, best.c, item.answer);
          placed.push({dir:best.dir,row:best.r,col:best.c,answer:item.answer,clue:item.clue});
        } else {
          words.push(item); attempts++;
        }
      }
      for(let r=0;r<size;r++){
        for(let c=0;c<size;c++){
          if(!grid[r][c].char){
            grid[r][c].black=true;
            const rr=size-1-r, cc=size-1-c;
            if(!grid[rr][cc].char) grid[rr][cc].black=true;
          }
        }
      }
      let letters=0, crossings=0;
      for(let r=0;r<size;r++){
        for(let c=0;c<size;c++){
          const ch=grid[r][c].char;
          if(ch) letters++;
          if(ch){
            const horiz = (c>0 && grid[r][c-1].char) || (c<size-1 && grid[r][c+1].char);
            const vert  = (r>0 && grid[r-1][c].char) || (r<size-1 && grid[r+1][c].char);
            if(horiz && vert) crossings++;
          }
        }
      }
      const score=crossings*3 + placed.length*2 - letters*0.05;
      return {score, grid, placed};
    };

    const autoBuild=entries=>{
      const sizes=suggestSizes(entries);
      let best={score:-Infinity, grid:null, placed:[]};
      sizes.forEach(sz=>{
        const res=tryBuildWithSize(entries, sz);
        if(res.score>best.score){ best=res; }
      });
      if(!best.grid){ toast("No build possible"); return; }
      CW.size=best.grid.length;
      CW.cells=allocGrid(CW.size);
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          CW.cells[r][c].black = best.grid[r][c].black;
          CW.cells[r][c].char = "";
          CW.cells[r][c].disabled = false;
        }
      }
      placedClues=best.placed;
      numberGrid();
      syncPlacedNumbers();
      markDisabledRuns();
      drawDisabledState();
      renderCWGrid();
      persistCW();
    };

    const submitCrossword=()=>{
      clearMarks();
      for(const p of placedClues){
        if(!Number.isInteger(p.num)) continue;
        const {dir,row,col,answer}=p;
        for(let i=0;i<answer.length;i++){
          const r=dir==="across"? row : row+i;
          const c=dir==="across"? col+i : col;
          if(CW.cells[r][c].disabled || CW.cells[r][c].black) continue;
          const val=(CW.cells[r][c].char||"").toUpperCase();
          const correct=answer[i]===val;
          paintCell(r,c, correct ? "correct" : (val? "incorrect" : null));
        }
      }
    };

    const clearMarks=()=>{
      document.querySelectorAll(".cw-cell.correct, .cw-cell.incorrect")
        .forEach(n=>n.classList.remove("correct","incorrect"));
    };

    const paintCell=(r,c,cls)=>{
      const idx=r*CW.size+c;
      const node=document.querySelectorAll(".cw-cell")[idx];
      if(!node) return;
      node.classList.remove("correct","incorrect");
      if(cls) node.classList.add(cls);
    };

    const persistCW=()=>{
      localStorage.setItem("cw.size", String(CW.size));
      localStorage.setItem("cw.cells", JSON.stringify(CW.cells));
      localStorage.setItem("cw.cluesPlaced", JSON.stringify(placedClues));
    };

    const restoreCW=()=>{
      const size=Number(localStorage.getItem("cw.size")||11);
      const cells=localStorage.getItem("cw.cells");
      const plc=localStorage.getItem("cw.cluesPlaced");
      CW.size=size; CW.cells=cells?JSON.parse(cells):allocGrid(size);
      placedClues=plc?JSON.parse(plc):[];
      numberGrid();
      syncPlacedNumbers();
      markDisabledRuns();
      renderCWGrid();
    };

    const btnDir=$("#tb-dir"), btnPrev=$("#tb-prev"), btnNext=$("#tb-next"), activeClueEl=$("#active-clue");

    const updateActiveClueHeader=()=>{
      const dir=CW.focus.dir;
      let r=CW.focus.row, c=CW.focus.col;
      if(dir==="across"){ while(c>0 && !CW.cells[r][c-1].black && !CW.cells[r][c-1].disabled) c--; }
      else { while(r>0 && !CW.cells[r-1][c].black && !CW.cells[r-1][c].disabled) r--; }
      const match = placedClues.find(p=>p.dir===dir && p.row===r && p.col===c && Number.isInteger(p.num));
      if(match){
        let len=0;
        if(dir==="across"){ let cc=match.col; while(cc<CW.size && !CW.cells[match.row][cc].black){ len++; cc++; } }
        else { let rr=match.row; while(rr<CW.size && !CW.cells[rr][match.col].black){ len++; rr++; } }
        activeClueEl.textContent = `${match.num} ${dir==="across"?"Across":"Down"} — ${match.clue||""} (${len})`;
      } else {
        activeClueEl.textContent = "Tap a cell to start";
      }
      if(btnDir) btnDir.textContent = dir==="across"?"Across":"Down";
    };

    btnDir?.addEventListener("click", ()=>{
      CW.focus.dir = CW.focus.dir==="across"?"down":"across";
      updateActiveClueHeader(); highlightFocus(); centerOnCell(CW.focus.row,CW.focus.col); highlightActiveWord();
    });

    btnPrev?.addEventListener("click", ()=>{
      const list = placedClues.filter(p=>p.dir===CW.focus.dir && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      let idx = list.findIndex(p=>p.row===CW.focus.row && p.col===CW.focus.col);
      if(idx<0) idx=0;
      const target = list[(idx-1+list.length)%list.length];
      if(target){
        CW.focus={row:target.row,col:target.col,dir:target.dir};
        highlightFocus(); updateActiveClueHeader(); centerOnCell(target.row,target.col); highlightActiveWord();
      }
    });

    btnNext?.addEventListener("click", ()=>{
      const list = placedClues.filter(p=>p.dir===CW.focus.dir && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      let idx = list.findIndex(p=>p.row===CW.focus.row && p.col===CW.focus.col);
      if(idx<0) idx=0;
      const target = list[(idx+1)%list.length];
      if(target){
        CW.focus={row:target.row,col:target.col,dir:target.dir};
        highlightFocus(); updateActiveClueHeader(); centerOnCell(target.row,target.col); highlightActiveWord();
      }
    });

    $("#cw-build")?.addEventListener("click", ()=>{
      let entries=[];
      try{ entries=JSON.parse($("#cw-json")?.value||"[]"); }
      catch{ toast("Invalid JSON"); return; }
      autoBuild(entries);
      toast("Crossword built");
    });

    $("#cw-import")?.addEventListener("click", ()=>{
      try{
        const arr=JSON.parse($("#cw-json")?.value||"[]");
        localStorage.setItem("cw.src", JSON.stringify(arr));
        toast("Clues loaded");
      }catch{ toast("Invalid JSON"); }
    });

    $("#cw-export")?.addEventListener("click", ()=>{
      const out=placedClues
        .filter(p=>Number.isInteger(p.num))
        .map(p=>({num:p.num, dir:p.dir,row:p.row+1,col:p.col+1,answer:p.answer,clue:p.clue}));
      const s=JSON.stringify(out,null,2);
      navigator.clipboard.writeText(s).then(()=> toast("Exported to clipboard"));
    });

    const resetCrossword=()=>{
      CW.cells=allocGrid(CW.size);
      renderCWGrid();
      persistCW();
      toast("Crossword reset");
    };

    $("#cw-admin-reset")?.addEventListener("click", resetCrossword);
    $("#cw-play-reset")?.addEventListener("click", resetCrossword);
    $("#cw-submit")?.addEventListener("click", submitCrossword);
    $("#cw-clear-errors")?.addEventListener("click", clearMarks);

    // Initialize
    setCSSLen(); buildKeyboard(); restoreWordle(); renderBoard(); restoreCW();

    // URL seeds
    const url=new URL(location.href);
    const pWord=(url.searchParams.get("wordle")||"").toUpperCase();
    const pLen=Number(url.searchParams.get("len")||W.len);
    if(pWord){ if(wAns) wAns.value=pWord; }
    if(pLen){ if(wLen) wLen.value=pLen; }
    if(url.searchParams.get("daily")==="1"){ if(wDaily){ wDaily.checked=true; W.daily=true; } }
    const pCW=url.searchParams.get("cwsrc");
    if(pCW){
      try{
        const json=atob(pCW.replace(/-/g,'+').replace(/_/g,'/'));
        const t=$("#cw-json"); if(t) t.value=json;
      }catch{}
    }
  }
})();
