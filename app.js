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
          const css=getComputedStyle(document.documentElement);
          if(st==="correct") t.style.background=css.getPropertyValue("--green");
          if(st==="present") t.style.background=css.getPropertyValue("--yellow");
          if(st==="absent") t.style.background=css.getPropertyValue("--gray");
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
      if(!ans){ toast("Answer not set"); return; }
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
      localStorage.setItem("w.state", JSON.stringify(W));
    };
    const restoreWordle=()=>{
      try{
        const s=JSON.parse(localStorage.getItem("w.state")||"null");
        if(s && typeof s==="object"){
          Object.assign(W,s);
        }
      }catch{}
      if(!W.board?.length){ W.board=emptyBoard(); W.states=emptyStates(); }
      if(!W.keyState) W.keyState={};
    };

    // ---------- CROSSWORD (simplified NYT-like controls) ----------
    const CW={ size:11, cells:[], focus:{row:0,col:0,dir:"across"}, placed:[], finished:false };
    const viewport=$(".cw-viewport"); const cwGrid=$("#cw-grid");
    const activeClueEl=$("#active-clue");
    const btnDir=$("#tb-dir"), btnPrev=$("#tb-prev"), btnNext=$("#tb-next");
    const btnSubmit=$("#cw-submit"), btnClear=$("#cw-clear"), btnReset=$("#cw-reset");
    const sheetToggle=$("#sheet-toggle"); const cluesSheet=$("#clues-sheet");
    const acrossEl=$("#cw-across"), downEl=$("#cw-down"); const cwJSON=$("#cw-json");

    // Build helpers
    const allocGrid=n=>Array.from({length:n},()=> Array.from({length:n},()=>({char:"",black:false,number:null,disabled:false})));
    const ensureBoard=()=>{ if(!CW.cells?.length){ CW.cells=allocGrid(CW.size);} };

    // Responsive grid renderer (auto cell size)
    const renderCWGrid=()=>{
      ensureBoard();
      cwGrid.innerHTML="";
      const vpw = viewport.clientWidth || cwGrid.clientWidth || 360;
      const gap = 2;
      const totalGaps = gap*(CW.size-1);
      const maxGridWidth = Math.max(260, vpw - 16);
      const cellPx = Math.max(30, Math.floor((maxGridWidth - totalGaps)/CW.size));
      cwGrid.style.gap = gap+"px";
      cwGrid.style.gridTemplateColumns=`repeat(${CW.size}, ${cellPx}px)`;

      // draw
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const cell=CW.cells[r][c];
          const d=document.createElement("div");
          d.className="cw-cell"+(cell.black?" black":"")+(cell.disabled?" disabled":"");
          d.style.width=cellPx+"px"; d.style.height=cellPx+"px";
          if(cell.number && !cell.black){
            const n=document.createElement("div"); n.className="cw-num"; n.textContent=cell.number; d.appendChild(n);
          }
          if(!cell.black){
            const letter=document.createElement("div"); letter.className="cw-letter"; letter.textContent=cell.char||""; d.appendChild(letter);
            const inp=document.createElement("input"); inp.setAttribute("aria-label",`Row ${r+1} Col ${c+1}`);
            inp.disabled = !!cell.disabled; d.appendChild(inp);

            // interactions
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
                highlightFocus(); centerOn(rr,cc); updateActiveClueHeader(); highlightWord();
              });
              inputEl.addEventListener("input",(e)=>{
                if(inputEl.disabled) return;
                const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,"");
                if(v){ CW.cells[rr][cc].char=v.slice(-1); moveNextInWord(rr,cc); } else { CW.cells[rr][cc].char=""; }
                drawLettersOnly(); updateActiveClueHeader(); centerOn(CW.focus.row,CW.focus.col); highlightWord();
              });
              inputEl.addEventListener("keydown",(e)=>{
                if(inputEl.disabled) return;
                if(e.key==="Backspace"){
                  if(CW.cells[rr][cc].char){ CW.cells[rr][cc].char=""; drawLettersOnly(); }
                  else { movePrevInWord(rr,cc); }
                  e.preventDefault();
                }
                if(e.key==="ArrowRight"){ CW.focus.dir="across"; moveNext(rr,cc); e.preventDefault(); }
                if(e.key==="ArrowLeft"){ CW.focus.dir="across"; movePrev(rr,cc); e.preventDefault(); }
                if(e.key==="ArrowDown"){ CW.focus.dir="down"; moveNext(rr,cc); e.preventDefault(); }
                if(e.key==="ArrowUp"){ CW.focus.dir="down"; movePrev(rr,cc); e.preventDefault(); }
                updateActiveClueHeader(); centerOn(CW.focus.row,CW.focus.col); highlightWord();
              });
            })(r,c,inp,d);
          }
          cwGrid.appendChild(d);
        }
      }
      numberGrid(); syncPlacedNumbers(); markDisabledRuns(); drawDisabledState(); highlightFocus(); updateActiveClueHeader(); renderClueList(); highlightWord();
    };

    const drawLettersOnly=()=>{
      const nodes=[...document.querySelectorAll(".cw-cell")]; let i=0;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const node=nodes[i++]; if(!node) continue;
          if(!CW.cells[r][c].black){
            const letter=node.querySelector(".cw-letter");
            if(letter) letter.textContent=CW.cells[r][c].char||"";
          }
        }
      }
    };

    // Numbering + placed clues sync
    const numberGrid=()=>{
      let num=1;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const cell=CW.cells[r][c]; cell.number=null;
          if(cell.black) continue;
          const startAcross=(c===0 || CW.cells[r][c-1].black) && (c+1<CW.size && !CW.cells[r][c+1].black);
          const startDown  =(r===0 || CW.cells[r-1][c].black) && (r+1<CW.size && !CW.cells[r+1][c].black);
          if(startAcross || startDown) cell.number=num++;
        }
      }
    };
    const syncPlacedNumbers=()=>{
      CW.placed.forEach(p=>{ p.num = CW.cells[p.row]?.[p.col]?.number ?? null; });
    };

    // Disable non-answer cells until entries are placed
    const markDisabledRuns=()=>{
      for(let r=0;r<CW.size;r++) for(let c=0;c<CW.size;c++) CW.cells[r][c].disabled = !CW.cells[r][c].black;
      for(const p of CW.placed){
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
      const nodes=[...document.querySelectorAll(".cw-cell")]; let i=0;
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          const node=nodes[i++]; if(!node) continue;
          if(CW.cells[r][c].black) continue;
          const inp=node.querySelector("input");
          if(inp) inp.disabled=!!CW.cells[r][c].disabled;
          node.classList.toggle("disabled", !!CW.cells[r][c].disabled);
        }
      }
    };

    // Focus + navigation
    const wordBounds=(r,c,dir)=>{
      if(dir==="across"){
        let c1=c; while(c1>0 && !CW.cells[r][c1-1].black && !CW.cells[r][c1-1].disabled) c1--;
        let c2=c; while(c2+1<CW.size && !CW.cells[r][c2+1].black && !CW.cells[r][c2+1].disabled) c2++;
        return {r1:r,c1,c2};
      } else {
        let r1=r; while(r1>0 && !CW.cells[r1-1][c].black && !CW.cells[r1-1][c].disabled) r1--;
        let r2=r; while(r2+1<CW.size && !CW.cells[r2+1][c].black && !CW.cells[r2+1][c].disabled) r2++;
        return {c1:c,r1,r2};
      }
    };
    const highlightWord=()=>{
      $$(".cw-cell.word").forEach(n=>n.classList.remove("word"));
      const {row,col,dir}=CW.focus; if(CW.cells[row]?.[col]?.black||CW.cells[row]?.[col]?.disabled) return;
      if(dir==="across"){
        const b=wordBounds(row,col,"across");
        for(let cc=b.c1; cc<=b.c2; cc++){ const node=cwGrid.children[row*CW.size+cc]; node?.classList.add("word"); }
      } else {
        const b=wordBounds(row,col,"down");
        for(let rr=b.r1; rr<=b.r2; rr++){ const node=cwGrid.children[rr*CW.size+col]; node?.classList.add("word"); }
      }
    };
    const highlightFocus=()=>{
      $$(".cw-cell").forEach(n=>n.classList.remove("active-hl"));
      const idx=CW.focus.row*CW.size+CW.focus.col; const node=cwGrid.children[idx];
      if(node && !CW.cells[CW.focus.row][CW.focus.col].black && !CW.cells[CW.focus.row][CW.focus.col].disabled){
        node.classList.add("active-hl"); node.querySelector("input")?.focus({preventScroll:true});
      }
    };
    const centerOn=(r,c)=>{
      const node=cwGrid.children[r*CW.size+c]; if(!node) return;
      const vRect=viewport.getBoundingClientRect(); const nRect=node.getBoundingClientRect();
      const cx=(nRect.left+nRect.right)/2; const cy=(nRect.top+nRect.bottom)/2;
      const vx=vRect.left+vRect.width/2; const vy=vRect.top+vRect.height/2;
      // simulate simple pan by scrolling container into view if overflowed (viewport has overflow:hidden; rely on soft center)
      node.scrollIntoView({block:"center", inline:"center", behavior:"smooth"});
    };
    const moveNext=(r,c)=>{
      let rr=r, cc=c;
      if(CW.focus.dir==="across"){ cc++; while(cc<CW.size && (CW.cells[rr][cc].black||CW.cells[rr][cc].disabled)) cc++; }
      else { rr++; while(rr<CW.size && (CW.cells[rr][cc].black||CW.cells[rr][cc].disabled)) rr++; }
      if(rr>=CW.size || cc>=CW.size) return;
      CW.focus={row:rr,col:cc,dir:CW.focus.dir}; highlightFocus(); centerOn(rr,cc); updateActiveClueHeader(); highlightWord();
    };
    const movePrev=(r,c)=>{
      let rr=r, cc=c;
      if(CW.focus.dir==="across"){ cc--; while(cc>=0 && (CW.cells[rr][cc]?.black||CW.cells[rr][cc]?.disabled)) cc--; }
      else { rr--; while(rr>=0 && (CW.cells[rr]?.[cc]?.black||CW.cells[rr]?.[cc]?.disabled)) rr--; }
      if(rr<0 || cc<0) return;
      CW.focus={row:rr,col:cc,dir:CW.focus.dir}; highlightFocus(); centerOn(rr,cc); updateActiveClueHeader(); highlightWord();
    };
    const moveNextInWord=(r,c)=>{
      if(CW.focus.dir==="across"){
        const b=wordBounds(r,c,"across"); let cc=c+1; while(cc<=b.c2 && (CW.cells[r][cc].black||CW.cells[r][cc].disabled)) cc++;
        if(cc<=b.c2) CW.focus={row:r,col:cc,dir:"across"};
      } else {
        const b=wordBounds(r,c,"down"); let rr=r+1; while(rr<=b.r2 && (CW.cells[rr][c].black||CW.cells[rr][c].disabled)) rr++;
        if(rr<=b.r2) CW.focus={row:rr,col:c,dir:"down"};
      }
      highlightFocus(); centerOn(CW.focus.row,CW.focus.col); updateActiveClueHeader(); highlightWord();
    };
    const movePrevInWord=(r,c)=>{
      if(CW.focus.dir==="across"){
        const b=wordBounds(r,c,"across"); let cc=c-1; while(cc>=b.c1 && (CW.cells[r][cc].black||CW.cells[r][cc].disabled)) cc--;
        if(cc>=b.c1) CW.focus={row:r,col:cc,dir:"across"};
      } else {
        const b=wordBounds(r,c,"down"); let rr=r-1; while(rr>=b.r1 && (CW.cells[rr][c].black||CW.cells[rr][c].disabled)) rr--;
        if(rr>=b.r1) CW.focus={row:rr,col:c,dir:"down"};
      }
      highlightFocus(); centerOn(CW.focus.row,CW.focus.col); updateActiveClueHeader(); highlightWord();
    };

    // Active clue header + lists
    const updateActiveClueHeader=()=>{
      const dir=CW.focus.dir; let r=CW.focus.row, c=CW.focus.col;
      if(dir==="across"){ while(c>0 && !CW.cells[r][c-1].black && !CW.cells[r][c-1].disabled) c--; }
      else { while(r>0 && !CW.cells[r-1][c].black && !CW.cells[r-1][c].disabled) r--; }
      const match = CW.placed.find(p=>p.dir===dir && p.row===r && p.col===c && Number.isInteger(p.num));
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
    const renderClueList=()=>{
      if(!acrossEl || !downEl) return;
      acrossEl.innerHTML=""; downEl.innerHTML="";
      const A=CW.placed.filter(p=>p.dir==="across" && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      const D=CW.placed.filter(p=>p.dir==="down" && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      const mk=(p,len)=>{
        const li=document.createElement("li");
        li.innerHTML = `<span class="num">${p.num}.</span> ${escapeHTML(p.clue||"(no clue)")} <span class="hint">(${len})</span>`;
        li.addEventListener("click", ()=>{
          CW.focus={row:p.row,col:p.col,dir:p.dir}; highlightFocus(); centerOn(p.row,p.col); updateActiveClueHeader(); highlightWord();
        });
        return li;
      };
      A.forEach(p=>{ let L=0,c=p.col; while(c<CW.size && !CW.cells[p.row][c].black){ L++; c++; } acrossEl.appendChild(mk(p,L)); });
      D.forEach(p=>{ let L=0,r=p.row; while(r<CW.size && !CW.cells[r][p.col].black){ L++; r++; } downEl.appendChild(mk(p,L)); });
    };
    const escapeHTML=s=>s.replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

    // Submit: check whole grid; show single verdict like NYT “Check Puzzle”
    const submitCrossword=()=>{
      let anyWrong=false, anyEmpty=false;
      // clear old marks
      $$(".cw-cell.correct, .cw-cell.incorrect").forEach(n=>n.classList.remove("correct","incorrect"));
      for(const p of CW.placed){
        if(!Number.isInteger(p.num)) continue;
        const {dir,row,col,answer}=p;
        for(let i=0;i<answer.length;i++){
          const r=dir==="across"? row : row+i;
          const c=dir==="across"? col+i : col;
          if(CW.cells[r][c].black || CW.cells[r][c].disabled) continue;
          const val=(CW.cells[r][c].char||"").toUpperCase();
          if(!val){ anyEmpty=true; continue; }
          if(val===answer[i]) document.querySelectorAll(".cw-cell")[r*CW.size+c]?.classList.add("correct");
          else { anyWrong=true; document.querySelectorAll(".cw-cell")[r*CW.size+c]?.classList.add("incorrect"); }
        }
      }
      if(!anyWrong && !anyEmpty){ toast("Crossword complete!"); CW.finished=true; }
      else if(anyWrong){ toast("There are mistakes"); }
      else { toast("Keep going"); }
    };
    const clearMarks=()=>{ $$(".cw-cell.correct, .cw-cell.incorrect").forEach(n=>n.classList.remove("correct","incorrect")); };

    // Builder (kept minimal, symmetric blacks, simple fit)
    const allocWork=(n)=>Array.from({length:n},()=> Array.from({length:n},()=>({char:"",black:false})));
    const canPlace=(grid,size,dir,r,c,word)=>{
      if(dir==="across"){
        if(c<0||c+word.length>size) return false;
        if(c>0 && grid[r][c-1].char) return false;
        if(c+word.length<size && grid[r][c+word.length].char) return false;
        for(let i=0;i<word.length;i++){ const cell=grid[r][c+i]; if(cell.black) return false; if(cell.char && cell.char!==word[i]) return false; }
        return true;
      } else {
        if(r<0||r+word.length>size) return false;
        if(r>0 && grid[r-1][c].char) return false;
        if(r+word.length<size && grid[r+word.length][c].char) return false;
        for(let i=0;i<word.length;i++){ const cell=grid[r+i][c]; if(cell.black) return false; if(cell.char && cell.char!==word[i]) return false; }
        return true;
      }
    };
    const placeWord=(grid,dir,r,c,word)=>{
      if(dir==="across") for(let i=0;i<word.length;i++){ grid[r][c+i].char=word[i]; grid[r][c+i].black=false; }
      else for(let i=0;i<word.length;i++){ grid[r+i][c].char=word[i]; grid[r+i][c].black=false; }
    };
    const autoBuild=(entries)=>{
      const words=entries.map(e=>({dir:(e.dir||"across").toLowerCase()==="down"?"down":"across",
        answer:(e.answer||"").toUpperCase().replace(/[^A-Z]/g,""), clue:e.clue||""}))
        .filter(e=>e.answer.length>=2).sort((a,b)=>b.answer.length-a.answer.length);
      if(!words.length){ toast("No clues"); return; }
      // choose size based on longest word and count
      const maxLen=Math.max(...words.map(w=>w.answer.length));
      CW.size=Math.min(21, Math.max(9, maxLen+4));
      const grid=allocWork(CW.size);
      const placed=[];
      // seed across center
      const seed=words.shift(); const center=Math.floor(CW.size/2);
      const start=Math.max(0, Math.min(CW.size-seed.answer.length, center-Math.floor(seed.answer.length/2)));
      placeWord(grid,"across",center,start,seed.answer);
      placed.push({dir:"across",row:center,col:start,answer:seed.answer,clue:seed.clue});

      // naive fit others
      for(const item of words){
        let best=null;
        for(let r=0;r<CW.size;r++){
          for(let c=0;c<CW.size;c++){
            if(canPlace(grid,CW.size,item.dir,r,c,item.answer)){ best={dir:item.dir,r,c}; break; }
            const alt=item.dir==="across"?"down":"across";
            if(canPlace(grid,CW.size,alt,r,c,item.answer)){ best={dir:alt,r,c}; break; }
          }
          if(best) break;
        }
        if(best){ placeWord(grid,best.dir,best.r,best.c,item.answer); placed.push({dir:best.dir,row:best.r,col:best.c,answer:item.answer,clue:item.clue}); }
      }

      // mirror blacks for symmetry
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          if(!grid[r][c].char){
            grid[r][c].black=true;
            const rr=CW.size-1-r, cc=CW.size-1-c;
            if(!grid[rr][cc].char) grid[rr][cc].black=true;
          }
        }
      }

      // move into live grid
      CW.cells=allocGrid(CW.size);
      for(let r=0;r<CW.size;r++){
        for(let c=0;c<CW.size;c++){
          CW.cells[r][c].black=grid[r][c].black;
          CW.cells[r][c].char="";
          CW.cells[r][c].disabled=false;
        }
      }
      CW.placed=placed;
      renderCWGrid();
      toast("Crossword built");
    };

    // Controls
    btnDir?.addEventListener("click", ()=>{ CW.focus.dir=CW.focus.dir==="across"?"down":"across"; updateActiveClueHeader(); highlightFocus(); centerOn(CW.focus.row,CW.focus.col); highlightWord(); });
    btnPrev?.addEventListener("click", ()=>{
      const list=CW.placed.filter(p=>p.dir===CW.focus.dir && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      let idx=list.findIndex(p=>p.row===CW.focus.row && p.col===CW.focus.col); if(idx<0) idx=0;
      const t=list[(idx-1+list.length)%list.length]; if(t){ CW.focus={row:t.row,col:t.col,dir:t.dir}; highlightFocus(); centerOn(t.row,t.col); updateActiveClueHeader(); highlightWord(); }
    });
    btnNext?.addEventListener("click", ()=>{
      const list=CW.placed.filter(p=>p.dir===CW.focus.dir && Number.isInteger(p.num)).sort((a,b)=>a.num-b.num);
      let idx=list.findIndex(p=>p.row===CW.focus.row && p.col===CW.focus.col); if(idx<0) idx=0;
      const t=list[(idx+1)%list.length]; if(t){ CW.focus={row:t.row,col:t.col,dir:t.dir}; highlightFocus(); centerOn(t.row,t.col); updateActiveClueHeader(); highlightWord(); }
    });
    btnSubmit?.addEventListener("click", submitCrossword);
    btnClear?.addEventListener("click", clearMarks);
    btnReset?.addEventListener("click", ()=>{
      CW.cells=allocGrid(CW.size); CW.finished=false; renderCWGrid(); toast("Grid reset");
    });

    // Sheet toggle
    let sheetOpen=true;
    const setSheet=(open)=>{
      sheetOpen=open;
      if(!cluesSheet) return;
      cluesSheet.style.maxHeight=open?"var(--sheet-max)":"0";
      cluesSheet.style.opacity=open?"1":"0.2";
    };
    setSheet(true);
    sheetToggle?.addEventListener("click", ()=>setSheet(!sheetOpen), {passive:true});

    // Admin build/import/export
    $("#cw-build")?.addEventListener("click", ()=>{
      let entries=[];
      try{ entries=JSON.parse(cwJSON?.value||"[]"); }catch{ toast("Invalid JSON"); return; }
      autoBuild(entries);
    });
    $("#cw-import")?.addEventListener("click", ()=>{
      try{ const arr=JSON.parse(cwJSON?.value||"[]"); localStorage.setItem("cw.src", JSON.stringify(arr)); toast("Clues loaded"); }
      catch{ toast("Invalid JSON"); }
    });
    $("#cw-export")?.addEventListener("click", ()=>{
      const out=CW.placed.filter(p=>Number.isInteger(p.num)).map(p=>({num:p.num,dir:p.dir,row:p.row+1,col:p.col+1,answer:p.answer,clue:p.clue}));
      navigator.clipboard.writeText(JSON.stringify(out,null,2)).then(()=> toast("Exported to clipboard"));
    });
    $("#cw-admin-reset")?.addEventListener("click", ()=>{
      CW.cells=allocGrid(CW.size); CW.placed=[]; renderCWGrid(); toast("Crossword reset");
    });

    // Init both apps
    setCSSLen(); buildKeyboard(); restoreWordle(); renderBoard();
    // Restore crossword from storage if present
    try{
      const c=JSON.parse(localStorage.getItem("cw.cells")||"null");
      const p=JSON.parse(localStorage.getItem("cw.placed")||"null");
      const s=Number(localStorage.getItem("cw.size")||CW.size);
      if(c && p && s){ CW.size=s; CW.cells=c; CW.placed=p; }
    }catch{}
    renderCWGrid();

    // Persist on unload
    addEventListener("beforeunload", ()=>{
      localStorage.setItem("cw.size", String(CW.size));
      localStorage.setItem("cw.cells", JSON.stringify(CW.cells));
      localStorage.setItem("cw.placed", JSON.stringify(CW.placed));
    });

    // URL seeds
    const url=new URL(location.href);
    const pWord=(url.searchParams.get("wordle")||"").toUpperCase();
    const pLen=Number(url.searchParams.get("len")||W.len);
    if(pWord){ if($("#w-answer")) $("#w-answer").value=pWord; }
    if(pLen){ if($("#w-len")) $("#w-len").value=pLen; }
    if(url.searchParams.get("daily")==="1"){ const el=$("#w-daily"); if(el){ el.checked=true; W.daily=true; } }
    const pCW=url.searchParams.get("cwsrc");
    if(pCW){
      try{
        const json=atob(pCW.replace(/-/g,'+').replace(/_/g,'/'));
        if(cwJSON) cwJSON.value=json;
      }catch{}
    }
  }
})();
