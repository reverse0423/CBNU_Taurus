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
  const selector = document.getElementById('yearSelector');
  const years = ['전체', ...Object.keys(scheduleData).sort((a, b) => b - a)];
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year === '전체' ? '전체 요약' : `${year}년`;
    selector.appendChild(opt);
  });
  selector.addEventListener('change', () => renderSchedule(selector.value));
}

function renderSchedule(year) {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  // ── 전체 요약 모드 ──
  if (year === '전체') {
    Object.keys(scheduleData)
      .sort((a, b) => b - a)
      .forEach(y => {
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

        const box = document.createElement('div');
        box.className = 'summary-box';
        box.innerHTML = `
          <div class="year-label">${y}년</div>
          <div class="record">${w}승 ${l}패${t ? ' ' + t + '무' : ''}</div>
          <div class="pct">승률: ${pct}</div>
        `;
        container.appendChild(box);
      });
    return;
  }

  // ── 특정 연도 상세 모드 ──
  const games = scheduleData[year] || [];
  games.forEach(game => {
    const box = document.createElement('div');
    box.className = 'game-box';

    // 날짜와 시간
    const date = game.date || '날짜 미정';
    const time = game.time ? ' ' + game.time : '';

    // 상대, 스코어, 결과, 장소, 리그, 상세 링크
    const opponent = game.opponent || '상대팀';
    const score    = game.score    || '';
    const result   = game.result   ? ' (' + game.result + ')' : '';
    const location = game.location || '장소 미정';
    const league   = game.type     || game.league || '리그 미정';
    const link     = game.detailLink || '#';

    // 날짜와 매치업을 분리된 <div>로 렌더링
    box.innerHTML = `
      <div class="date">${date}${time}</div>
      <div class="matchup">"충북대학교 타우루스" vs ${opponent}</div>
      <div class="result">${score}${result}</div>
      <div class="details">
        ${location}<br>
        ${league}<br>
        <a href="${link}">상세기록 보기</a>
      </div>
    `;
    container.appendChild(box);
  });
}