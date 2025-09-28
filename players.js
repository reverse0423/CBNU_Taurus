// players.js — FINAL (선수 목록 + WAR 랭킹 배너 Top 15, 컴팩트 표)
// - WAR = Bat WAR + pWAR (타자 wOBA 기반, 투수 RA7 기반)
// - 연도별 / 통산 지원, Top 15 클릭 시 player.html?id=... 이동
// - 표 폭 최적화: table-layout:fixed + colgroup, ellipsis로 가로 스크롤 제거

document.addEventListener('DOMContentLoaded', () => {
  const btnPlayers  = document.getElementById('btn-players');
  const btnRanking  = document.getElementById('btn-ranking');
  const playerList  = document.getElementById('playerList');
  const rankingList = document.getElementById('rankingList');
  const yearSelect  = document.getElementById('year-select-ranking');

  if (!playerList || !rankingList) {
    console.error('필수 요소가 없습니다.');
    return;
  }

  // ── 유틸 ─────────────────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3  = x => Math.round(x * 1000) / 1000;

  // WAR 설정(간이)
  const ERA_BASE = 7;
  const WAR_CFG = {
    WOBAScale: 1.15,
    RunsPerWin: 7.5,
    BatReplacementPerPA: 0.033,
    PitReplacementMult: 1.20
  };

  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

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

  // ── 타격 파생 ─────────────────────────────────────────────────
  function applyDerivedBat(p){
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
  const applyDerivedBatAll = arr => arr.map(applyDerivedBat);

  // ── 투수 파생 (IP/ERA) ───────────────────────────────────────
  function normalizeFractionStr(str=''){
    return String(str)
      .replace(/\u2153/g, ' 1/3').replace(/\u2154/g, ' 2/3')
      .replace(/\u00BC/g, ' 1/4').replace(/\u00BD/g, ' 1/2').replace(/\u00BE/g, ' 3/4');
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
    const m1 = s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/);
    if (m1) {
      const whole = +m1[1], num = m1[2] ? +m1[2] : 0, den = m1[3] ? +m1[3] : 1;
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
    p.innings = ip > 0 ? formatIP(ip) : (p.innings ?? p.ip ?? p.IP ?? p.이닝 ?? 0);
    p.era = r3(ERA);
    return p;
  }
  function formatIP(ip){
    const w = Math.floor(ip), f = ip - w;
    let mark = 0;
    if (Math.abs(f - 1/3) < 1e-6) mark = 1;
    else if (Math.abs(f - 2/3) < 1e-6) mark = 2;
    else if (f > 0) {
      const snaps=[0,1/3,2/3]; let best=0,bd=1;
      snaps.forEach((s,i)=>{const d=Math.abs(f-s); if(d<bd){bd=d; best=i;}});
      mark = best;
    }
    return `${w}${mark?'.'+mark:''}`;
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  // ── 리그 상수 ────────────────────────────────────────────────
  function leagueBatConstants(rows){
    let WNUM=0, WDEN=0;
    rows.forEach(p=>{
      const AB  = N(p.ab), H=N(p.hits), _2B=N(p.double), _3B=N(p.triple), HR=N(p.hr);
      const BB  = N(p.bb), IBB=N(p.ibb), HBP=N(p.hbp), SF=N(p.sf);
      const _1B = Math.max(0, H - _2B - _3B - HR);
      const uBB = Math.max(0, BB - IBB);
      WNUM += WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
      WDEN += (AB + BB - IBB + HBP + SF);
    });
    const lgwoba = WDEN>0 ? WNUM/WDEN : 0;
    return { lgwoba, wobaScale: WAR_CFG.WOBAScale, rpw: WAR_CFG.RunsPerWin };
  }
  function leaguePitchConstants(rows){
    let RUNS=0, OUTS=0;
    rows.forEach(p=>{
      const ip = deriveIP(p) || 0;
      RUNS += N(p.runs);
      OUTS += Math.round(ip * 3);
    });
    const IP  = OUTS/3;
    const ra7 = IP>0 ? RUNS * ERA_BASE / IP : 0;
    const repRA7 = ra7 * WAR_CFG.PitReplacementMult;
    return { ra7, repRA7, rpw: WAR_CFG.RunsPerWin };
  }

  // 개인 WAR
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
  function calcPitWAR(p, K){
    const ip = deriveIP(p) || 0;
    if (ip <= 0) return 0;
    const ra7 = N(p.runs) * ERA_BASE / ip;
    const rar = (K.repRA7 - ra7) * (ip / ERA_BASE);
    return rar / K.rpw;
  }

  // ── 로더들 ───────────────────────────────────────────────────
  const numericYearsFromSelect = () =>
    Array.from(yearSelect?.options || [])
      .map(o => o.value)
      .filter(v => /^\d{4}$/.test(v));

  function fetchBatYear(year){
    return fetch(`records_${year}.json`).then(r=>r.ok?r.json():Promise.reject(year)).then(normalizeRecords);
  }
  function fetchPitYear(year){
    return fetch(`pitching_${year}.json`).then(r=>r.ok?r.json():Promise.reject(year)).then(normalizeRecords).catch(()=>[]);
  }

  function aggregateBattingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      arr.forEach(r => {
        const key = pidKey(r); if (!key) return;
        const t = map.get(key) || {
          name:r.name, number:r.number ?? r.playerId ?? r.id,
          ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,RBI:0,RUN:0,sb:0
        };
        t.name   = t.name || r.name;
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;
        t.ab    += N(r.ab ?? r.AB ?? r.타수);
        t.hits  += N(r.hits ?? r.h ?? r.H ?? r.안타);
        t.double+= N(r.double ?? r['2B'] ?? r['2루타']);
        t.triple+= N(r.triple ?? r['3B'] ?? r['3루타']);
        t.hr    += N(r.hr ?? r['HR'] ?? r['홈런']);
        t.bb    += N(r.bb ?? r.BB ?? r['볼넷'] ?? r['4구']);
        t.ibb   += N(r.ibb ?? r.IBB ?? r['고의4구']);
        t.hbp   += N(r.hbp ?? r.HBP ?? r['사구']);
        t.sf    += N(r.sf ?? r.SF ?? r['희생플라이'] ?? r['희비']);
        t.sh    += N(r.sh ?? r.SH ?? r['희생번트'] ?? r['희번']);
        t.RBI   += N(r.RBI ?? r.rbi ?? r['타점']);
        t.RUN   += N(r.RUN ?? r.run ?? r.R ?? r['득점']);
        t.sb    += N(r.sb  ?? r.SB  ?? r['도루']);
        map.set(key, t);
      });
    });
    return applyDerivedBatAll(Array.from(map.values()));
  }

  function aggregatePitchingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      arr.forEach(r => {
        const key = pidKey(r); if (!key) return;
        const t = map.get(key) || {
          name:r.name, number:r.number ?? r.playerId ?? r.id,
          outs:0, er:0, runs:0, so:0, bb:0, hbp:0, games:0, wins:0, losses:0, holds:0, saves:0
        };
        t.name   = t.name || r.name;
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;

        const outs = N(r.outs ?? r.Outs ?? r.아웃);
        t.outs   += outs > 0 ? outs : Math.round(deriveIP(r) * 3);
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

  // ── UI: 탭 전환 ───────────────────────────────────────────────
  if (btnPlayers) {
    btnPlayers.style.display = '';
    btnPlayers.classList.add('active');
    btnPlayers.onclick = () => {
      btnPlayers.classList.add('active');
      if (btnRanking) btnRanking.classList.remove('active');
      playerList.style.display = '';
      rankingList.style.display = 'none';
      if (yearSelect) yearSelect.style.display = 'none';
    };
  }
  if (btnRanking) {
    btnRanking.style.display = '';
    btnRanking.onclick = () => {
      if (btnPlayers) btnPlayers.classList.remove('active');
      btnRanking.classList.add('active');
      playerList.style.display = 'none';
      rankingList.style.display = '';
      if (yearSelect) yearSelect.style.display = '';
      loadWarRanking(yearSelect ? yearSelect.value : null);
    };
  }
  if (yearSelect) {
    yearSelect.onchange = () => {
      if (btnRanking && btnRanking.classList.contains('active')) {
        loadWarRanking(yearSelect.value);
      }
    };
  }

  // ── 선수 목록 표시 ────────────────────────────────────────────
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject(new Error('players.json 로드 실패')))
    .then(players => {
      players.sort((a,b) => Number(a.id)-Number(b.id));
      playerList.innerHTML = '';
      players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `#${p.id} ${p.name}`;
        li.style.cursor = 'pointer';
        li.onclick = () => location.href = `player.html?id=${p.id}`;
        playerList.appendChild(li);
      });
    })
    .catch(err => {
      console.error(err);
      playerList.innerHTML = '<li>선수 목록 로드 실패</li>';
    });

  // ── WAR 랭킹 로드/렌더 ────────────────────────────────────────
  function loadWarRanking(year) {
    rankingList.innerHTML = '<div style="padding:8px 0;">WAR 랭킹 계산 중...</div>';

    const isCareer = (year === 'total' || year === 'career');

    if (isCareer) {
      const years = numericYearsFromSelect();
      if (!years.length) {
        rankingList.innerHTML = '<div>통산 집계에 사용할 연도가 없습니다.</div>';
        return;
      }
      const batJobs = years.map(y => fetchBatYear(y).catch(()=>[]));
      const pitJobs = years.map(y => fetchPitYear(y).catch(()=>[]));

      Promise.allSettled([Promise.allSettled(batJobs), Promise.allSettled(pitJobs)])
        .then(([batResAll, pitResAll]) => {
          const allBat = batResAll.value?.flatMap(r => r.status==='fulfilled' ? r.value : []) || [];
          const allPit = pitResAll.value?.flatMap(r => r.status==='fulfilled' ? r.value : []) || [];

          const batAgg = aggregateBattingAllPlayers([allBat]);
          const pitAgg = aggregatePitchingAllPlayers([allPit]);

          renderWarTop(batAgg, pitAgg, '통산');
        })
        .catch(() => {
          rankingList.innerHTML = '<div>통산 랭킹 집계 실패</div>';
        });
      return;
    }

    // 단일 연도
    Promise.all([
      fetchBatYear(year).catch(()=>[]),
      fetchPitYear(year).catch(()=>[])
    ]).then(([batRows, pitRows]) => {
      const b = applyDerivedBatAll(batRows);
      const p = applyDerivedPitchAll(pitRows);
      renderWarTop(b, p, `${year} 시즌`);
    }).catch(() => {
      rankingList.innerHTML = '<div>랭킹 로드 실패</div>';
    });
  }

  function renderWarTop(batRows, pitRows, label) {
    const Kb = leagueBatConstants(batRows || []);
    const Kp = leaguePitchConstants(pitRows || []);

    const byPid = new Map();
    const touch = (pid,name) => {
      if (!byPid.has(pid)) byPid.set(pid, { pid, name, batWAR:0, pWAR:0, total:0 });
      return byPid.get(pid);
    };

    (batRows||[]).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number,10) ?? r.id;
      if (!pid) return;
      const name = r.name || `#${pid}`;
      const w = calcBatWAR(r, Kb);
      const slot = touch(pid, name);
      slot.batWAR += w; slot.total += w;
    });

    (pitRows||[]).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number,10) ?? r.id;
      if (!pid) return;
      const name = r.name || `#${pid}`;
      const w = calcPitWAR(r, Kp);
      const slot = touch(pid, name);
      slot.pWAR += w; slot.total += w;
    });

    const rows = Array.from(byPid.values())
      .filter(x => isFinite(x.total))
      .sort((a,b) => b.total - a.total)
      .slice(0, 15);

    // 컴팩트 테이블(가로 스크롤 제거)
    const banner =
      `<div id="war-banner" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;margin:8px 0 12px 0; font-size:13px;">
         <div style="font-weight:700;margin-bottom:6px;">${label} WAR Top 15</div>
         <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
           <colgroup>
             <col style="width:42px;">   <!-- 순위 -->
             <col>                       <!-- 선수명: 남는 공간 전부 -->
             <col style="width:70px;">   <!-- Bat WAR -->
             <col style="width:70px;">   <!-- pWAR -->
             <col style="width:70px;">   <!-- WAR -->
           </colgroup>
           <thead>
             <tr>
               <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #eee; font-weight:600;">순위</th>
               <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #eee; font-weight:600;">선수</th>
               <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #eee; font-weight:600;">Bat</th>
               <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #eee; font-weight:600;">pWAR</th>
               <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #eee; font-weight:700;">WAR</th>
             </tr>
           </thead>
           <tbody>
             ${rows.map((r,idx)=>`
               <tr>
                 <td style="padding:4px 6px;">${idx+1}</td>
                 <td style="padding:4px 6px;">
                   <a href="player.html?id=${r.pid}" style="display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-decoration:none; color:#2563eb;">
                     #${r.pid} ${escapeHTML(r.name||'')}
                   </a>
                 </td>
                 <td style="padding:4px 6px; text-align:right;">${r.batWAR.toFixed(2)}</td>
                 <td style="padding:4px 6px; text-align:right;">${r.pWAR.toFixed(2)}</td>
                 <td style="padding:4px 6px; text-align:right; font-weight:700;">${r.total.toFixed(2)}</td>
               </tr>`).join('')}
           </tbody>
         </table>
       </div>`;

    rankingList.innerHTML = banner;
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // 초기 상태
  playerList.style.display  = '';
  rankingList.style.display = 'none';
  if (yearSelect) yearSelect.style.display = 'none';
});
