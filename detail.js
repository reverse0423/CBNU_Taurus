// detail.js — FINAL SAFE (ES6, same folder detail.json, detailId only)
(function () {
  // ───────── helpers ─────────
  function $(sel){ return document.querySelector(sel); }

  // detailId from URL (required)
  var qs = new URLSearchParams(location.search);
  var detailId = (qs.get('detailId') || '').trim();
  if (!detailId) { alert('detailId가 없습니다. 예: detail.html?detailId=2025-18'); throw new Error('missing detailId'); }

  // "2025-1" === "2025-01" 비교
  function sameId(a, b){
    if (!a || !b) return false;
    var A = String(a).split('-'), B = String(b).split('-');
    if (A[0] !== B[0]) return false;
    var an = parseInt(A[1],10), bn = parseInt(B[1],10);
    if (isNaN(an) || isNaN(bn) || an !== bn) return false;
    if (A.length >= 3 || B.length >= 3){
      var ad = parseInt(A[2] || '0',10), bd = parseInt(B[2] || '0',10);
      return ad === bd;
    }
    return true;
  }

  // inject CSS (headers black, mobile scoreboard)
  (function injectStyle(){
    if (document.getElementById('tau-style')) return;
    var css =
      '.tau-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0;}' +
      '.tau-table{border-collapse:separate;border-spacing:0;width:100%;min-width:760px;font-size:14px;line-height:1.45;}' +
      '.tau-table caption{caption-side:top;text-align:left;font-weight:700;margin:0 0 6px 0;font-size:15px;color:#111 !important;}' +
      '.tau-table th,.tau-table td{border:1px solid #e5e7eb;padding:10px 12px;background:#fff;white-space:nowrap;color:#111;}' +
      '.tau-table thead th{position:sticky;top:0;background:#f3f4f6;font-weight:700;z-index:2;color:#111 !important;}' +
      '.tau-table th.first,.tau-table td.first{text-align:left;font-weight:600}' +
      '.tau-table th.num,.tau-table td.num{text-align:center}' +
      '.tau-table tr:nth-child(even) td{background:#fafafa}' +

      /* 1) scoreboard: no horizontal scroll on mobile */
      '.tau-scoreboard{min-width:0 !important;table-layout:fixed;font-size:13px;}' +
      '.tau-scoreboard th,.tau-scoreboard td{padding:8px;}' +
      '.tau-scoreboard .teamcol{width:26%;}' +
      '.tau-scoreboard .inningcol{width:auto;}' +
      '@media (max-width:480px){.tau-scoreboard{font-size:12px}.tau-scoreboard th,.tau-scoreboard td{padding:6px}}' +

      /* 2) plays feed */
      '.tau-feed{margin:10px 0}' +
      '.tau-feed-group{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:10px;background:#fff}' +
      '.tau-feed-head{background:#f3f4f6;padding:8px 12px;font-weight:700;color:#111}' +
      '.tau-feed-list{list-style:none;margin:0;padding:8px 12px}' +
      '.tau-feed-list li{padding:6px 0;border-bottom:1px solid #f1f5f9}' +
      '.tau-feed-list li:last-child{border-bottom:0}' +
      '.tau-feed-no{display:inline-block;min-width:22px;text-align:right;margin-right:8px;color:#6b7280}' +

      /* 3) pinch-hitter row */
      '.row-sub td{background:#fcfcff !important;color:#374151}' +
      '.player .name{font-weight:600}.player .sub{font-size:12px;color:#6b7280}' +

      /* 4) bottom bar */
      '.tau-bottom{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;padding:12px;z-index:40}' +
      '.tau-btn{flex:1;display:flex;align-items:center;justify-content:center;height:44px;border-radius:10px;border:1px solid #e5e7eb;background:#fafafa;color:#111;text-decoration:none}' +
      '.tau-btn.primary{background:#7c2d8a;color:#fff;border-color:#7c2d8a}';

    var st = document.createElement('style');
    st.id = 'tau-style';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // data loader
  var DATA_URL = './detail.json';
  function getJSON(url){
    return fetch(url, { cache:'no-store' }).then(function(r){
      if(!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    });
  }

  // locate a game in detail.json (root map / byId / games array)
  function looksLikeGame(o){
    return o && typeof o === 'object' && (o.teams || o.innings || o.batting || o.pitching || o.plays);
  }
  function findGame(db){
    var k, by, bag, arr, i;

    // A) root map: { "2025-18": {...} }
    var keys = Object.keys(db);
    for (i=0;i<keys.length;i++){
      k = keys[i];
      if (k === 'games' || k === 'gamesById' || k === 'detailsById' || k === 'byId') continue;
      if (/^\d{4}$/.test(k)) continue;
      if (sameId(k, detailId) && looksLikeGame(db[k])) return db[k];
    }
    // B) *_byId maps
    var byKeys = ['gamesById','detailsById','byId'];
    for (i=0;i<byKeys.length;i++){
      by = byKeys[i];
      bag = db[by];
      if (bag && typeof bag === 'object'){
        var bkeys = Object.keys(bag);
        for (var j=0;j<bkeys.length;j++){
          k = bkeys[j];
          if (sameId(k, detailId) && looksLikeGame(bag[k])) return bag[k];
        }
      }
    }
    // C) array: { games:[{ detailId:"..." }]}
    arr = Array.isArray(db.games) ? db.games : null;
    if (arr){
      for (i=0;i<arr.length;i++){
        var g = arr[i];
        var cid = (g && (g.detailId || g.id || g.gameId)) || '';
        if (sameId(cid, detailId) && looksLikeGame(g)) return g;
      }
    }
    return null;
  }

  // table helpers
  function safe(v, d){ return (v === 0 || !!v) ? v : (d===undefined?'-':d); }
  function fmt(n, d){ return (n==null || isNaN(+n)) ? '-' : (+n).toFixed(d||2); }
  function wrap(html){ return '<div class="tau-wrap">' + html + '</div>'; }

  function table(opts){
    var caption = opts.caption || '';
    var heads = opts.heads || [];
    var rows  = opts.rows  || [];
    var scoreboard = !!opts.scoreboard;

    var thead = '<thead><tr>' + heads.map(function(t,i){
      var cls = (i===0?'first':'num') + (scoreboard && i===0 ? ' teamcol' : '') + (scoreboard && i>0 ? ' inningcol' : '');
      return '<th class="'+cls+'">'+ t +'</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + rows.map(function(r){
      var cells = Array.isArray(r) ? r : (r.cells || r._cells || []);
      var trc = (r && (r.isSub || r._sub)) ? 'row-sub' : '';
      return '<tr class="'+trc+'">' + cells.map(function(c,i){
        return '<td class="'+(i===0?'first':'num')+'">' + c + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    return wrap('<table class="tau-table '+(scoreboard?'tau-scoreboard':'')+'"><caption>'+caption+'</caption>'+thead+tbody+'</table>');
  }

  // 1) scoreboard (mobile-friendly)
  function renderScoreboard(teams, innings){
    teams = teams || {};
    innings = Array.isArray(innings) ? innings : [];
    if (innings.length === 0) return '<div class="empty">이닝 정보가 없습니다.</div>';

    var maxInning = 7;
    for (var i=0;i<innings.length;i++){
      var num = parseInt(innings[i].inning,10);
      if (!isNaN(num) && num > maxInning) maxInning = num;
    }
    var heads = ['팀'];
    for (i=1;i<=maxInning;i++) heads.push(i+'회');
    heads.push('R');

    var awayName = (teams.away && (teams.away.abbr || teams.away.name)) || 'AWAY';
    var homeName = (teams.home && (teams.home.abbr || teams.home.name)) || 'HOME';
    var awayRow = [awayName], homeRow = [homeName];
    var ar=0, hr=0;

    for (i=1;i<=maxInning;i++){
      var fr=null;
      for (var j=0;j<innings.length;j++){ if (+innings[j].inning===i){ fr=innings[j]; break; } }
      var a = fr && (fr.away!=null) ? fr.away : '';
      var h = fr && (fr.home!=null) ? fr.home : '';
      awayRow.push(a === '' ? '' : (+a || a));
      homeRow.push(h === '' ? '' : (+h || h));
      ar += (+a || 0); hr += (+h || 0);
    }
    awayRow.push(ar); homeRow.push(hr);

    return table({ caption:'스코어보드', heads:heads, rows:[{_cells:awayRow},{_cells:homeRow}], scoreboard:true });
  }

  // 2) batting (pinch-hitter sub row)
  function renderBatting(side, list){
    list = Array.isArray(list) ? list : [];
    if (list.length === 0) return '<div class="empty">타격 기록이 없습니다.</div>';

    var heads = ['타순','선수명','타수','득점','안타','2B','3B','HR','타점','4사구','삼진','도루'];
    var rows = list.map(function(p, idx){
      var bb = +(p && p.bb || 0), hbp = +(p && p.hbp || 0);
      var fourBB = bb + hbp;
      var role = (p && p.role) ? String(p.role) : '';
      var isPH = (role === '대타') || (role.toLowerCase() === 'ph') || !!(p && p.pinch);
      var pos = (p && p.pos) ? p.pos : '';
      var name = (p && p.name) ? p.name : '-';
      var sub = [];
      if (pos) sub.push(pos);
      if (isPH) sub.push('대타');
      else if (role && role !== pos) sub.push(role);
      var nameHtml = '<div class="player"><div class="name">'+name+'</div><div class="sub">'+(sub.join(' · '))+'</div></div>';

      return {
        _sub: isPH,
        _cells: [
          safe(p && p.bo, idx+1),
          nameHtml,
          safe(p && p.ab, 0),
          safe(p && p.r, 0),
          safe(p && p.hits, 0),
          safe(p && p.double, 0),
          safe(p && p.triple, 0),
          safe(p && p.hr, 0),
          safe(p && p.rbi, 0),
          fourBB,
          safe(p && p.so, 0),
          safe(p && p.sb, 0)
        ]
      };
    });
    return table({ caption:'타자 ('+side+')', heads:heads, rows:rows });
  }

  // 3) pitching
  function ipToOuts(ip){ if(ip==null) return null; var ss=String(ip).split('.'); var I=+ss[0], F=+(ss[1]||'0'); if(isNaN(I)||[0,1,2].indexOf(F)===-1) return null; return I*3+F; }
  function era7(er,ip){ var o=ipToOuts(ip); if(o==null) return null; var inn=o/3; return inn>0 ? (7*(+er||0))/inn : null; }

  function renderPitching(side, list){
    list = Array.isArray(list) ? list : [];
    if (list.length === 0) return '<div class="empty">투구 기록이 없습니다.</div>';

    var heads = ['투수','IP','BF','H','R','ER','BB','HBP','SO','HR','ERA(7)'];
    var rows = list.map(function(p){
      var name = (p && p.name) ? p.name : '-';
      var pos  = (p && p.pos)  ? p.pos  : '투수';
      var nameHtml = '<div class="player"><div class="name">'+name+'</div><div class="sub">'+pos+'</div></div>';
      return {
        _cells: [
          nameHtml,
          safe(p && p.ip, '-'),
          safe(p && p.bf, 0),
          safe(p && p.h, 0),
          safe(p && p.r, 0),
          safe(p && p.er, 0),
          safe(p && p.bb, 0),
          safe(p && p.hbp, 0),
          safe(p && p.so, 0),
          safe(p && p.hr, 0),
          fmt(era7(p && p.er, p && p.ip), 2)
        ]
      };
    });
    return table({ caption:'투수 ('+side+')', heads:heads, rows:rows });
  }

  // 4) plays feed (batter-by-result style)
  function renderPlaysFeed(plays, teams){
    plays = Array.isArray(plays) ? plays : [];
    teams = teams || {};
    if (plays.length === 0) return '<div class="empty">플레이 로그가 없습니다.</div>';

    // sort & group by inning-half
    var arr = plays.slice().sort(function(a,b){
      var c = (+a.inning - +b.inning);
      if (c !== 0) return c;
      if (a.half === b.half) return ((a.no||0) - (b.no||0));
      return (a.half === 'top') ? -1 : 1;
    });

    var groups = {};
    for (var i=0;i<arr.length;i++){
      var p = arr[i];
      var key = String(p.inning) + '-' + String(p.half);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    function halfTxt(h){ return h === 'top' ? '초' : '말'; }
    function teamTxt(h){
      if (h === 'top'){
        return (teams.away && (teams.away.abbr || teams.away.name)) || 'AWAY';
      } else {
        return (teams.home && (teams.home.abbr || teams.home.name)) || 'HOME';
      }
    }

    var orderedKeys = Object.keys(groups).sort(function(a,b){
      var ia = parseInt(a.split('-')[0],10), ib = parseInt(b.split('-')[0],10);
      if (ia !== ib) return ia - ib;
      var ha = a.split('-')[1], hb = b.split('-')[1];
      return (ha === 'top') ? -1 : 1;
    });

    var html = '';
    for (i=0;i<orderedKeys.length;i++){
      var key = orderedKeys[i];
      var inn = key.split('-')[0], half = key.split('-')[1];
      var head = inn + '회 ' + halfTxt(half) + ' · ' + teamTxt(half);
      var list = groups[key];
      var items = '';
      for (var j=0;j<list.length;j++){
        var it = list[j];
        var no = (it.no==null ? (j+1) : it.no);
        var desc = (it.desc==null ? '' : it.desc);
        items += '<li><span class="tau-feed-no">'+ no +'</span>'+ desc +'</li>';
      }
      html += '<div class="tau-feed-group"><div class="tau-feed-head">'+head+'</div><ol class="tau-feed-list">'+items+'</ol></div>';
    }
    return '<div class="tau-feed">'+html+'</div>';
  }

  // ───────── run ─────────
  (function run(){
    getJSON(DATA_URL).then(function(db){
      var game = findGame(db);
      if (!game) throw new Error("'" + detailId + "' 상세를 detail.json에서 찾지 못했습니다.");

      var teams = game.teams || {};
      var away = teams.away || {};
      var home = teams.home || {};

      if ($('#title')) $('#title').textContent = (away.abbr || away.name || 'AWAY') + ' @ ' + (home.abbr || home.name || 'HOME');
      if ($('#date'))  $('#date').textContent  = game.date || '';
      if ($('#venue')) $('#venue').textContent = game.venue || '';
      if ($('#status'))$('#status').textContent= game.status || '';

      if ($('#scoreboard'))    $('#scoreboard').innerHTML    = renderScoreboard(teams, game.innings || []);
      if ($('#batting-home'))  $('#batting-home').innerHTML  = renderBatting('홈',    (game.batting && game.batting.home)  || []);
      if ($('#batting-away'))  $('#batting-away').innerHTML  = renderBatting('원정',  (game.batting && game.batting.away)  || []);
      if ($('#pitching-home')) $('#pitching-home').innerHTML = renderPitching('홈',   (game.pitching && game.pitching.home)|| []);
      if ($('#pitching-away')) $('#pitching-away').innerHTML = renderPitching('원정', (game.pitching && game.pitching.away)|| []);
      if ($('#plays'))         $('#plays').innerHTML         = renderPlaysFeed(game.plays || [], teams);

      // bottom bar (unified)
      if (!document.querySelector('.tau-bottom')) {
        var bar = document.createElement('div');
        bar.className = 'tau-bottom';
        bar.innerHTML = '<a class="tau-btn" href="schedule.html">← 일정으로</a>' +
                        '<a class="tau-btn primary" id="shareBtn">공유</a>';
        document.body.appendChild(bar);
      }
      var shareBtn = document.getElementById('shareBtn');
      if (shareBtn) {
        shareBtn.addEventListener('click', function(){
          try{
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(location.href).then(function(){ alert('링크가 복사되었습니다.'); })
              .catch(function(){ alert('복사 실패'); });
            } else {
              // fallback
              var ta = document.createElement('textarea');
              ta.value = location.href; document.body.appendChild(ta); ta.select();
              document.execCommand('copy'); document.body.removeChild(ta);
              alert('링크가 복사되었습니다.');
            }
          } catch(e){ alert('복사 실패'); }
        });
      }
    }).catch(function(err){
      console.error(err);
      var main = document.querySelector('main') || document.body;
      main.innerHTML = '<div class="tau-wrap"><div class="empty">기록을 불러오지 못했습니다.<br>'+ err.message +'</div></div>';
    });
  })();
})();