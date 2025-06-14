// records.js

let currentData = [];
let isShowingTeam = false;
let isQualifiedFilterOn = false;

const yearSelect = document.getElementById('year-select');
const teamBtn    = document.getElementById('team-record-btn');
const qualBtn    = document.getElementById('filter-qualified-btn');
const indivDiv   = document.getElementById('individual-records');
const teamDiv    = document.getElementById('team-record-box');

// 연도 선택 변경 시
yearSelect.addEventListener('change', () => {
  // 통산인 경우에만 규정타석 버튼 보임
  if (yearSelect.value === 'total' && !isShowingTeam) {
    qualBtn.style.display = 'inline-block';
  } else {
    qualBtn.style.display = 'none';
    isQualifiedFilterOn = false;
    qualBtn.textContent = '규정타석 기준 적용';
  }
  // 개인/팀 뷰 갱신
  if (isShowingTeam) {
    loadTeamRecord(yearSelect.value);
  } else {
    loadIndividualRecords(yearSelect.value);
  }
});

// 팀 기록 토글 버튼
teamBtn.addEventListener('click', () => {
  isShowingTeam = !isShowingTeam;
  if (isShowingTeam) {
    indivDiv.style.display = 'none';
    teamDiv.style.display  = 'block';
    teamBtn.textContent     = '개인 기록 보기';
    qualBtn.style.display   = 'none';
    loadTeamRecord(yearSelect.value);
  } else {
    teamDiv.style.display   = 'none';
    indivDiv.style.display  = 'block';
    teamBtn.textContent     = '팀 전체 타격 기록 보기';
    if (yearSelect.value === 'total') {
      qualBtn.style.display = 'inline-block';
    }
    loadIndividualRecords(yearSelect.value);
  }
});

// 규정타석 기준 토글 버튼
qualBtn.addEventListener('click', () => {
  isQualifiedFilterOn = !isQualifiedFilterOn;
  qualBtn.textContent  = isQualifiedFilterOn ? '전체 기록 보기' : '규정타석 기준 적용';
  loadIndividualRecords(yearSelect.value);
});

// 개인 기록 불러오기
function loadIndividualRecords(year) {
  const file = year === 'total'
    ? 'records_career.json'
    : `records_${year}.json`;

  fetch(file)
    .then(res => res.ok ? res.json() : Promise.reject(`${file} 로드 실패`))
    .then(data => {
      // 통산 & 필터 켜짐 → PA>=40 필터
      if (year === 'total' && isQualifiedFilterOn) {
        data = data.filter(p => Number(p.pa) >= 40);
      }
      currentData = data;
      renderIndividualTable(currentData);
    })
    .catch(err => {
      console.error(err);
      document.getElementById('record-body').innerHTML =
        '<tr><td colspan="14" style="text-align:center;">불러오기 실패</td></tr>';
    });
}

// 개인 기록 테이블 렌더링
function renderIndividualTable(data) {
  const tbody = document.getElementById('record-body');
  tbody.innerHTML = '';

  data.forEach(p => {
    const pa   = Number(p.pa)    || 0;
    const ab   = Number(p.ab)    || 0;
    const hits = Number(p.hits)  || 0;
    const dbl  = Number(p.double)|| 0;
    const tpl  = Number(p.triple)|| 0;
    const hr   = Number(p.hr)    || 0;
    const bb   = Number(p.bb)    || 0;
    const hbp  = Number(p.hbp)   || 0;
    const sb   = Number(p.sb)    || 0;

    const avg = ab ? (hits/ab).toFixed(3) : '-';
    const obp = pa ? ((hits + bb + hbp)/pa).toFixed(3) : '-';
    const tb  = (hits - dbl - tpl - hr) + dbl*2 + tpl*3 + hr*4;
    const slg = ab ? (tb/ab).toFixed(3) : '-';
    const ops = (obp === '-' || slg === '-')
      ? '-'
      : (parseFloat(obp) + parseFloat(slg)).toFixed(3);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="player-name">${p.name}</td>
      <td>${pa}</td><td>${ab}</td><td>${hits}</td>
      <td>${dbl}</td><td>${tpl}</td><td>${hr}</td>
      <td>${bb}</td><td>${hbp}</td><td>${sb}</td>
      <td>${avg}</td><td>${obp}</td><td>${slg}</td><td>${ops}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 테이블 정렬 기능
function sortTable(key) {
  const sorted = [...currentData].sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name);
    const aVal = parseFloat(a[key]);
    const bVal = parseFloat(b[key]);
    if (isNaN(aVal) || isNaN(bVal)) return 0;
    return bVal - aVal;
  });
  renderIndividualTable(sorted);
}

// 팀 기록 집계 및 출력
function loadTeamRecord(year) {
  const file = year === 'total'
    ? 'records_career.json'
    : `records_${year}.json`;

  teamDiv.innerHTML = '<p style="text-align:center;">팀 기록 계산 중...</p>';

  fetch(file)
    .then(res => res.ok ? res.json() : Promise.reject(`${file} 로드 실패`))
    .then(data => {
      let pa=0, ab=0, hits=0, dbl=0, tpl=0, hr=0, bb=0, hbp=0, sb=0;
      data.forEach(p => {
        pa   += Number(p.pa)    || 0;
        ab   += Number(p.ab)    || 0;
        hits += Number(p.hits)  || 0;
        dbl  += Number(p.double)|| 0;
        tpl  += Number(p.triple)|| 0;
        hr   += Number(p.hr)    || 0;
        bb   += Number(p.bb)    || 0;
        hbp  += Number(p.hbp)   || 0;
        sb   += Number(p.sb)    || 0;
      });

      const avg = ab ? (hits/ab).toFixed(3) : '-';
      const obp = pa ? ((hits + bb + hbp)/pa).toFixed(3) : '-';
      const tb  = (hits - dbl - tpl - hr) + dbl*2 + tpl*3 + hr*4;
      const slg = ab ? (tb/ab).toFixed(3) : '-';
      const ops = (obp === '-' || slg === '-')
        ? '-'
        : (parseFloat(obp) + parseFloat(slg)).toFixed(3);

      let html = '<table class="records-table team-record-table"><tbody>';
      const rows = [
        ['타석', pa], ['타수', ab], ['안타', hits], ['2루타', dbl],
        ['3루타', tpl], ['홈런', hr], ['4구', bb], ['사구', hbp],
        ['도루', sb], ['타율', avg], ['출루율', obp], ['장타율', slg], ['OPS', ops]
      ];
      rows.forEach(([label, val]) => {
        html += `<tr><td>${label}</td><td>${val}</td></tr>`;
      });
      html += '</tbody></table>';
      teamDiv.innerHTML = html;
    })
    .catch(err => {
      console.error(err);
      teamDiv.innerHTML = '<p style="text-align:center;">팀 기록 로드 실패</p>';
    });
}

// 초기 로드 설정
window.addEventListener('DOMContentLoaded', () => {
  if (yearSelect.value === 'total') qualBtn.style.display = 'inline-block';
  loadIndividualRecords(yearSelect.value);
});
