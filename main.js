document.addEventListener('DOMContentLoaded', async () => {
  const nextBox = document.querySelector('#next-match .card-content');
  const recentBox = document.querySelector('#recent-match');
  const liveBtn = document.querySelector('a[href="live.html"]');
  const liveIcon = liveBtn.querySelector('.menu-icon');
  const liveText = liveBtn.querySelector('.menu-text');
  const liveSub = liveBtn.querySelector('.menu-sub');

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
  const now = new Date();

  // 1. 최근 경기 렌더링
  const finished = allGames.filter(g => g.result && g.result !== '예정');
  if (finished.length > 0 && recentBox) {
    renderRecentCard(recentBox, finished[0]);
  } else if (recentBox) {
    recentBox.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">완료된 경기 기록이 없습니다.</p>';
  }

  // 2. [실시간 중계 버튼] 자동 활성화 로직
  // 조건: 경기 시작 1시간 전 ~ 경기 시작 후 5시간 동안
  let activeGame = allGames.find(g => {
    const gameTime = g._dateObj.getTime();
    const nowTime = now.getTime();
    const min60 = 60 * 60 * 1000;      // 1시간
    const hour5 = 5 * 60 * 60 * 1000;  // 5시간

    // 현재 시간이 [경기 -1시간] ~ [경기 +5시간] 사이인가?
    return nowTime >= (gameTime - min60) && nowTime <= (gameTime + hour5);
  });

  if (activeGame && liveBtn) {
    // ★ 방송 중! (활성화)
    liveBtn.className = 'menu-item live-on';
    liveIcon.textContent = "📡";
    liveText.textContent = "실시간 중계";
    liveSub.textContent = "ON AIR";
    liveBtn.onclick = null; // 클릭 허용 (href 이동)
  } else if (liveBtn) {
    // ★ 방송 종료 (비활성화)
    liveBtn.className = 'menu-item live-off';
    liveIcon.textContent = "💤";
    liveText.textContent = "중계 대기";
    liveSub.textContent = "방송 종료";
    liveBtn.onclick = (e) => {
      e.preventDefault();
      alert("현재 진행 중인 경기가 없습니다.\n(경기 시작 1시간 전부터 입장 가능)");
    };
  }
});

function renderRecentCard(container, game) {
  const resClass = game.result === '승' ? 'res-win' : (game.result === '패' ? 'res-lose' : 'res-draw');
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
        ${game.detailId ? `<a href="detail.html?detailId=${game.detailId}" class="detail-link-btn">기록 보기 →</a>` : ''}
      </div>
    </div>`;
}