// players.js — FINAL (WAR Logic Unified with player.js/records.js)

document.addEventListener('DOMContentLoaded', () => {
  const btnPlayers = document.getElementById('btn-players');
  const btnRanking = document.getElementById('btn-ranking');
  const playerList = document.getElementById('playerList');
  const rankingList = document.getElementById('rankingList');
  const yearSelect = document.getElementById('year-select-ranking');

  if (!playerList || !rankingList) { console.error('필수 요소가 없습니다.'); return; }

  // ── 유틸 ─────────────────────────────────────────────────────
  const N = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3 = x => Math.round(x * 1000) / 1000;
  
  // ★ player.js와 동일한 상수
  const ERA_BASE = 7;
  const WAR_CFG = { WOBAScale: 1.15, RunsPerWin: 7.5, BatReplacementPerPA: 0.033, PitReplacementMult: 1.20 };
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  function normalizeRecords(data) {
    if (Array.isArray(data)) return data;
    if (data?.players) return data.players;
    if (data?.batters) return data.batters;
    if (data?.pitchers) return data.pitchers;
    if (data?.records) return data.records;
    if (data?.data) return data.data;
    return [];
  }
  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  // ── 파생 스탯 계산 (player.js와 통일) ──────────────────────────
  function applyDerivedBat(p) {
    const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),SH=N(p.sh),CI=N(p.ci),PAi=N(p.pa),PA=PAi>0?PAi:(AB+BB+HBP+SF+SH+CI),_1B=Math.max(0,H-_2B-_3B-HR),TB=_1B+2*_2B+3*_3B+4*HR,AVG=div(H,AB),OBP=div(H+BB+HBP,AB+BB+HBP+SF),SLG=div(TB,AB),OPS=OBP+SLG,uBB=Math.max(0,BB-IBB),wDen=(AB+BB-IBB+HBP+SF),wNum=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR,wOBA=div(wNum,wDen);
    p.k = N(p.k ?? p.so ?? p.SO); // 삼진 처리
    p.pa=PA;p.tb=TB;p.avg=r3(AVG);p.obp=r3(OBP);p.slg=r3(SLG);p.ops=r3(OPS);p.woba=r3(wOBA);p.iso=r3(SLG-AVG); return p;
  }
  const applyDerivedBatAll = arr => arr.map(applyDerivedBat);

  function normalizeFractionStr(str=''){ return String(str).replace(/\u2153/g,' 1/3').replace(/\u2154/g,' 2/3').replace(/\u00BC/g,' 1/4').replace(/\u00BD/g,' 1/2').replace(/\u00BE/g,' 3/4'); }
  function parseIPValue(v){ if(v==null||v==='') return 0; if(typeof v==='number'){const f=Math.trunc(v),frac=v-f;if(Math.abs(frac-0.1)<1e-6) return f+1/3;if(Math.abs(frac-0.2)<1e-6) return f+2/3; return v;} const s=normalizeFractionStr(String(v)).trim(); const m=s.match(/^(\d+)(?:\s+(\d)\/(\d))?$/); if(m){const whole=+m[1],num=m[2]?+m[2]:0,den=m[3]?+m[3]:1; return whole+(den?num/den:0);} const m2=s.match(/^(\d+)\.(\d)$/); if(m2){const whole=+m2[1],dec=+m2[2]; if(dec===1) return whole+1/3; if(dec===2) return whole+2/3; return +s;} const n=parseFloat(s); return isNaN(n)?0:n; }
  function deriveIP(p){ const outs=N(p.outs??p.Outs??p.아웃); if(outs>0) return outs/3; const raw=p.innings??p.ip??p.IP??p.이닝; return parseIPValue(raw); }
  
  function applyDerivedPitch(p) {
    const ER=N(p.er),ip=deriveIP(p),ERA=div(ER*ERA_BASE,ip); 
    p._ipVal=ip; 
    p.k = N(p.k ?? p.so ?? p.SO); // 삼진 처리
    p.era=r3(ERA); 
    return p;
  }
  const applyDerivedPitchAll = arr => arr.map(applyDerivedPitch);

  // ── ★ WAR 계산 (player.js와 완벽 통일 - FIP 기준) ────────────────
  function leagueBatConstants(rows){ let WNUM=0,WDEN=0; rows.forEach(p=>{ const AB=N(p.ab),H=N(p.hits),_2B=N(p.double),_3B=N(p.triple),HR=N(p.hr),BB=N(p.bb),IBB=N(p.ibb),HBP=N(p.hbp),SF=N(p.sf),_1B=Math.max(0,H-_2B-_3B-HR),uBB=Math.max(0,BB-IBB); WNUM+=WOBA.uBB*uBB+WOBA.HBP*HBP+WOBA['1B']*_1B+WOBA['2B']*_2B+WOBA['3B']*_3B+WOBA.HR*HR; WDEN+=(AB+BB-IBB+HBP+SF); }); const lgwoba=WDEN>0?WNUM/WDEN:0; return {lgwoba,wobaScale:WAR_CFG.WOBAScale,rpw:WAR_CFG.RunsPerWin}; }
  function calcBatWAR(p, K){ const PA=N(p.pa); if(PA<=0) return 0; const woba=N(p.woba),wraa=((woba-K.lgwoba)/K.wobaScale)*PA,bsR=0.2*N(p.sb),repl=WAR_CFG.BatReplacementPerPA*PA,runs=wraa+bsR+repl; return runs/K.rpw; }

  // 투수 상수 (FIP cFIP 계산)
  function leaguePitchConstants(rows){ 
    let SUM_ER=0, SUM_IP=0, SUM_HR=0, SUM_BB=0, SUM_HBP=0, SUM_K=0; 
    rows.forEach(p=>{ 
        const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; 
        SUM_IP+=ip; SUM_ER+=N(p.er); SUM_HR+=N(p.hr); SUM_BB+=N(p.bb); SUM_HBP+=N(p.hbp); SUM_K+=N(p.k); 
    }); 
    const lgERA = SUM_IP>0 ? (SUM_ER * ERA_BASE / SUM_IP) : 0;
    const lgFIP_Raw = SUM_IP>0 ? ((13*SUM_HR + 3*(SUM_BB+SUM_HBP) - 2*SUM_K) / SUM_IP) : 0;
    const cFIP = lgERA - lgFIP_Raw; 
    const repRA7 = lgERA * WAR_CFG.PitReplacementMult; 
    return { cFIP, repRA7, rpw: WAR_CFG.RunsPerWin }; 
  }

  // 투수 WAR (FIP 기반)
  function calcPitWAR(p, K){ 
    const ip=(p._ipVal!=null?p._ipVal:deriveIP(p))||0; if(ip<=0) return 0; 
    const fipRaw = (13*N(p.hr) + 3*(N(p.bb)+N(p.hbp)) - 2*N(p.k)) / ip;
    const fip = fipRaw + K.cFIP;
    const rar = (K.repRA7 - fip) * (ip / ERA_BASE); 
    return rar / K.rpw; 
  }

  // ── 로더들 ───────────────────────────────────────────────────
  const numericYearsFromSelect = () => Array.from(yearSelect?.options || []).map(o => o.value).filter(v => /^\d{4}$/.test(v));
  
  // fetchYearFile에서 에러 발생 시 빈 배열 반환 (멈춤 방지)
  function fetchBatYear(year){ return fetch(`records_${year}.json`).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }).then(normalizeRecords).catch(e=>{ console.warn(`Bat ${year} fail:`,e); return []; }); }
  function fetchPitYear(year){ return fetch(`pitching_${year}.json`).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }).then(normalizeRecords).catch(e=>{ console.warn(`Pit ${year} fail:`,e); return []; }); }

  // 통산 집계 함수 (k 합산 포함)
  function aggregateBattingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(r => {
        const key = pidKey(r); if (!key) return;
        let cn=map.has(key)?map.get(key).name:null; if(!cn && r.name) cn=r.name;
        let cnum=map.has(key)?map.get(key).number:null; if(cnum==null && (r.number??r.playerId??r.id)!=null) cnum=r.number??r.playerId??r.id;
        const t = map.get(key) || { ab:0,hits:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sf:0,sh:0,ci:0,RBI:0,RUN:0,sb:0, k:0 };
        t.name=cn; t.number=cnum;
        t.ab+=N(r.ab); t.hits+=N(r.hits); t.double+=N(r.double); t.triple+=N(r.triple); t.hr+=N(r.hr);
        t.bb+=N(r.bb); t.ibb+=N(r.ibb); t.hbp+=N(r.hbp); t.sf+=N(r.sf); t.sh+=N(r.sh); t.ci+=N(r.ci);
        t.RBI+=N(r.RBI??r.rbi); t.RUN+=N(r.RUN??r.run??r.R); t.sb+=N(r.sb); t.k+=N(r.k??r.so??r.SO);
        map.set(key, t);
      });
    });
    return applyDerivedBatAll(Array.from(map.values()));
  }

  function aggregatePitchingAllPlayers(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(r => {
        const key = pidKey(r); if (!key) return;
        const t = map.get(key) || { name:r.name, number:r.number??r.playerId??r.id, outs:0, er:0, runs:0, so:0, bb:0, hbp:0, hr:0, games:0, wins:0, losses:0, holds:0, saves:0, k:0 };
        t.name = t.name || r.name; 
        t.number = t.number ?? r.number ?? r.playerId ?? r.id;
        const outs=N(r.outs); let addOuts=0; if(outs>0) addOuts=outs; else addOuts=Math.round(deriveIP(r)*3);
        t.outs+=addOuts; t.er+=N(r.er); t.runs+=N(r.runs); 
        t.so+=N(r.so); t.k+=N(r.k??r.so??r.SO); // 삼진 합산
        t.bb+=N(r.bb); t.hbp+=N(r.hbp); t.hr+=N(r.hr);
        t.games+=N(r.games); t.wins+=N(r.wins); t.losses+=N(r.losses); t.holds+=N(r.holds); t.saves+=N(r.saves);
        map.set(key, t);
      });
    });
    const rows = Array.from(map.values());
    rows.forEach(p => { p.outs = Math.max(0, Math.round(p.outs)); });
    return applyDerivedPitchAll(rows);
  }

  // ── UI: 탭 전환 ───────────────────────────────────────────────
  if (btnPlayers) {
    btnPlayers.style.display = ''; btnPlayers.classList.add('active');
    btnPlayers.onclick = () => {
      btnPlayers.classList.add('active');
      if (btnRanking) btnRanking.classList.remove('active');
      playerList.style.display = ''; rankingList.style.display = 'none';
      if (yearSelect) yearSelect.style.display = 'none';
    };
  }
  if (btnRanking) {
    btnRanking.style.display = '';
    btnRanking.onclick = () => {
      if (btnPlayers) btnPlayers.classList.remove('active');
      btnRanking.classList.add('active');
      playerList.style.display = 'none'; rankingList.style.display = '';
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
    rankingList.innerHTML = '<div style="padding:16px; text-align:center;">WAR 랭킹 계산 중...</div>';
    const isCareer = (year === 'total' || year === 'career');

    let batPromise, pitPromise;

    if (isCareer) {
      const years = numericYearsFromSelect();
      if (!years.length) { rankingList.innerHTML = '<div>통산 집계에 사용할 연도가 없습니다.</div>'; return; }
      
      batPromise = Promise.all(years.map(y => fetchBatYear(y))).then(aggregateBattingAllPlayers);
      pitPromise = Promise.all(years.map(y => fetchPitYear(y))).then(aggregatePitchingAllPlayers);
    } else {
      batPromise = fetchBatYear(year).then(applyDerivedBatAll);
      pitPromise = fetchPitYear(year).then(applyDerivedPitchAll);
    }

    Promise.all([batPromise, pitPromise])
      .then(([batRows, pitRows]) => {
          renderWarTop(batRows, pitRows, isCareer ? '통산' : `${year} 시즌`);
      })
      .catch((err) => {
          console.error(err);
          rankingList.innerHTML = '<div>랭킹 로드 실패</div>';
      });
  }

  function ensureWarStyle() { /* 스타일은 style.css에서 관리 */ }

  function renderWarTop(batRows, pitRows, label) {
    ensureWarStyle();

    const Kb = leagueBatConstants(batRows || []);
    const Kp = leaguePitchConstants(pitRows || []);

    const byPid = new Map();
    const touch = (pid, name) => {
      if (!byPid.has(pid)) byPid.set(pid, { pid, name, batWAR: 0, pWAR: 0, total: 0 });
      return byPid.get(pid);
    };

    (batRows || []).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number, 10) ?? r.id; if (!pid) return;
      const name = r.name || `#${pid}`;
      const w = calcBatWAR(r, Kb);
      const slot = touch(pid, name);
      slot.batWAR += w; slot.total += w;
    });

    (pitRows || []).forEach(r => {
      const pid = r.playerId ?? parseInt(r.number, 10) ?? r.id; if (!pid) return;
      const name = r.name || `#${pid}`;
      const w = calcPitWAR(r, Kp);
      const slot = touch(pid, name);
      slot.pWAR += w; slot.total += w;
    });

    const rows = Array.from(byPid.values())
      .filter(x => isFinite(x.total))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const banner =
      `<div id="war-banner">
         <div style="font-weight:700;margin-bottom:6px;">${label} WAR Top 10</div>
         <table>
           <colgroup> <col class="rank"> <col class="name"> <col class="num"> <col class="num"> <col class="num"> </colgroup>
           <thead>
             <tr>
               <th>순위</th> <th>선수</th> <th class="val">Bat</th> <th class="val">pWAR</th> <th class="total-val">WAR</th>
             </tr>
           </thead>
           <tbody>
             ${rows.map((r, idx) => `
               <tr>
                 <td>${idx + 1}</td>
                 <td><a class="name-link" href="player.html?id=${r.pid}">#${r.pid} ${escapeHTML(r.name || '')}</a></td>
                 <td class="val">${r.batWAR.toFixed(2)}</td>
                 <td class="val">${r.pWAR.toFixed(2)}</td>
                 <td class="total-val">${r.total.toFixed(2)}</td>
               </tr>`).join('')}
           </tbody>
         </table>
       </div>`;
    rankingList.innerHTML = banner;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // 초기 상태
  playerList.style.display = '';
  rankingList.style.display = 'none';
  if (yearSelect) yearSelect.style.display = 'none';
});