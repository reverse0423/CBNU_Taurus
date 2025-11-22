// records.js — FINAL (FIP-based Pitcher WAR implemented)

document.addEventListener('DOMContentLoaded', () => {
  // --- 요소 참조 ---
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
  const leadersBox = document.getElementById('leaders');
  const searchWrap = document.getElementById('searchWrap');
  const btnListView = document.getElementById('btn-list-view');
  const btnTableView = document.getElementById('btn-table-view');

  // --- 상태 변수 ---
  let currentType = 'bat';
  let currentView = 'list';
  let filterOn = false;
  let currentSort = { key: 'war', asc: false };
  let searchTerm = '';
  let lastRows = [];
  let minPAForLeaders = 0;
  let scheduleCache = null;

  // --- 유틸 ---
  const N = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3 = x => Math.round(x * 1000) / 1000;
  const ERA_BASE = 7;
  const WAR_CFG = { WOBAScale: 1.15, RunsPerWin: 7.5, BatReplacementPerPA: 0.033, PitReplacementMult: 1.20 };
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
  function normalizeRecords(data) { if (Array.isArray(data)) return data; if (data?.players) return data.players; if (data?.batters) return data.batters; if (data?.records) return data.records; if (data?.data) return data.data; return []; }
  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  // --- 타격 파생 ---
  function applyDerived(p) {
    const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),CI=N(p.ci),PAi=N(p.pa),PA=PAi>0?PAi:(AB+BB+HBP+SF+SH+CI),_1B=Math.max(0,H-_2B-_3B-HR),TB=_1B+2*_2B+3*_3B+4*HR,AVG=div(H,AB),OBP=div(H+BB+HBP,AB+BB+HBP+SF),SLG=div(TB,AB),OPS=OBP+SLG,uBB=Math.max(0,BB-IBB),wDen=(AB+BB-IBB+HBP+SF),wNum=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR,wOBA=div(wNum,wDen);
    p.k = N(p.k ?? p.so ?? p.SO); // 삼진 정규화
    p.pa=PA;p.tb=TB;p.avg=r3(AVG);p.obp=r3(OBP);p.slg=r3(SLG);p.ops=r3(OPS);p.woba=r3(wOBA);p.iso=r3(SLG-AVG); return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);

  // --- 투수 파생 ---
  function normalizeFractionStr(str=''){ return String(str).replace(/\u2153/g,' 1/3').replace(/\u2154/g,' 2/3').replace(/\u00BC/g,' 1/4').replace(/\u00BD/g,' 1/2').replace(/\u00BE/g,' 3/4'); }
  function parseIPValue(v){ if(v==null||v==='') return 0; if(typeof v==='number'){const f=Math.trunc(v),frac=v-f;if(Math.abs(frac-0.1)<1e-6) return f+1/3;if(Math.abs(frac-0.2)<1e-6) return f+2/3; return v;} const s=normalizeFractionStr(String(v)).trim(); const m=s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/); if(m){const whole=+m[1],num=m[2]?+m[2]:0,den=m[3]?+m[3]:1; return whole+(den?num/den:0);} const m2=s.match(/^(\d+)\.(\d)$/); if(m2){const whole=+m2[1],dec=+m2[2]; if(dec===1) return whole+1/3; if(dec===2) return whole+2/3; return +s;} const n=parseFloat(s); return isNaN(n)?0:n; }
  function formatIP(ip){ const w=Math.floor(ip),f=ip-w; let mark=0; if(Math.abs(f-1/3)<1e-6) mark=1; else if(Math.abs(f-2/3)<1e-6) mark=2; else if(f>0){ const snaps=[0,1/3,2/3]; let best=0,bd=1; snaps.forEach((s,i)=>{ const d=Math.abs(f-s); if(d<bd){bd=d;best=i;} }); mark=best; } return `${w}${mark?'.'+mark:''}`; }
  function deriveIP(p){ const outs=N(p.outs??p.Outs??p.아웃); if(outs>0) return outs/3; const raw=p.innings??p.ip??p.IP??p.이닝; return parseIPValue(raw); }
  
  function applyDerivedPitch(p){ 
    const ER=N(p.er),ip=deriveIP(p),ERA=div(ER*ERA_BASE,ip); 
    p._ipVal=ip; 
    p.k = N(p.k ?? p.so ?? p.SO); // ★ 투수 삼진 정규화
    if(ip>0) p.innings=formatIP(ip); else p.innings=p.innings??p.ip??p.IP??p.이닝??0; 
    p.era=r3(ERA); 
    return p; 
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  // --- WAR 계산 (FIP 적용) ---
  function leagueBatConstants(rows){ let WNUM=0,WDEN=0,PA=0; rows.forEach(p=>{ const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),_1B=Math.max(0,H-_2B-_3B-HR),uBB=Math.max(0,BB-IBB); WNUM+=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR; WDEN+=(AB+BB-IBB+HBP+SF); PA+=N(p.pa); }); const lgwoba=WDEN>0?WNUM/WDEN:0; return {lgwoba,wobaScale:WAR_CFG.WOBAScale,rpw:WAR_CFG.RunsPerWin}; }
  function calcBatWAR(p, K){ const PA=N(p.pa); if(PA<=0) return 0; const woba=N(p.woba),wraa=((woba-K.lgwoba)/K.wobaScale)*PA,bsR=0.2*N(p.sb),repl=WAR_CFG.BatReplacementPerPA*PA,runs=wraa+bsR+repl; return runs/K.rpw; }

  // ★ 투수 리그 상수 (FIP용 상수 cFIP 계산 포함)
  function leaguePitchConstants(rows){ 
    let SUM_ER=0, SUM_IP=0, SUM_HR=0, SUM_BB=0, SUM_HBP=0, SUM_K=0; 
    rows.forEach(p=>{ 
      const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; 
      SUM_IP += ip; 
      SUM_ER += N(p.er); 
      SUM_HR += N(p.hr); 
      SUM_BB += N(p.bb); 
      SUM_HBP+= N(p.hbp); 
      SUM_K  += N(p.k); 
    }); 
    
    const lgERA = SUM_IP>0 ? (SUM_ER * ERA_BASE / SUM_IP) : 0;
    // FIP 공식 분자: 13*HR + 3*(BB+HBP) - 2*K
    const lgFIP_Raw = SUM_IP>0 ? ((13*SUM_HR + 3*(SUM_BB+SUM_HBP) - 2*SUM_K) / SUM_IP) : 0;
    const cFIP = lgERA - lgFIP_Raw; // 리그 평균 FIP를 리그 평균 ERA와 맞추는 상수

    // 대체 선수 수준 (RA7 기준 1.2배)
    const repRA7 = lgERA * WAR_CFG.PitReplacementMult; 

    return { cFIP, repRA7, rpw: WAR_CFG.RunsPerWin }; 
  }

  // ★ 투수 WAR (fWAR 스타일: FIP 기반)
  function calcPitWAR(p, K){ 
    const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; 
    if(ip<=0) return 0; 
    
    // FIP 계산: (13HR + 3(BB+HBP) - 2K) / IP + cFIP
    const fipRaw = (13*N(p.hr) + 3*(N(p.bb)+N(p.hbp)) - 2*N(p.k)) / ip;
    const fip = fipRaw + K.cFIP;
    
    // WAR = (대체수준_Run - FIP_Run) / RunsPerWin (ERA 스케일이므로 FIP를 RA7처럼 취급)
    // FIP는 실점 규모(RA9)가 아닌 자책점 규모(ERA)에 맞춰지므로, RA9 변환은 생략하고 간단히 계산
    // 여기서는 '대체선수 대비 득점 억제력'을 FIP로 판단
    const rar = (K.repRA7 - fip) * (ip / ERA_BASE); 
    return rar / K.rpw; 
  }

  // --- Career 집계 ---
  const numericYearsFromSelect = () => Array.from(yearSel?.options || []).map(o => o.value).filter(v => /^\d{4}$/.test(v));
  function fetchYearFile(year, type) { const file = type==='bat'?`records_${year}.json`:`pitching_${year}.json`; return fetch(file).then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(normalizeRecords).catch(err=>{ console.warn(`Failed to fetch/parse ${file}:`,err); return []; }); }
  
  function aggregateBatting(allArrays) {
    const map = new Map(); 
    allArrays.forEach((arr)=>{ 
      if(!Array.isArray(arr)) return; 
      arr.forEach((r)=>{ 
        const key=pidKey(r); if(!key) return; 
        let cn=map.has(key)?map.get(key).name:null; if(!cn && r.name) cn=r.name; 
        let cnum=map.has(key)?map.get(key).number:null; if(cnum==null && (r.number??r.playerId??r.id)!=null) cnum=r.number??r.playerId??r.id; 
        const t = map.get(key) || { ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,ci:0,RBI:0,RUN:0,sb:0, k:0 }; 
        t.name=cn; t.number=cnum; 
        t.ab+=N(r.ab); t.hits+=N(r.hits); t.double+=N(r.double); t.triple+=N(r.triple); t.hr+=N(r.hr); 
        t.bb+=N(r.bb); t.ibb+=N(r.ibb); t.hbp+=N(r.hbp); t.sf+=N(r.sf); t.sh+=N(r.sh); t.ci+=N(r.ci); 
        t.RBI+=N(r.RBI??r.rbi); t.RUN+=N(r.RUN??r.run??r.R); t.sb+=N(r.sb); 
        t.k += N(r.k ?? r.so ?? r.SO); 
        map.set(key,t); 
      }); 
    }); 
    return applyDerivedAll(Array.from(map.values())); 
  }
  
  function aggregatePitching(allArrays) { 
    const map = new Map(); 
    allArrays.forEach(arr=>{ 
      if(!Array.isArray(arr)) return; 
      arr.forEach(r=>{ 
        const key=pidKey(r); if(!key) return; 
        const t=map.get(key)||{name:r.name,number:r.number??r.playerId??r.id,outs:0,er:0,runs:0,so:0,bb:0,hbp:0,hr:0,games:0,wins:0,losses:0,holds:0,saves:0,k:0}; 
        t.name=t.name||r.name; t.number=t.number??r.number??r.playerId??r.id; 
        const outs=N(r.outs); let addOuts=0; if(outs>0) addOuts=outs; else addOuts=Math.round(deriveIP(r)*3); 
        t.outs+=addOuts; t.er+=N(r.er); t.runs+=N(r.runs); 
        t.so+=N(r.so); t.k+=N(r.k ?? r.so ?? r.SO); // k 합산
        t.bb+=N(r.bb); t.hbp+=N(r.hbp); t.hr+=N(r.hr);
        t.games+=N(r.games); t.wins+=N(r.wins); t.losses+=N(r.losses); t.holds+=N(r.holds); t.saves+=N(r.saves); 
        map.set(key,t); 
      }); 
    }); 
    const rows=Array.from(map.values()); rows.forEach(p=>{ p.outs=Math.max(0,Math.round(p.outs)); }); return applyDerivedPitchAll(rows); 
  }
  
  function loadCareerAggregated(type) { const years=numericYearsFromSelect(); if(!years.length) return Promise.resolve([]); const jobs=years.map(y=>fetchYearFile(y,type)); return Promise.all(jobs).then(allYearlyData=>{ return type==='bat'?aggregateBatting(allYearlyData):aggregatePitching(allYearlyData); }).catch(err=>{ console.error("Career agg error:",err); return []; }); }

  // --- 필드 정의 ---
  const batFields = [
    { key: 'name', label: '선수명' }, { key: 'pa', label: '타석' }, { key: 'hits', label: '안타' },
    { key: 'hr', label: '홈런' }, { key: 'RBI', label: '타점' }, { key: 'RUN', label: '득점' },
    { key: 'sb', label: '도루' }, { key: 'k', label: '삼진' }, 
    { key: 'avg', label: '타율' }, { key: 'obp', label: '출루율' },
    { key: 'slg', label: '장타율' }, { key: 'ops', label: 'OPS' }, { key: 'woba', label: 'wOBA' },
    { key: 'war', label: 'WAR' }
  ];
  const pitFields = [ 
    { key: 'name', label: '투수명' }, { key: 'games', label: '등판' }, { key: 'innings', label: '이닝' },
    { key: 'era', label: '방어율' }, { key: 'wins', label: '승' }, { key: 'losses', label: '패' },
    { key: 'so', label: '탈삼진' }, { key: 'pwar', label: 'pWAR' } 
  ];
  const floatBat = ['avg', 'obp', 'slg', 'ops', 'woba', 'iso', 'war'];
  const floatPit = ['era', 'pwar'];

  // --- UI 핸들러 ---
  ensureTopUI();
  btnBat.addEventListener('click', () => { if (currentType === 'bat') return; currentType = 'bat'; btnBat.classList.add('active'); btnPit.classList.remove('active'); filterBtn.style.display = 'inline-block'; currentSort = { key: 'war', asc: false }; populateSortOptions(); syncURL(); loadData(yearSel.value); });
  btnPit.addEventListener('click', () => { if (currentType === 'pit') return; currentType = 'pit'; btnPit.classList.add('active'); btnBat.classList.remove('active'); filterBtn.style.display = 'none'; filterOn = false; updateFilterButtonText(); currentSort = { key: 'era', asc: true }; populateSortOptions(); syncURL(); loadData(yearSel.value); });
  btnListView.addEventListener('click', () => { if (currentView === 'list') return; currentView = 'list'; btnListView.classList.add('active'); btnTableView.classList.remove('active'); listContainer.style.display = ''; tableWrapper.style.display = 'none'; syncURL(); renderCurrentView(lastRows); });
  btnTableView.addEventListener('click', () => { if (currentView === 'table') return; currentView = 'table'; btnTableView.classList.add('active'); btnListView.classList.remove('active'); tableWrapper.style.display = ''; listContainer.style.display = 'none'; syncURL(); renderCurrentView(lastRows); });
  yearSel.addEventListener('change', () => { filterOn = false; updateFilterButtonText(); syncURL(); loadData(yearSel.value); });
  filterBtn.addEventListener('click', () => { filterOn = !filterOn; updateFilterButtonText(); syncURL(); sortAndRender(lastRows); });
  function updateFilterButtonText() { filterBtn.textContent = filterOn ? '✅ 규정타석' : '⚾ 전체 보기'; }
  sortSelect.addEventListener('change', () => { const nk=sortSelect.value; if(nk==='name'){currentSort={key:'name',asc:true};}else{if(currentSort.key===nk){currentSort.asc=!currentSort.asc;}else{currentSort={key:nk,asc:(nk==='era')};}} updateSortOrderBtn(); syncURL(); sortAndRender(lastRows); });
  sortOrderBtn.addEventListener('click', () => { currentSort.asc=!currentSort.asc; updateSortOrderBtn(); syncURL(); sortAndRender(lastRows); });
  function updateSortOrderBtn() { sortOrderBtn.textContent = currentSort.asc ? '↑' : '↓'; }
  function populateSortOptions() { const fields=(currentType==='bat')?batFields:pitFields; sortSelect.innerHTML=''; fields.forEach(f=>{const opt=document.createElement('option'); opt.value=f.key; opt.textContent=f.label; sortSelect.appendChild(opt);}); if(fields.some(f=>f.key===currentSort.key)){sortSelect.value=currentSort.key;}else{ currentSort.key = (currentType === 'bat' ? 'war' : 'era'); sortSelect.value = currentSort.key; } updateSortOrderBtn(); }
  searchBox.addEventListener('input', () => { searchTerm = (searchBox.value||'').trim(); updateSuggest(); syncURL(); sortAndRender(lastRows); });
  searchBox.addEventListener('focus', updateSuggest);
  searchBox.addEventListener('blur', () => setTimeout(hideSuggest, 150));
  searchBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') { hideSuggest(); sortAndRender(lastRows); } });

  // --- 렌더링 ---
  function renderCurrentView(records) { if (currentView === 'list') { renderList(records); } else { renderTable(records); } }
  
  function renderList(records) {
     listContainer.innerHTML = '';
     const fieldsDefinition = (currentType === 'bat') ? batFields : pitFields;
     const fmt = (key, value) => { const isRate=['avg','obp','slg','ops','woba'].includes(key), isWarEra=['war','pwar','era'].includes(key), isIP=key==='innings'; if(value==null) return '-'; if(isWarEra) return Number(value).toFixed(2); if(isRate) return Number(value).toFixed(3); if(isIP) return value; return N(value); };
     records.forEach(r => { const card=document.createElement('a'); card.className='card record-list-item'; const pid=r.number??r.id??r.playerId; if(pid!=null){ card.href=`player.html?id=${pid}`; } const infoDiv=document.createElement('div'); infoDiv.className='player-info'; infoDiv.innerHTML=`<span>#${pid??'-'}</span>${r.name||'?'}`; const statsDiv=document.createElement('div'); statsDiv.className='player-stats'; const keyStatsToShow=[]; keyStatsToShow.push(currentSort.key); if(currentType==='bat'){ if(currentSort.key!=='avg') keyStatsToShow.push('avg'); if(currentSort.key!=='war') keyStatsToShow.push('war'); }else{ if(currentSort.key!=='era') keyStatsToShow.push('era'); if(currentSort.key!=='pwar') keyStatsToShow.push('pwar'); } const finalKeys=[...new Set(keyStatsToShow)].slice(0, 3); statsDiv.innerHTML = finalKeys.map(key=>{ const field=fieldsDefinition.find(f=>f.key===key); const label=field?field.label:key.toUpperCase(); const value=fmt(key, r[key]); return `<div class="stat-item"><span class="label">${label}</span><span class="value">${value}</span></div>`; }).join(''); card.appendChild(infoDiv); card.appendChild(statsDiv); listContainer.appendChild(card); });
  }

  function renderTable(records) {
    const fields = (currentType === 'bat') ? batFields : pitFields;
    const floatF = (currentType === 'bat') ? floatBat : floatPit;
    const fmtTbl = (key, v) => floatF.includes(key) ? fmtByKey(key, v) : v;
    theadRow.innerHTML = '';
    fields.forEach(f => { const th = document.createElement('th'); th.textContent = f.label; th.dataset.key = f.key; if (f.key === currentSort.key) { th.textContent += currentSort.asc ? ' ▲' : ' ▼'; th.style.backgroundColor = 'var(--primary-100)'; } th.style.cursor = 'pointer'; th.addEventListener('click', () => { const key = th.dataset.key; if (currentSort.key === key) { currentSort.asc = !currentSort.asc; } else { currentSort.key = key; currentSort.asc = (key === 'era'); } sortSelect.value = currentSort.key; updateSortOrderBtn(); syncURL(); sortAndRender(lastRows); }); theadRow.appendChild(th); });
    tbody.innerHTML = '';
    records.forEach(r => { const tr = document.createElement('tr'); fields.forEach(f => { const td = document.createElement('td'); let v = r[f.key] ?? ''; if (f.key === 'name') { const pid = r.number ?? r.id ?? r.playerId; if (pid != null) { const link = document.createElement('a'); link.href = `player.html?id=${pid}`; link.textContent = v; link.style.color = 'var(--primary)'; td.appendChild(link); } else { td.textContent = v; } } else if (f.key === 'innings' && currentType === 'pit') { td.textContent = v; } else { td.textContent = fmtTbl(f.key, v); } if (f.key === 'name') { td.classList.add('sticky-name-col'); } tr.appendChild(td); }); tbody.appendChild(tr); });
  }
  function fmtByKey(key, v) { if (key === 'era' || key === 'war' || key === 'pwar') return Number(v).toFixed(2); return Number(v).toFixed(3); }

  // --- 로직 ---
  function sortAndRender(records) {
    lastRows = records.slice(); let rows = records.slice();
    if (searchTerm) { const q = searchTerm.toLowerCase(); rows = rows.filter(r => String(r.name || '').toLowerCase().startsWith(q) || String(r.number || '').toLowerCase().startsWith(q)); }
    if (currentType === 'bat' && filterOn) { rows = rows.filter(r => Number(r.pa) >= minPAForLeaders); }
    else if (currentType === 'bat') { rows = rows.filter(r => Number(r.pa) >= 1); }
    else if (currentType === 'pit') { rows = rows.filter(r => (r._ipVal != null ? r._ipVal : deriveIP(r)) > 0); }
    
    const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key)) || (currentType==='pit' && floatPit.includes(currentSort.key));
    rows.sort((a,b)=>{ 
        if(currentType==='pit'&&currentSort.key==='innings'){const va=(a._ipVal!=null?a._ipVal:deriveIP(a))||0; const vb=(b._ipVal!=null?b._ipVal:deriveIP(b))||0; if(va<vb) return currentSort.asc?-1:1; if(va>vb) return currentSort.asc?1:-1; return String(a.name||'').localeCompare(String(b.name||''));} 
        if(currentSort.key==='name'){return String(a.name||'').localeCompare(String(b.name||''))*(currentSort.asc?1:-1);} 
        let va=a[currentSort.key],vb=b[currentSort.key]; if(isFloat){va=Number(va);vb=Number(vb);}else{va=N(va);vb=N(vb);} 
        if(va<vb) return currentSort.asc?-1:1; if(va>vb) return currentSort.asc?1:-1; 
        return String(a.name||'').localeCompare(String(b.name||'')); 
    });
    renderCurrentView(rows);
    if (leadersBox) { if (currentType==='bat' && rows.length) { leadersBox.innerHTML=buildLeadersHTML(rows,minPAForLeaders); } else { leadersBox.innerHTML=''; } ensureLeadersPlacement(); }
    updateSuggest();
  }

  function loadData(year) {
    const minPAp = getMinPAForYear(year).then(v => { minPAForLeaders = v; });
    const showLoading = () => { listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">기록 로드 중...</p>'; tableWrapper.style.display = 'none'; listContainer.style.display = ''; if (leadersBox) leadersBox.innerHTML = ''; };
    const showError = (err) => { console.error(`Error loading data for ${year} (${currentType}):`, err); listContainer.innerHTML = `<p style="text-align:center; padding: 20px;">기록 로드 실패 (${err.message || 'Unknown error'}).</p>`; };
    showLoading();
    getMinPAForYear(year).then(minPA => {
        minPAForLeaders = minPA; updateFilterButtonText();
        if (year === 'career') return loadCareerAggregated(currentType);
        const file = (currentType === 'bat') ? `records_${year}.json` : `pitching_${year}.json`;
        return fetch(file).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} for ${file}`))).then(normalizeRecords);
    })
    .then(arr => {
        if (!Array.isArray(arr)) { throw new Error("Loaded data is not an array."); }
        if (currentType === 'bat') {
            const processedArr = applyDerivedAll(arr);
            const K = leagueBatConstants(processedArr);
            processedArr.forEach(p => { p.war = calcBatWAR(p, K); });
            lastRows = processedArr;
        } else {
            const processedArr = applyDerivedPitchAll(arr);
            const Kp = leaguePitchConstants(processedArr);
            processedArr.forEach(p => { p.pwar = calcPitWAR(p, Kp); });
            lastRows = processedArr;
        }
        populateSortOptions(); sortAndRender(lastRows);
    })
    .catch(showError);
  }

  // --- 기타 함수 ---
  function fetchSchedule() { if(scheduleCache) return Promise.resolve(scheduleCache); return fetch('schedule.json').then(r=>r.ok?r.json():Promise.reject()).then(data=>(scheduleCache=data)).catch(()=>(scheduleCache={})); }
  function countPlayedGames(scheduleData,year) { try{const arr=scheduleData?.[year]||[]; let cnt=0; for(let i=0;i<arr.length;i++){const res=String(arr[i]?.result||'').trim(); if(/^(승|패)/.test(res)) cnt++;} return cnt;}catch(e){return 0;} }
  function getMinPAForYear(year) { if(year==='career') return Promise.resolve(40); return fetchSchedule().then(sc=>{ const played=countPlayedGames(sc,year); return Math.max(0,Math.ceil(played*1.5)); }).catch(()=>20); }
  function topN(rows,key,n,isRate,minPA) { const arr=rows.slice().filter(r=>!isRate||Number(r.pa)>=(minPA||0)); arr.sort((a,b)=>(+b[key]||0)-(+a[key]||0)); return arr.slice(0,n); }
  function buildLeadersHTML(rows,minPA) { const blocks=[{key:'iso',label:'ISO',rate:true},{key:'ops',label:'OPS',rate:true},{key:'avg',label:'AVG',rate:true},{key:'hr',label:'HR'},{key:'hits',label:'H'},{key:'RBI',label:'RBI'},{key:'RUN',label:'R'},{key:'sb',label:'SB'}]; const chips=blocks.map(b=>{const top=topN(rows,b.key,3,b.rate,minPA); const items=top.map(t=>`${t.name} <b>${Number(t[b.key]||0).toFixed(b.rate?3:0)}</b>`).join(' · '); return `<div class="mini-chip"><strong>${b.label}</strong> ${items}</div>`;}).join(''); const note=`<div class="mini-note">규정타석 (${minPA} PA) 기준</div>`; return note+chips; }
  function ensureLeadersPlacement() { if(!leadersBox) return; const controls=document.querySelector('.controls'); if(controls&&controls.parentNode&&leadersBox.parentNode!==controls.parentNode){ controls.parentNode.insertBefore(leadersBox,controls.nextSibling); } }
  function updateSuggest() { const box=suggestBox; if(!box) return; const q=(searchTerm||'').trim().toLowerCase(); if(!q){hideSuggest(); return;} const names=Array.from(new Set(lastRows.map(r=>String(r.name||'')))).filter(Boolean); const list=names.filter(n=>n.toLowerCase().startsWith(q)).slice(0,8); if(!list.length){hideSuggest(); return;} box.innerHTML=''; list.forEach(name=>{const item=document.createElement('div'); item.className='suggest-item'; item.textContent=name; item.addEventListener('mousedown',(e)=>{e.preventDefault(); searchBox.value=name; searchTerm=name; hideSuggest(); syncURL(); sortAndRender(lastRows);}); box.appendChild(item);}); box.style.display='block'; }
  function hideSuggest() { if (suggestBox) suggestBox.style.display = 'none'; }
  function restoreFromURL() { const qs=new URLSearchParams(location.search); const type=qs.get('type'); const year=qs.get('year'); const sort=qs.get('sort'); const desc=qs.get('desc'); const filterParam=qs.get('f'); const q=qs.get('q'); const viewParam=qs.get('view'); currentView=(viewParam==='table')?'table':'list'; if(currentView==='table'){btnTableView.classList.add('active');btnListView.classList.remove('active');tableWrapper.style.display='';listContainer.style.display='none';}else{btnListView.classList.add('active');btnTableView.classList.remove('active');listContainer.style.display='';tableWrapper.style.display='none';} if(type==='pit'){currentType='pit';btnPit.classList.add('active');btnBat.classList.remove('active');filterBtn.style.display='none';currentSort={key:'era',asc:true};}else{currentType='bat';btnBat.classList.add('active');btnPit.classList.remove('active');filterBtn.style.display='inline-block';currentSort={key:'war',asc:false};} if(year&&Array.from(yearSel.options).some(o=>o.value===year))yearSel.value=year; if(sort)currentSort.key=sort; if(desc==='1')currentSort.asc=false;else if(desc==='0')currentSort.asc=true;else currentSort.asc=(currentSort.key==='era'); filterOn=(currentType==='bat'&&filterParam==='1'); updateFilterButtonText(); if(q){searchTerm=q;if(searchBox)searchBox.value=q;} populateSortOptions(); }
  function syncURL() { const qs=new URLSearchParams(); qs.set('type',currentType); qs.set('year',yearSel.value); qs.set('sort',currentSort.key); qs.set('desc',currentSort.asc?'0':'1'); if(currentType==='bat'&&filterOn)qs.set('f','1'); if(searchTerm)qs.set('q',searchTerm); if(currentView==='table')qs.set('view','table'); const newUrl=location.pathname+'?'+qs.toString(); if(window.location.search!=='?'+qs.toString()){history.pushState({path:newUrl},'',newUrl);} }
  window.addEventListener('popstate', (event) => { restoreFromURL(); loadData(yearSel.value); });
  function ensureTopUI() { const controls=document.querySelector('.controls'); if(controls&&searchWrap&&searchWrap.parentNode!==controls){controls.appendChild(searchWrap);searchWrap.style.display='inline-block';} }

  restoreFromURL(); loadData(yearSel.value); syncURL();
});