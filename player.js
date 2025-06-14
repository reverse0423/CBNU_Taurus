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
      document.getElementById('record-box').innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  // 연도 선택 설정
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
  const salaryBox = document.getElementById('salary-box');
  const statsGrid = document.getElementById('stats-grid');

  // 초기화: hide salary and grid
  salaryBox.innerText = '';
  statsGrid.style.display = 'none';
  box.innerHTML = '<p style="text-align:center;">기록을 불러오는 중...</p>';

  fetch(file)
    .then(res => res.ok ? res.json() : Promise.reject(`${file} 로드 실패`))
    .then(data => {
      // 기록 찾기: playerId 우선, 없으면 number 매칭
      const rec = data.find(r => r.playerId ? r.playerId === playerId : parseInt(r.number,10) === playerId);
      if (!rec) {
        box.innerHTML = '<p style="text-align:center;">해당 연도 기록이 없습니다.</p>';
        return;
      }

      // 상단 그리드 채우고 보이기
      const gridOrder = ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops'];
      gridOrder.forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        let v = rec[key] != null ? rec[key] : '-';
        if (v !== '-' && ['avg','obp','slg','ops'].includes(key)) {
          v = Number(v).toFixed(3);
        }
        el.innerText = v;
      });
      statsGrid.style.display = 'grid';

      // 하단 상세 기록 리스트 생성
      box.innerHTML = '';
      const fields = [
        ['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],['3루타','triple'],['홈런','hr'],
        ['4구','bb'],['사구','hbp'],['타점','RBI'],['도루','sb'],
        ['출루율','obp'],['장타율','slg'],['OPS','ops'],['wOBA','woba'],['BABIP','babip']
      ];
      fields.forEach(([label, key]) => {
        const div = document.createElement('div');
        const raw = rec[key];
        let txt = '-';
        if (raw != null) {
          txt = ['woba','slg','obp','ops','avg'].includes(key)
            ? Number(raw).toFixed(3)
            : Math.round(raw).toString();
        }
        div.innerHTML = `<strong>${label}:</strong> ${txt}`;
        box.appendChild(div);
      });

      // 예상 연봉 계산
      const { avg=0, obp=0, slg=0, ops=0, woba=0, hr=0, sb=0, RBI=0 } = rec;
      const score = 30*ops + 25*woba + 20*slg + 15*avg + 5*hr + 2*sb + 3*RBI;
      const salaryKRW = score * 500_000;
      const salaryOku = salaryKRW / 100_000_000;

      // 팀 내 연봉 순위 계산
      const scoreList = data.map(r => {
        const r_score = 30*(r.ops||0) + 25*(r.woba||0) + 20*(r.slg||0) + 15*(r.avg||0)
          + 5*(r.hr||0) + 2*(r.sb||0) + 3*((r.RBI)||0);
        const pid = r.playerId !== undefined ? r.playerId : parseInt(r.number,10);
        return { pid, score: r_score };
      });
      scoreList.sort((a,b) => b.score - a.score);
      const rank = scoreList.findIndex(x => x.pid === playerId) + 1;
      const rankText = rank && rank <= 5
        ? ` (해당 연도 팀 내 ${rank}위)`
        : '';

      salaryBox.innerText =
        `Chat GPT 산정 예상 연봉: ${salaryOku.toFixed(2)}억 원 ` +
        `(약 ${salaryKRW.toLocaleString()}원)${rankText}`;
    })
    .catch(err => {
      console.error(err);
      box.innerHTML = '<p style="text-align:center;">기록 로드 실패</p>';
    });
}
