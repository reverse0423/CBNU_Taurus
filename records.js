// records.js — FINAL
// - 리더보드 규정타석: 연간 팀 '승/패' 경기수 × 1.5 (자동)
//   * 취소/연기/무 등은 제외합니다 (승/패만 집계)
// - career(통산)도 리더보드 표시 (규정타석 40 고정)
// - CSV 제거 / 리더보드 가로 스크롤과 분리 고정 / 이름 자동완성(시작 일치)
// - 파생지표 자동계산: AVG/OBP/SLG/OPS/wOBA/ISO

document.addEventListener('DOMContentLoaded', () => {
  const btnBat    = document.getElementById('btn-batting');
  const btnPit    = document.getElementById('btn-pitching');
  const yearSel   = document.getElementById('yearSelect');
  const filterBtn = document.getElementById('filterBtn');
  const theadRow  = document.getElementById('theadRow');
  const tbody     = document.getElementById('tbodyRows');

  // 상태
  let currentType = 'bat';    // 'bat' | 'pit'
  let filterOn    = false;    // 규정타석(통산)
  let currentSort = { key:'pa', asc:false };
  let searchTerm  = '';       // 이름 검색(시작 일치)
  let lastRows    = [];       // 현재 데이터(정렬/검색 전 원본)
  let minPAForLeaders = 0;    // 리더보드용 규정타석 (연도별 동적 / career=40)
  let scheduleCache = null;   // schedule.json 캐시

  // ── 파생지표 계산 유틸 ─────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3  = x => Math.round(x * 1000) / 1000;
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  function applyDerived(p) {
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
    const PAi = N(p.pa ?? p.PA ?? p.타석);
    const PA  = PAi > 0 ? PAi : (AB + BB + HBP + SF + SH);

    const _1B = Math.max(0, H - _2B - _3B - HR);
    const TB  = _1B + 2*_2B + 3*_3B + 4*HR;

    const AVG = div(H, AB);
    const OBP = div(H + BB + HBP, AB + BB + HBP + SF);
    const SLG = div(TB, AB);
    const OPS = OBP + SLG;

    const uBB = Math.max(0, BB - IBB);
    const wDen= (AB + BB - IBB + HBP + SF);
    const wNum= WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
    const wOBA= div(wNum, wDen);

    p.pa   = PA;
    p.tb   = TB;
    p.avg  = r3(AVG);
    p.obp  = r3(OBP);
    p.slg  = r3(SLG);
    p.ops  = r3(OPS);
    p.woba = r3(wOBA);
    p.iso  = r3(SLG - AVG); // ISO
    return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);

  // ── 필드 정의 (BABIP 제거) ─────────────────────────────────────
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
    {key:'iso',  label:'ISO'},
    {key:'woba', label:'wOBA'}
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
  const floatBat = ['avg','obp','slg','ops','woba','iso'];
  const floatPit = ['era'];

  // ── 상단 UI(검색·리더보드 자리 확보) ──────────────────────────
  injectStyle();
  ensureTopUI();

  const searchBox  = document.getElementById('searchBox');
  const suggestBox = document.getElementById('suggestBox');

  // 타입 토글
  btnBat.addEventListener('click', () => {
    currentType = 'bat';
    btnBat.classList.add('active');
    btnPit.classList.remove('active');
    filterBtn.style.display = (yearSel.value==='career') ? 'inline-block' : 'none';
    currentSort = { key:'pa', asc:false };
    syncURL();
    loadData(yearSel.value);
  });
  btnPit.addEventListener('click', () => {
    currentType = 'pit';
    btnPit.classList.add('active');
    btnBat.classList.remove('active');
    filterBtn.style.display = 'none';
    currentSort = { key:'games', asc:false };
    syncURL();
    loadData(yearSel.value);
  });

  // 연도 변경
  yearSel.addEventListener('change', () => {
    filterOn = false;
    filterBtn.textContent = '규정타석 기준';
    syncURL();
    loadData(yearSel.value);
  });

  // 규정타석 필터 (타격·통산만)
  filterBtn.addEventListener('click', () => {
    filterOn = !filterOn;
    filterBtn.textContent = filterOn ? '전체 보기' : '규정타석 기준';
    syncURL();
    sortAndRender(lastRows);
  });

  // 검색 입력(시작 일치 + 자동완성)
  searchBox.addEventListener('input', () => {
    searchTerm = (searchBox.value || '').trim();
    updateSuggest();
    syncURL();
    sortAndRender(lastRows);
  });
  searchBox.addEventListener('focus', updateSuggest);
  searchBox.addEventListener('blur', () => setTimeout(hideSuggest, 150));
  searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { hideSuggest(); sortAndRender(lastRows); }
  });

  // 테이블 렌더
  function renderTable(records) {
    const fields = (currentType==='bat') ? batFields : pitFields;

    // 헤더
    theadRow.innerHTML = '';
    fields.forEach(f => {
      const th = document.createElement('th');
      th.textContent = f.label;
      th.style.cursor = 'pointer';
      th.dataset.key = f.key;
      th.addEventListener('click', () => {
        if (currentSort.key === f.key) currentSort.asc = !currentSort.asc;
        else { currentSort.key = f.key; currentSort.asc = true; }
        syncURL();
        sortAndRender(records);
      });
      theadRow.appendChild(th);
    });

    // 본문
    sortAndRender(records);
  }

  // 정렬 + 검색 + 필터 + 렌더
  function sortAndRender(records) {
    lastRows = records.slice();

    let rows = records.slice();

    // 검색: 시작 일치(이름/등번호)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        String(r.name || '').toLowerCase().startsWith(q) ||
        String(r.number || '').toLowerCase().startsWith(q)
      );
    }

    if (currentType==='bat') {
      rows = rows.filter(r => Number(r.pa) >= 1);
      if (filterOn && yearSel.value==='career') rows = rows.filter(r => Number(r.pa) >= 40);
    }

    // 정렬
    const isFloat = (currentType==='bat' && floatBat.includes(currentSort.key))
                 || (currentType==='pit' && floatPit.includes(currentSort.key));
    rows.sort((a, b) => {
      let va = a[currentSort.key], vb = b[currentSort.key];
      if (isFloat) { va = Number(va); vb = Number(vb); }
      if (va < vb) return currentSort.asc ? -1 : 1;
      if (va > vb) return currentSort.asc ? 1 : -1;
      return String(a.name||'').localeCompare(String(b.name||''));
    });

    // 렌더
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

    // 리더보드(타격만) — 연도/통산 모두 표시
    const leaders = document.getElementById('leaders');
    if (leaders) {
      if (currentType === 'bat' && rows.length) {
        leaders.innerHTML = buildLeadersHTML(rows, minPAForLeaders);
      } else {
        leaders.innerHTML = '';
      }
      ensureLeadersPlacement(); // 스크롤 컨테이너 밖으로 이동(고정)
    }

    // 자동완성 갱신
    updateSuggest();
  }

  // ── 리그/시즌 규정타석 계산(동적) ─────────────────────────────
  function fetchSchedule(){
    if (scheduleCache) return Promise.resolve(scheduleCache);
    return fetch('schedule.json')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => (scheduleCache = data))
      .catch(() => (scheduleCache = {}));
  }

  // 중요: '승' 또는 '패'로 끝난 경기만 카운트 (취소/연기/무 등 제외)
  function countPlayedGames(scheduleData, year){
    try{
      const arr = scheduleData && scheduleData[year] ? scheduleData[year] : [];
      let cnt = 0;
      for (let i=0;i<arr.length;i++){
        const g = arr[i] || {};
        const res = String(g.result || '').trim();
        // '승' 또는 '패'로 시작하는 표기만 인정 (예: '승', '패', '승(연장)' 등)
        if (/^(승|패)/.test(res)) cnt++;
      }
      return cnt;
    }catch(e){ return 0; }
  }

  function getMinPAForYear(year){
    if (year === 'career') return Promise.resolve(40);
    return fetchSchedule().then(sc => {
      const played = countPlayedGames(sc, year);
      const minPA = Math.max(0, Math.ceil(played * 1.2)); // 팀 '승/패' 경기수 × 1.2
      return minPA;
    }).catch(()=>20); // 실패 시 임시 20
  }

  // 리더보드 생성 (ISO/OPS/AVG/HR/H/RBI/R/SB)
  function topN(rows, key, n, isRate, minPA){
    const arr = rows.slice().filter(r => !isRate || Number(r.pa) >= (minPA || 0));
    arr.sort((a,b)=> (+b[key]||0) - (+a[key]||0));
    return arr.slice(0, n);
  }
  function buildLeadersHTML(rows, minPA){
    const blocks = [
      { key:'iso',  label:'ISO',  rate:true },
      { key:'ops',  label:'OPS',  rate:true },
      { key:'avg',  label:'AVG',  rate:true },
      { key:'hr',   label:'HR' },
      { key:'hits', label:'H'  },
      { key:'RBI',  label:'RBI' },
      { key:'RUN',  label:'R' },
      { key:'sb',   label:'SB' }
    ];
    const chips = blocks.map(b => {
      const top = topN(rows, b.key, 3, b.rate, minPA);
      const items = top.map(t => `${t.name} <b>${Number(t[b.key]||0).toFixed(b.rate?3:0)}</b>`).join(' · ');
      return `<div class="mini-chip"><strong>${b.label}</strong> ${items}</div>`;
    }).join('');
    const note = `<div class="mini-note">규정타석: ${yearSel.value==='career' ? '40 고정' : `팀 '승/패' 경기수 × 1.2 = ${minPA}`}</div>`;
    return note + chips;
  }

  // 데이터 로드 (+타격 자동계산 & 리더보드 규정타석 설정)
  function loadData(year) {
    let file;
    if (currentType==='bat') {
      file = (year==='career') ? 'records_career.json' : `records_${year}.json`;
    } else {
      file = (year==='career') ? 'pitching_career.json' : `pitching_${year}.json`;
    }

    // 규정타석(리더보드용) 먼저 계산
    const minPAp = getMinPAForYear(year).then(v => { minPAForLeaders = v; });

    fetch(file)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        let arr = Array.isArray(data) ? data : (data.players || data.batters || data.records || []);
        if (currentType==='bat') {
          arr = applyDerivedAll(arr);
        }
        return minPAp.then(() => renderTable(arr));
      })
      .catch(err => {
        console.error('로드 오류:', err);
        tbody.innerHTML = `<tr><td colspan="${(currentType==='bat'?batFields.length:pitFields.length)}">데이터를 불러오는 데 실패했습니다.</td></tr>`;
        const leaders = document.getElementById('leaders'); if (leaders) leaders.innerHTML='';
      });
  }

  // ── 리더보드 위치: 가로 스크롤 컨테이너 밖으로 이동(고정) ───────
  function ensureLeadersPlacement() {
    const leaders = document.getElementById('leaders');
    if (!leaders) return;
    const table = theadRow ? theadRow.closest('table') : null;
    const scrollWrap = findHorizontalScroller(table || theadRow);
    const targetParent = scrollWrap ? scrollWrap.parentNode : (table ? table.parentNode : leaders.parentNode);
    if (leaders.parentNode !== targetParent) {
      targetParent.insertBefore(leaders, scrollWrap || table);
    }
  }
  function findHorizontalScroller(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      const cs = window.getComputedStyle(cur);
      const ox = cs.overflowX;
      if (ox === 'auto' || ox === 'scroll') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  // ── 자동완성 드롭다운 ──────────────────────────────────────────
  function updateSuggest() {
    const box = suggestBox;
    if (!box) return;
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) { hideSuggest(); return; }

    const names = Array.from(new Set(lastRows.map(r => String(r.name||'')))).filter(Boolean);
    const list = names.filter(n => n.toLowerCase().startsWith(q)).slice(0, 8);

    if (!list.length) { hideSuggest(); return; }

    box.innerHTML = '';
    list.forEach(name => {
      const item = document.createElement('div');
      item.className = 'suggest-item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        searchBox.value = name;
        searchTerm = name;
        hideSuggest();
        syncURL();
        sortAndRender(lastRows);
      });
      box.appendChild(item);
    });
    box.style.display = 'block';
  }
  function hideSuggest(){ if (suggestBox) suggestBox.style.display = 'none'; }

  // ── 딥링크 복원/동기화 ────────────────────────────────────────
  function restoreFromURL() {
    const qs = new URLSearchParams(location.search);
    const type = qs.get('type');        // bat | pit
    const year = qs.get('year');        // 2025 | career
    const sort = qs.get('sort');        // 필드키
    const desc = qs.get('desc');        // '1'이면 내림차순
    const filt = qs.get('f');           // '1' 규정타석
    const q    = qs.get('q');           // 검색어

    if (type === 'pit') { currentType='pit'; btnPit.classList.add('active'); btnBat.classList.remove('active'); filterBtn.style.display='none'; currentSort={key:'games',asc:false}; }
    if (year && Array.from(yearSel.options).some(o => o.value===year)) yearSel.value=year;
    if (sort) currentSort.key = sort;
    if (desc==='1') currentSort.asc = false; else if (desc==='0') currentSort.asc = true;
    if (type==='bat' && yearSel.value==='career' && filt==='1') { filterOn=true; filterBtn.textContent='전체 보기'; }
    if (q) { searchTerm = q; if (searchBox) searchBox.value = q; }
  }
  function syncURL() {
    const qs = new URLSearchParams();
    qs.set('type', currentType);
    qs.set('year', yearSel.value);
    qs.set('sort', currentSort.key);
    qs.set('desc', currentSort.asc ? '0':'1');
    if (currentType==='bat' && yearSel.value==='career' && filterOn) qs.set('f','1');
    if (searchTerm) qs.set('q', searchTerm);
    history.replaceState(null, '', location.pathname + '?' + qs.toString());
  }

  // ── 유틸: 스타일/상단 UI 생성 ────────────────────────────────
  function injectStyle(){
    if (document.getElementById('records-style')) return;
    const css =
      /* 리더보드(가로 스크롤과 분리, 한 줄 카드들) */
      '#leaders{margin:10px 0 6px 0; position:relative; z-index:5}' +
      '#leaders .mini-chip{padding:6px 8px;border:1px solid #eee;border-radius:8px;display:inline-block;margin:4px 6px;background:#fff;white-space:nowrap;font-size:13px}' +
      '#leaders .mini-note{display:block;margin:0 6px 6px 6px;color:#6b7280;font-size:12px}' +
      /* 검색창 & 자동완성 */
      '#searchWrap{display:inline-block; position:relative; margin-left:8px}' +
      '#searchBox{padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;min-width:140px}' +
      '#suggestBox{position:absolute;top:34px;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.06);display:none;max-height:220px;overflow:auto;z-index:50}' +
      '.suggest-item{padding:8px 10px;cursor:pointer}' +
      '.suggest-item:hover{background:#f3f4f6}';
    const st = document.createElement('style');
    st.id = 'records-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
  function ensureTopUI(){
    // 검색 입력 + 자동완성 박스
    if (!document.getElementById('searchWrap')) {
      const wrap = document.createElement('span');
      wrap.id = 'searchWrap';
      const input = document.createElement('input');
      input.id = 'searchBox';
      input.placeholder = '선수 검색(시작 일치)';
      const sugg = document.createElement('div');
      sugg.id = 'suggestBox';
      wrap.appendChild(input);
      wrap.appendChild(sugg);
      (filterBtn && filterBtn.parentNode ? filterBtn.parentNode : yearSel.parentNode).appendChild(wrap);
    }
    // 리더보드 영역: 테이블(혹은 스크롤 래퍼) 바깥에 위치
    if (!document.getElementById('leaders')) {
      const leaders = document.createElement('div');
      leaders.id = 'leaders';
      const table = theadRow && theadRow.parentNode && theadRow.parentNode.parentNode;
      const parent = (table && table.parentNode) || document.body;
      parent.insertBefore(leaders, table || parent.firstChild);
    }
  }

  // 초기: URL 복원 → 로드 → URL 동기화
  restoreFromURL();
  loadData(yearSel.value);
  syncURL();
});