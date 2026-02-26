// player.js — FINAL (Career Aggregation Fixed + FIP WAR + K stats)

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const playerId = parseInt(params.get('id'), 10);
  
  // 에러 방지: ID가 없으면 중단
  if (isNaN(playerId)) {
    const rb = document.getElementById('record-box');
    if(rb) rb.innerHTML = '<p style="text-align:center;">선수 ID가 올바르지 않습니다.</p>';
    return;
  }

  // 요소 참조
  const yearSelect = document.getElementById('year-select');
  const btnBat = document.getElementById('btn-bat');
  const btnPit = document.getElementById('btn-pit');
  const batGrid = document.getElementById('stats-grid');
  const pitchGrid = document.getElementById('pitch-stats-grid');
  const recordBox = document.getElementById('record-box');
  const contribBox = document.getElementById('salary-box');

  let batData = [], pitData = [], currentMode = 'bat', playerName = '';
  // 캐시 저장소 (속도 개선)
  const careerCache = { bat: null, pit: null };

  // --- 유틸 ---
  const N = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3 = x => Math.round(x * 1000) / 1000;
  const ERA_BASE = 7;
  const WAR_CFG = { WOBAScale: 1.15, RunsPerWin: 7.5, BatReplacementPerPA: 0.033, PitReplacementMult: 1.20 };
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // 데이터 정규화
  function normalizeRecords(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.players) return data.players;
    if (data.batters) return data.batters;
    if (data.pitchers) return data.pitchers;
    if (data.records) return data.records;
    if (data.data) return data.data;
    return [];
  }

  // 식별자 생성
  const pidKey = r => {
    if (!r) return '';
    return String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();
  };

  // --- 파생 스탯 계산 ---
  function applyDerived(p) {
    if (!p) return {};
    const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),CI=N(p.ci),PAi=N(p.pa),PA=PAi>0?PAi:(AB+BB+HBP+SF+SH+CI),_1B=Math.max(0,H-_2B-_3B-HR),TB=_1B+2*_2B+3*_3B+4*HR,AVG=div(H,AB),OBP=div(H+BB+HBP,AB+BB+HBP+SF),SLG=div(TB,AB),OPS=OBP+SLG,uBB=Math.max(0,BB-IBB),wDen=(AB+BB-IBB+HBP+SF),wNum=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR,wOBA=div(wNum,wDen);
    p.k = N(p.k ?? p.so ?? p.SO); // 삼진 처리
    p.pa=PA;p.tb=TB;p.avg=r3(AVG);p.obp=r3(OBP);p.slg=r3(SLG);p.ops=r3(OPS);p.woba=r3(wOBA);p.iso=r3(SLG-AVG);
    return p;
  }
  const applyDerivedAll = arr => Array.isArray(arr) ? arr.map(applyDerived) : [];

  // 투수 파생
  function normalizeFractionStr(str=''){ return String(str).replace(/\u2153/g,' 1/3').replace(/\u2154/g,' 2/3').replace(/\u00BC/g,' 1/4').replace(/\u00BD/g,' 1/2').replace(/\u00BE/g,' 3/4'); }
  function parseIPValue(v){ if(v==null||v==='') return 0; if(typeof v==='number'){const f=Math.trunc(v),frac=v-f;if(Math.abs(frac-0.1)<1e-6) return f+1/3;if(Math.abs(frac-0.2)<1e-6) return f+2/3; return v;} const s=normalizeFractionStr(String(v)).trim(); const m=s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/); if(m){const whole=+m[1],num=m[2]?+m[2]:0,den=m[3]?+m[3]:1; return whole+(den?num/den:0);} const m2=s.match(/^(\d+)\.(\d)$/); if(m2){const whole=+m2[1],dec=+m2[2]; if(dec===1) return whole+1/3; if(dec===2) return whole+2/3; return +s;} const n=parseFloat(s); return isNaN(n)?0:n; }
  function formatIP(ip){ const w=Math.floor(ip),f=ip-w; let mark=0; if(Math.abs(f-1/3)<1e-6) mark=1; else if(Math.abs(f-2/3)<1e-6) mark=2; else if(f>0){ const snaps=[0,1/3,2/3]; let best=0,bd=1; snaps.forEach((s,i)=>{ const d=Math.abs(f-s); if(d<bd){bd=d;best=i;}}); mark=best; } return `${w}${mark?'.'+mark:''}`; }
  function deriveIP(p){ const outs=N(p.outs??p.Outs??p.아웃); if(outs>0) return outs/3; const raw=p.innings??p.ip??p.IP??p.이닝; return parseIPValue(raw); }
  
  function applyDerivedPitch(p){
    if(!p) return {};
    const ER=N(p.er),ip=deriveIP(p),ERA=div(ER*ERA_BASE,ip);
    p._ipVal=ip; 
    p.k = N(p.k ?? p.so ?? p.SO); 
    if(ip>0) p.innings=formatIP(ip); else p.innings=p.innings??p.ip??p.IP??p.이닝??0;
    p.era=r3(ERA); 
    return p;
  }
  const applyDerivedPitchAll = arr => Array.isArray(arr) ? arr.map(applyDerivedPitch) : [];

  // --- WAR (FIP 기반 통일) ---
  function leagueBatConstants(rows){ let WNUM=0,WDEN=0,PA=0; rows.forEach(p=>{ const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),_1B=Math.max(0,H-_2B-_3B-HR),uBB=Math.max(0,BB-IBB); WNUM+=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR; WDEN+=(AB+BB-IBB+HBP+SF); PA+=N(p.pa); }); const lgwoba=WDEN>0?WNUM/WDEN:0; return {lgwoba,wobaScale:WAR_CFG.WOBAScale,rpw:WAR_CFG.RunsPerWin}; }
  function calcBatWAR(p, K){ const PA=N(p.pa); if(PA<=0) return 0; const woba=N(p.woba),wraa=((woba-K.lgwoba)/K.wobaScale)*PA,bsR=0.2*N(p.sb),repl=WAR_CFG.BatReplacementPerPA*PA,runs=wraa+bsR+repl; return runs/K.rpw; }
  
  function leaguePitchConstants(rows){ 
    let SUM_ER=0, SUM_IP=0, SUM_HR=0, SUM_BB=0, SUM_HBP=0, SUM_K=0; 
    rows.forEach(p=>{ const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; SUM_IP+=ip; SUM_ER+=N(p.er); SUM_HR+=N(p.hr); SUM_BB+=N(p.bb); SUM_HBP+=N(p.hbp); SUM_K+=N(p.k); }); 
    const lgERA = SUM_IP>0 ? (SUM_ER * ERA_BASE / SUM_IP) : 0;
    const lgFIP_Raw = SUM_IP>0 ? ((13*SUM_HR + 3*(SUM_BB+SUM_HBP) - 2*SUM_K) / SUM_IP) : 0;
    const cFIP = lgERA - lgFIP_Raw; 
    const repRA7 = lgERA * WAR_CFG.PitReplacementMult; 
    return { cFIP, repRA7, rpw: WAR_CFG.RunsPerWin }; 
  }
  function calcPitWAR(p, K){ 
    const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; if(ip<=0) return 0; 
    const fipRaw = (13*N(p.hr) + 3*(N(p.bb)+N(p.hbp)) - 2*N(p.k)) / ip;
    const fip = fipRaw + K.cFIP;
    const rar = (K.repRA7 - fip) * (ip / ERA_BASE); 
    return rar / K.rpw; 
  }

  // --- Career 집계 ---
  const numericYearsFromSelect = () => Array.from(yearSelect?.options || []).map(o => o.value).filter(v => /^\d{4}$/.test(v));
  
  function fetchYearFile(year, type) {
    const file = type === 'bat' ? `records_${year}.json` : `pitching_${year}.json`;
    return fetch(file)
      .then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(normalizeRecords)
      .catch(err => {
        console.warn(`[Skipping] ${file} not found or invalid:`, err);
        return []; // 에러 시 빈 배열 반환하여 멈추지 않게 함
      });
  }

  // ★ 통산 타격 집계
  function aggregateBattingAllPlayers(allArrays) {
    const map = new Map();
    allArrays.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(r => {
        if (!r) return;
        const key = pidKey(r);
        if (!key) return;
        
        let cn = map.has(key) ? map.get(key).name : null;
        if (!cn && r.name) cn = r.name;
        let cnum = map.has(key) ? map.get(key).number : null;
        if (cnum == null && (r.number ?? r.playerId ?? r.id) != null) cnum = r.number ?? r.playerId ?? r.id;

        const t = map.get(key) || { ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,ci:0,RBI:0,RUN:0,sb:0, k:0 };
        
        t.name = cn; t.number = cnum;
        t.ab += N(r.ab); t.hits += N(r.hits); t.double += N(r.double); t.triple += N(r.triple); t.hr += N(r.hr);
        t.bb += N(r.bb); t.ibb += N(r.ibb); t.hbp += N(r.hbp); t.sf += N(r.sf); t.sh += N(r.sh); t.ci += N(r.ci);
        t.RBI += N(r.RBI ?? r.rbi); t.RUN += N(r.RUN ?? r.run ?? r.R); t.sb += N(r.sb); 
        t.k += N(r.k ?? r.so ?? r.SO); // 삼진 합산
        
        map.set(key, t);
      });
    });
    return applyDerivedAll(Array.from(map.values()));
  }
  
  // ★ 통산 투수 집계
  function aggregatePitchingAllPlayers(allArrays) {
    const map = new Map();
    allArrays.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(r => {
        if (!r) return;
        const key = pidKey(r); 
        if (!key) return;
        
        const t = map.get(key) || { name:r.name, number:r.number??r.playerId??r.id, outs:0, er:0, runs:0, so:0, bb:0, hbp:0, hr:0, games:0, wins:0, losses:0, holds:0, saves:0, k:0 };
        t.name = t.name || r.name; 
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;
        
        const outs = N(r.outs); 
        let addOuts = 0; 
        if (outs > 0) addOuts = outs; 
        else addOuts = Math.round(deriveIP(r) * 3);
        
        t.outs += addOuts; t.er += N(r.er); t.runs += N(r.runs); 
        t.so += N(r.so); t.k += N(r.k ?? r.so ?? r.SO); // 삼진 합산
        t.bb += N(r.bb); t.hbp += N(r.hbp); t.hr += N(r.hr);
        t.games += N(r.games); t.wins += N(r.wins); t.losses += N(r.losses); 
        t.holds += N(r.holds); t.saves += N(r.saves);
        
        map.set(key, t);
      });
    });
    const rows = Array.from(map.values());
    rows.forEach(p => { p.outs = Math.max(0, Math.round(p.outs)); });
    return applyDerivedPitchAll(rows);
  }

  // --- 로딩 ---
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(players => {
      const p = players.find(x => x.id === playerId);
      if (!p) throw new Error('Player not found');
      playerName = p.name;
      document.getElementById('number').textContent = `#${p.id}`;
      document.getElementById('name').textContent = p.name;
      document.getElementById('birth').textContent = p.birth || '-';
      document.getElementById('highschool').textContent = p.highschool || '-';
      document.getElementById('major').textContent = p.major || '-';
      document.getElementById('position').textContent = p.position || '-';
      loadYear(yearSelect.value || '2025');
    })
    .catch((err) => {
      console.error("Failed to load player profile:", err);
      recordBox.innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
      // 프로필 실패해도 기본 연도로 로드 시도
      loadYear('2025');
    });

  yearSelect.addEventListener('change', () => loadYear(yearSelect.value));
  
  btnBat.addEventListener('click', () => {
    if (currentMode === 'bat') return;
    currentMode = 'bat';
    btnBat.classList.add('active'); btnPit.classList.remove('active');
    toggleStatGrids(false);
    renderView();
  });
  
  btnPit.addEventListener('click', () => {
    if (currentMode === 'pit') return;
    currentMode = 'pit';
    btnPit.classList.add('active'); btnBat.classList.remove('active');
    toggleStatGrids(true);
    renderView();
  });

  function toggleStatGrids(showPitcherGrid) {
    if (batGrid) batGrid.style.display = showPitcherGrid ? 'none' : 'grid';
    if (pitchGrid) pitchGrid.style.display = showPitcherGrid ? 'grid' : 'none';
  }
  
  // ★ loadYear 함수 (캐싱 및 Promise.all 에러 처리 포함)
  function loadYear(year) {
    const isCareer = (year === 'total' || year === 'career');
    
    recordBox.innerHTML = '<p style="text-align:center;">기록 로드 중...</p>';
    batGrid.style.display = 'none';
    pitchGrid.style.display = 'none';
    contribBox.innerHTML = '';

    // 1. 캐시 확인
    if (isCareer && careerCache.bat && careerCache.pit) {
        console.log("Using cached career stats");
        batData = careerCache.bat;
        pitData = careerCache.pit;
        handleLoadedData();
        return;
    }

    // 2. 데이터 로드
    let dataPromise;
    if (isCareer) {
      console.log("Loading career stats...");
      const years = numericYearsFromSelect();
      if (!years.length) {
          // 연도 옵션이 없으면 빈 데이터 처리
          dataPromise = Promise.resolve({ batData: [], pitData: [] });
      } else {
          const batJobs = years.map(y => fetchYearFile(y, 'bat'));
          const pitJobs = years.map(y => fetchYearFile(y, 'pit'));
          
          dataPromise = Promise.all([Promise.all(batJobs), Promise.all(pitJobs)])
            .then(([batResults, pitResults]) => {
               const b = aggregateBattingAllPlayers(batResults);
               const p = aggregatePitchingAllPlayers(pitResults);
               // 캐시에 저장
               careerCache.bat = b; 
               careerCache.pit = p;
               return { batData: b, pitData: p };
            });
      }
    } else {
      console.log(`Loading stats for year: ${year}`);
      dataPromise = Promise.all([fetchYearFile(year, 'bat'), fetchYearFile(year, 'pit')])
        .then(([bDataRaw, pDataRaw]) => {
          return { batData: applyDerivedAll(bDataRaw), pitData: applyDerivedPitchAll(pDataRaw) };
        });
    }
    
    // 3. 로드 완료 처리
    dataPromise.then(({ batData: b, pitData: p }) => {
        batData = b; 
        pitData = p;
        handleLoadedData();
    }).catch((err) => {
        console.error(`Error loading data:`, err);
        recordBox.innerHTML = '<p style="text-align:center;">기록 로드/집계 실패</p>';
        batData = []; pitData = [];
        // 실패해도 화면은 그려줌 (빈 상태)
        toggleStatGrids(currentMode === 'pit');
        renderView();
    });
  }

  function handleLoadedData() {
      // 현재 선수의 투수 기록이 있는지 확인
      const hasPit = pitData.some(r => pidKey(r) == playerId || r.name === playerName);
      btnPit.style.display = hasPit ? 'inline-block' : 'none';

      // 투수 기록 없는데 투수 탭 보고 있으면 타자 탭으로 이동
      if (!hasPit && currentMode === 'pit') {
          currentMode = 'bat';
      }

      // 탭 활성화 상태 동기화
      if (currentMode === 'bat') {
          btnBat.classList.add('active'); btnPit.classList.remove('active');
          toggleStatGrids(false);
      } else {
          btnPit.classList.add('active'); btnBat.classList.remove('active');
          toggleStatGrids(true);
      }
      renderView();
  }

  function renderView() {
    if (currentMode === 'bat') {
      showBatting();
    } else {
      showPitching();
    }
  }

  // --- 표시 함수 ---
  function showBatting() {
    const rec = batData.find(r => pidKey(r) == playerId || r.name === playerName);
    toggleStatGrids(false);
    
    if (!rec) {
      // 값이 없으면 대시(-) 처리
      ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '-';
      });
      recordBox.innerHTML = '<p style="text-align:center;">타격 기록이 없습니다.</p>';
    } else {
      // 요약표 채우기 (12개 항목, 삼진 제외)
      document.getElementById('avg').textContent = (rec.avg != null ? Number(rec.avg).toFixed(3) : '.000');
      document.getElementById('ab').textContent = N(rec.ab);
      document.getElementById('hits').textContent = N(rec.hits);
      document.getElementById('double').textContent = N(rec.double);
      document.getElementById('triple').textContent = N(rec.triple);
      document.getElementById('hr').textContent = N(rec.hr);
      document.getElementById('bb').textContent = N(rec.bb);
      document.getElementById('hbp').textContent = N(rec.hbp);
      document.getElementById('RBI').textContent = N(rec.RBI ?? rec.rbi);
      document.getElementById('slg').textContent = (rec.slg != null ? Number(rec.slg).toFixed(3) : '.000');
      document.getElementById('obp').textContent = (rec.obp != null ? Number(rec.obp).toFixed(3) : '.000');
      document.getElementById('ops').textContent = (rec.ops != null ? Number(rec.ops).toFixed(3) : '.000');
      
      // 하단 상세 리스트 채우기 (삼진 포함)
      recordBox.innerHTML = '';
      [['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],['3루타','triple'],['홈런','hr'],
       ['4구','bb'],['사구','hbp'],['삼진','k'], // 삼진 포함
       ['타점','RBI'],['득점','RUN'],['도루','sb'],['출루율','obp'],['장타율','slg'],['OPS','ops'],['wOBA','woba']
      ].forEach(([lab, k]) => {
        const d = document.createElement('div');
        const raw = rec[k];
        const isRate = ['woba','slg','obp','ops','avg'].includes(k);
        const valueToDisplay = (k === 'RBI' && rec.rbi != null && rec.RBI == null) ? rec.rbi : raw;
        const txt = valueToDisplay != null ? (isRate ? Number(valueToDisplay).toFixed(3) : N(valueToDisplay).toString()) : '0';
        d.innerHTML = `<span class="stat-label">${lab}</span> <span class="stat-value">${txt}</span>`;
        recordBox.appendChild(d);
      });
    }
    computeWAR();
  }

  function showPitching() {
    const rec = pitData.find(r => pidKey(r) == playerId || r.name === playerName);
    toggleStatGrids(true);
    
    if (!rec) {
      ['p-era','p-ip','p-w','p-l','p-sv','p-hld','p-so','p-bb','p-hbp','p-er','p-r','p-war'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '-';
      });
      recordBox.innerHTML = '<p style="text-align:center;">투구 기록이 없습니다.</p>';
    } else {
      const Kp = leaguePitchConstants(pitData || []);
      const pWAR = calcPitWAR(rec, Kp);
      const ipVal = deriveIP(rec);

      // 요약표 채우기
      document.getElementById('p-era').textContent = (rec.era != null ? Number(rec.era).toFixed(2) : '0.00');
      document.getElementById('p-ip').textContent = (ipVal > 0 ? formatIP(ipVal) : '0');
      document.getElementById('p-w').textContent = N(rec.wins);
      document.getElementById('p-l').textContent = N(rec.losses);
      document.getElementById('p-sv').textContent = N(rec.saves);
      document.getElementById('p-hld').textContent = N(rec.holds);
      document.getElementById('p-so').textContent = N(rec.so);
      document.getElementById('p-bb').textContent = N(rec.bb);
      document.getElementById('p-hbp').textContent = N(rec.hbp);
      document.getElementById('p-er').textContent = N(rec.er);
      document.getElementById('p-r').textContent = N(rec.runs);
      document.getElementById('p-war').textContent = pWAR.toFixed(2);

      // 상세 리스트 채우기
      recordBox.innerHTML = '';
      const eraTxt = (rec.era != null) ? Number(rec.era).toFixed(2) : '0.00';
      [['등판','games'],['이닝','innings',(ipVal > 0 ? formatIP(ipVal) : '0')],['방어율','era',eraTxt],
       ['승','wins'],['패','losses'],['홀드','holds'],['세이브','saves'],['탈삼진','so'],
       ['볼넷','bb'],['사구','hbp'],['실점','runs'],['자책점','er']
      ].forEach(([lab, k, override]) => {
        const d = document.createElement('div');
        const val = (override != null) ? override : (rec[k] != null ? N(rec[k]) : 0).toString();
        d.innerHTML = `<span class="stat-label">${lab}</span> <span class="stat-value">${val}</span>`;
        recordBox.appendChild(d);
      });
    }
    computeWAR();
  }

  function computeWAR() {
    const Kb = leagueBatConstants(batData || []);
    const Kp = leaguePitchConstants(pitData || []);
    const batRec = batData.find(r => pidKey(r) == playerId || r.name === playerName);
    const pitRec = pitData.find(r => pidKey(r) == playerId || r.name === playerName);
    
    const batWAR = batRec ? calcBatWAR(batRec, Kb) : 0;
    const pWAR = pitRec ? calcPitWAR(pitRec, Kp) : 0;
    const tWAR = batWAR + pWAR;

    let rank = 0;
    // 전체 선수와 비교하여 순위 계산
    if ((batData && batData.length > 0) || (pitData && pitData.length > 0)) {
        const warByPid = new Map();
        (batData || []).forEach(r => {
            const pid = pidKey(r); if (!pid) return;
            const w = calcBatWAR(r, Kb);
            warByPid.set(pid, (warByPid.get(pid) || 0) + w);
        });
        (pitData || []).forEach(r => {
            const pid = pidKey(r); if (!pid) return;
            const w = calcPitWAR(r, Kp);
            warByPid.set(pid, (warByPid.get(pid) || 0) + w);
        });
        const totals = Array.from(warByPid.values());
        const sorted = totals.slice().sort((a, b) => b - a);
        
        // 현재 선수 WAR와 일치하는 순위 찾기
        const currentPid = playerId.toString();
        const myTotal = warByPid.get(currentPid) ?? tWAR;
        
        if (warByPid.has(currentPid)) {
             rank = sorted.indexOf(myTotal) + 1;
        } else if (tWAR !== 0) {
             // ID로 못 찾았을 경우 값으로 근사치 찾기
             const idx = sorted.findIndex(w => Math.abs(w - tWAR) < 0.001);
             if (idx !== -1) rank = idx + 1;
        }
    }

    contribBox.innerHTML =
      `<strong>WAR(총):</strong> ${tWAR.toFixed(2)}${rank ? ` <span style="color:#6b7280;">(팀 내 ${rank}위)</span>` : ''}` +
      `<br><strong>Bat WAR:</strong> ${batWAR.toFixed(2)}` +
      `<br><strong>pWAR:</strong> ${pWAR.toFixed(2)}`;
  }
});