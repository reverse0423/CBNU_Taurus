// detail.js — FINAL (Sticky cols fix + Column order + Comment fix)
(function () {
  function $(s){ return document.querySelector(s); }
  var qs = new URLSearchParams(location.search);
  var detailId = (qs.get('detailId') || '').trim();
  if (!detailId) {
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.html')) {
        const potentialId = lastPart.replace('.html', '');
        if (/^\d{4}-\d+/.test(potentialId)) { detailId = potentialId; }
    }
    if (!detailId) { alert('URL에 detailId가 없습니다.'); throw new Error('missing detailId'); }
  }
  function sameId(a, b){ return String(a || '').trim() === String(b || '').trim(); }

  (function injectStyle(){
    if (document.getElementById('tau-detail-style')) return;
    var css =
      '.tau-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0;border:1px solid #e5e7eb; border-radius: 8px; background: #fff;}'+
      '.tau-table{border-collapse:separate;border-spacing:0;width:100%;min-width:700px;font-size:14px;line-height:1.45;}'+
      '.tau-table caption{caption-side:top;text-align:left;font-weight:700;margin:10px 12px 6px;font-size:16px;color:#111 !important;}'+
      '.tau-table th,.tau-table td{border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:10px 12px;background:#fff;white-space:nowrap;color:#111;text-align:center;}'+
      '.tau-table th:first-child, .tau-table td:first-child { border-left: none; }' +
      '.tau-table th:last-child, .tau-table td:last-child { border-right: none; }' +
      '.tau-table thead tr:first-child th { border-top: none; }' +
      '.tau-table tbody tr:last-child td { border-bottom: none; }' +
      '.tau-table thead th{position:sticky;top:0;background:#f3f4f6;font-weight:700;z-index:10;color:#111 !important; border-top: 1px solid #e5e7eb; border-bottom-width: 2px;}'+
      '.tau-table th.left,.tau-table td.left{text-align:left;}'+
      '.tau-table tbody tr:nth-child(even) td{background:#fafafa}'+
      '.tau-table.sticky-cols th.col1,.tau-table.sticky-cols td.col1{position:sticky;left:0;z-index:8;min-width:52px;width:52px;text-align:center;}'+
      '.tau-table.sticky-cols th.col2,.tau-table.sticky-cols td.col2{position:sticky;left:52px;z-index:7;min-width:160px;width:160px;text-align:left;}'+
      '.tau-table.sticky-cols th.col1, .tau-table.sticky-cols td.col1, .tau-table.sticky-cols th.col2, .tau-table.sticky-cols td.col2 { background: var(--bg-white, #fff); border-right: 2px solid #ddd; }'+
      '.tau-table.sticky-cols thead th.col1, .tau-table.sticky-cols thead th.col2 { background: #f3f4f6; }'+
      '.tau-table.sticky-cols tbody tr:nth-child(even) td.col1, .tau-table.sticky-cols tbody tr:nth-child(even) td.col2 { background: #fafafa; }'+
      '.tau-table.sticky-cols thead th.col1{z-index:12;} .tau-table.sticky-cols thead th.col2{z-index:11;}'+
      '@media (max-width:480px){ .tau-table{min-width:600px;font-size:13px} .tau-table.sticky-cols th.col1,.tau-table.sticky-cols td.col1{min-width:44px;width:44px} .tau-table.sticky-cols th.col2,.tau-table.sticky-cols td.col2{min-width:140px;width:140px;left:44px} }'+
      '.tau-scoreboard{min-width:0 !important;table-layout:fixed;font-size:13px; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;}'+
      '.tau-scoreboard th,.tau-scoreboard td{padding:8px; border: none; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;}'+
      '.tau-scoreboard .teamcol{width:26%; text-align: left; font-weight: bold;} .tau-scoreboard .totalcol{font-weight: bold;}'+
      '.tau-feed{margin:16px 0} .tau-feed-group{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:10px;background:#fff}'+
      '.tau-feed-head{background:#f3f4f6;padding:10px 14px;font-weight:700;color:#111; font-size: 15px;}'+
      '.tau-feed-list{list-style:none;margin:0;padding:8px 14px} .tau-feed-list li{padding:8px 0;border-bottom:1px solid #f1f5f9; font-size: 14px; line-height: 1.5;} .tau-feed-list li:last-child{border-bottom:0}'+
      '.tau-feed-no{display:inline-block;min-width:22px;text-align:right;margin-right:8px;color:#6b7280; font-size: 13px; vertical-align: top;}'+
      '.row-sub td{background:#f0f4ff !important;color:#374151} .player .name{font-weight:600}.player .sub{font-size:12px;color:#6b7280; margin-top: 2px;} .empty{padding:16px; color:#777; text-align:center;}'+
      '.tau-bottom{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;padding:12px;z-index:40}'+
      '.tau-btn{flex:1;display:flex;align-items:center;justify-content:center;height:44px;border-radius:10px;border:1px solid #e5e7eb;background:#fafafa;color:#111;text-decoration:none; font-size: 14px;}'+
      '.tau-btn.primary{background:#7a003c;color:#fff;border-color:#7a003c; font-weight: bold;} button.tau-btn { cursor: pointer; }';
    var st=document.createElement('style'); st.id='tau-detail-style'; st.textContent=css; document.head.appendChild(st);
  })();

  var DATA_URL='./detail.json';
  function getJSON(url){ return fetch(url,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error(`HTTP ${r.status} (${r.statusText})`); return r.json(); }); }
  function findGame(db){
    if (!db) return null;
    if (db[detailId] && typeof db[detailId] === 'object' && db[detailId].teams) return db[detailId];
    var keys = Object.keys(db);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (sameId(k, detailId) && typeof db[k] === 'object' && db[k].teams) return db[k];
        if (typeof db[k] === 'object') { const nK = Object.keys(db[k] || {}); for (let j = 0; j < nK.length; j++) { if (sameId(nK[j], detailId) && typeof db[k][nK[j]] === 'object') return db[k][nK[j]]; } }
    }
    if (Array.isArray(db.games)) { for (let i = 0; i < db.games.length; i++) { const g = db.games[i]; if (sameId(g?.detailId || g?.id, detailId) && typeof g === 'object') return g; } }
    return null;
  }

  function safe(v, d){ return (v !== null && v !== undefined && v !== '') ? v : (d === undefined ? '-' : d); }
  function fmt(n, d){ return (n == null || isNaN(+n)) ? '-' : (+n).toFixed(d === undefined ? 2 : d); }
  function wrap(html){ return '<div class="tau-wrap">'+html+'</div>'; }
  function N(v) { return (v == null || isNaN(+v)) ? 0 : +v; }

  function table(opts){
    var caption = opts.caption || '', heads = opts.heads || [], rowsData = opts.rows || [], scoreboard = !!opts.scoreboard, stickyCols = !!opts.stickyCols;
    var cls = 'tau-table' + (scoreboard ? ' tau-scoreboard' : '') + (stickyCols ? ' sticky-cols' : '');
    var thead = '<thead><tr>' + heads.map(function(t, i){
      let headClass = ''; if (i === 0 && stickyCols) headClass = 'col1'; else if (i === 1 && stickyCols) headClass = 'col2 left'; else if (i === 0 && !stickyCols) headClass = 'left'; else headClass = 'num';
      return '<th class="' + headClass + '">' + t + '</th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + rowsData.map(function(r){
      var cells = Array.isArray(r) ? r : (r.cells || r._cells || []); var trc = (r && (r.isSub || r._sub)) ? 'row-sub' : '';
      return '<tr class="' + trc + '">' + cells.map(function(c, i){
        let tdClass = ''; if (i === 0 && stickyCols) tdClass = 'col1'; else if (i === 1 && stickyCols) tdClass = 'col2 left'; else if (i === 0 && !stickyCols) tdClass = 'left'; else tdClass = 'num';
        let cellContent = (typeof c === 'object' && c.html) ? c.html : safe(c);
        return '<td class="' + tdClass + '">' + cellContent + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return wrap('<table class="' + cls + '"><caption>' + caption + '</caption>' + thead + tbody + '</table>');
  }

  function renderScoreboard(teams, innings){
    teams = teams || {}; innings = Array.isArray(innings) ? innings : []; if (innings.length === 0) return '<div class="empty">스코어보드 정보가 없습니다.</div>';
    let maxInning = 7; innings.forEach(inn => { const iNum = parseInt(inn.inning, 10); if (!isNaN(iNum) && iNum > maxInning) maxInning = iNum; });
    var heads = ['팀']; for (let i = 1; i <= maxInning; i++) heads.push(i + ''); heads.push('R');
    var awayName = (teams.away?.abbr || teams.away?.name) || '원정', homeName = (teams.home?.abbr || teams.home?.name) || '홈';
    var awayRow = [awayName], homeRow = [homeName], ar = 0, hr = 0;
    for (let i = 1; i <= maxInning; i++) {
      let innData = innings.find(inn => parseInt(inn.inning, 10) === i);
      let aScore = innData?.away ?? '', hScore = innData?.home ?? '';
      awayRow.push(safe(aScore, '')); homeRow.push(safe(hScore, '')); ar += N(aScore); hr += N(hScore);
    }
    awayRow.push(ar); homeRow.push(hr);
    const finalHeads = heads.map((h, i) => i === 0 ? `<th class="teamcol">${h}</th>` : (i === heads.length - 1 ? `<th class="totalcol">${h}</th>` : `<th class="inningcol">${h}</th>`));
    const finalAwayRow = awayRow.map((c, i) => i === 0 ? `<td class="teamcol">${c}</td>` : (i === awayRow.length - 1 ? `<td class="totalcol">${c}</td>` : `<td class="inningcol">${c}</td>`));
    const finalHomeRow = homeRow.map((c, i) => i === 0 ? `<td class="teamcol">${c}</td>` : (i === homeRow.length - 1 ? `<td class="totalcol">${c}</td>` : `<td class="inningcol">${c}</td>`));
    return wrap(`<table class="tau-table tau-scoreboard"><caption>스코어보드</caption><thead><tr>${finalHeads.join('')}</tr></thead><tbody><tr>${finalAwayRow.join('')}</tr><tr>${finalHomeRow.join('')}</tr></tbody></table>`);
  }

  function renderBatting(side, list){
    list = Array.isArray(list) ? list : []; if (list.length === 0) return '<div class="empty">타격 기록이 없습니다.</div>';
    var heads = ['타순','선수','타석','타수','안타','2루타','3루타','홈런','타점','득점','4사구','도루','삼진'];
    var rows = list.map(function(p, idx){
      var bb = N(p?.bb), hbp = N(p?.hbp), fourBall = bb + hbp, runs = N(p?.r ?? p?.run);
      var role = p?.role || '', isSub = (role === '대타') || (role.toLowerCase() === 'ph') || !!(p?.pinch), pos = p?.pos || '', name = p?.name || '-';
      var subText = []; if (pos) subText.push(pos); if (isSub && !subText.includes('대타')) subText.push('대타'); else if (role && role !== pos && role !== name && !subText.includes(role)) subText.push(role);
      var nameHtml = { html: '<div class="player"><div class="name">'+name+'</div><div class="sub">'+(subText.join(' · '))+'</div></div>' };
      var cells = [ safe(p?.bo, idx + 1), nameHtml, safe(p?.pa, 0), safe(p?.ab, 0), safe(p?.hits, 0), safe(p?.double, 0), safe(p?.triple, 0), safe(p?.hr, 0), safe(p?.rbi, 0), runs, fourBall, safe(p?.sb, 0), safe(p?.so, 0) ];
      return { _sub: isSub, _cells: cells };
    });
    return table({ caption: `타자 (${side})`, heads: heads, rows: rows, stickyCols: true });
  }

  function ipToOuts(ip){ if(ip==null) return null; var s=String(ip).split('.'); var I=+s[0], F=+(s[1]||'0'); if(isNaN(I)||[0,1,2].indexOf(F)===-1) return null; return I*3+F; }
  function era7(er,ip){ var o=ipToOuts(ip); if(o==null || o <= 0) return null; var inn=o/3; return (7*(N(er)))/inn; }
  function renderPitching(side, list){
    list = Array.isArray(list) ? list : []; if (list.length === 0) return '<div class="empty">투구 기록이 없습니다.</div>';
    var heads = ['투수','IP','H','R','ER','BB+HBP','SO','ERA(7)'];
    var rows = list.map(function(p){
      var nm = p?.name || '-', pos = p?.pos || '투수', nameHtml = { html: '<div class="player"><div class="name">'+nm+'</div><div class="sub">'+pos+'</div></div>' };
      var bb = N(p?.bb), hbp = N(p?.hbp), fourBall = bb + hbp;
      var cells = [ nameHtml, safe(p?.ip, '-'), safe(p?.h, 0), safe(p?.r, 0), safe(p?.er, 0), fourBall, safe(p?.so, 0), fmt(era7(p?.er, p?.ip), 2) ];
      return { _cells: cells };
    });
    return table({ caption: `투수 (${side})`, heads: heads, rows: rows, stickyCols: false });
  }

  function renderPlaysFeed(plays, teams){
    plays = Array.isArray(plays) ? plays : []; teams = teams || {}; if (plays.length === 0) return '<div class="empty">플레이 로그가 없습니다.</div>';
    var arr = plays.slice().sort(function(a, b){ var c = (N(a.inning) - N(b.inning)); if (c !== 0) return c; if (a.half === b.half) return ((N(a.no) || N(a.order) || 0) - (N(b.no) || N(b.order) || 0)); return (a.half === 'top') ? -1 : 1; });
    var groups = {}, i; for (i = 0; i < arr.length; i++){ var p = arr[i]; var key = String(p.inning || '?') + '-' + String(p.half || 'unknown'); if (!groups[key]) groups[key] = []; groups[key].push(p); }
    function halfTxt(h){ return h === 'top' ? '초' : (h === 'bottom' ? '말' : ''); } function teamTxt(h){ return h === 'top' ? (teams.away?.abbr || teams.away?.name || '원정') : (teams.home?.abbr || teams.home?.name || '홈'); }
    var ordered = Object.keys(groups).sort(function(a, b){ var ia = parseInt(a.split('-')[0], 10), ib = parseInt(b.split('-')[0], 10); if (ia !== ib) return ia - ib; var ha = a.split('-')[1], hb = b.split('-')[1]; return (ha === 'top') ? -1 : 1; });
    var html = ''; for (i = 0; i < ordered.length; i++){ var key = ordered[i]; var inn = key.split('-')[0], half = key.split('-')[1]; var head = inn + '회 ' + halfTxt(half) + ' <span style="color:#555; font-weight: normal;">(' + teamTxt(half) + ')</span>'; var list = groups[key]; var items = ''; for (var j = 0; j < list.length; j++){ var it = list[j]; var no = (it.no != null ? it.no : (it.order != null ? it.order : (j + 1))); var desc = (it.desc == null ? '' : it.desc); items += '<li><span class="tau-feed-no">' + no + '</span>' + desc + '</li>'; } html += '<div class="tau-feed-group"><div class="tau-feed-head">' + head + '</div><ol class="tau-feed-list">' + items + '</ol></div>'; } return '<div class="tau-feed">' + html + '</div>';
  }

  (function run(){
    getJSON(DATA_URL).then(function(db){
      var game = findGame(db); if (!game) throw new Error(`'${detailId}' 상세 정보를 detail.json에서 찾을 수 없습니다.`);
      var teams = game.teams || {}, away = teams.away || {}, home = teams.home || {};
      if ($('#title')) $('#title').textContent = (away.abbr || away.name || '원정') + ' vs ' + (home.abbr || home.name || '홈');
      if ($('#date')) $('#date').textContent = game.date || ''; if ($('#venue')) $('#venue').textContent = game.venue || ''; if ($('#status')) $('#status').textContent = game.status || '';
      if ($('#scoreboard')) $('#scoreboard').innerHTML = renderScoreboard(teams, game.innings || []);
      if ($('#batting-home')) $('#batting-home').innerHTML = renderBatting('홈', game.batting?.home || []);
      if ($('#batting-away')) $('#batting-away').innerHTML = renderBatting('원정', game.batting?.away || []);
      if ($('#pitching-home')) $('#pitching-home').innerHTML = renderPitching('홈', game.pitching?.home || []);
      if ($('#pitching-away')) $('#pitching-away').innerHTML = renderPitching('원정', game.pitching?.away || []);
      if ($('#plays')) $('#plays').innerHTML = renderPlaysFeed(game.plays || [], teams);
      
      const existingBar = document.querySelector('.tau-bottom'); if(existingBar) existingBar.remove();
      let backYear = String(detailId).split('-')[0] || ''; if(!backYear && game.date) backYear = String(game.date).slice(0,4);
      let href = 'schedule.html' + (backYear ? `?year=${encodeURIComponent(backYear)}&focus=${encodeURIComponent(detailId)}` : '');
      const bar = document.createElement('nav'); bar.className = 'tau-bottom';
      bar.innerHTML = `<a class="tau-btn" id="backBtn" href="${href}">← 일정으로</a><button type="button" class="tau-btn primary" id="shareBtn">🔗 링크 복사</button>`;
      document.body.appendChild(bar);
      const shareBtnEl = document.getElementById('shareBtn');
      if (shareBtnEl) { shareBtnEl.addEventListener('click', function(){ try { navigator.clipboard.writeText(location.href).then(function(){ alert('링크가 복사되었습니다.'); }).catch(function(){ alert('복사 실패 (클립보드 권한 오류)'); }); } catch(e) { alert('복사 실패'); } }); }
    }).catch(function(err){ console.error(err); var main = $('main') || document.body; main.innerHTML = `<div class="tau-wrap"><div class="empty" style="color: red;">기록 로드 실패<br><small>(${err.message})</small></div></div>`; });
  })();
})();