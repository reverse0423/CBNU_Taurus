// players.js
// records_career.json에서 선수 이름과 등번호를 가져와 정렬 후 목록을 렌더링합니다.

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('playersList');
  if (!listEl) {
    console.error('playersList 요소를 찾을 수 없습니다.');
    return;
  }

  fetch('records_career.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(records => {
      // 등번호 오름차순, 동일 등번호 시 이름 가나다순 정렬
      records.sort((a, b) => {
        const numA = Number(a.number);
        const numB = Number(b.number);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name, 'ko');
      });

      // 리스트 렌더링
      records.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';

        const link = document.createElement('a');
        // player.html로 이동하며, id 파라미터로 등번호 전달
        link.href = `player.html?id=${encodeURIComponent(player.number)}`;
        link.textContent = `#${player.number} ${player.name}`;
        link.className = 'player-link';

        li.appendChild(link);
        listEl.appendChild(li);
      });
    })
    .catch(err => {
      console.error('선수 데이터를 불러오는 중 오류 발생:', err);
      listEl.innerHTML = '<li>선수 목록을 불러오는 데 실패했습니다.</li>';
    });
});
