// ── schedule.js ──
const scheduleData = {};

fetch('./schedule.json')
  .then(res => res.json())
  .then(data => {
    Object.assign(scheduleData, data);
    populateYearSelector();
    renderSchedule('전체');
  })
  .catch(error => console.error('JSON 로딩 실패:', error));

function populateYearSelector() {
  const sel = document.getElementById('yearSelector');
  ['전체', ...Object.keys(scheduleData).sort((a, b) => b - a)]
    .forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y === '전체' ? '전체 요약' : `${y}년`;
      sel.append(opt);
    });
  sel.addEventListener('change', () => renderSchedule(sel.value));
}

function renderSchedule(year) {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  // ── 전체 요약 모드 ──
  if (year === '전체') {
    const years = Object.keys(scheduleData).sort((a, b) => b - a);
    // 한 박스에 모을 HTML 문자열 생성
    const summaryLines = years.map(y => {
      const games = scheduleData[y] || [];
      let w = 0, l = 0, t = 0;
      games.forEach(g => {
        if (g.result === '승') w++;
        else if (g.result === '패') l++;
        else if (g.result === '무') t++;
      });
      const pct = w + l > 0
        ? ((w / (w + l)) * 100).toFixed(1) + '%'
        : '-';
      return `<div>${y}년: ${w}승 ${l}패${t ? ' ' + t + '무' : ''} / 승률: ${pct}</div>`;
    }).join('');

    const box = document.createElement('div');
    box.className = 'summary-box';
    box.innerHTML = summaryLines;
    container.append(box);
    return;
  }

  // ── 특정 연도 상세 모드 ──
  (scheduleData[year] || []).forEach(game => {
    const box = document.createElement('div');
    box.className = 'game-box';

    const date = game.date || '날짜 미정';
    const time = game.time ? ' ' + game.time : '';
    const opponent = game.opponent || '상대팀';
    const score = game.score || '';
    const result = game.result ? ' (' + game.result + ')' : '';
    const location = game.location || '장소 미정';
    const league = game.type || game.league || '리그 미정';
    const link = game.detailLink || '#';

    box.innerHTML = `
      <div class="date">${date}${time}</div>
      <div class="matchup">충북대학교 타우루스 vs ${opponent}</div>
      <div class="result">${score}${result}</div>
      <div class="details">
        ${location}<br>
        ${league}<br>
        <a href="${link}">상세기록 보기</a>
      </div>
    `;
    container.append(box);
  });
}
