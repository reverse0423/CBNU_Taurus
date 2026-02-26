// records.js — FINAL (Team Color Theme + Comparison Feature Restored)

document.addEventListener('DOMContentLoaded', () => {
  // 기본 요소 참조
  const btnBat = document.getElementById('btn-batting');
  const btnPit = document.getElementById('btn-pitching');
  const yearSel = document.getElementById('yearSelect');
  const filterBtn = document.getElementById('filterBtn');
  const listContainer = document.getElementById('record-list');
  const tableWrapper = document.getElementById('tableWrapper');
  const recordsTable = document.getElementById('recordsTable');
  const theadRow = document.getElementById('theadRow');
  const tbody = document.getElementById('tbodyRows');
  const sortSelect = document.getElementById('sortSelect');
  const sortOrderBtn = document.getElementById('sortOrderBtn');
  const searchBox = document.getElementById('searchBox');
  const suggestBox = document.getElementById('suggestBox');
  const btnListView = document.getElementById('btn-list-view');
  const btnTableView = document.getElementById('btn-table-view');

  // ★ 모달 요소 참조 (비교 기능용)
  const btnCompare = document.getElementById('btn-compare');
  const modal = document.getElementById('comparisonModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const resetCompareBtn = document.getElementById('resetCompareBtn');
  const selectPhase = document.getElementById('selectPhase');
  const resultPhase = document.getElementById('resultPhase');
  const slot1 = document.getElementById('slot1');
  const slot2 = document.getElementById('slot2');
  const compareSearch = document.getElementById('compareSearch');
  const compareList = document.getElementById('comparePlayerList');
  const compareTable = document.getElementById('compareTable');
  const compBatBtn = document.getElementById('compBatBtn');
  const compPitBtn = document.getElementById('compPitBtn');

  // 상태 변수
  let currentType = 'bat';
  let currentView = 'list';
  let filterOn = false;
  let currentSort = { key: 'war', asc: false };
  let searchTerm = '';
  let lastRows = [];
  let minPAForLeaders = 0;
  let globalBatData = [];
  let globalPitData = [];
  
  // 모달 상태
  let selectedPlayers = [null, null];
  let compareMode = 'bat';

  // 유틸 및 스탯 로직
  const N = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3 = x => Math.round(x * 1000) / 1000;
  const ERA_BASE = 7;
  const WAR_CFG = { WOBAScale: 1.15, RunsPerWin: 7.5, BatReplacementPerPA: 0.033, PitReplacementMult: 1.20 };
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
  
  function normalizeRecords(data) { 
      if (Array.isArray(data)) return data; 
      if (data?.players) return data.players; 
      if (data?.batters) return data.batters; 
      if (data?.records) return data.records; 
      if (data?.data) return data.data; 
      return []; 
  }
  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  function applyDerived(p) {
    const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),CI=N(p.ci),PAi=N(p.pa),PA=PAi>0?PAi:(AB+BB+HBP+SF+SH+CI),_1B=Math.max(0,H-_2B-_3B-HR),TB=_1B+2*_2B+3*_3B+4*HR,AVG=div(H,AB),OBP=div(H+BB+HBP,AB+BB+HBP+SF),SLG=div(TB,AB),OPS=OBP+SLG,uBB=Math.max(0,BB-IBB),wDen=(AB+BB-IBB+HBP+SF),wNum=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR,wOBA=div(wNum,wDen);
    p.k = N(p.k ?? p.so ?? p.SO);
    p.pa=PA; p.tb=TB; p.avg=r3(AVG); p.obp=r3(OBP); p.slg=r3(SLG); p.ops=r3(OPS); p.woba=r3(wOBA); p.iso=r3(SLG-AVG); 
    p.double = _2B; p.triple = _3B; p.sb = N(p.sb); p.RBI = N(p.RBI??p.rbi); p.RUN = N(p.RUN??p.run??p.R);
    return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);
  
  function deriveIP(p){ const outs=N(p.outs??p.Outs??p.아웃); if(outs>0) return outs/3; const raw=p.innings??p.ip??p.IP??p.이닝; return parseFloat(raw)||0; }
  function formatIP(ip){ const w=Math.floor(ip),f=ip-w; let mark=0; if(Math.abs(f-1/3)<1e-6) mark=1; else if(Math.abs(f-2/3)<1e-6) mark=2; return `${w}${mark?'.'+mark:''}`; }
  
  function applyDerivedPitch(p){ 
    const ER=N(p.er),ip=deriveIP(p),ERA=div(ER*ERA_BASE,ip); 
    p._ipVal=ip; p.k=N(p.k??p.so??p.SO);
    p.innings = ip > 0 ? formatIP(ip) : 0;
    p.era=r3(ERA); 
    p.wins = N(p.wins); p.losses = N(p.losses); p.saves = N(p.saves); p.holds = N(p.holds); p.bb = N(p.bb); p.hr = N(p.hr);
    return p; 
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  function leagueBatConstants(rows){ let WNUM=0,WDEN=0,PA=0; rows.forEach(p=>{ const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),_1B=Math.max(0,H-_2B-_3B-HR),uBB=Math.max(0,BB-IBB); WNUM+=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR; WDEN+=(AB+BB-IBB+HBP+SF); PA+=N(p.pa); }); const lgwoba=WDEN>0?WNUM/WDEN:0; return {lgwoba,wobaScale:WAR_CFG.WOBAScale,rpw:WAR_CFG.RunsPerWin}; }
  function calcBatWAR(p, K){ const PA=N(p.pa); if(PA<=0) return 0; const woba=N(p.woba),wraa=((woba-K.lgwoba)/K.wobaScale)*PA,bsR=0.2*N(p.sb),repl=WAR_CFG.BatReplacementPerPA*PA,runs=wraa+bsR+repl; return runs/K.rpw; }
  
  function leaguePitchConstants(rows){ let SUM_ER=0, SUM_IP=0, SUM_HR=0, SUM_BB=0, SUM_HBP=0, SUM_K=0; rows.forEach(p=>{ const ip=p._ipVal||0; SUM_IP+=ip; SUM_ER+=N(p.er); SUM_HR+=N(p.hr); SUM_BB+=N(p.bb); SUM_HBP+=N(p.hbp); SUM_K+=N(p.k); }); const lgERA = SUM_IP>0 ? (SUM_ER * ERA_BASE / SUM_IP) : 0; const lgFIP_Raw = SUM_IP>0 ? ((13*SUM_HR + 3*(SUM_BB+SUM_HBP) - 2*SUM_K) / SUM_IP) : 0; const cFIP = lgERA - lgFIP_Raw; const repRA7 = lgERA * WAR_CFG.PitReplacementMult; return { cFIP, repRA7, rpw: WAR_CFG.RunsPerWin }; }
  function calcPitWAR(p, K){ const ip=p._ipVal||0; if(ip<=0) return 0; const fipRaw = (13*N(p.hr) + 3*(N(p.bb)+N(p.hbp)) - 2*N(p.k)) / ip; const fip = fipRaw + K.cFIP; const rar = (K.repRA7 - fip) * (ip / ERA_BASE); return rar / K.rpw; }

  function fetchYearFile(year, type) { const file = type==='bat'?`records_${year}.json?t=${Date.now()}`:`pitching_${year}.json?t=${Date.now()}`; return fetch(file).then(r=>r.ok?r.json():[]).then(normalizeRecords).catch(()=>[]); }
  
  function aggregateBatting(allArrays) {
    const map = new Map(); 
    allArrays.forEach(arr=>{ if(!Array.isArray(arr)) return; arr.forEach(r=>{ 
      const key=pidKey(r); if(!key) return; 
      const t = map.get(key) || { name:r.name, number:r.number??r.playerId??r.id, ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,ci:0,RBI:0,RUN:0,sb:0, k:0 }; 
      t.ab+=N(r.ab); t.hits+=N(r.hits); t.double+=N(r.double); t.triple+=N(r.triple); t.hr+=N(r.hr); t.bb+=N(r.bb); t.ibb+=N(r.ibb); t.hbp+=N(r.hbp); t.sf+=N(r.sf); t.sh+=N(r.sh); t.ci+=N(r.ci); t.RBI+=N(r.RBI??r.rbi); t.RUN+=N(r.RUN??r.run??r.R); t.sb+=N(r.sb); t.k+=N(r.k??r.so??r.SO); 
      map.set(key,t); 
    }); }); 
    return applyDerivedAll(Array.from(map.values())); 
  }
  function aggregatePitching(allArrays) { 
    const map = new Map(); 
    allArrays.forEach(arr=>{ if(!Array.isArray(arr)) return; arr.forEach(r=>{ 
      const key=pidKey(r); if(!key) return; 
      const t=map.get(key)||{name:r.name,number:r.number??r.playerId??r.id,outs:0,er:0,runs:0,so:0,bb:0,hbp:0,hr:0,games:0,wins:0,losses:0,holds:0,saves:0,k:0}; 
      const outs=N(r.outs); t.outs+=(outs>0?outs:Math.round(deriveIP(r)*3)); t.er+=N(r.er); t.runs+=N(r.runs); t.so+=N(r.so); t.k+=N(r.k??r.so??r.SO); t.bb+=N(r.bb); t.hbp+=N(r.hbp); t.hr+=N(r.hr); t.games+=N(r.games); t.wins+=N(r.wins); t.losses+=N(r.losses); t.holds+=N(r.holds); t.saves+=N(r.saves); 
      map.set(key,t); 
    }); }); 
    const rows=Array.from(map.values()); rows.forEach(p=>{ p.outs=Math.max(0,Math.round(p.outs)); }); return applyDerivedPitchAll(rows); 
  }

  const batFields = [ 
    { key: 'name', label: '선수명' }, { key: 'pa', label: '타석' }, { key: 'ab', label: '타수' }, 
    { key: 'hits', label: '안타' }, { key: 'double', label: '2루타' }, { key: 'triple', label: '3루타' }, { key: 'hr', label: '홈런' }, 
    { key: 'RUN', label: '득점' }, { key: 'RBI', label: '타점' }, { key: 'bb', label: '볼넷' }, { key: 'hbp', label: '사구' }, 
    { key: 'k', label: '삼진' }, { key: 'sb', label: '도루' }, 
    { key: 'avg', label: '타율' }, { key: 'obp', label: '출루율' }, { key: 'slg', label: '장타율' }, { key: 'ops', label: 'OPS' }, 
    { key: 'woba', label: 'wOBA' }, { key: 'war', label: 'WAR' } 
  ];
  const pitFields = [ 
    { key: 'name', label: '투수명' }, { key: 'games', label: '등판' }, { key: 'wins', label: '승' }, { key: 'losses', label: '패' }, 
    { key: 'saves', label: '세' }, { key: 'holds', label: '홀' }, { key: 'innings', label: '이닝' }, { key: 'hits', label: '피안타' }, 
    { key: 'hr', label: '피홈런' }, { key: 'bb', label: '볼넷' }, { key: 'k', label: '탈삼진' }, { key: 'runs', label: '실점' }, { key: 'er', label: '자책' }, 
    { key: 'era', label: '방어율' }, { key: 'pwar', label: 'pWAR' } 
  ];
  const floatBat = ['avg', 'obp', 'slg', 'ops', 'woba', 'iso', 'war'];
  const floatPit = ['era', 'pwar'];

  // UI 이벤트
  btnBat.addEventListener('click', () => { if(currentType==='bat')return; currentType='bat'; btnBat.classList.add('active'); btnPit.classList.remove('active'); filterBtn.style.display='inline-block'; currentSort={key:'war',asc:false}; populateSortOptions(); loadData(yearSel.value); });
  btnPit.addEventListener('click', () => { if(currentType==='pit')return; currentType='pit'; btnPit.classList.add('active'); btnBat.classList.remove('active'); filterBtn.style.display='none'; filterOn=false; updateFilterButtonText(); currentSort={key:'era',asc:true}; populateSortOptions(); loadData(yearSel.value); });
  btnListView.addEventListener('click', () => { if(currentView==='list')return; currentView='list'; btnListView.classList.add('active'); btnTableView.classList.remove('active'); listContainer.style.display=''; tableWrapper.style.display='none'; sortAndRender(lastRows); });
  btnTableView.addEventListener('click', () => { if(currentView==='table')return; currentView='table'; btnTableView.classList.add('active'); btnListView.classList.remove('active'); tableWrapper.style.display=''; listContainer.style.display='none'; sortAndRender(lastRows); });
  yearSel.addEventListener('change', () => { filterOn=false; updateFilterButtonText(); loadData(yearSel.value); });
  filterBtn.addEventListener('click', () => { filterOn=!filterOn; updateFilterButtonText(); sortAndRender(lastRows); });
  sortSelect.addEventListener('change', () => { currentSort.key=sortSelect.value; currentSort.asc=(sortSelect.value==='era'); updateSortOrderBtn(); sortAndRender(lastRows); });
  sortOrderBtn.addEventListener('click', () => { currentSort.asc=!currentSort.asc; updateSortOrderBtn(); sortAndRender(lastRows); });
  searchBox.addEventListener('input', () => { searchTerm=(searchBox.value||'').trim(); updateSuggest(); sortAndRender(lastRows); });
  searchBox.addEventListener('focus', updateSuggest);
  searchBox.addEventListener('blur', () => setTimeout(hideSuggest, 150));

  function updateFilterButtonText() { filterBtn.textContent = filterOn ? '✅ 규정타석' : '⚾ 전체 보기'; filterBtn.style.backgroundColor = filterOn ? '#ffebee' : '#f9f9f9'; filterBtn.style.color = filterOn ? '#d32f2f' : '#333'; }
  function updateSortOrderBtn() { sortOrderBtn.textContent = currentSort.asc ? '↑' : '↓'; }
  function populateSortOptions() { 
      const fields = currentType === 'bat' ? batFields : pitFields; 
      sortSelect.innerHTML=''; 
      fields.forEach(f => {
          const opt=document.createElement('option'); opt.value=f.key; opt.textContent=f.label; sortSelect.appendChild(opt);
      }); 
      sortSelect.value = currentSort.key;
  }

  function renderCurrentView(records) { 
      if (currentView === 'list') renderList(records); 
      else renderTable(records); 
  }

  function renderList(records) {
      listContainer.innerHTML = '';
      const fmt = (key, val) => { 
          if(val==null) return '-'; 
          if(['avg','obp','slg','ops','woba'].includes(key)) return Number(val).toFixed(3); 
          if(['war','pwar','era'].includes(key)) return Number(val).toFixed(2); 
          return val; 
      };

      records.forEach(r => { 
          const card = document.createElement('a'); 
          card.className = 'card'; 
          const pid = r.number ?? r.id ?? r.playerId; 
          if(pid!=null) card.href=`player.html?id=${pid}`; 
          
          const infoDiv = document.createElement('div'); 
          infoDiv.className = 'player-info'; 
          infoDiv.innerHTML = `<span class="name">${r.name||'?'}</span> <span class="number">(${pid??'-'})</span>`; 
          
          const statsDiv = document.createElement('div'); 
          statsDiv.className = 'player-stats'; 
          
          let keys = [currentSort.key];
          if (currentType === 'bat') {
              if (!keys.includes('avg')) keys.push('avg');
              if (!keys.includes('ops')) keys.push('ops');
              if (keys.length < 3) keys.push('hr'); 
              if (keys.length < 3) keys.push('hits');
          } else {
              if (!keys.includes('era')) keys.push('era');
              if (!keys.includes('so')) keys.push('so');
              if (keys.length < 3) keys.push('innings');
              if (keys.length < 3) keys.push('wins');
          }
          keys = keys.slice(0, 3);
          
          statsDiv.innerHTML = keys.map(key => { 
              const field = (currentType==='bat'?batFields:pitFields).find(f=>f.key===key); 
              const label = field ? field.label : key.toUpperCase(); 
              const val = fmt(key, r[key]); 
              
              // 팀 컬러(#d32f2f)로 강조
              const isHighlight = (key === currentSort.key);
              const colorStyle = isHighlight ? 'color:#d32f2f;' : '';
              const weightStyle = isHighlight ? 'font-weight:bold; color:#d32f2f;' : '';
              
              return `<div class="stat-item"><span class="label" style="${weightStyle}">${label}</span><span class="value" style="${colorStyle}">${val}</span></div>`; 
          }).join(''); 
          
          card.appendChild(infoDiv); card.appendChild(statsDiv); 
          listContainer.appendChild(card); 
      });
  }

  function renderTable(records) {
    const fields = currentType === 'bat' ? batFields : pitFields;
    const floatF = currentType === 'bat' ? floatBat : floatPit;
    const fmtTbl = (key, v) => floatF.includes(key) ? Number(v).toFixed(key==='era'||key.includes('war')?2:3) : N(v);
    
    theadRow.innerHTML = '';
    fields.forEach(f => { 
        const th = document.createElement('th'); 
        th.textContent = f.label; 
        th.dataset.key = f.key; 
        if (f.key === currentSort.key) { th.textContent += currentSort.asc ? ' ▲' : ' ▼'; th.style.backgroundColor = 'var(--primary-dark)'; } 
        if (f.key === 'name') th.classList.add('sticky-name-col');
        
        th.addEventListener('click', () => { 
            if (currentSort.key === f.key) currentSort.asc = !currentSort.asc; 
            else { currentSort.key = f.key; currentSort.asc = (f.key === 'era'); } 
            sortSelect.value = currentSort.key; updateSortOrderBtn(); sortAndRender(lastRows); 
        }); 
        theadRow.appendChild(th); 
    });
    
    tbody.innerHTML = '';
    records.forEach(r => { 
        const tr = document.createElement('tr'); 
        fields.forEach(f => { 
            const td = document.createElement('td'); 
            let v = r[f.key] ?? 0; 
            
            if (f.key === 'name') { 
                td.classList.add('sticky-name-col');
                const pid = r.number ?? r.id ?? r.playerId; 
                td.innerHTML = `<a href="player.html?id=${pid}" style="color:inherit; text-decoration:none;">${r.name||'?'} <span class="tbl-num">${pid?`(${pid})`:''}</span></a>`;
            } else if (f.key === 'innings' && currentType === 'pit') { 
                td.textContent = r.innings || 0; 
            } else { 
                td.textContent = fmtTbl(f.key, v); 
            } 
            tr.appendChild(td); 
        }); 
        tbody.appendChild(tr); 
    });
  }

  function sortAndRender(records) {
    lastRows = records.slice(); let rows = records.slice();
    if (searchTerm) { const q = searchTerm.toLowerCase(); rows = rows.filter(r => String(r.name || '').toLowerCase().includes(q) || String(r.number || '').includes(q)); }
    if (currentType === 'bat' && filterOn) { rows = rows.filter(r => Number(r.pa) >= minPAForLeaders); }
    else if (currentType === 'bat') { rows = rows.filter(r => Number(r.pa) >= 1); }
    else if (currentType === 'pit') { rows = rows.filter(r => (r._ipVal != null ? r._ipVal : deriveIP(r)) > 0); }
    
    const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key)) || (currentType==='pit' && floatPit.includes(currentSort.key));
    
    rows.sort((a,b)=>{ 
        if(currentSort.key==='name') return String(a.name||'').localeCompare(String(b.name||''))*(currentSort.asc?1:-1);
        if(currentType==='pit' && currentSort.key==='innings') {
            const va = a._ipVal || deriveIP(a); const vb = b._ipVal || deriveIP(b);
            return currentSort.asc ? va-vb : vb-va;
        }
        let va=a[currentSort.key], vb=b[currentSort.key]; 
        if(isFloat){ va=Number(va)||0; vb=Number(vb)||0; } else { va=N(va); vb=N(vb); } 
        return currentSort.asc ? va-vb : vb-va;
    });
    
    renderCurrentView(rows);
  }

  function loadData(year) {
    listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">데이터 로딩 중...</p>'; 
    tableWrapper.style.display = 'none'; listContainer.style.display = '';
    
    minPAForLeaders = year === 'career' ? 40 : 15; 
    updateFilterButtonText();
    
    let batPromise, pitPromise;
    if (year === 'career') {
        const years = ['2022','2023','2024','2025','2026'];
        batPromise = Promise.all(years.map(y=>fetchYearFile(y,'bat'))).then(aggregateBatting);
        pitPromise = Promise.all(years.map(y=>fetchYearFile(y,'pit'))).then(aggregatePitching);
    } else {
        batPromise = fetchYearFile(year, 'bat').then(applyDerivedAll);
        pitPromise = fetchYearFile(year, 'pit').then(applyDerivedPitchAll);
    }
    
    Promise.all([batPromise, pitPromise]).then(([bData, pData]) => {
        globalBatData = bData; globalPitData = pData;
        if (bData.length > 0) { const Kb = leagueBatConstants(bData); bData.forEach(p => { p.war = calcBatWAR(p, Kb); }); }
        if (pData.length > 0) { const Kp = leaguePitchConstants(pData); pData.forEach(p => { p.pwar = calcPitWAR(p, Kp); }); }
        
        populateSortOptions();
        sortAndRender(currentType === 'bat' ? globalBatData : globalPitData);
    }).catch(e => {
        listContainer.innerHTML = `<p style="text-align:center;">데이터 로드 실패: ${e.message}</p>`;
    });
  }

  // 검색 로직
  function updateSuggest() { 
      const box = suggestBox; if(!box) return; 
      const q = (searchTerm||'').toLowerCase(); 
      if(!q) { box.style.display='none'; return; } 
      const names = Array.from(new Set(lastRows.map(r=>String(r.name||'')))).filter(Boolean); 
      const list = names.filter(n=>n.toLowerCase().includes(q)).slice(0,5); 
      if(!list.length) { box.style.display='none'; return; } 
      box.innerHTML=''; 
      list.forEach(name => {
          const item=document.createElement('div'); item.className='suggest-item'; item.textContent=name; 
          item.addEventListener('mousedown',(e)=>{e.preventDefault(); searchBox.value=name; searchTerm=name; box.style.display='none'; sortAndRender(lastRows);}); 
          box.appendChild(item);
      }); 
      box.style.display='block'; 
  }
  function hideSuggest() { if (suggestBox) suggestBox.style.display = 'none'; }


  // ==========================================
  // ★ 선수 비교(Comparison) 모달 로직 복구
  // ==========================================
  if (btnCompare) { 
      btnCompare.addEventListener('click', () => { 
          modal.style.display = 'flex'; 
          selectPhase.style.display = 'block'; 
          resultPhase.style.display = 'none'; 
          resetComparison(); 
      }); 
  }
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
  if (resetCompareBtn) resetCompareBtn.addEventListener('click', resetComparison);
  
  if (compareSearch) { 
      compareSearch.addEventListener('input', (e) => { 
          const q = e.target.value.toLowerCase(); 
          const sourceList = compareMode === 'bat' ? globalBatData : globalPitData; 
          const filtered = sourceList.filter(r => String(r.name||'').toLowerCase().includes(q) || String(r.number||'').includes(q)); 
          renderCompareList(filtered); 
      }); 
  }
  
  if (compBatBtn) compBatBtn.addEventListener('click', () => { compareMode = 'bat'; compBatBtn.classList.add('active'); compPitBtn.classList.remove('active'); updateComparisonView(); });
  if (compPitBtn) compPitBtn.addEventListener('click', () => { compareMode = 'pit'; compPitBtn.classList.add('active'); compBatBtn.classList.remove('active'); updateComparisonView(); });

  function resetComparison() { 
      selectedPlayers = [null, null]; 
      compareMode = currentType; 
      if(compareMode === 'bat') { compBatBtn.classList.add('active'); compPitBtn.classList.remove('active'); } 
      else { compPitBtn.classList.add('active'); compBatBtn.classList.remove('active'); } 
      
      selectPhase.style.display = 'block'; 
      resultPhase.style.display = 'none'; 
      slot1.textContent = '선수 1 선택'; slot1.className = 'slot empty'; 
      slot2.textContent = '선수 2 선택'; slot2.className = 'slot empty'; 
      compareSearch.value = ''; 
      renderCompareList(compareMode === 'bat' ? globalBatData : globalPitData); 
  }

  function renderCompareList(list) { 
      compareList.innerHTML = ''; 
      list.forEach(p => { 
          const li = document.createElement('li'); 
          const pid = p.number ?? p.id ?? p.playerId; 
          li.textContent = `${p.name} (#${pid||'-'})`; 
          li.addEventListener('click', () => selectPlayer(pid, p.name)); 
          compareList.appendChild(li); 
      }); 
  }

  function selectPlayer(pid, name) { 
      if (!selectedPlayers[0]) { 
          selectedPlayers[0] = pid; slot1.textContent = name; slot1.className = 'slot selected'; 
      } else if (!selectedPlayers[1]) { 
          if (selectedPlayers[0] === pid) { alert('다른 선수를 선택해주세요.'); return; } 
          selectedPlayers[1] = pid; slot2.textContent = name; slot2.className = 'slot selected'; 
          setTimeout(showComparisonResult, 300); 
      } 
  }

  function showComparisonResult() { 
      selectPhase.style.display = 'none'; 
      resultPhase.style.display = 'block'; 
      updateComparisonView(); 
  }

  function updateComparisonView() { 
      const sourceData = (compareMode === 'bat') ? globalBatData : globalPitData; 
      const p1 = sourceData.find(p => pidKey(p) == selectedPlayers[0]); 
      const p2 = sourceData.find(p => pidKey(p) == selectedPlayers[1]); 
      
      if (!p1 || !p2) { compareTable.innerHTML = `<tr><td colspan="3" style="padding:20px; color:#888;">두 선수 모두 해당 모드 기록이 존재해야 합니다.</td></tr>`; return; } 
      
      let metrics = []; 
      if (compareMode === 'bat') { 
          metrics = [ { key: 'pa', label: '타석' }, { key: 'avg', label: '타율' }, { key: 'obp', label: '출루율' }, { key: 'slg', label: '장타율' }, { key: 'ops', label: 'OPS' }, { key: 'hits', label: '안타' }, { key: 'hr', label: '홈런' }, { key: 'RBI', label: '타점' }, { key: 'sb', label: '도루' }, { key: 'k', label: '삼진', lowerIsBetter: true }, { key: 'war', label: 'WAR' } ]; 
      } else { 
          metrics = [ { key: 'games', label: '등판' }, { key: 'era', label: 'ERA', lowerIsBetter: true }, { key: 'innings', label: '이닝' }, { key: 'wins', label: '승' }, { key: 'so', label: '탈삼진' }, { key: 'bb', label: '볼넷', lowerIsBetter: true }, { key: 'pwar', label: 'pWAR' } ]; 
      } 
      
      let html = `<thead><tr><th style="width:35%; color:#d32f2f;">${p1.name}</th><th style="width:30%">항목</th><th style="width:35%; color:#d32f2f;">${p2.name}</th></tr></thead><tbody>`; 
      
      metrics.forEach(m => { 
          let v1 = p1[m.key]; let v2 = p2[m.key]; 
          let n1 = (m.key === 'innings') ? (p1._ipVal || 0) : N(v1); 
          let n2 = (m.key === 'innings') ? (p2._ipVal || 0) : N(v2); 
          
          let disp1 = formatValue(m.key, v1); let disp2 = formatValue(m.key, v2); 
          let cls1 = '', cls2 = ''; 
          
          if (n1 !== n2) { 
              let p1Better = (n1 > n2); 
              if (m.lowerIsBetter) p1Better = !p1Better; 
              if (p1Better) cls1 = 'winner'; else cls2 = 'winner'; 
          } 
          html += `<tr><td class="${cls1}">${disp1}</td><td><span class="stat-label">${m.label}</span></td><td class="${cls2}">${disp2}</td></tr>`; 
      }); 
      html += '</tbody>'; 
      compareTable.innerHTML = html; 
  }

  function formatValue(key, val) { 
      if (val == null) return '-'; 
      if (['avg','obp','slg','ops','woba'].includes(key)) return Number(val).toFixed(3); 
      if (['era','war','pwar'].includes(key)) return Number(val).toFixed(2); 
      return val; 
  }

  // 초기 실행
  loadData(yearSel.value);
});