// players.js
// 연도별 배팅 기여도 랭킹만 계산

document.addEventListener('DOMContentLoaded', () => {
  const btnPlayers  = document.getElementById('btn-players');
  const btnRanking  = document.getElementById('btn-ranking');
  const playerList  = document.getElementById('playerList');
  const rankingList = document.getElementById('rankingList');
  const yearSelect  = document.getElementById('year-select-ranking');

  if (!btnPlayers || !btnRanking || !playerList || !rankingList || !yearSelect) {
    console.error('필요한 요소를 찾을 수 없습니다.');
    return;
  }

  // 뷰 전환
  btnPlayers.addEventListener('click', () => {
    btnPlayers.classList.add('active');
    btnRanking.classList.remove('active');
    yearSelect.style.display = 'none';
    playerList.style.display = '';
    rankingList.style.display = 'none';
  });
  btnRanking.addEventListener('click', () => {
    btnRanking.classList.add('active');
    btnPlayers.classList.remove('active');
    yearSelect.style.display = '';
    playerList.style.display = 'none';
    rankingList.style.display = '';
    loadRanking(yearSelect.value);
  });
  yearSelect.addEventListener('change', () => {
    if (btnRanking.classList.contains('active')) {
      loadRanking(yearSelect.value);
    }
  });

  // 선수 목록
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(players => {
      players.sort((a,b) => Number(a.id)-Number(b.id));
      players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `#${p.id} ${p.name}`;
        li.onclick = () => location.href = `player.html?id=${p.id}`;
        playerList.appendChild(li);
      });
    })
    .catch(() => {
      playerList.innerHTML = '<li>선수 목록 로드 실패</li>';
    });

  // 배팅 기여도 계산
  function calcBat(r) {
    const avg  = parseFloat(r.avg)||0;
    const woba = parseFloat(r.woba)||0;
    const slg  = parseFloat(r.slg)||0;
    const ops  = parseFloat(r.ops)||0;
    const hr   = parseInt(r.hr)||0;
    const sb   = parseInt(r.sb)||0;
    const RBI  = parseInt(r.RBI)||0;
    return 30*ops + 25*woba + 20*slg + 15*avg + 5*hr + 2*sb + 3*RBI;
  }

  // 랭킹 로드 (배팅만)
  function loadRanking(year) {
    rankingList.innerHTML = '';
    const file = year === 'total'
      ? 'records_career.json'
      : `records_${year}.json`;

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(records => {
        // 기여도 계산 및 정렬
        const ranks = records
          .map(r => {
            const pid  = r.playerId ?? parseInt(r.number,10);
            const name = r.name;
            const contrib = calcBat(r);
            return { pid, name, contrib };
          })
          .filter(x => x.contrib > 0)
          .sort((a,b) => b.contrib - a.contrib)
          .slice(0, 10);

        // 화면에 표시
        ranks.forEach((p, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx+1}. #${p.pid} ${p.name} — ${p.contrib.toFixed(2)}`;
          li.onclick = () => location.href = `player.html?id=${p.pid}`;
          rankingList.appendChild(li);
        });
      })
      .catch(() => {
        rankingList.innerHTML = '<li>랭킹 로드 실패</li>';
      });
  }

  // 초기
  playerList.style.display   = '';
  rankingList.style.display  = 'none';
  yearSelect.style.display   = 'none';
});






