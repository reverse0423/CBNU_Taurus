// players.js
// 선수 목록 및 연도별 통합 기여도 랭킹 구현 (투구기록 없을 땐 타격만)

document.addEventListener('DOMContentLoaded', () => {
  const btnPlayers    = document.getElementById('btn-players');
  const btnRanking    = document.getElementById('btn-ranking');
  const playerList    = document.getElementById('playerList');
  const rankingList   = document.getElementById('rankingList');
  const yearSelect    = document.getElementById('year-select-ranking');

  if (!btnPlayers || !btnRanking || !playerList || !rankingList || !yearSelect) {
    console.error('필요한 요소를 찾을 수 없습니다.');
    return;
  }

  // 뷰 전환 핸들러
  btnPlayers.addEventListener('click', () => {
    btnPlayers.classList.add('active');
    btnRanking.classList.remove('active');
    yearSelect.style.display   = 'none';
    playerList.style.display   = '';
    rankingList.style.display  = 'none';
  });
  btnRanking.addEventListener('click', () => {
    btnRanking.classList.add('active');
    btnPlayers.classList.remove('active');
    yearSelect.style.display   = '';
    playerList.style.display   = 'none';
    rankingList.style.display  = '';
    loadRanking(yearSelect.value);
  });

  // 연도 변경
  yearSelect.addEventListener('change', () => {
    if (btnRanking.classList.contains('active')) {
      loadRanking(yearSelect.value);
    }
  });

  // 선수 목록 로드
  fetch('players.json')
    .then(res => res.ok ? res.json() : Promise.reject(res.status))
    .then(players => {
      players.sort((a, b) => Number(a.id) - Number(b.id));
      players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `#${p.id} ${p.name}`;
        li.addEventListener('click', () => {
          location.href = `player.html?id=${p.id}`;
        });
        playerList.appendChild(li);
      });
    })
    .catch(err => {
      console.error('선수 목록 로드 오류:', err);
      playerList.innerHTML = '<li>선수 목록을 불러오는 데 실패했습니다.</li>';
    });

  /**
   * 연도별 통합 기여도 랭킹 로드
   * @param {string} year '2025'|'2024'|'2023'|'total'
   */
  function loadRanking(year) {
    rankingList.innerHTML = '';

    // JSON 파일 경로
    const batFile = (year === 'total')
      ? 'records_career.json'
      : `records_${year}.json`;
    const pitFile = (year === 'total')
      ? 'pitching_career.json'
      : `pitching_${year}.json`;

    // 타격 기록 먼저 로드
    const batPromise = fetch(batFile)
      .then(r => r.ok ? r.json() : Promise.reject(r.status));

    // 투구 기록은 실패해도 빈 배열로 처리
    const pitPromise = fetch(pitFile)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .catch(() => []);

    Promise.all([batPromise, pitPromise])
      .then(([batRecords, pitRecords]) => {
        // 기여도 계산 함수
        function calcBat(r) {
          const avg  = parseFloat(r.avg)  || 0;
          const woba = parseFloat(r.woba) || 0;
          const slg  = parseFloat(r.slg)  || 0;
          const ops  = parseFloat(r.ops)  || 0;
          const hr   = parseInt(r.hr)      || 0;
          const sb   = parseInt(r.sb)      || 0;
          const RBI  = parseInt(r.RBI)     || 0;
          return 30*ops + 25*woba + 20*slg + 15*avg + 5*hr + 2*sb + 3*RBI;
        }
        function calcPit(r) {
          const wins   = parseInt(r.wins)   || 0;
          const holds  = parseInt(r.holds)  || 0;
          const saves  = parseInt(r.saves)  || 0;
          const so     = parseInt(r.so)     || 0;
          const losses = parseInt(r.losses) || 0;
          const runs   = parseInt(r.runs)   || 0;
          const bb     = parseInt(r.bb)     || 0;
          const hbp    = parseInt(r.hbp)    || 0;
          return (wins*5 + holds*3 + saves*4 + so)
               - (losses*5 + runs*2 + bb + hbp);
        }

        // 기여도 맵 구성
        const contribMap = new Map();
        const nameMap    = new Map();

        batRecords.forEach(r => {
          const pid = r.playerId ?? parseInt(r.number,10);
          const c   = calcBat(r);
          contribMap.set(pid, (contribMap.get(pid)||0) + c);
          nameMap.set(pid, r.name || nameMap.get(pid));
        });
        pitRecords.forEach(r => {
          const pid = r.playerId ?? parseInt(r.number,10);
          const c   = calcPit(r);
          contribMap.set(pid, (contribMap.get(pid)||0) + c);
          nameMap.set(pid, r.name || nameMap.get(pid));
        });

        // 랭킹 배열 생성 및 정렬
        const ranks = Array.from(contribMap.entries())
          .map(([id, contrib]) => ({ id, name: nameMap.get(id), contrib }))
          .filter(p => p.contrib !== 0)
          .sort((a,b) => b.contrib - a.contrib)
          .slice(0,10);

        // 화면에 렌더링
        ranks.forEach((p, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx+1}. #${p.id} ${p.name} — ${p.contrib.toFixed(2)}`;
          li.addEventListener('click', () => {
            location.href = `player.html?id=${p.id}`;
          });
          rankingList.appendChild(li);
        });
      })
      .catch(err => {
        console.error('랭킹 로드 오류:', err);
        rankingList.innerHTML = '<li>랭킹을 불러오는 데 실패했습니다.</li>';
      });
  }

  // 초기 상태
  playerList.style.display  = '';
  rankingList.style.display = 'none';
  yearSelect.style.display  = 'none';
});



