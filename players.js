// players.js
// 연도별 + 통산(자동 집계) 배팅 기여도 랭킹 계산

document.addEventListener('DOMContentLoaded', () => {
  const btnPlayers  = document.getElementById('btn-players');
  const btnRanking  = document.getElementById('btn-ranking');
  const playerList  = document.getElementById('playerList');
  const rankingList = document.getElementById('rankingList');
  const yearSelect  = document.getElementById('year-select-ranking');

  if (!btnPlayers || !btnRanking || !playerList || !rankingList || !yearSelect) {
    console.error('필요한 요소를 찾을 수 없습니다.');
    return;
  }

  // ── 유틸 ─────────────────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);

  // wOBA 가중치(기본값)
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // 다양한 JSON 형태 보정
  function normalizeRecords(data){
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.players)) return data.players;
    if (data && Array.isArray(data.batters)) return data.batters;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.data))    return data.data;
    return [];
  }

  // 파생지표 계산 (AVG/OBP/SLG/OPS/wOBA/PA/ISO)
  function deriveBatting(p){
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

    return {
      pa: PA,
      tb: TB,
      avg: AVG,
      obp: OBP,
      slg: SLG,
      ops: OPS,
      woba: wOBA,
      iso: SLG - AVG
    };
  }

  // 플레이어 키(선수 식별): playerId > number > id > name
  const pidKey = r => String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();

  // 드롭다운에서 숫자 연도만 추출 (예: 2023, 2024, 2025)
  const numericYearsFromSelect = () =>
    Array.from(yearSelect?.options || [])
      .map(o => o.value)
      .filter(v => /^\d{4}$/.test(v));

  // 파일 로더
  function fetchYearFile(year){
    const file = `records_${year}.json`;
    return fetch(file).then(r => r.ok ? r.json() : Promise.reject(file)).then(normalizeRecords);
  }

  // 연도별 배열들 → 선수별 합산(카운팅 스탯) → 파생지표 재계산
  function aggregateBatting(allArrays){
    const map = new Map();
    allArrays.forEach(arr => {
      arr.forEach(r => {
        const key = pidKey(r);
        if (!key) return;
        const t = map.get(key) || {
          name: r.name,
          number: r.number ?? r.playerId ?? r.id,
          // 카운팅 스탯
          ab:0, hits:0, double:0, triple:0, hr:0,
          bb:0, ibb:0, hbp:0, sf:0, sh:0,
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
        t.sf    += N(r.sf ?? r.SF ?? r['희생플라이'] ?? r['희비']);
        t.sh    += N(r.sh ?? r.SH ?? r['희생번트'] ?? r['희번']);
        t.RBI   += N(r.RBI ?? r.rbi ?? r['타점']);
        t.RUN   += N(r.RUN ?? r.run ?? r.R ?? r['득점']);
        t.sb    += N(r.sb  ?? r.SB  ?? r['도루']);

        map.set(key, t);
      });
    });

    // 파생지표 재계산 병합
    return Array.from(map.values()).map(rec => ({ ...rec, ...deriveBatting(rec) }));
  }

  // ── 뷰 전환 ───────────────────────────────────────────────────
  btnPlayers.addEventListener('click', () => {
    btnPlayers.classList.add('active');
    btnRanking.classList.remove('active');
    yearSelect.style.display = 'none';
    playerList.style.display = '';
    rankingList.style.display = 'none';
  });

  btnRanking.addEventListener('click', () => {
    btnRanking.classList.add('active');
    btnPlayers.classList.remove('active');
    yearSelect.style.display = '';
    playerList.style.display = 'none';
    rankingList.style.display = '';
    loadRanking(yearSelect.value);
  });

  yearSelect.addEventListener('change', () => {
    if (btnRanking.classList.contains('active')) {
      loadRanking(yearSelect.value);
    }
  });

  // 선수 목록
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(players => {
      players.sort((a,b) => Number(a.id)-Number(b.id));
      players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `#${p.id} ${p.name}`;
        li.onclick = () => location.href = `player.html?id=${p.id}`;
        playerList.appendChild(li);
      });
    })
    .catch(() => {
      playerList.innerHTML = '<li>선수 목록 로드 실패</li>';
    });

  // ── 기여도 공식(사용자 정의 유지) ─────────────────────────────
  function calcBat(r) {
    const avg  = parseFloat(r.avg)||0;
    const woba = parseFloat(r.woba)||0;
    const slg  = parseFloat(r.slg)||0;
    const ops  = parseFloat(r.ops)||0;
    const hr   = parseInt(r.hr)||0;
    const sb   = parseInt(r.sb)||0;
    const RBI  = parseInt(r.RBI)||0;
    return 30*ops + 25*woba + 20*slg + 15*avg + 5*hr + 2*sb + 3*RBI;
  }

  // ── 랭킹 로드 (배팅) ──────────────────────────────────────────
  function loadRanking(year) {
    rankingList.innerHTML = '';

    const isCareer = (year === 'total' || year === 'career');

    if (isCareer) {
      // 통산: 드롭다운의 숫자 연도들을 모두 합산
      const years = numericYearsFromSelect();
      if (!years.length) {
        rankingList.innerHTML = '<li>통산 집계에 사용할 연도가 없습니다.</li>';
        return;
      }

      const jobs = years.map(y =>
        fetchYearFile(y).then(arr => arr).catch(() => [])
      );

      Promise.allSettled(jobs)
        .then(results => {
          const all = results.flatMap(r => r.status === 'fulfilled' ? normalizeRecords(r.value) : []);
          const aggregated = aggregateBatting([all]);

          const ranks = aggregated
            .map(rec => {
              const pid  = rec.playerId ?? parseInt(rec.number,10);
              const name = rec.name;
              const contrib = calcBat(rec);
              return { pid, name, contrib };
            })
            .filter(x => x.name && x.contrib > 0)
            .sort((a,b) => b.contrib - a.contrib)
            .slice(0, 10);

          if (!ranks.length) {
            rankingList.innerHTML = '<li>통산 기여도 데이터가 없습니다.</li>';
            return;
          }

          ranks.forEach((p, idx) => {
            const li = document.createElement('li');
            li.textContent = `${idx+1}. #${p.pid} ${p.name} — ${p.contrib.toFixed(2)}`;
            li.onclick = () => location.href = `player.html?id=${p.pid}`;
            rankingList.appendChild(li);
          });
        })
        .catch(() => {
          rankingList.innerHTML = '<li>통산 랭킹 로드 실패</li>';
        });

      return;
    }

    // 단일 연도
    const file = `records_${year}.json`;

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const raw = normalizeRecords(data);

        const ranks = raw
          .map(rec => {
            // 원시값에서 파생계산 → 병합 후 기여도
            const derived = deriveBatting(rec);
            const merged  = { ...rec, ...derived };

            const pid  = merged.playerId ?? parseInt(merged.number,10);
            const name = merged.name;
            const contrib = calcBat(merged);
            return { pid, name, contrib };
          })
          .filter(x => x.name && x.contrib > 0)
          .sort((a,b) => b.contrib - a.contrib)
          .slice(0, 10);

        if (!ranks.length) {
          rankingList.innerHTML = '<li>랭킹 데이터가 없습니다.</li>';
          return;
        }

        ranks.forEach((p, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx+1}. #${p.pid} ${p.name} — ${p.contrib.toFixed(2)}`;
          li.onclick = () => location.href = `player.html?id=${p.pid}`;
          rankingList.appendChild(li);
        });
      })
      .catch(() => {
        rankingList.innerHTML = '<li>랭킹 로드 실패</li>';
      });
  }

  // 초기
  playerList.style.display   = '';
  rankingList.style.display  = 'none';
  yearSelect.style.display   = 'none';
});