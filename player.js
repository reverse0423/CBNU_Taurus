// player.js — FINAL (투수 요약표 타일형 그리드, 모바일 최적화)
// - Bat/Pit 파생지표, ERA 표준화(0.00), WAR 계산 유지
// - 투수 요약표: 라벨+값 타일형, 5→3→2열 반응형, 한 화면에 정돈 표시

document.addEventListener('DOMContentLoaded', () => {
  const params    = new URLSearchParams(window.location.search);
  const playerId  = parseInt(params.get('id'), 10);
  if (isNaN(playerId)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // 요소
  const yearSelect = document.getElementById('year-select');
  const btnBat     = document.getElementById('btn-bat');
  const btnPit     = document.getElementById('btn-pit');
  const grid       = document.getElementById('stats-grid');   // 타자 요약표(기존)
  const recordBox  = document.getElementById('record-box');   // 상세 기록
  const contribBox = document.getElementById('salary-box');   // WAR/순위 표기

  let batData = [], pitData = [], currentMode = 'bat', playerName = '';

  // ── 기본 유틸 ────────────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3  = x => Math.round(x * 1000) / 1000;

  // ERA 기준 이닝(7이닝 리그 가정, 필요 시 9로 변경)
  const ERA_BASE = 7;

  // WAR 설정(간이 WAR)
  const WAR_CFG = {
    WOBAScale: 1.15,
    RunsPerWin: 7.5,
    BatReplacementPerPA: 0.033,
    PitReplacementMult: 1.20
  };

  // wOBA 계수
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // 다양한 JSON 형태 보정
  function normalizeRecords(data){
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.players))  return data.players;
    if (data && Array.isArray(data.batters))  return data.batters;
    if (data && Array.isArray(data.pitchers)) return data.pitchers;
    if (data && Array.isArray(data.records))  return data.records;
    if (data && Array.isArray(data.data))     return data.data;
    return [];
  }

  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  // ── 타격 파생 ────────────────────────────────────────────────
  function applyDerived(p) {
    const AB  = N(p.ab ?? p.AB ?? p.타수);
    const H   = N(p.hits ?? p.h ?? p.H ?? p.안타);
    const _2B = N(p.double ?? p['2B'] ?? p['2루타']);
    const _3B = N(p.triple ?? p['3B'] ?? p['3루타']);
    const HR  = N(p.hr ?? p.HR ?? p.홈런);
    const BB  = N(p.bb ?? p.BB ?? p.볼넷 ?? p['4구']);
    const IBB = N(p.ibb ?? p.IBB ?? p.고의4구);
    const HBP = N(p.hbp ?? p.HBP ?? p.사구);
    const SF  = N(p.sf ?? p.SF ?? p['희생플라이'] ?? p['희비']);
    const SH  = N(p.sh ?? p.SH ?? p['희생번트'] ?? p['희번']);
    const PAi = N(p.pa ?? p.PA ?? p.타석);
    const PA  = PAi > 0 ? PAi : (AB + BB + HBP + SF + SH);

    const _1B = Math.max(0, H - _2B - _3B - HR);
    const TB  = _1B + 2*_2B + 3*_3B + 4*HR;

    const AVG = div(H, AB);
    const OBP = div(H + BB + HBP, AB + BB + HBP + SF);
    const SLG = div(TB, AB);
    const OPS = OBP + SLG;

    const uBB  = Math.max(0, BB - IBB);
    const wDen = (AB + BB - IBB + HBP + SF);
    const wNum = WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
    const wOBA = div(wNum, wDen);

    p.pa   = PA;
    p.tb   = TB;
    p.avg  = r3(AVG);
    p.obp  = r3(OBP);
    p.slg  = r3(SLG);
    p.ops  = r3(OPS);
    p.woba = r3(wOBA);
    p.iso  = r3(SLG - AVG);
    return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);

  // ── 투수 파생 (IP/ERA) ───────────────────────────────────────
  function normalizeFractionStr(str=''){
    return String(str)
      .replace(/\u2153/g, ' 1/3')
      .replace(/\u2154/g, ' 2/3')
      .replace(/\u00BC/g, ' 1/4')
      .replace(/\u00BD/g, ' 1/2')
      .replace(/\u00BE/g, ' 3/4');
  }
  function parseIPValue(v){
    if (v == null || v === '') return 0;
    if (typeof v === 'number') {
      const f = Math.trunc(v), frac = v - f;
      if (Math.abs(frac - 0.1) < 1e-6) return f + 1/3;
      if (Math.abs(frac - 0.2) < 1e-6) return f + 2/3;
      return v;
    }
    const s = normalizeFractionStr(String(v)).trim();
    const m = s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/);
    if (m) {
      const whole = +m[1], num = m[2] ? +m[2] : 0, den = m[3] ? +m[3] : 1;
      return whole + (den ? num/den : 0);
    }
    const m2 = s.match(/^(\d+)\.(\d)$/);
    if (m2) {
      const whole = +m2[1], dec = +m2[2];
      if (dec === 1) return whole + 1/3;
      if (dec === 2) return whole + 2/3;
      return +s;
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function formatIP(ip){
    const w = Math.floor(ip);
    const f = ip - w;
    let mark = 0;
    if (Math.abs(f - 1/3) < 1e-6) mark = 1;
    else if (Math.abs(f - 2/3) < 1e-6) mark = 2;
    else if (f > 0) {
      const snaps = [0, 1/3, 2/3];
      let best = 0, bestDiff = 1;
      snaps.forEach((s,i)=>{ const d=Math.abs(f-s); if(d<bestDiff){best=i;bestDiff=d;} });
      mark = best;
    }
    return `${w}${mark ? '.'+mark : ''}`;
  }
  function deriveIP(p){
    const outs = N(p.outs ?? p.Outs ?? p.아웃);
    if (outs > 0) return outs / 3;
    const raw = p.innings ?? p.ip ?? p.IP ?? p.이닝;
    return parseIPValue(raw);
  }
  function applyDerivedPitch(p){
    const ER = N(p.er ?? p.ER ?? p['자책점']);
    const ip = deriveIP(p);
    const ERA = div(ER * ERA_BASE, ip);
    if (ip > 0) p.innings = formatIP(ip);
    else p.innings = p.innings ?? p.ip ?? p.IP ?? p.이닝 ?? 0;
    p.era = r3(ERA);
    return p;
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  // ── WAR(리그 상수/개인) ──────────────────────────────────────
  function leagueBatConstants(rows){
    let WNUM=0, WDEN=0;
    rows.forEach(p=>{
      const AB  = N(p.ab), H = N(p.hits), _2B=N(p.double), _3B=N(p.triple), HR=N(p.hr);
      const BB  = N(p.bb), IBB=N(p.ibb), HBP=N(p.hbp), SF=N(p.sf);
      const _1B = Math.max(0, H - _2B - _3B - HR);
      const uBB = Math.max(0, BB - IBB);
      WNUM += WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
      WDEN += (AB + BB - IBB + HBP + SF);
    });
    const lgwoba = WDEN>0 ? WNUM/WDEN : 0;
    return { lgwoba, wobaScale: WAR_CFG.WOBAScale, rpw: WAR_CFG.RunsPerWin };
  }
  function calcBatWAR(p, K){
    const PA = N(p.pa);
    if (PA <= 0) return 0;
    const woba = N(p.woba);
    const wraa = ((woba - K.lgwoba) / K.wobaScale) * PA;
    const bsR  = 0.2 * N(p.sb);
    const repl = WAR_CFG.BatReplacementPerPA * PA;
    const runs = wraa + bsR + repl;
    return runs / K.rpw;
  }
  function leaguePitchConstants(rows){
    let RUNS=0, OUTS=0;
    rows.forEach(p=>{
      const ip = deriveIP(p) || 0;
      RUNS += N(p.runs);
      OUTS += Math.round(ip * 3);
    });
    const IP = OUTS/3;
    const ra7 = IP>0 ? RUNS * ERA_BASE / IP : 0;
    const repRA7 = ra7 * WAR_CFG.PitReplacementMult;
    return { ra7, repRA7, rpw: WAR_CFG.RunsPerWin };
  }
  function calcPitWAR(p, K){
    const ip = deriveIP(p) || 0;
    if (ip <= 0) return 0;
    const ra7 = N(p.runs) * ERA_BASE / ip;
    const rar = (K.repRA7 - ra7) * (ip / ERA_BASE);
    return rar / K.rpw;
  }

  // ── 연도 로딩 ────────────────────────────────────────────────
  const yearsFromSelect = () =>
    Array.from(yearSelect?.options || [])
      .map(o => o.value)
      .filter(v => /^\d{4}$/.test(v));

  function fetchBatYear(year){
    return fetch(`records_${year}.json`)
      .then(r => r.ok ? r.json() : Promise.reject(year))
      .then(normalizeRecords);
  }
  function fetchPitYear(year){
    return fetch(`pitching_${year}.json`)
      .then(r => r.ok ? r.json() : Promise.reject(year))
      .then(normalizeRecords)
      .catch(()=>[]);
  }

  function aggregateBattingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => arr.forEach(r => {
      const key = pidKey(r); if (!key) return;
      const t = map.get(key) || {
        name:r.name, number:r.number ?? r.playerId ?? r.id,
        ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,RBI:0,RUN:0,sb:0
      };
      t.name   = t.name || r.name;
      t.number = t.number ?? r.number ?? r.playerId ?? r.id;
      t.ab += N(r.ab ?? r.AB ?? r.타수);
      t.hits += N(r.hits ?? r.h ?? r.H ?? r.안타);
      t.double += N(r.double ?? r['2B'] ?? r['2루타']);
      t.triple += N(r.triple ?? r['3B'] ?? r['3루타']);
      t.hr += N(r.hr ?? r.HR ?? r['홈런']);
      t.bb += N(r.bb ?? r.BB ?? r['볼넷'] ?? r['4구']);
      t.ibb += N(r.ibb ?? r.IBB ?? r['고의4구']);
      t.hbp += N(r.hbp ?? r.HBP ?? r['사구']);
      t.sf += N(r.sf ?? r.SF ?? r['희생플라이'] ?? r['희비']);
      t.sh += N(r.sh ?? r.SH ?? r['희생번트'] ?? r['희번']);
      t.RBI += N(r.RBI ?? r.rbi ?? r['타점']);
      t.RUN += N(r.RUN ?? r.run ?? r.R ?? r['득점']);
      t.sb += N(r.sb ?? r.SB ?? r['도루']);
      map.set(key, t);
    }));
    return applyDerivedAll(Array.from(map.values()));
  }

  function aggregatePitchingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => arr.forEach(r => {
      const key = pidKey(r); if (!key) return;
      const t = map.get(key) || {
        name:r.name, number:r.number ?? r.playerId ?? r.id,
        outs:0, er:0, runs:0, so:0, bb:0, hbp:0, games:0, wins:0, losses:0, holds:0, saves:0
      };
      t.name   = t.name || r.name;
      t.number = t.number ?? r.number ?? r.playerId ?? r.id;
      const outs = N(r.outs ?? r.Outs ?? r.아웃);
      t.outs   += outs>0 ? outs : Math.round(deriveIP(r)*3);
      t.er     += N(r.er ?? r.ER ?? r['자책점']);
      t.runs   += N(r.runs ?? r.R ?? r['실점']);
      t.so     += N(r.so ?? r.SO ?? r['탈삼진']);
      t.bb     += N(r.bb ?? r.BB ?? r['볼넷']);
      t.hbp    += N(r.hbp ?? r.HBP ?? r['사구']);
      t.games  += N(r.games ?? r.G ?? r['경기수'] ?? r['등판 경기 수']);
      t.wins   += N(r.wins ?? r.W);
      t.losses += N(r.losses ?? r.L);
      t.holds  += N(r.holds ?? r.HLD ?? r['홀드']);
      t.saves  += N(r.saves ?? r.SV  ?? r['세이브']);
      map.set(key, t);
    }));
    const rows = Array.from(map.values());
    rows.forEach(p => { p.outs = Math.max(0, Math.round(p.outs)); });
    return applyDerivedPitchAll(rows);
  }

  // 선수 기본 정보
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(players => {
      const p = players.find(x => x.id === playerId);
      if (!p) throw '선수 정보 없음';
      playerName = p.name;
      document.getElementById('number').innerText     = `#${p.id}`;
      document.getElementById('name').innerText       = p.name;
      document.getElementById('birth').innerText      = p.birth;
      document.getElementById('highschool').innerText = p.highschool;
      document.getElementById('major').innerText      = p.major || '-';
      document.getElementById('position').innerText   = p.position || '-';
      yearSelect.value = '2025';
      loadYear('2025');
    })
    .catch(() => {
      recordBox.innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  // 탭 이벤트
  yearSelect.addEventListener('change', () => loadYear(yearSelect.value));
  btnBat.addEventListener('click', () => {
    currentMode = 'bat';
    btnBat.classList.add('active'); btnPit.classList.remove('active');
    togglePitchGrid(false);
    renderView();
  });
  btnPit.addEventListener('click', () => {
    currentMode = 'pit';
    btnPit.classList.add('active'); btnBat.classList.remove('active');
    togglePitchGrid(true);
    renderView();
  });

  // ── 투수 요약표(타일형) DOM/CSS ───────────────────────────────
  function ensurePitchGrid(){
    if (document.getElementById('pstats-grid')) return;
    const sec = document.createElement('section');
    sec.id = 'pstats-grid';
    // recordBox 위쪽에 고정 배치
    recordBox.parentNode.insertBefore(sec, recordBox);

    // 스타일(반응형 5→3→2열)
    if (!document.getElementById('pstats-grid-style')) {
      const st = document.createElement('style');
      st.id = 'pstats-grid-style';
      st.textContent = `
        #pstats-grid{ margin:12px 0 8px }
        #pstats-grid .tiles{
          display:grid; gap:12px;
          grid-template-columns:repeat(5,minmax(0,1fr));
        }
        #pstats-grid .tile{
          background:#fff; border:1px solid #e5e7eb; border-radius:12px;
          padding:10px 8px; display:flex; flex-direction:column; align-items:center;
        }
        #pstats-grid .th{
          width:100%; text-align:center; font-weight:700; color:#374151;
          background:#f3f4f6; border-radius:10px; padding:8px 8px; margin-bottom:6px;
          white-space:nowrap; font-size:clamp(12px,3.6vw,14px)
        }
        #pstats-grid .td{
          text-align:center; font-variant-numeric:tabular-nums;
          white-space:nowrap; font-size:clamp(12px,3.6vw,14px)
        }
        @media (max-width:840px){ #pstats-grid .tiles{ grid-template-columns:repeat(4,minmax(0,1fr)); } }
        @media (max-width:560px){ #pstats-grid .tiles{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:360px){
          #pstats-grid .tiles{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px }
          #pstats-grid .tile{ padding:8px 6px }
          #pstats-grid .th{ padding:6px 6px; margin-bottom:4px }
        }
      `;
      document.head.appendChild(st);
    }
  }
  function togglePitchGrid(show){
    const sec = document.getElementById('pstats-grid');
    if (sec) sec.style.display = show ? '' : 'none';
    // 타자 요약표는 반대로
    if (grid) grid.style.display = show ? 'none' : 'grid';
  }
  function renderPitchSummaryTiles(p){
    ensurePitchGrid();
    const sec = document.getElementById('pstats-grid');
    if (!p) { sec.innerHTML=''; return; }

    // 리그 상수로 pWAR 산출(표기용)
    const Kp   = leaguePitchConstants(pitData||[]);
    const pWAR = calcPitWAR(p, Kp);

    const ip = deriveIP(p);
    const tiles = [
      {lab:'이닝',    val: ip>0 ? formatIP(ip) : '0'},
      {lab:'방어율',  val: (p.era!=null ? Number(p.era).toFixed(2) : '0.00')},
      {lab:'승',      val: N(p.wins)},
      {lab:'패',      val: N(p.losses)},
      {lab:'탈삼진',  val: N(p.so)},
      {lab:'볼넷',    val: N(p.bb)},
      {lab:'사구',    val: N(p.hbp)},
      {lab:'실점',    val: N(p.runs)},
      {lab:'자책점',  val: N(p.er)},
      {lab:'WAR',     val: pWAR.toFixed(2)}
    ];

    sec.innerHTML = `
      <div class="tiles">
        ${tiles.map(t => `
          <div class="tile">
            <div class="th">${t.lab}</div>
            <div class="td">${t.val}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── 데이터 로드 ───────────────────────────────────────────────
  function loadYear(year) {
    const isCareer = (year === 'total' || year === 'career');

    recordBox.innerHTML  = '<p style="text-align:center;">기록 로드 중...</p>';
    grid.style.display   = 'none';
    contribBox.innerHTML = '';
    togglePitchGrid(currentMode==='pit'); // 모드 유지

    if (isCareer) {
      const years = yearsFromSelect();
      if (!years.length) {
        recordBox.innerHTML = '<p style="text-align:center;">통산 집계에 사용할 연도가 없습니다.</p>';
        batData = []; pitData = [];
        renderView();
        return;
      }
      const batJobs = years.map(y => fetchBatYear(y).catch(()=>[]));
      const pitJobs = years.map(y => fetchPitYear(y).catch(()=>[]));
      Promise.allSettled([Promise.allSettled(batJobs), Promise.allSettled(pitJobs)])
        .then(([batResAll, pitResAll]) => {
          const allBat = batResAll.value?.flatMap(r => r.status==='fulfilled'?r.value:[]) || [];
          const allPit = pitResAll.value?.flatMap(r => r.status==='fulfilled'?r.value:[]) || [];
          batData = aggregateBattingAllPlayers([allBat]);
          pitData = aggregatePitchingAllPlayers([allPit]);
          const hasPit = pitData.some(r => ((r.playerId ?? parseInt(r.number,10)) === playerId) || (r.name === playerName));
          btnPit.style.display = hasPit ? 'inline-block' : 'none';
          currentMode = 'bat';
          btnBat.classList.add('active'); btnPit.classList.remove('active');
          togglePitchGrid(false);
          renderView();
        })
        .catch(() => {
          recordBox.innerHTML = '<p style="text-align:center;">통산 집계 실패</p>';
          batData = []; pitData = [];
          renderView();
        });
      return;
    }

    // 단일 연도
    Promise.all([ fetchBatYear(year).catch(()=>[]), fetchPitYear(year).catch(()=>[]) ])
      .then(([bDataRaw, pDataRaw]) => {
        batData = applyDerivedAll(bDataRaw);
        pitData = applyDerivedPitchAll(pDataRaw);
        const hasPit = pitData.some(r => ((r.playerId ?? parseInt(r.number,10)) === playerId) || (r.name === playerName));
        btnPit.style.display = hasPit ? 'inline-block' : 'none';
        currentMode = 'bat';
        btnBat.classList.add('active'); btnPit.classList.remove('active');
        togglePitchGrid(false);
        renderView();
      })
      .catch(() => {
        recordBox.innerHTML = '<p style="text-align:center;">기록 로드 실패</p>';
        batData = []; pitData = [];
        renderView();
      });
  }

  function renderView() { (currentMode === 'bat') ? showBatting() : showPitching(); }

  // ── 배팅 표시 ────────────────────────────────────────────────
  function showBatting() {
    const rec = batData.find(r => (r.playerId ?? parseInt(r.number,10)) === playerId)
             || batData.find(r => r.name === playerName);

    togglePitchGrid(false);

    if (!rec) {
      recordBox.innerHTML = '<p style="text-align:center;">타격 기록이 없습니다.</p>';
      grid.style.display  = 'none';
    } else {
      ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops']
      .forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        let v = rec[key] != null ? rec[key] : '-';
        if (v !== '-' && ['avg','obp','slg','ops'].includes(key)) v = Number(v).toFixed(3);
        el.innerText = v;
      });
      grid.style.display = 'grid';

      recordBox.innerHTML = '';
      [
        ['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],
        ['3루타','triple'],['홈런','hr'],['4구','bb'],['사구','hbp'],
        ['타점','RBI'],['득점','RUN'],['도루','sb'],
        ['출루율','obp'],['장타율','slg'],['OPS','ops'],['wOBA','woba']
      ].forEach(([lab,k])=>{
        const d = document.createElement('div');
        const raw = rec[k];
        const isRate = ['woba','slg','obp','ops','avg'].includes(k);
        const txt = raw != null ? (isRate ? Number(raw).toFixed(3) : raw.toString()) : '0';
        d.innerHTML = `<strong>${lab}:</strong> ${txt}`;
        recordBox.appendChild(d);
      });
    }
    computeWAR();
  }

  // ── 투구 표시 (요약 타일 + 상세) ─────────────────────────────
  function showPitching() {
    const rec = pitData.find(r => (r.playerId ?? parseInt(r.number,10)) === playerId)
             || pitData.find(r => r.name === playerName);

    togglePitchGrid(true);

    if (!rec) {
      renderPitchSummaryTiles(null);
      recordBox.innerHTML = '<p style="text-align:center;">투구 기록이 없습니다.</p>';
      return;
    }

    // 요약 타일
    renderPitchSummaryTiles(rec);

    // 상세(아래 텍스트 리스트는 기존처럼 유지)
    recordBox.innerHTML = '';
    const eraTxt = (rec.era != null) ? Number(rec.era).toFixed(2) : '0.00';
    [
      ['등판 경기 수','games'],
      ['이닝','innings', (deriveIP(rec)>0 ? formatIP(deriveIP(rec)) : '0')],
      ['방어율','era', eraTxt],
      ['승','wins'],['패','losses'],['홀드','holds'],['세이브','saves'],
      ['탈삼진','so'],['볼넷','bb'],['사구','hbp'],
      ['실점','runs'],['자책점','er']
    ].forEach(([lab,k,override])=>{
      const d = document.createElement('div');
      const val = (override != null) ? override : (rec[k]!=null?rec[k]:0).toString();
      d.innerHTML = `<strong>${lab}:</strong> ${val}`;
      recordBox.appendChild(d);
    });

    computeWAR();
  }

  // ── WAR(팀 내 순위 포함) ────────────────────────────────────
  function computeWAR() {
    const Kb = leagueBatConstants(batData || []);
    const Kp = leaguePitchConstants(pitData || []);

    const warByPid = new Map();

    (batData || []).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number,10) ?? r.id;
      if (!pid) return;
      const w = calcBatWAR(r, Kb);
      warByPid.set(pid, (warByPid.get(pid) || 0) + w);
      r._batWAR = w;
    });

    (pitData || []).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number,10) ?? r.id;
      if (!pid) return;
      const w = calcPitWAR(r, Kp);
      warByPid.set(pid, (warByPid.get(pid) || 0) + w);
      r._pitWAR = w;
    });

    const batRec = (batData || []).find(r => (r.playerId ?? parseInt(r.number,10)) === playerId) ||
                   (batData || []).find(r => r.name === playerName);
    const pitRec = (pitData || []).find(r => (r.playerId ?? parseInt(r.number,10)) === playerId) ||
                   (pitData || []).find(r => r.name === playerName);

    const batWAR = batRec ? (batRec._batWAR || 0) : 0;
    const pWAR   = pitRec ? (pitRec._pitWAR || 0) : 0;
    const tWAR   = batWAR + pWAR;

    const totals = Array.from(warByPid.values());
    const sorted = totals.slice().sort((a,b)=>b-a);
    const rank = (tWAR !== 0) ? (sorted.indexOf(tWAR) + 1) : 0;

    contribBox.innerHTML =
      `<strong>WAR(총):</strong> ${tWAR.toFixed(2)}${rank?` <span style="color:#6b7280;">(팀 내 ${rank}위)</span>`:''}` +
      `<br><strong>Bat WAR:</strong> ${batWAR.toFixed(2)}` +
      `<br><strong>pWAR:</strong> ${pWAR.toFixed(2)}`;
  }
});
