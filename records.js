// records.js
// 타격·투수 기록 토글 및 연도별 로드

document.addEventListener('DOMContentLoaded', () => {
  const btnBat    = document.getElementById('btn-batting');
  const btnPit    = document.getElementById('btn-pitching');
  const yearSel   = document.getElementById('yearSelect');
  const filterBtn = document.getElementById('filterBtn');
  const theadRow  = document.getElementById('theadRow');
  const tbody     = document.getElementById('tbodyRows');

  let currentType = 'bat';    // 'bat' or 'pit'
  let filterOn    = false;
  let currentSort = { key:'pa', asc:false };

  // 필드 정의
  const batFields = [
    {key:'name', label:'선수명'},
    {key:'pa',   label:'타석'},
    {key:'ab',   label:'타수'},
    {key:'hits', label:'안타'},
    {key:'double',label:'2루타'},
    {key:'triple',label:'3루타'},
    {key:'hr',   label:'홈런'},
    {key:'RBI',  label:'타점'},
    {key:'RUN',  label:'득점'},
    {key:'sb',   label:'도루'},
    {key:'bb',   label:'4구'},
    {key:'hbp',  label:'사구'},
    {key:'avg',  label:'타율'},
    {key:'obp',  label:'출루율'},
    {key:'slg',  label:'장타율'},
    {key:'ops',  label:'OPS'},
    {key:'woba', label:'wOBA'},
    {key:'babip',label:'BABIP'},
  ];
  const pitFields = [
    {key:'name',   label:'투수명'},
    {key:'games',  label:'등판 경기 수'},
    {key:'innings',label:'이닝'},
    {key:'era',    label:'방어율'},
    {key:'wins',   label:'승'},
    {key:'losses', label:'패'},
    {key:'holds',  label:'홀드'},
    {key:'saves',  label:'세이브'},
    {key:'so',     label:'탈삼진'},
    {key:'bb',     label:'볼넷'},
    {key:'hbp',    label:'사구'},
    {key:'runs',   label:'실점'},
    {key:'er',     label:'자책점'},
  ];
  const floatBat = ['avg','obp','slg','ops','woba','babip'];
  const floatPit = ['era'];

  // 타입 토글
  btnBat.addEventListener('click', () => {
    currentType = 'bat';
    btnBat.classList.add('active');
    btnPit.classList.remove('active');
    filterBtn.style.display = (yearSel.value==='career') ? 'inline-block' : 'none';
    currentSort = { key:'pa', asc:false };
    loadData(yearSel.value);
  });
  btnPit.addEventListener('click', () => {
    currentType = 'pit';
    btnPit.classList.add('active');
    btnBat.classList.remove('active');
    filterBtn.style.display = 'none';
    currentSort = { key:'games', asc:false };
    loadData(yearSel.value);
  });

  // 연도 변경
  yearSel.addEventListener('change', () => {
    filterOn = false;
    filterBtn.textContent = '규정타석 기준';
    loadData(yearSel.value);
  });

  // 규정타석 필터 (타격 모드 통산만)
  filterBtn.addEventListener('click', () => {
    filterOn = !filterOn;
    filterBtn.textContent = filterOn ? '전체 보기' : '규정타석 기준';
    loadData(yearSel.value);
  });

  // 테이블 렌더
  function renderTable(records) {
    const fields = (currentType==='bat') ? batFields : pitFields;
    const floatF = (currentType==='bat') ? floatBat : floatPit;

    // 헤더
    theadRow.innerHTML = '';
    fields.forEach(f => {
      const th = document.createElement('th');
      th.textContent = f.label;
      th.dataset.key = f.key;
      th.addEventListener('click', () => {
        if (currentSort.key === f.key) currentSort.asc = !currentSort.asc;
        else { currentSort.key = f.key; currentSort.asc = true; }
        sortAndRender(records);
      });
      theadRow.appendChild(th);
    });

    // 본문
    sortAndRender(records);
  }

  // 정렬 + 렌더링
  function sortAndRender(records) {
    let rows = records.slice();

    // 타격 모드, pa>=1 필터
    if (currentType==='bat') {
      rows = rows.filter(r => Number(r.pa) >= 1);
      if (filterOn && yearSel.value==='career') {
        rows = rows.filter(r => Number(r.pa) >= 40);
      }
    }

    // 정렬
    rows.sort((a, b) => {
      let va = a[currentSort.key], vb = b[currentSort.key];
      const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key))
                   || (currentType==='pit' && floatPit.includes(currentSort.key));
      if (isFloat) { va = Number(va); vb = Number(vb); }
      if (va < vb) return currentSort.asc ? -1 : 1;
      if (va > vb) return currentSort.asc ? 1 : -1;
      return 0;
    });

    // 렌더
    tbody.innerHTML = '';
    const fields = (currentType==='bat') ? batFields : pitFields;
    const floatF = (currentType==='bat') ? floatBat : floatPit;
    rows.forEach(r => {
      const tr = document.createElement('tr');
      fields.forEach(f => {
        const td = document.createElement('td');
        let v = r[f.key] != null ? r[f.key] : '';
        td.textContent = floatF.includes(f.key)
          ? Number(v).toFixed(3)
          : v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // 데이터 로드
  function loadData(year) {
    let file;
    if (currentType==='bat') {
      file = (year==='career')
        ? 'records_career.json'
        : `records_${year}.json`;
    } else {
      file = (year==='career')
        ? 'pitching_career.json'
        : `pitching_${year}.json`;
    }

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => renderTable(data))
      .catch(err => {
        console.error('로드 오류:', err);
        tbody.innerHTML = `<tr><td colspan="${(currentType==='bat'?batFields.length:pitFields.length)}">데이터를 불러오는 데 실패했습니다.</td></tr>`;
      });
  }

  // 초기 로드
  loadData(yearSel.value);
});
