// player.js

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'), 10);
  if (isNaN(id)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // 선수 기본 정보 로드 (생략: 기존 로직 그대로)
  fetch('players.json')
    .then(res => res.ok ? res.json() : Promise.reject('players.json 로드 실패'))
    .then(players => {
      const p = players.find(x => x.id === id);
      if (!p) throw '선수 정보 없음';
      document.getElementById('number').innerText = `#${p.id}`;
      document.getElementById('name').innerText   = p.name;
      document.getElementById('birth').innerText  = p.birth;
      document.getElementById('highschool').innerText = p.highschool;
      document.getElementById('major').innerText = p.major || '-';
      document.getElementById('position').innerText = p.position || '-';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('record-box').innerHTML =
        '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  const yearSelect = document.getElementById('year-select');

  // ▶ 기본값을 2025로 강제 설정
  yearSelect.value = '2025';

  // ▶ 연도 바뀔 때마다 호출
  yearSelect.addEventListener('change', () => {
    console.log('▶ 연도 변경:', yearSelect.value);
    loadRecord(id, yearSelect.value);
  });

  // ▶ 초기 한 번도 2025로 기록 로드
  console.log('▶ 초기 로드 연도:', yearSelect.value);
  loadRecord(id, yearSelect.value);
});

function loadRecord(playerId, year) {
  const file = year === 'total'
    ? 'records_career.json'
    : `records_${year}.json`;

  console.log(`loadRecord 호출 → id=${playerId}, year=${year}, file=${file}`);

  const box = document.getElementById('record-box');
  box.innerHTML = '<p style="text-align:center;">기록을 불러오는 중...</p>';

  fetch(file)
    .then(res => res.ok ? res.json() : Promise.reject(`${file} 로드 실패`))
    .then(data => {
      const rec = data.find(r => parseInt(r.number, 10) === playerId);
      if (!rec) {
        box.innerHTML = '<p style="text-align:center;">해당 연도 기록이 없습니다.</p>';
        return;
      }

      const floatKeys = ['avg','obp','slg','ops','woba','babip'];
      const fields = [
        ['타율','avg'],['타석','pa'],['타수','ab'],['안타','hits'],
        ['2루타','double'],['3루타','triple'],['홈런','hr'],
        ['4구','bb'],['사구','hbp'],['출루율','obp'],['장타율','slg'],
        ['OPS','ops'],['wOBA','woba'],['BABIP','babip'],['도루','sb']
      ];

      box.innerHTML = '';
      fields.forEach(([label, key]) => {
        let txt = '-';
        const v = rec[key];
        if (v !== undefined && v !== null) {
          txt = floatKeys.includes(key)
            ? Number(v).toFixed(3)
            : Math.round(v).toString();
        }
        const div = document.createElement('div');
        div.innerHTML = `<strong>${label}:</strong> ${txt}`;
        div.style.cssText = 'border:1px solid #ccc; border-radius:6px; padding:8px; margin:4px 0; background:#fafafa;';
        box.appendChild(div);
      });
    })
    .catch(err => {
      console.error(err);
      document.getElementById('record-box').innerHTML =
        '<p style="text-align:center;">기록 로드 실패</p>';
    });
}
