// player.js — FINAL (자동 계산: AVG/OBP/SLG/OPS/wOBA/ISO, BABIP 제거)
// 프로필 페이지: 배팅 기여도만 반영

document.addEventListener('DOMContentLoaded', () => {
  const params    = new URLSearchParams(window.location.search);
  const playerId  = parseInt(params.get('id'), 10);
  if (isNaN(playerId)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // 요소
  const yearSelect = document.getElementById('year-select');
  const btnBat     = document.getElementById('btn-bat');
  const btnPit     = document.getElementById('btn-pit');
  const grid       = document.getElementById('stats-grid');
  const recordBox  = document.getElementById('record-box');
  const contribBox = document.getElementById('salary-box');

  let batData = [], pitData = [], currentMode = 'bat', playerName = '';

  // ── 파생지표 계산 유틸 ─────────────────────────────────────────
  const N   = v => (v == null || isNaN(+v) ? 0 : +v);
  const div = (n, d) => (d > 0 ? n / d : 0);
  const r3  = x => Math.round(x * 1000) / 1000;
  // wOBA 계수(필요시 조정)
  const WOBA = { uBB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };

  // 한 선수 객체에 파생치 채우기 (카운팅 스탯만 있어도 됨)
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

    const uBB  = Math.max(0, BB - IBB);
    const wDen = (AB + BB - IBB + HBP + SF);
    const wNum = WOBA.uBB*uBB + WOBA.HBP*HBP + WOBA['1B']*_1B + WOBA['2B']*_2B + WOBA['3B']*_3B + WOBA.HR*HR;
    const wOBA = div(wNum, wDen);

    p.pa   = PA;
    p.tb   = TB;
    p.avg  = r3(AVG);
    p.obp  = r3(OBP);
    p.slg  = r3(SLG);
    p.ops  = r3(OPS);
    p.woba = r3(wOBA);
    p.iso  = r3(SLG - AVG); // 정확
    return p;
  }
  const applyDerivedAll = arr => arr.map(applyDerived);

  // 선수 기본 정보 로드
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(players => {
      const p = players.find(x => x.id === playerId);
      if (!p) throw '선수 정보 없음';
      playerName = p.name;
      document.getElementById('number').innerText     = `#${p.id}`;
      document.getElementById('name').innerText       = p.name;
      document.getElementById('birth').innerText      = p.birth;
      document.getElementById('highschool').innerText = p.highschool;
      document.getElementById('major').innerText      = p.major || '-';
      document.getElementById('position').innerText   = p.position || '-';
      yearSelect.value = '2025';
      loadYear('2025');
    })
    .catch(() => {
      recordBox.innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  // 이벤트
  yearSelect.addEventListener('change', () => loadYear(yearSelect.value));
  btnBat.addEventListener('click', () => {
    currentMode = 'bat';
    btnBat.classList.add('active');
    btnPit.classList.remove('active');
    renderView();
  });
  btnPit.addEventListener('click', () => {
    currentMode = 'pit';
    btnPit.classList.add('active');
    btnBat.classList.remove('active');
    renderView();
  });

  // 연도별 데이터 로드
  function loadYear(year) {
    const bFile = year === 'total'
      ? 'records_career.json'
      : `records_${year}.json`;
    const pFile = year === 'total'
      ? 'pitching_career.json'
      : `pitching_${year}.json`;

    recordBox.innerHTML  = '<p style="text-align:center;">기록 로드 중...</p>';
    grid.style.display   = 'none';
    contribBox.innerHTML = '';

    Promise.all([
      fetch(bFile).then(r=>r.ok?r.json():Promise.reject()),
      fetch(pFile).then(r=>r.ok?r.json():Promise.reject()).catch(()=>[])
    ])
    .then(([bDataRaw, pDataRaw]) => {
      // 배열 / {players:[...]} / {batters:[...]} / {records:[...]} 지원 + 파생치 자동 계산
      const bArr = Array.isArray(bDataRaw) ? bDataRaw : (bDataRaw.players || bDataRaw.batters || bDataRaw.records || []);
      batData    = applyDerivedAll(bArr);

      const pArr = Array.isArray(pDataRaw) ? pDataRaw : (pDataRaw.players || pDataRaw.pitchers || pDataRaw.records || []);
      pitData    = pArr;

      // 투구 버튼은 존재하되, 기여도 계산은 배팅만
      const hasPit = pitData.some(r =>
        ((r.playerId ?? parseInt(r.number,10)) === playerId) || (r.name === playerName)
      );
      btnPit.style.display = hasPit ? 'inline-block' : 'none';
      currentMode = 'bat';
      btnBat.classList.add('active');
      btnPit.classList.remove('active');
      renderView();
    })
    .catch(() => {
      recordBox.innerHTML = '<p style="text-align:center;">기록 로드 실패</p>';
    });
  }

  function renderView() {
    if (currentMode === 'bat') showBatting();
    else showPitching();
  }

  // 배팅 기록 표시(파생치 자동 반영)
  function showBatting() {
    const rec = batData.find(r =>
      (r.playerId ?? parseInt(r.number,10)) === playerId
    ) || batData.find(r => r.name === playerName);

    if (!rec) {
      recordBox.innerHTML = '<p style="text-align:center;">타격 기록이 없습니다.</p>';
      grid.style.display  = 'none';
    } else {
      // 그리드(HTML에 있는 항목만 채움)
      ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops']
      .forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        let v = rec[key] != null ? rec[key] : '-';
        if (v !== '-' && ['avg','obp','slg','ops'].includes(key)) {
          v = Number(v).toFixed(3);
        }
        el.innerText = v;
      });
      grid.style.display = 'grid';

      // 상세(레이트는 3자리 고정) — BABIP 제거
      recordBox.innerHTML = '';
      [
        ['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],
        ['3루타','triple'],['홈런','hr'],['4구','bb'],['사구','hbp'],
        ['타점','RBI'],['득점','RUN'],['도루','sb'],
        ['출루율','obp'],['장타율','slg'],['OPS','ops'],['wOBA','woba']
      ].forEach(([lab,k])=>{
        const d = document.createElement('div');
        const raw = rec[k];
        const isRate = ['woba','slg','obp','ops','avg'].includes(k);
        const txt = raw != null
          ? (isRate ? Number(raw).toFixed(3) : raw.toString())
          : '0';
        d.innerHTML = `<strong>${lab}:</strong> ${txt}`;
        recordBox.appendChild(d);
      });
    }
    computeContrib();
  }

  // 투구 기록 표시 (UI 용 – 기여도에는 반영 안 함)
  function showPitching() {
    const rec = pitData.find(r =>
      (r.playerId ?? parseInt(r.number,10)) === playerId
    ) || pitData.find(r => r.name === playerName);

    if (!rec) {
      recordBox.innerHTML = '<p style="text-align:center;">투구 기록이 없습니다.</p>';
    } else {
      recordBox.innerHTML = '';
      [['등판 경기 수','games'],['이닝','innings'],['방어율','era'],
       ['승','wins'],['패','losses'],['홀드','holds'],['세이브','saves'],
       ['탈삼진','so'],['볼넷','bb'],['사구','hbp'],
       ['실점','runs'],['자책점','er']]
      .forEach(([lab,k])=>{
        const d = document.createElement('div');
        d.innerHTML = `<strong>${lab}:</strong> ${(rec[k]!=null?rec[k]:0).toString()}`;
        recordBox.appendChild(d);
      });
    }
    // 투구 기여도 제외 → 배팅만으로 계산
    computeContrib();
  }

  // 배팅 기여도만 계산
  function computeContrib() {
    const cb = r => {
      const avg = +r.avg||0,
            woba= +r.woba||0,
            slg = +r.slg||0,
            ops = +r.ops||0,
            hr  = +r.hr||0,
            sb  = +r.sb||0,
            RBI = +r.RBI||0;
      return 30*ops + 25*woba + 20*slg + 15*avg + 5*hr + 2*sb + 3*RBI;
    };

    // 배팅만
    const map = new Map();
    batData.forEach(r => {
      const pid = r.playerId ?? parseInt(r.number,10) ?? r.id;
      if (!pid) return;
      map.set(pid, (map.get(pid)||0) + cb(r));
    });

    const total = map.get(playerId) || 0;
    const sorted = Array.from(map.values())
      .filter(v => v !== 0)
      .sort((a,b) => b - a);
    const rank = sorted.indexOf(total) + 1;

    contribBox.innerHTML =
      `팀 승리 기여도: ${total.toFixed(2)}` +
      (rank > 0 ? `<br>(팀 내 ${rank}위)` : '');
  }
});