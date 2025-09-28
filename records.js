// records.js — FINAL (career 자동집계 + CI 포함 + WAR 추가 + 이닝 정렬 보정)
// - 리더보드 규정타석: 연간 팀 '승/패' 경기수 × 1.5 (자동)
// - career(통산): 연도별 파일 합산 자동계산
// - 파생지표 자동계산: AVG/OBP/SLG/OPS/wOBA/ISO
// - 투수: ERA 자동계산(7이닝 기준), IP 표기 .1=⅓, .2=⅔, ERA는 0.00
// - WAR 추가: bat WAR(간이), pWAR(간이). 리그 상수 동적 계산

document.addEventListener('DOMContentLoaded', () => {
  const btnBat    = document.getElementById('btn-batting');
  const btnPit    = document.getElementById('btn-pitching');
  const yearSel   = document.getElementById('yearSelect');
  const filterBtn = document.getElementById('filterBtn');
  const theadRow  = document.getElementById('theadRow');
  const tbody     = document.getElementById('tbodyRows');

  // 상태
  let currentType = 'bat';    // 'bat' | 'pit'
  let filterOn    = false;    // 규정타석(통산)
  let currentSort = { key:'pa', asc:false };
  let searchTerm  = '';       // 이름 검색(시작 일치)
  let lastRows    = [];       // 현재 데이터(정렬/검색 전 원본)
  let minPAForLeaders = 0;    // 리더보드용 규정타석 (연도별 동적 / career=40)
  let scheduleCache = null;   // schedule.json 캐시

  // ── 설정값 (필요시 조정) ──────────────────────────────────────
  // 7이닝 환경용 대략값: RunsPerWin은 7~8 근처. wOBA_SCALE은 MLB와 유사 1.15 가정.
  const WAR_CFG = {
    WOBAScale: 1.15,
    RunsPerWin: 7.5,
    BatReplacementPerPA: 0.033,  // ≈ 20 runs / 600 PA
    PitReplacementMult: 1.20     // 대체선수 RA7 = 리그RA7 * 1.20
  };

  // ── 파생지표 계산 유틸 ─────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3  = x => Math.round(x * 1000) / 1000;

  // (리그 기준 이닝 수: 아마 7이닝 기본. 필요 시 9로 변경)
  const ERA_BASE = 7;

  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // JSON 정규화
  function normalizeRecords(data){
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.players)) return data.players;
    if (data && Array.isArray(data.batters)) return data.batters;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.data))    return data.data;
    return [];
  }
  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  // ── 타격 파생 ─────────────────────────────────────────────────
  function applyDerived(p) {
    const AB  = N(p.ab ?? p.AB ?? p.타수);
    const H   = N(p.hits ?? p.h ?? p.H ?? p.안타);
    const _2B = N(p.double ?? p['2B'] ?? p['2루타']);
    const _3B = N(p.triple ?? p['3B'] ?? p['3루타']);
    const HR  = N(p.hr ?? p.HR ?? p.홈런);
    const BB  = N(p.bb ?? p.BB ?? p.볼넷 ?? p['4구']);
    const IBB = N(p.ibb ?? p.IBB ?? p.고의4구);
    const HBP = N(p.hbp ?? p.HBP ?? p.사구);
    const SF  = N(p.sf ?? p.SF ?? p['희생플라이'] ?? p['희비'] ?? p['희플']);
    const SH  = N(p.sh ?? p.SH ?? p['희생번트'] ?? p['희번']);
    const CI  = N(p.ci ?? p.CI ?? p['타격방해'] ?? p['포수방해']); // PA 포함

    const PAi = N(p.pa ?? p.PA ?? p.타석);
    const PA  = PAi > 0 ? PAi : (AB + BB + HBP + SF + SH + CI);

    const _1B = Math.max(0, H - _2B - _3B - HR);
    const TB  = _1B + 2*_2B + 3*_3B + 4*HR;

    const AVG = div(H, AB);
    const OBP = div(H + BB + HBP, AB + BB + HBP + SF);
    const SLG = div(TB, AB);
    const OPS = OBP + SLG;

    const uBB = Math.max(0, BB - IBB);
    const wDen= (AB + BB - IBB + HBP + SF);
    const wNum= WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
    const wOBA= div(wNum, wDen);

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

  // ── 투수 파생 (ERA/IP) ────────────────────────────────────────
  function normalizeFractionStr(str=''){
    return String(str)
      .replace(/\u2153/g, ' 1/3') // ⅓
      .replace(/\u2154/g, ' 2/3') // ⅔
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
    p._ipVal = ip; // 정렬/계산 캐시
    if (ip > 0) p.innings = formatIP(ip);
    else p.innings = p.innings ?? p.ip ?? p.IP ?? p.이닝 ?? 0;
    p.era = r3(ERA);
    return p;
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  // ── WAR 계산 보조: 리그 상수 ───────────────────────────────────
  function leagueBatConstants(rows){
    // lgwOBA = ΣwNum / ΣwDen (선수별 합산)
    let WNUM=0, WDEN=0, PA=0;
    rows.forEach(p=>{
      const AB  = N(p.ab), H = N(p.hits), _2B=N(p.double), _3B=N(p.triple), HR=N(p.hr);
      const BB  = N(p.bb), IBB=N(p.ibb), HBP=N(p.hbp), SF=N(p.sf), SH=N(p.sh);
      const _1B = Math.max(0, H - _2B - _3B - HR);
      const uBB = Math.max(0, BB - IBB);
      WNUM += WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
      WDEN += (AB + BB - IBB + HBP + SF);
      PA   += N(p.pa);
    });
    const lgwoba = WDEN>0 ? WNUM/WDEN : 0;
    return { lgwoba, wobaScale: WAR_CFG.WOBAScale, rpw: WAR_CFG.RunsPerWin };
  }
  function calcBatWAR(p, K){
    const PA = N(p.pa);
    if (PA <= 0) return 0;
    const woba = N(p.woba);
    const wraa = ((woba - K.lgwoba) / K.wobaScale) * PA;
    const bsR  = 0.2 * N(p.sb);             // 간단 주루 보정(보수적). CS 없으므로 최소치만
    const repl = WAR_CFG.BatReplacementPerPA * PA;
    const runs = wraa + bsR + repl;
    return runs / K.rpw;
  }
  function leaguePitchConstants(rows){
    // 리그 RA7 = (총 실점 * ERA_BASE) / 총 IP
    let RUNS=0, OUTS=0;
    rows.forEach(p=>{
      const ip = (p._ipVal != null ? p._ipVal : deriveIP(p)) || 0;
      RUNS += N(p.runs);
      OUTS += Math.round(ip * 3);
    });
    const IP = OUTS/3;
    const ra7 = IP>0 ? RUNS * ERA_BASE / IP : 0;
    const repRA7 = ra7 * WAR_CFG.PitReplacementMult;
    return { ra7, repRA7, rpw: WAR_CFG.RunsPerWin };
  }
  function calcPitWAR(p, K){
    const ip = (p._ipVal != null ? p._ipVal : deriveIP(p)) || 0;
    if (ip <= 0) return 0;
    const ra7 = N(p.runs) * ERA_BASE / ip;
    const rar = (K.repRA7 - ra7) * (ip / ERA_BASE);
    return rar / K.rpw;
  }

  // ── career 자동집계 ───────────────────────────────────────────
  const numericYearsFromSelect = () =>
    Array.from(yearSel?.options || [])
      .map(o => o.value)
      .filter(v => /^\d{4}$/.test(v));

  function fetchYearFile(year, type){
    const file = type==='bat' ? `records_${year}.json` : `pitching_${year}.json`;
    return fetch(file).then(r => r.ok ? r.json() : Promise.reject(file)).then(normalizeRecords);
  }

  function aggregateBatting(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      arr.forEach(r => {
        const key = pidKey(r);
        if (!key) return;
        const t = map.get(key) || {
          name: r.name, number: r.number ?? r.playerId ?? r.id,
          ab:0, hits:0, double:0, triple:0, hr:0, bb:0, ibb:0, hbp:0, sf:0, sh:0, ci:0,
          RBI:0, RUN:0, sb:0
        };
        t.name   = t.name || r.name;
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;

        t.ab    += N(r.ab ?? r.AB ?? r.타수);
        t.hits  += N(r.hits ?? r.h ?? r.H ?? r.안타);
        t.double+= N(r.double ?? r['2B'] ?? r['2루타']);
        t.triple+= N(r.triple ?? r['3B'] ?? r['3루타']);
        t.hr    += N(r.hr ?? r.HR ?? r.홈런);
        t.bb    += N(r.bb ?? r.BB ?? r.볼넷 ?? r['4구']);
        t.ibb   += N(r.ibb ?? r.IBB ?? r.고의4구);
        t.hbp   += N(r.hbp ?? r.HBP ?? r.사구);
        t.sf    += N(r.sf ?? r.SF ?? r['희생플라이'] ?? r['희비'] ?? r['희플']);
        t.sh    += N(r.sh ?? r.SH ?? r['희생번트'] ?? r['희번']);
        t.ci    += N(r.ci ?? r.CI ?? r['타격방해'] ?? r['포수방해']);
        t.RBI   += N(r.RBI ?? r.rbi ?? r['타점']);
        t.RUN   += N(r.RUN ?? r.run ?? r.R ?? r['득점']);
        t.sb    += N(r.sb  ?? r.SB  ?? r['도루']);
        map.set(key, t);
      });
    });
    return applyDerivedAll(Array.from(map.values()));
  }

  function aggregatePitching(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      arr.forEach(r => {
        const key = pidKey(r);
        if (!key) return;
        const t = map.get(key) || {
          name:r.name, number:r.number ?? r.playerId ?? r.id,
          outs:0, er:0, runs:0, so:0, bb:0, hbp:0, games:0, wins:0, losses:0, holds:0, saves:0
        };
        t.name   = t.name || r.name;
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;

        const outs = N(r.outs ?? r.Outs ?? r.아웃);
        let addOuts = 0;
        if (outs > 0) addOuts = outs;
        else addOuts = Math.round(deriveIP(r) * 3);

        t.outs   += addOuts;
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
      });
    });
    const rows = Array.from(map.values());
    rows.forEach(p => { p.outs = Math.max(0, Math.round(p.outs)); });
    return applyDerivedPitchAll(rows);
  }

  function loadCareerAggregated(type){
    const years = numericYearsFromSelect();
    if (!years.length) return Promise.resolve([]);
    const jobs = years.map(y => fetchYearFile(y, type).then(arr => arr).catch(()=>[]));
    return Promise.allSettled(jobs).then(results => {
      const all = results.flatMap(r => r.status==='fulfilled' ? r.value : []);
      return type==='bat' ? aggregateBatting([all]) : aggregatePitching([all]);
    });
  }

  // ── 필드 정의 ────────────────────────────────────────────────
  const batFields = [
    {key:'name', label:'선수명'},
    {key:'pa',   label:'타석'},
    {key:'ab',   label:'타수'},
    {key:'hits', label:'안타'},
    {key:'double',label:'2루타'},
    {key:'triple',label:'3루타'},
    {key:'hr',   label:'홈런'},
    {key:'RBI',  label:'타점'},
    {key:'RUN',  label:'득점'},
    {key:'sb',   label:'도루'},
    {key:'bb',   label:'4구'},
    {key:'hbp',  label:'사구'},
    {key:'avg',  label:'타율'},
    {key:'obp',  label:'출루율'},
    {key:'slg',  label:'장타율'},
    {key:'ops',  label:'OPS'},
    {key:'iso',  label:'ISO'},
    {key:'woba', label:'wOBA'},
    {key:'war',  label:'WAR'}        // ★ 추가
  ];
  const pitFields = [
    {key:'name',   label:'투수명'},
    {key:'games',  label:'등판 경기 수'},
    {key:'innings',label:'이닝'},
    {key:'era',    label:'방어율'},
    {key:'wins',   label:'승'},
    {key:'losses', label:'패'},
    {key:'holds',  label:'홀드'},
    {key:'saves',  label:'세이브'},
    {key:'so',     label:'탈삼진'},
    {key:'bb',     label:'볼넷'},
    {key:'hbp',    label:'사구'},
    {key:'runs',   label:'실점'},
    {key:'er',     label:'자책점'},
    {key:'pwar',   label:'pWAR'}     // ★ 추가
  ];
  const floatBat = ['avg','obp','slg','ops','woba','iso','war']; // ★ war 포함
  const floatPit = ['era','pwar'];                                // ★ pwar 포함

  // ── 상단 UI(검색·리더보드 자리 확보) ──────────────────────────
  injectStyle();
  ensureTopUI();

  const searchBox  = document.getElementById('searchBox');
  const suggestBox = document.getElementById('suggestBox');

  // 타입 토글
  btnBat.addEventListener('click', () => {
    currentType = 'bat';
    btnBat.classList.add('active');
    btnPit.classList.remove('active');
    filterBtn.style.display = (yearSel.value==='career') ? 'inline-block' : 'none';
    currentSort = { key:'pa', asc:false };
    syncURL();
    loadData(yearSel.value);
  });
  btnPit.addEventListener('click', () => {
    currentType = 'pit';
    btnPit.classList.add('active');
    btnBat.classList.remove('active');
    filterBtn.style.display = 'none';
    currentSort = { key:'games', asc:false };
    syncURL();
    loadData(yearSel.value);
  });

  // 연도 변경
  yearSel.addEventListener('change', () => {
    filterOn = false;
    filterBtn.textContent = '규정타석 기준';
    syncURL();
    loadData(yearSel.value);
  });

  // 규정타석 필터 (타격·통산만)
  filterBtn.addEventListener('click', () => {
    filterOn = !filterOn;
    filterBtn.textContent = filterOn ? '전체 보기' : '규정타석 기준';
    syncURL();
    sortAndRender(lastRows);
  });

  // 검색 입력(시작 일치 + 자동완성)
  searchBox.addEventListener('input', () => {
    searchTerm = (searchBox.value || '').trim();
    updateSuggest();
    syncURL();
    sortAndRender(lastRows);
  });
  searchBox.addEventListener('focus', updateSuggest);
  searchBox.addEventListener('blur', () => setTimeout(hideSuggest, 150));
  searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { hideSuggest(); sortAndRender(lastRows); }
  });

  // 테이블 렌더
  function renderTable(records) {
    const fields = (currentType==='bat') ? batFields : pitFields;

    // 헤더
    theadRow.innerHTML = '';
    fields.forEach(f => {
      const th = document.createElement('th');
      th.textContent = f.label;
      th.style.cursor = 'pointer';
      th.dataset.key = f.key;
      th.addEventListener('click', () => {
        if (currentSort.key === f.key) currentSort.asc = !currentSort.asc;
        else { currentSort.key = f.key; currentSort.asc = true; }
        syncURL();
        sortAndRender(records);
      });
      theadRow.appendChild(th);
    });

    // 본문
    sortAndRender(records);
  }

  // 소수 자리수 통일 함수
  function fmtByKey(key, v){
    if (key === 'era' || key === 'war' || key === 'pwar') return Number(v).toFixed(2); // ERA/WAR류는 0.00
    return Number(v).toFixed(3); // 타율류
  }

  // 정렬 + 검색 + 필터 + 렌더
  function sortAndRender(records) {
    lastRows = records.slice();

    let rows = records.slice();

    // 검색: 시작 일치(이름/등번호)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        String(r.name || '').toLowerCase().startsWith(q) ||
        String(r.number || '').toLowerCase().startsWith(q)
      );
    }

    if (currentType==='bat') {
      rows = rows.filter(r => Number(r.pa) >= 1);
      if (filterOn && yearSel.value==='career') rows = rows.filter(r => Number(r.pa) >= 40);
    }

    // 정렬
    const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key))
                 || (currentType==='pit' && floatPit.includes(currentSort.key));

    rows.sort((a, b) => {
      // 투수 '이닝'은 ⅓ 단위 실수로 비교
      if (currentType === 'pit' && currentSort.key === 'innings') {
        const va = (a._ipVal != null ? a._ipVal : deriveIP(a)) || 0;
        const vb = (b._ipVal != null ? b._ipVal : deriveIP(b)) || 0;
        if (va < vb) return currentSort.asc ? -1 : 1;
        if (va > vb) return currentSort.asc ? 1 : -1;
        return String(a.name||'').localeCompare(String(b.name||''));
      }

      let va = a[currentSort.key], vb = b[currentSort.key];
      if (isFloat) { va = Number(va); vb = Number(vb); }
      if (va < vb) return currentSort.asc ? -1 : 1;
      if (va > vb) return currentSort.asc ? 1 : -1;
      return String(a.name||'').localeCompare(String(b.name||''));
    });

    // 렌더
    tbody.innerHTML = '';
    const fields = (currentType==='bat') ? batFields : pitFields;
    const floatF = (currentType==='bat') ? floatBat : floatPit;

    rows.forEach(r => {
      const tr = document.createElement('tr');
      fields.forEach(f => {
        const td = document.createElement('td');
        let v = (r[f.key] != null ? r[f.key] : '');
        td.textContent = floatF.includes(f.key) ? fmtByKey(f.key, v) : v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // 리더보드(타격만)
    const leaders = document.getElementById('leaders');
    if (leaders) {
      if (currentType === 'bat' && rows.length) {
        leaders.innerHTML = buildLeadersHTML(rows, minPAForLeaders);
      } else {
        leaders.innerHTML = '';
      }
      ensureLeadersPlacement();
    }

    // 자동완성 갱신
    updateSuggest();
  }

  // ── 리그/시즌 규정타석 계산(동적) ─────────────────────────────
  function fetchSchedule(){
    if (scheduleCache) return Promise.resolve(scheduleCache);
    return fetch('schedule.json')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => (scheduleCache = data))
      .catch(() => (scheduleCache = {}));
  }

  function countPlayedGames(scheduleData, year){
    try{
      const arr = scheduleData && scheduleData[year] ? scheduleData[year] : [];
      let cnt = 0;
      for (let i=0;i<arr.length;i++){
        const res = String((arr[i]||{}).result || '').trim();
        if (/^(승|패)/.test(res)) cnt++;
      }
      return cnt;
    }catch(e){ return 0; }
  }

  function getMinPAForYear(year){
    if (year === 'career') return Promise.resolve(40);
    return fetchSchedule().then(sc => {
      const played = countPlayedGames(sc, year);
      const minPA = Math.max(0, Math.ceil(played * 1.5)); // ×1.5
      return minPA;
    }).catch(()=>20);
  }

  // 리더보드 생성 (ISO/OPS/AVG/HR/H/RBI/R/SB)
  function topN(rows, key, n, isRate, minPA){
    const arr = rows.slice().filter(r => !isRate || Number(r.pa) >= (minPA || 0));
    arr.sort((a,b)=> (+b[key]||0) - (+a[key]||0));
    return arr.slice(0, n);
  }
  function buildLeadersHTML(rows, minPA){
    const blocks = [
      { key:'iso',  label:'ISO',  rate:true },
      { key:'ops',  label:'OPS',  rate:true },
      { key:'avg',  label:'AVG',  rate:true },
      { key:'hr',   label:'HR' },
      { key:'hits', label:'H'  },
      { key:'RBI',  label:'RBI' },
      { key:'RUN',  label:'R' },
      { key:'sb',   label:'SB' }
      // 필요하면 { key:'war', label:'WAR' } 를 추가해 상단 칩에 노출 가능
    ];
    const chips = blocks.map(b => {
      const top = topN(rows, b.key, 3, b.rate, minPA);
      const items = top.map(t => `${t.name} <b>${Number(t[b.key]||0).toFixed(b.rate?3:0)}</b>`).join(' · ');
      return `<div class="mini-chip"><strong>${b.label}</strong> ${items}</div>`;
    }).join('');
    const note = `<div class="mini-note">규정타석: ${yearSel.value==='career' ? '40 고정' : `팀 '승/패' 경기수 × 1.5 = ${minPA}`}</div>`;
    return note + chips;
  }

  // 데이터 로드 (+타격/투수 자동계산 & 리그 상수로 WAR 계산 & 리더보드 규정타석 설정)
  function loadData(year) {
    const minPAp = getMinPAForYear(year).then(v => { minPAForLeaders = v; });

    if (year === 'career') {
      const aggP = (currentType==='bat') ? loadCareerAggregated('bat') : loadCareerAggregated('pit');

      Promise.all([aggP, minPAp])
        .then(([arr]) => {
          if (currentType === 'bat') {
            // 리그 상수 → WAR
            const K = leagueBatConstants(arr);
            arr.forEach(p => { p.war = calcBatWAR(p, K); });
          } else {
            const Kp = leaguePitchConstants(arr);
            arr.forEach(p => { p.pwar = calcPitWAR(p, Kp); });
          }
          renderTable(arr);
        })
        .catch(err => {
          console.error('career 집계 오류:', err);
          tbody.innerHTML = `<tr><td colspan="${(currentType==='bat'?batFields.length:pitFields.length)}">통산 집계에 실패했습니다.</td></tr>`;
          const leaders = document.getElementById('leaders'); if (leaders) leaders.innerHTML='';
        });
      return;
    }

    // 단일 연도
    const file = (currentType==='bat') ? `records_${year}.json` : `pitching_${year}.json`;

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        let arr = normalizeRecords(data);
        if (currentType==='bat') {
          arr = applyDerivedAll(arr);
          const K = leagueBatConstants(arr);
          arr.forEach(p => { p.war = calcBatWAR(p, K); });
        } else {
          arr = applyDerivedPitchAll(arr);
          const Kp = leaguePitchConstants(arr);
          arr.forEach(p => { p.pwar = calcPitWAR(p, Kp); });
        }
        return minPAp.then(() => renderTable(arr));
      })
      .catch(err => {
        console.error('로드 오류:', err);
        tbody.innerHTML = `<tr><td colspan="${(currentType==='bat'?batFields.length:pitFields.length)}">데이터를 불러오는 데 실패했습니다.</td></tr>`;
        const leaders = document.getElementById('leaders'); if (leaders) leaders.innerHTML='';
      });
  }

  // ── 리더보드 위치: 가로 스크롤 컨테이너 밖으로 이동(고정) ───────
  function ensureLeadersPlacement() {
    const leaders = document.getElementById('leaders');
    if (!leaders) return;
    const table = theadRow ? theadRow.closest('table') : null;
    const scrollWrap = findHorizontalScroller(table || theadRow);
    const targetParent = scrollWrap ? scrollWrap.parentNode : (table ? table.parentNode : leaders.parentNode);
    if (leaders.parentNode !== targetParent) {
      targetParent.insertBefore(leaders, scrollWrap || table);
    }
  }
  function findHorizontalScroller(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      const cs = window.getComputedStyle(cur);
      const ox = cs.overflowX;
      if (ox === 'auto' || ox === 'scroll') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  // ── 자동완성 드롭다운 ──────────────────────────────────────────
  function updateSuggest() {
    const box = suggestBox;
    if (!box) return;
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) { hideSuggest(); return; }

    const names = Array.from(new Set(lastRows.map(r => String(r.name||'')))).filter(Boolean);
    const list = names.filter(n => n.toLowerCase().startsWith(q)).slice(0, 8);

    if (!list.length) { hideSuggest(); return; }

    box.innerHTML = '';
    list.forEach(name => {
      const item = document.createElement('div');
      item.className = 'suggest-item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        searchBox.value = name;
        searchTerm = name;
        hideSuggest();
        syncURL();
        sortAndRender(lastRows);
      });
      box.appendChild(item);
    });
    box.style.display = 'block';
  }
  function hideSuggest(){ if (suggestBox) suggestBox.style.display = 'none'; }

  // ── 딥링크 복원/동기화 ────────────────────────────────────────
  function restoreFromURL() {
    const qs = new URLSearchParams(location.search);
    const type = qs.get('type');        // bat | pit
    const year = qs.get('year');        // 2025 | career
    const sort = qs.get('sort');        // 필드키
    const desc = qs.get('desc');        // '1'이면 내림차순
    const filt = qs.get('f');           // '1' 규정타석
    const q    = qs.get('q');           // 검색어

    if (type === 'pit') { currentType='pit'; btnPit.classList.add('active'); btnBat.classList.remove('active'); filterBtn.style.display='none'; currentSort={key:'games',asc:false}; }
    if (year && Array.from(yearSel.options).some(o => o.value===year)) yearSel.value=year;
    if (sort) currentSort.key = sort;
    if (desc==='1') currentSort.asc = false; else if (desc==='0') currentSort.asc = true;
    if (type==='bat' && yearSel.value==='career' && filt==='1') { filterOn=true; filterBtn.textContent='전체 보기'; }
    if (q) { searchTerm = q; if (searchBox) searchBox.value = q; }
  }
  function syncURL() {
    const qs = new URLSearchParams();
    qs.set('type', currentType);
    qs.set('year', yearSel.value);
    qs.set('sort', currentSort.key);
    qs.set('desc', currentSort.asc ? '0':'1');
    if (currentType==='bat' && yearSel.value==='career' && filterOn) qs.set('f','1');
    if (searchTerm) qs.set('q', searchTerm);
    history.replaceState(null, '', location.pathname + '?' + qs.toString());
  }

  // ── 유틸: 스타일/상단 UI 생성 ────────────────────────────────
  function injectStyle(){
    if (document.getElementById('records-style')) return;
    const css =
      '#leaders{margin:10px 0 6px 0; position:relative; z-index:5}' +
      '#leaders .mini-chip{padding:6px 8px;border:1px solid #eee;border-radius:8px;display:inline-block;margin:4px 6px;background:#fff;white-space:nowrap;font-size:13px}' +
      '#leaders .mini-note{display:block;margin:0 6px 6px 6px;color:#6b7280;font-size:12px}' +
      '#searchWrap{display:inline-block; position:relative; margin-left:8px}' +
      '#searchBox{padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;min-width:140px}' +
      '#suggestBox{position:absolute;top:34px;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.06);display:none;max-height:220px;overflow:auto;z-index:50}' +
      '.suggest-item{padding:8px 10px;cursor:pointer}' +
      '.suggest-item:hover{background:#f3f4f6}';
    const st = document.createElement('style');
    st.id = 'records-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
  function ensureTopUI(){
    if (!document.getElementById('searchWrap')) {
      const wrap = document.createElement('span');
      wrap.id = 'searchWrap';
      const input = document.createElement('input');
      input.id = 'searchBox';
      input.placeholder = '선수 검색(시작 일치)';
      const sugg = document.createElement('div');
      sugg.id = 'suggestBox';
      wrap.appendChild(input);
      wrap.appendChild(sugg);
      (filterBtn && filterBtn.parentNode ? filterBtn.parentNode : yearSel.parentNode).appendChild(wrap);
    }
    if (!document.getElementById('leaders')) {
      const leaders = document.createElement('div');
      leaders.id = 'leaders';
      const table = theadRow && theadRow.parentNode && theadRow.parentNode.parentNode;
      const parent = (table && table.parentNode) || document.body;
      parent.insertBefore(leaders, table || parent.firstChild);
    }
  }

  // 초기: URL 복원 → 로드 → URL 동기화
  restoreFromURL();
  loadData(yearSel.value);
  syncURL();
});
