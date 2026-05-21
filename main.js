document.addEventListener('DOMContentLoaded', async () => {
  const recentBox = document.querySelector('#recent-match');
  initPlayerSearch();

  let allGames = [];
  try {
    // 캐시 방지
    const res = await fetch('schedule.json?t=' + Date.now());
    if (!res.ok) throw new Error('파일 없음');
    const data = await res.json();
    
    // 데이터 통합
    Object.keys(data).forEach(year => {
      if (Array.isArray(data[year])) {
        data[year].forEach(g => {
          const timeStr = g.time || '00:00';
          let gameDate;

          // ★ 핵심 수정: 날짜 형식 2가지 모두 지원
          if (g.date.includes('-') || g.date.includes('/')) {
            // Case 1: "2026-02-01" 또는 "2026/02/01" (연도 포함됨)
            // 하이픈(-)을 슬래시(/)로 바꿔서 호환성 확보
            const safeDate = g.date.replace(/-/g, '/'); 
            gameDate = new Date(`${safeDate} ${timeStr}`);
          } else {
            // Case 2: "02.01" (연도 없음, 점 찍음) -> 기존 방식
            const dateStr = g.date.replace(/\./g, '/');
            gameDate = new Date(`${year}/${dateStr} ${timeStr}`);
          }
          
          allGames.push({ ...g, _year: year, _dateObj: gameDate });
        });
      }
    });
  } catch (err) {
    console.error(err);
    if(recentBox) recentBox.innerHTML = '<p style="text-align:center;">데이터 로드 실패</p>';
    return;
  }

  // 최신순 정렬 (미래 -> 과거)
  allGames.sort((a, b) => b._dateObj - a._dateObj);
  renderSeasonDashboard(allGames);

  const finished = allGames.filter(g => g.result && g.result !== '예정');
  if (finished.length > 0 && recentBox) {
    renderRecentCard(recentBox, finished[0]);
  } else if (recentBox) {
    recentBox.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">완료된 경기 기록이 없습니다.</p>';
  }
});

async function initPlayerSearch() {
  const input = document.getElementById('playerSearch');
  const results = document.getElementById('playerSearchResults');
  if (!input || !results) return;

  let players = [];
  try {
    const res = await fetch('players.json?t=' + Date.now());
    players = await res.json();
  } catch (err) {
    results.innerHTML = '';
  }

  function hide() { results.style.display = 'none'; }
  function show(list) {
    if (!list.length) { hide(); return; }
    results.innerHTML = list.map(p =>
      `<a href="player.html?id=${encodeURIComponent(p.id)}">#${p.id} ${p.name}<span>${p.position || '-'}</span></a>`
    ).join('');
    results.style.display = 'block';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { hide(); return; }
    show(players.filter(p =>
      String(p.name || '').toLowerCase().includes(q) || String(p.id || '').includes(q)
    ).slice(0, 6));
  });
  input.addEventListener('blur', () => setTimeout(hide, 150));
}

async function renderSeasonDashboard(allGames) {
  const y = '2026';
  const seasonGames = allGames.filter(g => String(g._year) === y);
  const finished = seasonGames.filter(g => g.result && g.result !== '예정');
  const w = finished.filter(g => g.result === '승' || g.result === '몰수승').length;
  const l = finished.filter(g => g.result === '패').length;
  const t = finished.filter(g => g.result === '무').length;
  const recordEl = document.getElementById('dash-record');
  const last5El = document.getElementById('dash-last5');
  if (recordEl) recordEl.textContent = `${w}승 ${l}패${t ? ` ${t}무` : ''}`;
  if (last5El) {
    last5El.innerHTML = finished.slice(0, 5).map(g => `<span class="form-badge ${resultClass(g.result)}">${g.result[0]}</span>`).join('') || '-';
  }

  const opsEl = document.getElementById('dash-ops');
  const eraEl = document.getElementById('dash-era');
  if (opsEl) opsEl.textContent = '...';
  if (eraEl) eraEl.textContent = '...';

  try {
    const batRes = await fetch(`records_${y}.json?t=${Date.now()}`);
    if (!batRes.ok) throw new Error('batting file missing');
    const batRows = normalizeRecords(await batRes.json());
    const team = calcTeamBatting(batRows);
    if (opsEl) opsEl.textContent = team.ops > 0 ? team.ops.toFixed(3) : '-';
  } catch (err) {
    if (opsEl) opsEl.textContent = '-';
  }

  try {
    const pitRes = await fetch(`pitching_${y}.json?t=${Date.now()}`);
    if (!pitRes.ok) throw new Error('pitching file missing');
    const pitRows = normalizeRecords(await pitRes.json());
    const era = calcTeamERA(pitRows);
    if (eraEl) eraEl.textContent = era != null ? era.toFixed(2) : '-';
  } catch (err) {
    if (eraEl) eraEl.textContent = '-';
  }
}

function normalizeRecords(data) {
  if (Array.isArray(data)) return data;
  if (data?.players) return data.players;
  if (data?.batters) return data.batters;
  if (data?.pitchers) return data.pitchers;
  if (data?.records) return data.records;
  if (data?.data) return data.data;
  return [];
}

function N(v) { return v == null || isNaN(+v) ? 0 : +v; }
function div(n, d) { return d > 0 ? n / d : 0; }
function calcTeamBatting(rows) {
  let ab = 0, h = 0, d2 = 0, d3 = 0, hr = 0, bb = 0, hbp = 0, sf = 0;
  rows.forEach(r => {
    ab += N(r.ab); h += N(r.hits); d2 += N(r.double); d3 += N(r.triple); hr += N(r.hr);
    bb += N(r.bb); hbp += N(r.hbp); sf += N(r.sf);
  });
  const singles = Math.max(0, h - d2 - d3 - hr);
  const tb = singles + 2 * d2 + 3 * d3 + 4 * hr;
  const obp = div(h + bb + hbp, ab + bb + hbp + sf);
  const slg = div(tb, ab);
  return { ops: obp + slg };
}
function parseIP(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') {
    const f = Math.trunc(v), frac = v - f;
    if (Math.abs(frac - 0.1) < 1e-6) return f + 1/3;
    if (Math.abs(frac - 0.2) < 1e-6) return f + 2/3;
    if (Math.abs(frac - 0.33) < 0.02) return f + 1/3;
    if (Math.abs(frac - 0.66) < 0.02 || Math.abs(frac - 0.67) < 0.02) return f + 2/3;
    return v;
  }
  const m = String(v).trim().match(/^(\d+)\.(\d)$/);
  if (m) return +m[1] + (+m[2] === 1 ? 1/3 : (+m[2] === 2 ? 2/3 : 0));
  return parseFloat(v) || 0;
}
function calcTeamERA(rows) {
  let er = 0, ip = 0;
  rows.forEach(r => { er += N(r.er); ip += N(r.outs) > 0 ? N(r.outs) / 3 : parseIP(r.innings ?? r.ip); });
  return ip > 0 ? (er * 7 / ip) : null;
}

function resultClass(result) {
  if (result === '승' || result === '몰수승') return 'win';
  if (result === '패') return 'lose';
  return 'draw';
}

function renderRecentCard(container, game) {
  const resClass = game.result === '승' ? 'res-win' : (game.result === '패' ? 'res-lose' : 'res-draw');
  const detailed = game.detailed === true || game.detailed === 'true' || game.detailed === 1;
  const detailId = game.detailId || game.id || '';
  container.innerHTML = `
    <div class="match-widget">
      <div class="match-header">
        <span class="match-result-badge ${resClass}">${game.result}</span>
        <span class="match-tag">${game.date}</span>
      </div>
      <div class="match-body">
        <div class="team-box"><span class="name">TAURUS</span></div>
        <div class="score-box">${game.score || '0:0'}</div>
        <div class="team-box"><span class="name">${game.opponent}</span></div>
      </div>
      <div class="match-footer">
        <span>📍 ${game.location || '-'}</span><br>
        ${detailed && detailId ? `<a href="detail.html?detailId=${encodeURIComponent(detailId)}" class="detail-link-btn">상세 기록 보기 →</a>` : ''}
      </div>
    </div>`;
}
