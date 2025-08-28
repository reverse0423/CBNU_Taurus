// records.js — FINAL (자동 계산: AVG/OBP/SLG/OPS/wOBA, BABIP 제거)

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

  // ---- 파생지표 계산 유틸 ----
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (num, den) => (den > 0 ? num / den : 0);
  const r3  = x => Math.round(x * 1000) / 1000;
  // 기본 wOBA 계수 (필요하면 조정)
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // 한 선수 객체에 파생치 채우기 (원시 카운팅 값만 있으면 됨)
  function applyDerived(p) {
    // 영/한 혼용 대비 폴백 지원
    const AB  = N(p.ab ?? p.AB ?? p.타수);
    const H   = N(p.hits ?? p.h ?? p.H ?? p.안타);
    const _2B = N(p.double ?? p['2B'] ?? p['2루타']);
    const _3B = N(p.triple ?? p['3B'] ?? p['3루타']);
    const HR  = N(p.hr ?? p.HR ?? p.홈런);
    const BB  = N(p.bb ?? p.BB ?? p.볼넷 ?? p['4구']);
    const IBB = N(p.ibb ?? p.IBB ?? p.고의4구);
    const HBP = N(p.hbp ?? p.HBP ?? p.사구);
    const SF  = N(p.sf ?? p.SF ?? p['희생플라이'] ?? p['희비']);
    const SH  = N(p.sh ?? p.SH ?? p['희생번트'] ?? p['희번']);
    // PA 없으면 계산(일반식)
    const PAi = N(p.pa ?? p.PA ?? p.타석);
    const PA  = PAi > 0 ? PAi : (AB + BB + HBP + SF + SH);

    const _1B = Math.max(0, H - _2B - _3B - HR);
    const TB  = _1B + 2*_2B + 3*_3B + 4*HR;

    const AVG = div(H, AB);
    const OBP = div(H + BB + HBP, AB + BB + HBP + SF);
    const SLG = div(TB, AB);
    const OPS = OBP + SLG;

    const uBB = Math.max(0, BB - IBB);
    const wobaDen = (AB + BB - IBB + HBP + SF);
    const wobaNum = WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
    const wOBA = div(wobaNum, wobaDen);
    const ISO = (SLG-AVG);

    // 결과 숫자(정렬용)로 저장 — 렌더에서 .toFixed(3)
    p.pa   = PA;
    p.tb   = TB;
    p.avg  = r3(AVG);
    p.obp  = r3(OBP);
    p.slg  = r3(SLG);
    p.ops  = r3(OPS);
    p.woba = r3(wOBA);
    p.ISO = r3(ISO);

    // 정렬/표시에 쓰지 않는 기존 문자열 지표가 있더라도 덮어씀
    return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);

  // ---- 필드 정의 (BABIP 제거) ----
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
    {key:'ISO', label:'ISO'}
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
    {key:'er',     label:'자책점'}
  ];
  const floatBat = ['avg','obp','slg','ops','woba','ISO'];
  const floatPit = ['era'];

  // ---- 타입 토글 ----
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

  // ---- 연도 변경 ----
  yearSel.addEventListener('change', () => {
    filterOn = false;
    filterBtn.textContent = '규정타석 기준';
    loadData(yearSel.value);
  });

  // ---- 규정타석 필터 (타격·통산만) ----
  filterBtn.addEventListener('click', () => {
    filterOn = !filterOn;
    filterBtn.textContent = filterOn ? '전체 보기' : '규정타석 기준';
    loadData(yearSel.value);
  });

  // ---- 테이블 렌더 ----
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

  // ---- 정렬 + 렌더 ----
  function sortAndRender(records) {
    let rows = records.slice();

    if (currentType==='bat') {
      rows = rows.filter(r => Number(r.pa) >= 1);
      if (filterOn && yearSel.value==='career') {
        rows = rows.filter(r => Number(r.pa) >= 40);
      }
    }

    rows.sort((a, b) => {
      let va = a[currentSort.key], vb = b[currentSort.key];
      const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key))
                   || (currentType==='pit' && floatPit.includes(currentSort.key));
      if (isFloat) { va = Number(va); vb = Number(vb); }
      if (va < vb) return currentSort.asc ? -1 : 1;
      if (va > vb) return currentSort.asc ? 1 : -1;
      return 0;
    });

    tbody.innerHTML = '';
    const fields = (currentType==='bat') ? batFields : pitFields;
    const floatF = (currentType==='bat') ? floatBat : floatPit;

    rows.forEach(r => {
      const tr = document.createElement('tr');
      fields.forEach(f => {
        const td = document.createElement('td');
        let v = (r[f.key] != null ? r[f.key] : '');
        td.textContent = floatF.includes(f.key)
          ? Number(v).toFixed(3)
          : v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ---- 데이터 로드 (+타격 자동 계산) ----
  function loadData(year) {
    let file;
    if (currentType==='bat') {
      file = (year==='career') ? 'records_career.json' : `records_${year}.json`;
    } else {
      file = (year==='career') ? 'pitching_career.json' : `pitching_${year}.json`;
    }

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        // 배열 or {players:[...]} 둘 다 지원
        let arr = Array.isArray(data) ? data : (data.players || data.batters || data.records || []);
        if (currentType==='bat') {
          arr = applyDerivedAll(arr);     // ← 파생 지표 자동 계산
        }
        renderTable(arr);
      })
      .catch(err => {
        console.error('로드 오류:', err);
        tbody.innerHTML = `<tr><td colspan="${(currentType==='bat'?batFields.length:pitFields.length)}">데이터를 불러오는 데 실패했습니다.</td></tr>`;
      });
  }

  // 초기 로드
  loadData(yearSel.value);
});