// player.js

document.addEventListener('DOMContentLoaded', () => {
  const params     = new URLSearchParams(window.location.search);
  const playerId   = parseInt(params.get('id'), 10);
  if (isNaN(playerId)) {
    document.body.innerHTML = '<p style="text-align:center;">유효한 선수 ID가 없습니다.</p>';
    return;
  }

  // Elements
  const yearSelect = document.getElementById('year-select');
  const btnBat     = document.getElementById('btn-bat');
  const btnPit     = document.getElementById('btn-pit');
  const grid       = document.getElementById('stats-grid');
  const recordBox  = document.getElementById('record-box');
  const contribBox = document.getElementById('salary-box');

  let batData = [], pitData = [], currentMode = 'bat';

  // Load basic profile
  fetch('players.json')
    .then(r => r.ok ? r.json() : Promise.reject('players.json 실패'))
    .then(players => {
      const p = players.find(x => x.id === playerId);
      if (!p) throw '선수 정보 없음';
      document.getElementById('number').innerText     = `#${p.id}`;
      document.getElementById('name').innerText       = p.name;
      document.getElementById('birth').innerText      = p.birth;
      document.getElementById('highschool').innerText = p.highschool;
      document.getElementById('major').innerText      = p.major || '-';
      document.getElementById('position').innerText   = p.position || '-';
      // initialize
      yearSelect.value = '2025';
      loadYear('2025');
    })
    .catch(err => {
      console.error(err);
      recordBox.innerHTML = '<p style="text-align:center;">프로필 로드 실패</p>';
    });

  // Events
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

  function loadYear(year) {
    const bFile = year === 'total'
      ? 'records_career.json' : `records_${year}.json`;
    const pFile = year === 'total'
      ? 'pitching_career.json' : `pitching_${year}.json`;

    recordBox.innerHTML    = '<p style="text-align:center;">기록을 불러오는 중...</p>';
    grid.style.display     = 'none';
    contribBox.innerHTML   = '';

    Promise.all([
      fetch(bFile).then(r=>r.ok?r.json():Promise.reject()),
      fetch(pFile).then(r=>r.ok?r.json():Promise.reject()).catch(() => [])
    ])
    .then(([bData, pData]) => {
      batData = bData;
      pitData = pData;
      // show/hide pitching toggle
      const hasPitch = pitData.some(r =>
        (r.playerId ?? parseInt(r.number,10)) === playerId
      );
      btnPit.style.display = hasPitch ? 'inline-block' : 'none';
      // reset to batting view
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

  function showBatting() {
    const rec = batData.find(r =>
      (r.playerId ?? parseInt(r.number,10)) === playerId
    );
    if (!rec) {
      recordBox.innerHTML = '<p style="text-align:center;">타격 기록이 없습니다.</p>';
      grid.style.display  = 'none';
    } else {
      // grid
      ['avg','ab','hits','double','triple','hr','bb','hbp','RBI','slg','obp','ops']
      .forEach(key => {
        const el = document.getElementById(key);
        let v = rec[key]!=null?rec[key]:'-';
        if (v!=='-' && ['avg','obp','slg','ops'].includes(key)) v = Number(v).toFixed(3);
        el.innerText = v;
      });
      grid.style.display = 'grid';

      // details
      recordBox.innerHTML = '';
      [['타석','pa'],['타수','ab'],['안타','hits'],['2루타','double'],
       ['3루타','triple'],['홈런','hr'],['4구','bb'],['사구','hbp'],
       ['타점','RBI'],['도루','sb'],['출루율','obp'],['장타율','slg'],
       ['OPS','ops'],['wOBA','woba'],['BABIP','babip']]
      .forEach(([lab,k])=>{
        const d = document.createElement('div');
        const raw = rec[k];
        d.innerHTML = `<strong>${lab}:</strong> ${
          raw!=null
            ? (['woba','slg','obp','ops','avg'].includes(k)
               ? Number(raw).toFixed(3)
               : raw.toString())
            : '0'
        }`;
        recordBox.appendChild(d);
      });
    }
    computeContrib();
  }

  function showPitching() {
    const rec = pitData.find(r =>
      (r.playerId ?? parseInt(r.number,10)) === playerId
    );
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
        d.innerHTML = `<strong>${lab}:</strong> ${(
          rec[k]!=null?rec[k]:0
        ).toString()}`;
        recordBox.appendChild(d);
      });
    }
    computeContrib();
  }

  function computeContrib() {
    const cb = rec => {
      const avg = parseFloat(rec.avg)||0, woba=parseFloat(rec.woba)||0,
            slg = parseFloat(rec.slg)||0, ops=parseFloat(rec.ops)||0,
            hr  = parseInt(rec.hr)||0, sb=parseInt(rec.sb)||0,
            RBI = parseInt(rec.RBI)||0;
      return 30*ops+25*woba+20*slg+15*avg+5*hr+2*sb+3*RBI;
    };
    const cp = rec => {
      const w=parseInt(rec.wins)||0,h=parseInt(rec.holds)||0,
            s=parseInt(rec.saves)||0, so=parseInt(rec.so)||0,
            l=parseInt(rec.losses)||0, run=parseInt(rec.runs)||0,
            bb=parseInt(rec.bb)||0, hp=parseInt(rec.hbp)||0;
      return (w*5+h*3+s*4+so)-(l*5+run*2+bb+hp);
    };
    const map = new Map();
    batData.forEach(r=>{
      const pid = r.playerId ?? parseInt(r.number,10);
      map.set(pid,(map.get(pid)||0)+cb(r));
    });
    pitData.forEach(r=>{
      const pid = r.playerId ?? parseInt(r.number,10);
      map.set(pid,(map.get(pid)||0)+cp(r));
    });
    const total = map.get(playerId)||0;
    const sorted = Array.from(map.values()).filter(v=>v!==0).sort((a,b)=>b-a);
    const rank = sorted.indexOf(total)+1;
    contribBox.innerHTML =
      `팀 승리 기여도: ${total.toFixed(2)}` +
      (rank>0? `<br>(팀 내 ${rank}위)` : '');
  }
});
