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
  // “전체” + 연도 내림차순
  const years = ['전체', ...Object.keys(scheduleData).sort((a, b) => b - a)];
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year === '전체' ? '전체 요약' : `${year}년`;
    selector.appendChild(option);
  });
  selector.addEventListener('change', () => {
    renderSchedule(selector.value);
  });
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
        let wins = 0, losses = 0, ties = 0;
        games.forEach(g => {
          if (g.result === '승') wins++;
          else if (g.result === '패') losses++;
          else if (g.result === '무') ties++;
        });
        const pct = wins + losses > 0
          ? ((wins / (wins + losses)) * 100).toFixed(1) + '%'
          : '-';

        const summaryBox = document.createElement('div');
        summaryBox.className = 'summary-box';
        summaryBox.innerHTML = `
          <div class="year-label">${y}년</div>
          <div class="record">${wins}승 ${losses}패${ties ? ' ' + ties + '무' : ''}</div>
          <div class="pct">승률: ${pct}</div>
        `;
        container.appendChild(summaryBox);
      });
    return;
  }

  // ── 특정 연도 상세 모드 ──
  const games = scheduleData[year] || [];
  games.forEach(game => {
    const box = document.createElement('div');
    box.className = 'game-box';

    const date     = game.date     || '날짜 미정';
    const time     = game.time     || '';
    const location = game.location || '장소 미정';
    const league   = game.type     || game.league || '리그 미정';
    const opponent = game.opponent || '상대팀';
    const score    = game.score    || '';
    const result   = game.result   || '';
    const link     = game.detailLink || '#';

    box.innerHTML = `
      <div class="date">${date}${time ? ' ' + time : ''}</div>
      <div class="matchup">충북대학교 타우루스 vs ${opponent}</div>
      <div class="result">${score}${result ? ' (' + result + ')' : ''}</div>
      <div class="details">
        ${location}<br>
        ${league}<br>
        <a href="${link}">상세기록 보기</a>
      </div>
    `;
    container.appendChild(box);
  });
}