document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));

  if (isNaN(id)) {
    document.body.innerHTML = "<p>유효한 선수 ID가 없습니다.</p>";
    return;
  }

  // 선수 기본 정보 표시
  fetch('players.json')
    .then(response => response.json())
    .then(players => {
      const player = players.find(p => p.id === id);

      if (!player) {
        document.body.innerHTML = "<p>선수 정보를 찾을 수 없습니다.</p>";
        return;
      }

      document.getElementById('name').innerText = player.name;
      document.getElementById('number').innerText = `#${player.id}`;
      document.getElementById('birth').innerText = player.birth;
      document.getElementById('highschool').innerText = player.highschool;
      document.getElementById('major').innerText = player.major || '-';
      document.getElementById('position').innerText = player.position || '-';
    });

  // 기록 연도 선택 처리
  const yearSelect = document.getElementById('year-select');
  yearSelect.addEventListener('change', () => {
    loadRecord(id, yearSelect.value);
  });

  // 기본은 첫 선택된 연도 로딩
  loadRecord(id, yearSelect.value);
});

function loadRecord(playerId, year) {
  const file = year === 'total' ? 'records_career.json' : `records_${year}.json`;

  fetch(file)
    .then(res => res.json())
    .then(data => {
      const playerRecord = data.find(p => parseInt(p.number) === playerId);
      const box = document.getElementById('record-box');
      box.innerHTML = '';

      if (!playerRecord) {
        box.innerHTML = '<p>기록이 없습니다.</p>';
        return;
      }

      const floatFields = ['avg', 'obp', 'slg', 'ops', 'woba', 'babip'];

      const items = [
        ['타율', 'avg'],
        ['타석', 'pa'],
        ['타수', 'ab'],
        ['안타', 'hits'],
        ['2루타', 'double'],
        ['3루타', 'triple'],
        ['홈런', 'hr'],
        ['4구', 'bb'],
        ['사구', 'hbp'],
        ['출루율', 'obp'],
        ['장타율', 'slg'],
        ['OPS', 'ops'],
        ['wOBA', 'woba'],
        ['BABIP', 'babip'],
        ['도루', 'sb']
      ];

      items.forEach(([label, key]) => {
        const div = document.createElement('div');
        div.style.border = '1px solid #ccc';
        div.style.borderRadius = '8px';
        div.style.padding = '8px';
        div.style.marginBottom = '6px';
        div.style.backgroundColor = '#f9f9f9';
        div.style.fontSize = '0.95em';

        let formattedValue = '-';
        const value = playerRecord[key];
        if (typeof value === 'number') {
          if (floatFields.includes(key)) {
            formattedValue = value.toFixed(3);
          } else {
            formattedValue = Math.round(value).toString();
          }
        }

        div.innerHTML = `<strong>${label}:</strong> ${formattedValue}`;
        box.appendChild(div);
      });
    })
    .catch(err => {
      console.error('기록 파일 로딩 오류:', err);
      document.getElementById('record-box').innerHTML = '<p>기록을 불러오는 데 실패했습니다.</p>';
    });
}
