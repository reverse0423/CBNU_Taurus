// player.js — 투수 요약표 스타일 통일 및 통산 기록 계산 기능 포함

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const playerId = parseInt(params.get('id'), 10);
  if (isNaN(playerId)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // --- 요소 참조 ---
  const yearSelect = document.getElementById('year-select');
  const btnBat = document.getElementById('btn-bat');
  const btnPit = document.getElementById('btn-pit');
  const batGrid = document.getElementById('stats-grid');      // 타자 요약표
  const pitchGrid = document.getElementById('pitch-stats-grid'); // 투수 요약표
  const recordBox = document.getElementById('record-box');
  const contribBox = document.getElementById('salary-box');

  let batData = [], pitData = [], currentMode = 'bat', playerName = '';

  // --- 유틸, 파생 스탯, WAR, 연도/통산 로딩 함수들 ---
  const N=v=>(v==null||isNaN(+v)?0:+v); const div=(n,d)=>(d>0?n/d:0); const r3=x=>Math.round(x*1000)/1000; const ERA_BASE=7; const WAR_CFG={WOBAScale:1.15,RunsPerWin:7.5,BatReplacementPerPA:0.033,PitReplacementMult:1.20}; const WOBA={uBB:0.69,HBP:0.72,'1B':0.89,'2B':1.27,'3B':1.62,HR:2.10};
  function normalizeRecords(data){if(Array.isArray(data))return data;if(data?.players)return data.players;if(data?.batters)return data.batters;if(data?.pitchers)return data.pitchers;if(data?.records)return data.records;if(data?.data)return data.data;return[];} const pidKey=r=>String(r.playerId??r.number??r.id??r.name??'').trim();
  function normalizeFractionStr(str=''){return String(str).replace(/\u2153/g,' 1/3').replace(/\u2154/g,' 2/3').replace(/\u00BC/g,' 1/4').replace(/\u00BD/g,' 1/2').replace(/\u00BE/g,' 3/4');} function parseIPValue(v){if(v==null||v==='')return 0;if(typeof v==='number'){const f=Math.trunc(v),frac=v-f;if(Math.abs(frac-0.1)<1e-6)return f+1/3;if(Math.abs(frac-0.2)<1e-6)return f+2/3;return v;} const s=normalizeFractionStr(String(v)).trim(); const m=s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/);if(m){const whole=+m[1],num=m[2]?+m[2]:0,den=m[3]?+m[3]:1;return whole+(den?num/den:0);} const m2=s.match(/^(\d+)\.(\d)$/);if(m2){const whole=+m2[1],dec=+m2[2];if(dec===1)return whole+1/3;if(dec===2)return whole+2/3;return+s;} const n=parseFloat(s);return isNaN(n)?0:n;} function formatIP(ip){const w=Math.floor(ip),f=ip-w;let mark=0;if(Math.abs(f-1/3)<1e-6)mark=1;else if(Math.abs(f-2/3)<1e-6)mark=2;else if(f>0){const snaps=[0,1/3,2/3];let best=0,bd=1;snaps.forEach((s,i)=>{const d=Math.abs(f-s);if(d<bd){bd=d;best=i;}});mark=best;} return`${w}${mark?'.'+mark:''}`;} function deriveIP(p){const outs=N(p.outs??p.Outs??p.아웃);if(outs>0)return outs/3;const raw=p.innings??p.ip??p.IP??p.이닝;return parseIPValue(raw);}
  function applyDerived(p){const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),CI=N(p.ci),PAi=N(p.pa),PA=PAi>0?PAi:(AB+BB+HBP+SF+SH+CI),_1B=Math.max(0,H-_2B-_3B-HR),TB=_1B+2*_2B+3*_3B+4*HR,AVG=div(H,AB),OBP=div(H+BB+HBP,AB+BB+HBP+SF),SLG=div(TB,AB),OPS=OBP+SLG,uBB=Math.max(0,BB-IBB),wDen=(AB+BB-IBB+HBP+SF),wNum=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR,wOBA=div(wNum,wDen);p.pa=PA;p.tb=TB;p.avg=r3(AVG);p.obp=r3(OBP);p.slg=r3(SLG);p.ops=r3(OPS);p.woba=r3(wOBA);p.iso=r3(SLG-AVG);return p;} const applyDerivedAll=arr=>arr.map(applyDerived);
  function applyDerivedPitch(p){const ER=N(p.er),ip=deriveIP(p),ERA=div(ER*ERA_BASE,ip);p._ipVal=ip;if(ip>0)p.innings=formatIP(ip);else p.innings=p.innings??p.ip??p.IP??p.이닝??0;p.era=r3(ERA);return p;} const applyDerivedPitchAll=arr=>arr.map(applyDerivedPitch);
  function leagueBatConstants(rows){let WNUM=0,WDEN=0;rows.forEach(p=>{const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),_1B=Math.max(0,H-_2B-_3B-HR),uBB=Math.max(0,BB-IBB);WNUM+=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR;WDEN+=(AB+BB-IBB+HBP+SF);});const lgwoba=WDEN>0?WNUM/WDEN:0;return{lgwoba,wobaScale:WAR_CFG.WOBAScale,rpw:WAR_CFG.RunsPerWin};} function calcBatWAR(p,K){const PA=N(p.pa);if(PA<=0)return 0;const woba=N(p.woba),wraa=((woba-K.lgwoba)/K.wobaScale)*PA,bsR=0.2*N(p.sb),repl=WAR_CFG.BatReplacementPerPA*PA,runs=wraa+bsR+repl;return runs/K.rpw;} function leaguePitchConstants(rows){let RUNS=0,OUTS=0;rows.forEach(p=>{const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0;RUNS+=N(p.runs);OUTS+=Math.round(ip*3);});const IP=OUTS/3,ra7=IP>0?RUNS*ERA_BASE/IP:0,repRA7=ra7*WAR_CFG.PitReplacementMult;return{ra7,repRA7,rpw:WAR_CFG.RunsPerWin};} function calcPitWAR(p,K){const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0;if(ip<=0)return 0;const ra7=N(p.runs)*ERA_BASE/ip,rar=(K.repRA7-ra7)*(ip/ERA_BASE);return rar/K.rpw;}
  const yearsFromSelect=()=>Array.from(yearSelect?.options||[]).map(o=>o.value).filter(v=>/^\d{4}$/.test(v)); function fetchBatYear(year){return fetch(`records_${year}.json`).then(r=>r.ok?r.json():Promise.reject(`records_${year}.json`)).then(normalizeRecords).catch(err=>{console.warn(`Failed bat load ${year}:`,err);return[];});} function fetchPitYear(year){return fetch(`pitching_${year}.json`).then(r=>r.ok?r.json():Promise.reject(`pitching_${year}.json`)).then(normalizeRecords).catch(err=>{console.warn(`Failed pit load ${year}:`,err);return[];});}
  function aggregateBattingAllPlayers(allArrays){const map=new Map();allArrays.forEach(arr=>{if(!Array.isArray(arr))return;arr.forEach(r=>{const key=pidKey(r);if(!key)return;let cn=map.has(key)?map.get(key).name:null;if(!cn&&r.name)cn=r.name;let cnum=map.has(key)?map.get(key).number:null;if(cnum==null&&(r.number??r.playerId??r.id)!=null)cnum=r.number??r.playerId??r.id;const t=map.get(key)||{ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,ci:0,RBI:0,RUN:0,sb:0};t.name=cn;t.number=cnum;t.ab+=N(r.ab);t.hits+=N(r.hits);t.double+=N(r.double);t.triple+=N(r.triple);t.hr+=N(r.hr);t.bb+=N(r.bb);t.ibb+=N(r.ibb);t.hbp+=N(r.hbp);t.sf+=N(r.sf);t.sh+=N(r.sh);t.ci+=N(r.ci);t.RBI+=N(r.RBI??r.rbi);t.RUN+=N(r.RUN??r.run??r.R);t.sb+=N(r.sb);map.set(key,t);});});return applyDerivedAll(Array.from(map.values()));} function aggregatePitchingAllPlayers(allArrays){const map=new Map();allArrays.forEach(arr=>{if(!Array.isArray(arr))return;arr.forEach(r=>{const key=pidKey(r);if(!key)return;const t=map.get(key)||{name:r.name,number:r.number??r.playerId??r.id,outs:0,er:0,runs:0,so:0,bb:0,hbp:0,games:0,wins:0,losses:0,holds:0,saves:0};t.name=t.name||r.name;t.number=t.number??r.number??r.playerId??r.id;const outs=N(r.outs);let addOuts=0;if(outs>0)addOuts=outs;else addOuts=Math.round(deriveIP(r)*3);t.outs+=addOuts;t.er+=N(r.er);t.runs+=N(r.runs);t.so+=N(r.so);t.bb+=N(r.bb);t.hbp+=N(r.hbp);t.games+=N(r.games);t.wins+=N(r.wins);t.losses+=N(r.losses);t.holds+=N(r.holds);t.saves+=N(r.saves);map.set(key,t);});});const rows=Array.from(map.values());rows.forEach(p=>{p.outs=Math.max(0,Math.round(p.outs));});return applyDerivedPitchAll(rows);}

  // --- 선수 기본 정보 로딩 ---
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
      // Load default year after profile is set
      loadYear(yearSelect.value || '2025');
    })
    .catch((err) => {
      console.error("Failed to load player profile:", err);
      recordBox.innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
      // Try loading default year even if profile fails, might show some data
      loadYear(yearSelect.value || '2025');
    });

  // --- 탭/연도 변경 이벤트 핸들러 ---
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

  // --- 그리드 표시/숨김 함수 ---
  function toggleStatGrids(showPitcherGrid) {
    if (batGrid) batGrid.style.display = showPitcherGrid ? 'none' : 'grid';
    if (pitchGrid) pitchGrid.style.display = showPitcherGrid ? 'grid' : 'none';
  }

  // --- 데이터 로드 함수 ---
  function loadYear(year) {
    const isCareer = (year === 'total' || year === 'career');
    recordBox.innerHTML = '<p style="text-align:center;">기록 로드 중...</p>';
    batGrid.style.display = 'none';
    pitchGrid.style.display = 'none';
    contribBox.innerHTML = '';

    let dataPromise;

    if (isCareer) {
      console.log("Loading career stats...");
      const years = yearsFromSelect();
      if (!years.length) { /* ... 에러 처리 ... */ }
      const batJobs = years.map(y => fetchBatYear(y));
      const pitJobs = years.map(y => fetchPitYear(y));
      dataPromise = Promise.all([Promise.all(batJobs), Promise.all(pitJobs)])
        .then(([batResults, pitResults]) => {
           console.log("Fetched all yearly data for career.");
           batData = aggregateBattingAllPlayers(batResults);
           pitData = aggregatePitchingAllPlayers(pitResults);
           console.log("Aggregated career data:", { batData, pitData });
           return { batData, pitData }; // 집계 데이터 반환
        });
    } else {
      console.log(`Loading stats for year: ${year}`);
      dataPromise = Promise.all([fetchBatYear(year), fetchPitYear(year)])
        .then(([bDataRaw, pDataRaw]) => {
          batData = applyDerivedAll(bDataRaw);
          pitData = applyDerivedPitchAll(pDataRaw);
          console.log(`Loaded data for ${year}:`, { batData, pitData });
          return { batData, pitData }; // 로드된 데이터 반환
        });
    }

    // 데이터 로딩 완료 후 처리
    dataPromise.then(({ batData, pitData }) => {
        const hasPit = pitData.some(r => pidKey(r) == playerId || r.name === playerName);
        btnPit.style.display = hasPit ? 'inline-block' : 'none';

        // 현재 선택된 모드(currentMode) 유지 또는 기본값(bat) 설정
        if (!hasPit && currentMode === 'pit') {
            currentMode = 'bat'; // 투수 기록 없으면 타격 모드로 강제 전환
        }
        if (currentMode === 'bat') {
            btnBat.classList.add('active'); btnPit.classList.remove('active');
            toggleStatGrids(false);
        } else {
            btnPit.classList.add('active'); btnBat.classList.remove('active');
            toggleStatGrids(true);
        }
        renderView(); // 최종 데이터로 뷰 렌더링
      })
      .catch((err) => {
        console.error(`Error in dataPromise for ${year}:`, err);
        recordBox.innerHTML = '<p style="text-align:center;">기록 로드/집계 실패</p>';
        batData = []; pitData = [];
        // 실패 시에도 빈 화면 렌더링 시도
        toggleStatGrids(currentMode === 'pit');
        renderView();
      });
  }

  // --- 뷰 렌더링 함수 ---
  function renderView() {
    if (currentMode === 'bat') {
      showBatting();
    } else {
      showPitching();
    }
  }

  // --- 배팅 표시 함수 ---
  function showBatting() {
    const rec = batData.find(r => pidKey(r) == playerId || r.name === playerName);
    toggleStatGrids(false); // 타자 그리드 표시

    if (!rec) {
      // 기록 없을 때 그리드 초기화
      ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '-'; });
      recordBox.innerHTML = '<p style="text-align:center;">타격 기록이 없습니다.</p>';
    } else {
      // 그리드 채우기
      document.getElementById('avg').textContent = (rec.avg != null ? Number(rec.avg).toFixed(3) : '.000');
      document.getElementById('ab').textContent = N(rec.ab);
      document.getElementById('hits').textContent = N(rec.hits);
      document.getElementById('double').textContent = N(rec.double);
      document.getElementById('triple').textContent = N(rec.triple);
      document.getElementById('hr').textContent = N(rec.hr);
      document.getElementById('bb').textContent = N(rec.bb);
      document.getElementById('hbp').textContent = N(rec.hbp);
      document.getElementById('RBI').textContent = N(rec.RBI ?? rec.rbi); // RBI 키 우선
      document.getElementById('slg').textContent = (rec.slg != null ? Number(rec.slg).toFixed(3) : '.000');
      document.getElementById('obp').textContent = (rec.obp != null ? Number(rec.obp).toFixed(3) : '.000');
      document.getElementById('ops').textContent = (rec.ops != null ? Number(rec.ops).toFixed(3) : '.000');

      // 상세 기록 리스트
      recordBox.innerHTML = '';
      [ ['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],['3루타','triple'],['홈런','hr'],
        ['4구','bb'],['사구','hbp'],['타점','RBI'],['득점','RUN'],['도루','sb'],['출루율','obp'],
        ['장타율','slg'],['OPS','ops'],['wOBA','woba']
      ].forEach(([lab, k]) => {
        const d = document.createElement('div');
        const raw = rec[k];
        const isRate = ['woba','slg','obp','ops','avg'].includes(k);
        // RBI 키 우선 사용
        const valueToDisplay = (k === 'RBI' && rec.rbi != null && rec.RBI == null) ? rec.rbi : raw;
        const txt = valueToDisplay != null ? (isRate ? Number(valueToDisplay).toFixed(3) : N(valueToDisplay).toString()) : '0';
        d.innerHTML = `<span class="stat-label">${lab}</span> <span class="stat-value">${txt}</span>`;
        recordBox.appendChild(d);
      });
    }
    computeWAR(); // WAR 정보 업데이트
  }

  // --- 투구 표시 함수 ---
  function showPitching() {
    const rec = pitData.find(r => pidKey(r) == playerId || r.name === playerName);
    toggleStatGrids(true); // 투수 그리드 표시

    if (!rec) {
      // 기록 없을 때 그리드 초기화
      ['p-era','p-ip','p-w','p-l','p-sv','p-hld','p-so','p-bb','p-hbp','p-er','p-r','p-war']
        .forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '-'; });
      recordBox.innerHTML = '<p style="text-align:center;">투구 기록이 없습니다.</p>';
    } else {
      // WAR 계산
      const Kp = leaguePitchConstants(pitData || []);
      const pWAR = calcPitWAR(rec, Kp);
      const ipVal = deriveIP(rec);

      // 그리드 채우기
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

      // 상세 기록 리스트
      recordBox.innerHTML = '';
      const eraTxt = (rec.era != null) ? Number(rec.era).toFixed(2) : '0.00';
      [ ['등판','games'],['이닝','innings',(ipVal > 0 ? formatIP(ipVal) : '0')],['방어율','era',eraTxt],
        ['승','wins'],['패','losses'],['홀드','holds'],['세이브','saves'],['탈삼진','so'],
        ['볼넷','bb'],['사구','hbp'],['실점','runs'],['자책점','er']
      ].forEach(([lab, k, override]) => {
        const d = document.createElement('div');
        const val = (override != null) ? override : (rec[k] != null ? N(rec[k]) : 0).toString();
        d.innerHTML = `<span class="stat-label">${lab}</span> <span class="stat-value">${val}</span>`;
        recordBox.appendChild(d);
      });
    }
    computeWAR(); // WAR 정보 업데이트
  }


  // --- WAR 계산 함수 ---
  function computeWAR() {
    // WAR 계산 위한 전체 데이터 필요
    const Kb = leagueBatConstants(batData || []);
    const Kp = leaguePitchConstants(pitData || []);

    // 현재 선수의 기록 찾기
    const batRec = batData.find(r => pidKey(r) == playerId || r.name === playerName);
    const pitRec = pitData.find(r => pidKey(r) == playerId || r.name === playerName);

    const batWAR = batRec ? calcBatWAR(batRec, Kb) : 0;
    const pWAR = pitRec ? calcPitWAR(pitRec, Kp) : 0;
    const tWAR = batWAR + pWAR;

    // 팀 내 순위 계산 (선택적 - 모든 선수 WAR 계산 필요)
    let rank = 0;
    if ((batData && batData.length > 0) || (pitData && pitData.length > 0)) {
        const warByPid = new Map();
        (batData || []).forEach(r => {
            const pid = pidKey(r); if (!pid) return;
            const w = calcBatWAR(r, Kb); warByPid.set(pid, (warByPid.get(pid) || 0) + w);
        });
        (pitData || []).forEach(r => {
            const pid = pidKey(r); if (!pid) return;
            const w = calcPitWAR(r, Kp); warByPid.set(pid, (warByPid.get(pid) || 0) + w);
        });
        const totals = Array.from(warByPid.values());
        const sorted = totals.slice().sort((a, b) => b - a);
        const currentPid = playerId.toString(); // 현재 선수 ID
        const currentTotalWar = warByPid.get(currentPid) ?? tWAR; // Map에 ID가 없을 경우 대비

        // Map에 현재 선수 ID가 있는지 확인하여 WAR 값 사용
        if (warByPid.has(currentPid) && currentTotalWar !== 0) {
           rank = sorted.indexOf(currentTotalWar) + 1;
        } else if (tWAR !== 0) {
            // Map에 없지만 계산된 tWAR가 0이 아니면, 해당 값으로 순위 찾기 시도
             // 주의: 이 경우 정확한 순위가 아닐 수 있음 (다른 선수 WAR 값과 중복 가능성)
             const rankIndex = sorted.findIndex(w => Math.abs(w - tWAR) < 1e-6); // 부동소수점 비교
             if (rankIndex !== -1) rank = rankIndex + 1;
        }
    }


    contribBox.innerHTML =
      `<strong>WAR(총):</strong> ${tWAR.toFixed(2)}${rank ? ` <span style="color:#6b7280;">(팀 내 ${rank}위)</span>` : ''}` +
      `<br><strong>Bat WAR:</strong> ${batWAR.toFixed(2)}` +
      `<br><strong>pWAR:</strong> ${pWAR.toFixed(2)}`;
  }

});