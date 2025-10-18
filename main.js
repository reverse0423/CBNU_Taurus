// main.js

// 2025.json에서 경기 데이터 로드
async function fetchMatchData() {
  try {
    const res = await fetch('schedule.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data['2025'] || [];
  } catch (err) {
    console.error('경기 데이터를 불러오지 못했습니다:', err);
    return [];
  }
}

// 경기 HTML 생성 함수
function formatMatch(match) {
  const { date, time, opponent: opp, location: loc, type } = match;
  let html = `<p class="match-date">${date} ${time}</p>`;
  html += `<p>상대: ${opp}</p>`;
  html += `<p>장소: ${loc}</p>`;
  html += `<p>리그: ${type}</p>`;
  return html;
}

// 다음 경기 렌더링
function renderNextMatch(matches) {
  const now = new Date();
  const upcoming = matches
    .filter(m => new Date(`${m.date}T${m.time}`) > now)
    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  const next = upcoming[0];
  const box = document.querySelector('#next-match .match-info');

  if (next) {
    box.innerHTML = formatMatch(next);
  } else {
    box.innerHTML = '<p>예정된 경기가 없습니다.</p>';
  }
}

// 최근 경기 렌더링
function renderRecentMatch(matches) {
  const now = new Date();
  const past = matches
    .filter(m => new Date(`${m.date}T${m.time}`) < now)
    .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
  const recent = past[0];
  const box = document.querySelector('#recent-match .match-info');

  if (recent) {
    let html = formatMatch(recent);
    html += `<p>점수: ${recent.score} (${recent.result})</p>`;
    box.innerHTML = html;
  } else {
    box.innerHTML = '<p>경기 기록이 없습니다.</p>';
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  const matches = await fetchMatchData();
  renderNextMatch(matches);
  renderRecentMatch(matches);
});