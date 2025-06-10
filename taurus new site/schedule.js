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
  const years = ['전체', ...Object.keys(scheduleData).sort()];
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    selector.appendChild(option);
  });

  selector.addEventListener('change', () => {
    renderSchedule(selector.value);
  });
}

function renderSchedule(year) {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  const games = year === '전체'
    ? Object.values(scheduleData).flat()
    : scheduleData[year] || [];

  games.forEach(game => {
    const box = document.createElement('div');
    box.className = 'game-box';

    const opponent = game.opponent || '상대팀';
    const date = game.date || '날짜 미정';
    const location = game.location || '장소 미정';
    const league = game.type || game.league || '리그 미정';
    const detailLink = game.detailLink || '#';

    box.innerHTML = `
      <div class="matchup">충북대학교 타우루스 vs ${opponent}</div>
      <div class="details">
        ${date}<br>
        ${location}<br>
        ${league}<br>
        <a href="${detailLink}">상세기록 보기</a>
      </div>
    `;

    container.appendChild(box);
  });
}

