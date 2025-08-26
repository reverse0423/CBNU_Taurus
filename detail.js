// detail.js — FINAL (same folder detail.json; detailId ONLY; headers black)
(function () {
  const $ = (s) => document.querySelector(s);

  // 1) 주소에서 detailId 읽기
  const qs = new URLSearchParams(location.search);
  const detailId = (qs.get('detailId') || '').trim();
  if (!detailId) {
    alert('detailId가 없습니다. 예: detail.html?detailId=2025-18');
    throw new Error('missing detailId');
  }

  // "2025-1"과 "2025-01" 동일 취급
  const sameId = (a, b) => {
    if (!a || !b) return false;
    const A = String(a).split('-'), B = String(b).split('-');
    if (A[0] !== B[0]) return false;                 // 연도 비교
    if (+A[1] !== +B[1]) return false;               // 월/번호 비교(숫자)
    if (A.length >= 3 || B.length >= 3) return (+A[2]||0) === (+B[2]||0); // 일/서브 넘버
    return true;
  };

  // 2) 표 스타일 주입 (헤더/캡션 글씨 검정)
  (function injectStyle() {
    if (document.getElementById('tau-style')) return;
    const css = `
      .tau-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0;}
      .tau-table{border-collapse:separate;border-spacing:0;width:100%;min-width:760px;font-size:14px;line-height:1.45;}
      .tau-table caption{
        caption-side:top;text-align:left;font-weight:700;margin:0 0 6px 0;font-size:15px;
        color:#111 !important; /* 캡션(표 제목) 검정 */
      }
      .tau-table th,.tau-table td{
        border:1px solid #e5e7eb;padding:10px 12px;background:#fff;white-space:nowrap;
        color:#111; /* 표 기본 글자색 검정 */
      }
      .tau-table thead th{
        position:sticky;top:0;background:#f3f4f6;font-weight:700;z-index:2;
        color:#111 !important; /* 헤더(상단바) 글자색 검정 */
      }
      .tau-table th.first,.tau-table td.first{text-align:left;font-weight:600}
      .tau-table th.num,.tau-table td.num{text-align:center}
      .tau-table tr:nth-child(even) td{background:#fafafa}
      .tau-scoreboard .teamcol{width:190px}
      .tau-scoreboard .inningcol{width:56px}
      .empty{padding:10px 0;color:#6b7280}
      .player .name{font-weight:600}
      .player .sub{font-size:12px;color:#6b7280}
    `;
    const st = document.createElement('style');
    st.id = 'tau-style';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // 3) detail.json 로드(같은 폴더)
  const DATA_URL = './detail.json';
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  // 4) detail.json에서 경기 찾기 (루트맵 / games 배열 지원)
  function looksLikeGame(o) {
    return o && typeof o === 'object' && (o.teams || o.innings || o.batting || o.pitching || o.plays);
  }
  function findGame(db) {
    // A) 루트 맵: { "2025-18": {...} }
    for (const k of Object.keys(db)) {
      if (['games','gamesById','detailsById','byId'].includes(k)) continue;
      if (/^\d{4}$/.test(k)) continue; // 연도 버킷은 여기서 제외
      if (sameId(k, detailId) && looksLikeGame(db[k])) return db[k];
    }
    // B) byId 형태 (있을 때만)
    for (const by of ['gamesById','detailsById','byId']) {
      const bag = db[by];
      if (bag && typeof bag === 'object') {
        for (const k of Object.keys(bag)) {
          if (sameId(k, detailId) && looksLikeGame(bag[k])) return bag[k];
        }
      }
    }
    // C) 배열: { games:[{ detailId:"2025-18", ...}] }
    if (Array.isArray(db.games)) {
      const g = db.games.find(x => sameId(x?.detailId || x?.id || x?.gameId, detailId));
      if (g && looksLikeGame(g)) return g;
    }
    return null;
  }

  // 5) 테이블 유틸/렌더러
  const safe = (v, d='-') => (v === 0 || !!v ? v : d);
  const fmt  = (n, d=2) => (n==null || Number.isNaN(+n) ? '-' : (+n).toFixed(d));
  const wrap = (html) => `<div class="tau-wrap">${html}</div>`;

  function table({ caption, heads, rows, scoreboard=false }) {
    const thead = `<thead><tr>${
      heads.map((t,i)=>`<th class="${i===0?'first':'num'} ${scoreboard && i===0 ? 'teamcol':''} ${scoreboard && i>0 ? 'inningcol':''}">${t}</th>`).join('')
    }</tr></thead>`;
    const tbody = `<tbody>${
      rows.map(r=>`<tr>${
        r.map((c,i)=>`<td class="${i===0?'first':'num'}">${c}</td>`).join('')
      }</tr>`).join('')
    }</tbody>`;
    return wrap(`<table class="tau-table ${scoreboard?'tau-scoreboard':''}"><caption>${caption}</caption>${thead}${tbody}</table>`);
  }

  function renderScoreboard(teams={}, innings=[]) {
    if (!Array.isArray(innings) || innings.length === 0) return `<div class="empty">이닝 정보가 없습니다.</div>`;
    const maxInning = Math.max(...innings.map(i => +i.inning || 0), 7);
    const heads = ['팀', ...Array.from({ length: maxInning }, (_,i)=>`${i+1}회`), 'R'];

    let hr=0, ar=0;
    const awayRow = [teams?.away?.abbr || teams?.away?.name || 'AWAY'];
    const homeRow = [teams?.home?.abbr || teams?.home?.name || 'HOME'];
    for (let i=1;i<=maxInning;i++) {
      const fr = innings.find(x => +x.inning === i) || {};
      const a = fr.away ?? '', h = fr.home ?? '';
      awayRow.push(a === '' ? '' : (+a || a));
      homeRow.push(h === '' ? '' : (+h || h));
      ar += +a||0; hr += +h||0;
    }
    awayRow.push(ar); homeRow.push(hr);

    return table({ caption:'스코어보드', heads, rows:[awayRow, homeRow], scoreboard:true });
  }

  function renderBatting(side, list=[]) {
    if (!Array.isArray(list) || list.length === 0) return `<div class="empty">타격 기록이 없습니다.</div>`;
    const heads = ['타순','선수명','타수','득점','안타','2B','3B','HR','타점','4사구','삼진','도루'];
    const rows = list.map((p,idx)=>{
      const fourBB = (+p.bb||0) + (+p.hbp||0);
      const name = `<div class="player"><div class="name">${safe(p.name)}</div><div class="sub">${[p.pos,p.role].filter(Boolean).join(' · ')}</div></div>`;
      return [ safe(p.bo, idx+1), name, safe(p.ab,0), safe(p.r,0), safe(p.hits,0),
               safe(p.double,0), safe(p.triple,0), safe(p.hr,0),
               safe(p.rbi,0), fourBB, safe(p.so,0), safe(p.sb,0) ];
    });
    return table({ caption:`타자 (${side})`, heads, rows });
  }

  function ipToOuts(ip){ if(ip==null) return null; const [i,f='0']=String(ip).split('.'); const I=+i,F=+f; if(Number.isNaN(I)||![0,1,2].includes(F)) return null; return I*3+F; }
  function era7(er,ip){ const o=ipToOuts(ip); if(o==null) return null; const inn=o/3; return inn>0 ? (7*(+er||0))/inn : null; }

  function renderPitching(side, list=[]) {
    if (!Array.isArray(list) || list.length === 0) return `<div class="empty">투구 기록이 없습니다.</div>`;
    const heads = ['투수','IP','BF','H','R','ER','BB','HBP','SO','HR','ERA(7)'];
    const rows = list.map(p=>{
      const name = `<div class="player"><div class="name">${safe(p.name)}</div><div class="sub">${safe(p.pos,'투수')}</div></div>`;
      return [ name, safe(p.ip,'-'), safe(p.bf,0), safe(p.h,0), safe(p.r,0), safe(p.er,0),
               safe(p.bb,0), safe(p.hbp,0), safe(p.so,0), safe(p.hr,0), fmt(era7(p.er,p.ip),2) ];
    });
    return table({ caption:`투수 (${side})`, heads, rows });
  }

  function renderPlays(list=[]) {
    if (!Array.isArray(list) || list.length === 0) return `<div class="empty">플레이 로그가 없습니다.</div>`;
    const heads = ['이닝','공/수','No','내용'];
    const halfTxt = (h)=> h==='top' ? '초' : '말';
    const rows = list.map(p=>[ safe(p.inning), halfTxt(p.half), safe(p.no,''), safe(p.desc,'') ]);
    return table({ caption:'플레이 로그', heads, rows });
  }

  // 6) 실행
  (async () => {
    try {
      const db = await getJSON(DATA_URL);
      const game = findGame(db);
      if (!game) throw new Error(`'${detailId}' 상세를 detail.json에서 찾지 못했습니다.`);

      const away = game?.teams?.away, home = game?.teams?.home;
      $('#title')  && ($('#title').textContent  = `${away?.abbr||away?.name||'AWAY'} @ ${home?.abbr||home?.name||'HOME'}`);
      $('#date')   && ($('#date').textContent   = game.date || '');
      $('#venue')  && ($('#venue').textContent  = game.venue || '');
      $('#status') && ($('#status').textContent = game.status || '');

      $('#scoreboard')    && ($('#scoreboard').innerHTML    = renderScoreboard(game.teams, game.innings || []));
      $('#batting-home')  && ($('#batting-home').innerHTML  = renderBatting('홈',    game.batting?.home || []));
      $('#batting-away')  && ($('#batting-away').innerHTML  = renderBatting('원정',  game.batting?.away || []));
      $('#pitching-home') && ($('#pitching-home').innerHTML = renderPitching('홈',   game.pitching?.home || []));
      $('#pitching-away') && ($('#pitching-away').innerHTML = renderPitching('원정', game.pitching?.away || []));
      $('#plays')         && ($('#plays').innerHTML         = renderPlays(game.plays || []));
    } catch (err) {
      console.error(err);
      const main = document.querySelector('main') || document.body;
      main.innerHTML = `<div class="tau-wrap"><div class="empty">기록을 불러오지 못했습니다.<br>${err.message}</div></div>`;
    }
  })();
})();