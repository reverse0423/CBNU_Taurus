// player.js

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'), 10);
  if (isNaN(id)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // 선수 기본 정보 로드
  fetch('players.json')
    .then(res => res.ok ? res.json() : Promise.reject('players.json 로드 실패'))
    .then(players => {
      const p = players.find(x => x.id === id);
      if (!p) throw '선수 정보 없음';
      document.getElementById('number').innerText     = `#${p.id}`;
      document.getElementById('name').innerText       = p.name;
      document.getElementById('birth').innerText      = p.birth;
      document.getElementById('highschool').innerText = p.highschool;
      document.getElementById('major').innerText      = p.major || '-';
      document.getElementById('position').innerText   = p.position || '-';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('record-box').innerHTML =
        '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  // 연도 선택
  const yearSelect = document.getElementById('year-select');
  yearSelect.value = '2025';
  yearSelect.addEventListener('change', () => loadRecord(id, yearSelect.value));
  loadRecord(id, yearSelect.value);
});

/**
 * 기록 로드 및 화면 업데이트
 * @param {number} playerId - URL 파라미터로 넘어온 선수 고유 ID
 * @param {string} year - '2023', '2024', '2025' 또는 'total'
 */
function loadRecord(playerId, year) {
  const file = year === 'total'
    ? 'records_career.json'
    : `records_${year}.json`;
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

      // 상단 주요 기록 그리드에 값 채우기
      const gridKeys = ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops'];
      gridKeys.forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        let v = rec[key] != null ? rec[key] : '-';
        if (v !== '-' && ['avg','obp','slg','ops'].includes(key)) {
          v = Number(v).toFixed(3);
        }
        el.innerText = v;
      });

      // 하단 상세 기록 리스트 생성
      box.innerHTML = '';
      const fields = [
        ['타율','avg'],['타석','pa'],['타수','ab'],['안타','hits'],
        ['2루타','double'],['3루타','triple'],['홈런','hr'],
        ['4구','bb'],['사구','hbp'],['타점','RBI'],['도루','sb'],
        ['출루율','obp'],['장타율','slg'],['OPS','ops'],['wOBA','woba'],['BABIP','babip']
      ];
      const floatFields = ['avg','obp','slg','ops','woba','babip'];

      fields.forEach(([label, key]) => {
        const div = document.createElement('div');
        const raw = rec[key];
        let txt = '-';
        if (raw != null) {
          txt = floatFields.includes(key)
            ? Number(raw).toFixed(3)
            : raw.toString();
        }
        div.innerHTML = `<strong>${label}:</strong> ${txt}`;
        div.style.cssText =
          'border:1px solid #ccc; border-radius:6px; padding:8px; margin:4px 0; background:#fafafa;';
        box.appendChild(div);
      });
    })
    .catch(err => {
      console.error(err);
      document.getElementById('record-box').innerHTML =
        '<p style="text-align:center;">기록 로드 실패</p>';
    });
}
