document.addEventListener('DOMContentLoaded', runChecks);

const CHECK_YEARS = ['2022', '2023', '2024', '2025', '2026'];

function N(v) { return v == null || isNaN(+v) ? 0 : +v; }
function normalizeRecords(data) {
  if (Array.isArray(data)) return data;
  if (data?.players) return data.players;
  if (data?.batters) return data.batters;
  if (data?.pitchers) return data.pitchers;
  if (data?.records) return data.records;
  if (data?.data) return data.data;
  return [];
}
async function getJSON(file, issues) {
  try {
    const res = await fetch(`${file}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    issues.push({ level: 'bad', title: `${file} 로드 실패`, body: err.message });
    return null;
  }
}

async function runChecks() {
  const issues = [];
  const schedule = await getJSON('schedule.json', issues);
  const detail = await getJSON('detail.json', issues);
  const players = await getJSON('players.json', issues);
  const playerIds = new Set((players || []).map(p => String(p.id)));

  if (schedule && detail) checkDetails(schedule, detail, issues);
  if (players) checkPlayers(players, issues);

  for (const year of CHECK_YEARS) {
    const bat = normalizeRecords(await getJSON(`records_${year}.json`, issues));
    const pit = normalizeRecords(await getJSON(`pitching_${year}.json`, issues));
    checkBatting(year, bat, playerIds, issues);
    checkPitching(year, pit, playerIds, issues);
  }

  renderIssues(issues);
}

function checkDetails(schedule, detail, issues) {
  const detailIds = new Set(Object.keys(detail || {}));
  Object.values(detail || {}).forEach(v => {
    if (v && typeof v === 'object') Object.keys(v).forEach(k => {
      if (v[k]?.teams) detailIds.add(k);
    });
  });
  Object.values(schedule).flat().forEach(g => {
    const detailed = g?.detailed === true || g?.detailed === 'true' || g?.detailed === 1;
    const id = String(g?.detailId || g?.id || '');
    if (detailed && !id) issues.push({ level: 'bad', title: '상세 기록 ID 누락', body: `${g.date || '-'} ${g.opponent || ''}` });
    if (detailed && id && !detailIds.has(id)) issues.push({ level: 'bad', title: 'detail.json 연결 누락', body: id });
    if (!detailed && id && detailIds.has(id)) issues.push({ level: 'warn', title: '상세 기록은 있는데 일정이 비활성', body: id });
  });
}

function checkPlayers(players, issues) {
  const seen = new Set();
  players.forEach(p => {
    const id = String(p.id);
    if (seen.has(id)) issues.push({ level: 'bad', title: '선수 등번호 중복', body: `#${id} ${p.name || ''}` });
    seen.add(id);
    if (!p.name) issues.push({ level: 'bad', title: '선수 이름 누락', body: `#${id}` });
    if (!p.position) issues.push({ level: 'warn', title: '포지션 누락', body: `#${id} ${p.name || ''}` });
  });
}

function playerIssue(year, row, ids, issues, type) {
  const id = String(row.playerId ?? row.number ?? row.id ?? '').trim();
  if (id && !ids.has(id)) issues.push({ level: 'warn', title: `${year} ${type} 선수 DB 미등록`, body: `#${id} ${row.name || ''}` });
}

function checkBatting(year, rows, ids, issues) {
  rows.forEach(r => {
    playerIssue(year, r, ids, issues, '타격');
    const h = N(r.hits), ab = N(r.ab), d2 = N(r.double), d3 = N(r.triple), hr = N(r.hr);
    if (h > ab) issues.push({ level: 'bad', title: `${year} 안타가 타수보다 큼`, body: `${r.name || '-'} H ${h} / AB ${ab}` });
    if (d2 + d3 + hr > h) issues.push({ level: 'bad', title: `${year} 장타 합계 오류`, body: `${r.name || '-'} 2B+3B+HR > H` });
  });
}

function checkPitching(year, rows, ids, issues) {
  rows.forEach(r => {
    playerIssue(year, r, ids, issues, '투구');
    const ipRaw = r.innings ?? r.ip ?? r.IP;
    if (ipRaw != null && !validIP(ipRaw)) issues.push({ level: 'bad', title: `${year} 이닝 표기 확인`, body: `${r.name || '-'} IP ${ipRaw}` });
    if (N(r.er) > N(r.runs) && N(r.runs) > 0) issues.push({ level: 'warn', title: `${year} 자책점이 실점보다 큼`, body: `${r.name || '-'}` });
  });
}

function validIP(v) {
  if (typeof v === 'number') {
    const dec = Math.round((v - Math.trunc(v)) * 10);
    return dec === 0 || dec === 1 || dec === 2;
  }
  return /^(\d+)(\.[012])?$/.test(String(v).trim());
}

function renderIssues(issues) {
  const total = document.getElementById('check-total');
  const list = document.getElementById('check-list');
  const bad = issues.filter(i => i.level === 'bad').length;
  const warn = issues.filter(i => i.level === 'warn').length;
  total.textContent = bad || warn ? `${bad} 오류 · ${warn} 확인` : '정상';
  list.innerHTML = issues.length
    ? issues.map(i => `<article class="check-item ${i.level}"><strong>${escapeHTML(i.title)}</strong><span>${escapeHTML(i.body)}</span></article>`).join('')
    : '<article class="check-item good"><strong>문제 없음</strong><span>현재 검사 기준에서 이상이 없습니다.</span></article>';
}

function escapeHTML(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
