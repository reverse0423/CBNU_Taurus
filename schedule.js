// schedule.js — FINAL (detailed 플래그 반영 + detailId 링크)
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

  // ── 전체 요약 ──
  if (year === '전체') {
    const years = Object.keys(scheduleData).sort((a, b) => b - a);
    const summaryLines = years.map(y => {
      const games = scheduleData[y] || [];
      let w = 0, l = 0, t = 0;
      games.forEach(g => {
        if (g.result === '승') w++;
        else if (g.result === '패') l++;
        else if (g.result === '무') t++;
      });
      const pct = w + l > 0 ? ((w / (w + l)) * 100).toFixed(1) + '%' : '-';
      return `<div>${y}년: ${w}승 ${l}패${t ? ' ' + t + '무' : ''} / 승률: ${pct}</div>`;
    }).join('');
    const box = document.createElement('div');
    box.className = 'summary-box';
    box.innerHTML = summaryLines;
    container.append(box);
    return;
  }

  // ── 특정 연도 상세 ──
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

    // ★ detailed 플래그 적용 (미기재도 false 취급)
    const detailed =
      game.detailed === true || game.detailed === 'true' || game.detailed === 1;
    const detailId = game.detailId || game.id || '';
    const canOpen = detailed && !!detailId;
    const href = canOpen ? `detail.html?detailId=${encodeURIComponent(detailId)}` : '';

    box.innerHTML = `
      <div class="date">${date}${time}</div>
      <div class="matchup">충북대학교 타우루스 vs ${opponent}</div>
      <div class="result">${score}${result}</div>
      <div class="details">
        ${location}<br>${league}
      </div>
      <div class="actions" style="margin-top:8px">
        ${
          canOpen
            ? `<a class="detail-link" href="${href}">상세기록 보기</a>`
            : `<span class="detail-link" style="opacity:.55;cursor:not-allowed">업로드 예정</span>`
        }
      </div>
    `;
    container.append(box);
  });
}