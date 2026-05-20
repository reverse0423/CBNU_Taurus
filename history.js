document.addEventListener('DOMContentLoaded', initHistory);

const YEARS = ['2022', '2023', '2024', '2025', '2026'];

function N(v) { return v == null || isNaN(+v) ? 0 : +v; }
function normalizeRecords(data) {
  if (Array.isArray(data)) return data;
  if (data?.players) return data.players;
  if (data?.batters) return data.batters;
  if (data?.records) return data.records;
  if (data?.data) return data.data;
  return [];
}
function div(n, d) { return d > 0 ? n / d : 0; }
function r3(x) { return Math.round(x * 1000) / 1000; }
const ERA_BASE = 7;
const WAR_CFG = { WOBAScale: 1.15, RunsPerWin: 7.5, BatReplacementPerPA: 0.033, PitReplacementMult: 1.20 };
const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
function resultBucket(result) {
  if (result === '승' || result === '몰수승') return 'w';
  if (result === '패') return 'l';
  if (result === '무') return 't';
  return '';
}
function pct(w, l) { return w + l > 0 ? (w / (w + l)).toFixed(3) : '-'; }
function cleanOpponent(name) {
  return String(name || '상대 미정')
    .replace(/\s+/g, ' ')
    .replace(/대학교/g, '대')
    .trim();
}

async function initHistory() {
  const schedule = await fetch('schedule.json?t=' + Date.now()).then(r => r.json());
  renderYearHistory(schedule);
  renderOpponentHistory(schedule);
  renderCareerLeaders();
}

function renderYearHistory(schedule) {
  const box = document.getElementById('year-history');
  const total = { w: 0, l: 0, t: 0 };
  const years = Object.keys(schedule).sort((a, b) => b - a);

  box.innerHTML = years.map(year => {
    const row = { w: 0, l: 0, t: 0 };
    (schedule[year] || []).forEach(g => {
      const key = resultBucket(g.result);
      if (key) { row[key]++; total[key]++; }
    });
    return `
      <article class="history-card">
        <span>${year}</span>
        <strong>${row.w}승 ${row.l}패${row.t ? ` ${row.t}무` : ''}</strong>
        <em>승률 ${pct(row.w, row.l)}</em>
      </article>`;
  }).join('');

  const totalEl = document.getElementById('history-total');
  if (totalEl) totalEl.textContent = `${total.w}승 ${total.l}패${total.t ? ` ${total.t}무` : ''}`;
}

function renderOpponentHistory(schedule) {
  const map = new Map();
  Object.values(schedule).forEach(games => {
    (games || []).forEach(g => {
      const key = resultBucket(g.result);
      if (!key) return;
      const opponent = cleanOpponent(g.opponent);
      const row = map.get(opponent) || { opponent, w: 0, l: 0, t: 0, games: 0, last: '' };
      row[key]++; row.games++; row.last = g.date || row.last;
      map.set(opponent, row);
    });
  });

  const rows = Array.from(map.values()).sort((a, b) => b.games - a.games || b.w - a.w).slice(0, 30);
  document.getElementById('opponent-history').innerHTML = `
    <div class="desktop-table">
      <table class="records-table">
        <thead><tr><th>상대팀</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${escapeHTML(r.opponent)}</td><td>${r.games}</td><td>${r.w}</td><td>${r.l}</td><td>${r.t}</td><td>${pct(r.w, r.l)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="opponent-card-list">
      ${rows.map(r => `
        <article class="opponent-card">
          <div>
            <strong>${escapeHTML(r.opponent)}</strong>
            <span>${r.games}경기 · 승률 ${pct(r.w, r.l)}</span>
          </div>
          <div class="opponent-record">
            <b>${r.w}</b><span>승</span>
            <b>${r.l}</b><span>패</span>
            ${r.t ? `<b>${r.t}</b><span>무</span>` : ''}
          </div>
        </article>`).join('')}
    </div>`;
}

async function renderCareerLeaders() {
  const arrays = await Promise.all(YEARS.map(y =>
    fetch(`records_${y}.json?t=${Date.now()}`).then(r => r.ok ? r.json() : []).then(normalizeRecords).catch(() => [])
  ));
  const pitArrays = await Promise.all(YEARS.map(y =>
    fetch(`pitching_${y}.json?t=${Date.now()}`).then(r => r.ok ? r.json() : []).then(normalizeRecords).catch(() => [])
  ));
  const map = new Map();
  arrays.flat().forEach(r => {
    const key = String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();
    if (!key) return;
    const row = map.get(key) || { name: r.name || `#${key}`, ab:0, hits: 0, double:0, triple:0, hr: 0, bb:0, ibb:0, hbp:0, sf:0, pa:0, rbi: 0, sb: 0 };
    row.ab += N(r.ab); row.hits += N(r.hits); row.double += N(r.double); row.triple += N(r.triple); row.hr += N(r.hr);
    row.bb += N(r.bb); row.ibb += N(r.ibb); row.hbp += N(r.hbp); row.sf += N(r.sf); row.pa += N(r.pa);
    row.rbi += N(r.RBI ?? r.rbi); row.sb += N(r.sb);
    map.set(key, row);
  });
  const rows = Array.from(map.values()).map(applyBatDerived);
  const Kb = leagueBatConstants(rows);
  rows.forEach(r => { r.war = calcBatWAR(r, Kb); });

  const pitRows = aggregatePitching(pitArrays).map(applyPitchDerived);
  const Kp = leaguePitchConstants(pitRows);
  pitRows.forEach(r => { r.pwar = calcPitWAR(r, Kp); });

  document.getElementById('career-leaders').innerHTML = [
    leaderTable('안타', rows, 'hits'),
    leaderTable('홈런', rows, 'hr'),
    leaderTable('타점', rows, 'rbi'),
    leaderTable('도루', rows, 'sb'),
    leaderTable('OPS', rows.filter(r => r.pa >= 40), 'ops', 3),
    leaderTable('WAR', rows, 'war', 2),
    leaderTable('ERA', pitRows.filter(r => r._ipVal >= 10), 'era', 2, true),
    leaderTable('탈삼진', pitRows, 'k'),
    leaderTable('pWAR', pitRows, 'pwar', 2)
  ].join('');
}

function leaderTable(title, rows, key, digits, asc) {
  const top = rows.slice().sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key]).slice(0, 10);
  return `
    <article class="leader-card">
      <h3>${title}</h3>
      ${top.map((r, i) => `<div><span>${i + 1}. ${escapeHTML(r.name)}</span><strong>${formatValue(r[key], digits)}</strong></div>`).join('')}
    </article>`;
}

function formatValue(v, digits) {
  return digits == null ? N(v).toString() : Number(v || 0).toFixed(digits);
}

function applyBatDerived(p) {
  const ab=N(p.ab), h=N(p.hits), d2=N(p.double), d3=N(p.triple), hr=N(p.hr), bb=N(p.bb), ibb=N(p.ibb), hbp=N(p.hbp), sf=N(p.sf);
  const singles = Math.max(0, h - d2 - d3 - hr);
  const tb = singles + 2*d2 + 3*d3 + 4*hr;
  p.pa = N(p.pa) || (ab + bb + hbp + sf);
  p.avg = r3(div(h, ab));
  p.obp = r3(div(h + bb + hbp, ab + bb + hbp + sf));
  p.slg = r3(div(tb, ab));
  p.ops = r3(p.obp + p.slg);
  const ubb = Math.max(0, bb - ibb);
  p.woba = r3(div(WOBA.uBB*ubb + WOBA.HBP*hbp + WOBA['1B']*singles + WOBA['2B']*d2 + WOBA['3B']*d3 + WOBA.HR*hr, ab + bb - ibb + hbp + sf));
  return p;
}

function leagueBatConstants(rows) {
  let num = 0, den = 0;
  rows.forEach(p => {
    const ab=N(p.ab), h=N(p.hits), d2=N(p.double), d3=N(p.triple), hr=N(p.hr), bb=N(p.bb), ibb=N(p.ibb), hbp=N(p.hbp), sf=N(p.sf);
    const singles = Math.max(0, h - d2 - d3 - hr), ubb = Math.max(0, bb - ibb);
    num += WOBA.uBB*ubb + WOBA.HBP*hbp + WOBA['1B']*singles + WOBA['2B']*d2 + WOBA['3B']*d3 + WOBA.HR*hr;
    den += ab + bb - ibb + hbp + sf;
  });
  return { lgwoba: den > 0 ? num / den : 0, wobaScale: WAR_CFG.WOBAScale, rpw: WAR_CFG.RunsPerWin };
}
function calcBatWAR(p, K) {
  const pa = N(p.pa);
  if (pa <= 0) return 0;
  return ((((N(p.woba) - K.lgwoba) / K.wobaScale) * pa) + 0.2*N(p.sb) + WAR_CFG.BatReplacementPerPA*pa) / K.rpw;
}

function parseIP(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') {
    const f = Math.trunc(v), frac = v - f;
    if (Math.abs(frac - 0.1) < 1e-6) return f + 1/3;
    if (Math.abs(frac - 0.2) < 1e-6) return f + 2/3;
    return v;
  }
  const m = String(v).trim().match(/^(\d+)\.(\d)$/);
  if (m) return +m[1] + (+m[2] === 1 ? 1/3 : (+m[2] === 2 ? 2/3 : 0));
  return parseFloat(v) || 0;
}
function aggregatePitching(arrays) {
  const map = new Map();
  arrays.flat().forEach(r => {
    const key = String(r.playerId ?? r.number ?? r.id ?? r.name ?? '').trim();
    if (!key) return;
    const row = map.get(key) || { name: r.name || `#${key}`, outs:0, er:0, runs:0, bb:0, hbp:0, hr:0, k:0 };
    row.outs += N(r.outs) || Math.round(parseIP(r.innings ?? r.ip) * 3);
    row.er += N(r.er); row.runs += N(r.runs); row.bb += N(r.bb); row.hbp += N(r.hbp); row.hr += N(r.hr); row.k += N(r.k ?? r.so ?? r.SO);
    map.set(key, row);
  });
  return Array.from(map.values());
}
function applyPitchDerived(p) {
  p._ipVal = N(p.outs) / 3;
  p.era = p._ipVal > 0 ? (N(p.er) * ERA_BASE / p._ipVal) : 0;
  return p;
}
function leaguePitchConstants(rows) {
  let er=0, ip=0, hr=0, bb=0, hbp=0, k=0;
  rows.forEach(p => { ip += N(p._ipVal); er += N(p.er); hr += N(p.hr); bb += N(p.bb); hbp += N(p.hbp); k += N(p.k); });
  const lgERA = ip > 0 ? er * ERA_BASE / ip : 0;
  const raw = ip > 0 ? (13*hr + 3*(bb+hbp) - 2*k) / ip : 0;
  return { cFIP: lgERA - raw, repRA7: lgERA * WAR_CFG.PitReplacementMult, rpw: WAR_CFG.RunsPerWin };
}
function calcPitWAR(p, K) {
  const ip = N(p._ipVal);
  if (ip <= 0) return 0;
  const fip = ((13*N(p.hr) + 3*(N(p.bb)+N(p.hbp)) - 2*N(p.k)) / ip) + K.cFIP;
  return ((K.repRA7 - fip) * (ip / ERA_BASE)) / K.rpw;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
