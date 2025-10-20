// detail.js — FINAL (Data finding logic simplified + Enhanced error logging)
(function () {
  function $(s){ return document.querySelector(s); }

  // --- detailId 추출 ---
  var qs = new URLSearchParams(location.search);
  var detailId = (qs.get('detailId') || '').trim();
  if (!detailId) {
    // URL 경로에서 추출 시도 (예: /detail/2025-18.html)
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.html')) {
        const potentialId = lastPart.replace('.html', '');
        if (/^\d{4}-\d+/.test(potentialId)) { // YYYY-NN 형식 확인
            detailId = potentialId;
            console.log("URL 경로에서 detailId 추출:", detailId);
        }
    }
    // 그래도 없으면 오류 처리
    if (!detailId) {
        alert('URL에 detailId가 없습니다. (예: detail.html?detailId=2025-18)');
        console.error('URL에서 detailId를 찾을 수 없습니다.');
        // 사용자에게 오류 표시 (선택적)
        var main = $('main') || document.body;
        main.innerHTML = '<div class="tau-wrap"><div class="empty" style="color: red;">페이지를 표시할 수 없습니다.<br>URL에 경기 ID(detailId)가 필요합니다.</div></div>';
        return; // 스크립트 실행 중단
    }
  }
  console.log("사용할 detailId:", detailId);

  // --- ID 비교 함수 (단순 문자열 비교) ---
  function sameId(a, b){
    return String(a || '').trim() === String(b || '').trim();
  }

  // --- 스타일 주입 (Sticky columns 등) ---
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
      '.tau-table th.num,.tau-table td.num{text-align:center;}'+
      '.tau-table tbody tr:nth-child(even) td{background:#fafafa}'+
      '.tau-table.sticky-cols th.col1,.tau-table.sticky-cols td.col1{position:sticky;left:0;z-index:8;min-width:52px;width:52px;text-align:center;}'+
      '.tau-table.sticky-cols th.col2,.tau-table.sticky-cols td.col2{position:sticky;left:52px;z-index:7;min-width:160px;width:160px;text-align:left;}'+
      '.tau-table.sticky-cols th.col1, .tau-table.sticky-cols td.col1,' +
      '.tau-table.sticky-cols th.col2, .tau-table.sticky-cols td.col2 {' +
      ' background: var(--bg-white, #fff); border-right: 2px solid #ddd;' +
      '}'+
      '.tau-table.sticky-cols thead th.col1, .tau-table.sticky-cols thead th.col2 {'+
      ' background: #f3f4f6;' +
      '}'+
      '.tau-table.sticky-cols tbody tr:nth-child(even) td.col1, .tau-table.sticky-cols tbody tr:nth-child(even) td.col2 {'+
      ' background: #fafafa;' +
      '}'+
      '.tau-table.sticky-cols thead th.col1{z-index:12;}'+
      '.tau-table.sticky-cols thead th.col2{z-index:11;}'+
      '@media (max-width:480px){'+
        '.tau-table{min-width:600px;font-size:13px}'+
        '.tau-table.sticky-cols th.col1,.tau-table.sticky-cols td.col1{min-width:44px;width:44px}'+
        '.tau-table.sticky-cols th.col2,.tau-table.sticky-cols td.col2{min-width:140px;width:140px;left:44px}'+
      '}'+
      '.tau-scoreboard{min-width:0 !important;table-layout:fixed;font-size:13px; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;}'+
      '.tau-scoreboard th,.tau-scoreboard td{padding:8px; border: none; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;}'+
      '.tau-scoreboard th:last-child, .tau-scoreboard td:last-child { border-right: none; }'+
      '.tau-scoreboard tbody tr:last-child td { border-bottom: none; }'+
      '.tau-scoreboard .teamcol{width:26%; text-align: left; font-weight: bold;}'+
      '.tau-scoreboard .inningcol{width:auto}'+
      '.tau-scoreboard .totalcol{font-weight: bold;}'+
      '.tau-scoreboard thead th{position:static !important; background: #f3f4f6;}'+
      '@media (max-width:480px){.tau-scoreboard{font-size:12px}.tau-scoreboard th,.tau-scoreboard td{padding:6px}}'+
      '.tau-feed{margin:16px 0}'+
      '.tau-feed-group{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:10px;background:#fff}'+
      '.tau-feed-head{background:#f3f4f6;padding:10px 14px;font-weight:700;color:#111; font-size: 15px;}'+
      '.tau-feed-list{list-style:none;margin:0;padding:8px 14px}'+
      '.tau-feed-list li{padding:8px 0;border-bottom:1px solid #f1f5f9; font-size: 14px; line-height: 1.5;}'+
      '.tau-feed-list li:last-child{border-bottom:0}'+
      '.tau-feed-no{display:inline-block;min-width:22px;text-align:right;margin-right:8px;color:#6b7280; font-size: 13px; vertical-align: top;}'+
      '.row-sub td{background:#f0f4ff !important;color:#374151}'+
      '.player .name{font-weight:600}.player .sub{font-size:12px;color:#6b7280; margin-top: 2px;}'+
      '.empty{padding:16px; color:#777; text-align:center;}'+
      /* Bottom bar styles from previous version */
      '.tau-bottom{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;padding:12px;z-index:40}'+
      '.tau-btn{flex:1;display:flex;align-items:center;justify-content:center;height:44px;border-radius:10px;border:1px solid #e5e7eb;background:#fafafa;color:#111;text-decoration:none; font-size: 14px;}'+ // Added font-size
      '.tau-btn.primary{background:#7a003c;color:#fff;border-color:#7a003c; font-weight: bold;}'+ // Updated color and added bold
      'button.tau-btn { cursor: pointer; }'; // Make button look clickable

    var st=document.createElement('style'); st.id='tau-detail-style'; st.textContent=css; document.head.appendChild(st);
  })();

  // --- 데이터 로딩 및 처리 ---
  var DATA_URL='./detail.json'; // JSON 파일 경로 확인!

  function getJSON(url){
    console.log("Fetching data from:", url); // 로딩 시도 로그
    return fetch(url,{cache:'no-store'})
      .then(function(r){
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} (${r.statusText}) while fetching ${url}`);
        }
        return r.json();
      });
  }

  // ★ findGame 함수 단순화 (직접 접근 우선)
  function findGame(db){
    console.log("Trying to find game with detailId:", detailId);
    if (!db) {
        console.error("Database object is null or undefined.");
        return null;
    }
    // 1. detailId로 직접 접근 시도 (가장 일반적인 경우)
    if (db[detailId] && typeof db[detailId] === 'object' && db[detailId].teams) {
      console.log("Game found directly with key:", detailId);
      return db[detailId];
    }

    // 2. 다른 구조 탐색 (기존 코드 유지, 비상용)
    console.warn("Direct key access failed, trying alternative structures...");
    var keys = Object.keys(db);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (sameId(k, detailId) && typeof db[k] === 'object' && db[k].teams) {
            console.log("Game found with alternative key:", k);
            return db[k];
        }
        if (typeof db[k] === 'object') { // Check nested objects like 'gamesById'
            const nestedKeys = Object.keys(db[k] || {});
            for (let j = 0; j < nestedKeys.length; j++) {
                const nk = nestedKeys[j];
                if (sameId(nk, detailId) && typeof db[k][nk] === 'object' && db[k][nk].teams) {
                     console.log("Game found in nested object:", k, nk);
                     return db[k][nk];
                }
            }
        }
    }
    // Check arrays like 'games'
    if (Array.isArray(db.games)) {
        for (let i = 0; i < db.games.length; i++) {
            const g = db.games[i];
            const gid = g?.detailId || g?.id;
            if (sameId(gid, detailId) && typeof g === 'object' && g.teams) {
                console.log("Game found in 'games' array with id:", gid);
                return g;
            }
        }
    }

    console.error("Game not found with detailId:", detailId, "in the loaded data:", db);
    return null; // 최종적으로 못 찾음
  }

  // --- Helper 함수들 ---
  function safe(v, d){ return (v !== null && v !== undefined && v !== '') ? v : (d === undefined ? '-' : d); }
  function fmt(n, d){ return (n == null || isNaN(+n)) ? '-' : (+n).toFixed(d === undefined ? 2 : d); }
  function wrap(html){ return '<div class="tau-wrap">'+html+'</div>'; }
  function N(v) { return (v == null || isNaN(+v)) ? 0 : +v; } // N 함수 추가

  // --- Table 렌더링 함수 ---
  function table(opts){
    var caption = opts.caption || '', heads = opts.heads || [], rowsData = opts.rows || [], scoreboard = !!opts.scoreboard, stickyCols = !!opts.stickyCols;
    var cls = 'tau-table' + (scoreboard ? ' tau-scoreboard' : '') + (stickyCols ? ' sticky-cols' : '');

    var thead = '<thead><tr>' + heads.map(function(t, i){
      let headClass = '';
      if (i === 0 && stickyCols) headClass = 'col1';
      else if (i === 1 && stickyCols) headClass = 'col2 left';
      else if (i === 0 && !stickyCols) headClass = 'left';
      else headClass = 'num';
      return '<th class="' + headClass + '">' + t + '</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + rowsData.map(function(r){
      var cells = Array.isArray(r) ? r : (r.cells || r._cells || []);
      var trc = (r && (r.isSub || r._sub)) ? 'row-sub' : '';
      return '<tr class="' + trc + '">' + cells.map(function(c, i){
        let tdClass = '';
         if (i === 0 && stickyCols) tdClass = 'col1';
         else if (i === 1 && stickyCols) tdClass = 'col2 left';
         else if (i === 0 && !stickyCols) tdClass = 'left';
         else tdClass = 'num';
        let cellContent = (typeof c === 'object' && c.html) ? c.html : safe(c);
        return '<td class="' + tdClass + '">' + cellContent + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    return wrap('<table class="' + cls + '"><caption>' + caption + '</caption>' + thead + tbody + '</table>');
  }

  // --- Section 렌더링 함수들 ---
  function renderScoreboard(teams, innings){ /* ... 이전 코드와 동일 ... */ teams=teams||{};innings=Array.isArray(innings)?innings:[];if(innings.length===0)return'<div class="empty">스코어보드 정보가 없습니다.</div>';let maxInning=0;innings.forEach(inn=>{const iNum=parseInt(inn.inning,10);if(!isNaN(iNum)&&iNum>maxInning)maxInning=iNum;});maxInning=Math.max(maxInning,7);var heads=['팀'];for(let i=1;i<=maxInning;i++)heads.push(i+'');heads.push('R');var awayName=(teams.away?.abbr||teams.away?.name)||'원정';var homeName=(teams.home?.abbr||teams.home?.name)||'홈';var awayRow=[awayName],homeRow=[homeName],ar=0,hr=0;for(let i=1;i<=maxInning;i++){let innData=innings.find(inn=>parseInt(inn.inning,10)===i);let aScore=innData?.away??'';let hScore=innData?.home??'';awayRow.push(safe(aScore,''));homeRow.push(safe(hScore,''));ar+=N(aScore);hr+=N(hScore);}awayRow.push(ar);homeRow.push(hr);const finalHeads=heads.map((h,i)=>i===0?`<th class="teamcol">${h}</th>`:(i===heads.length-1?`<th class="totalcol">${h}</th>`:`<th class="inningcol">${h}</th>`));const finalAwayRow=awayRow.map((c,i)=>i===0?`<td class="teamcol">${c}</td>`:(i===awayRow.length-1?`<td class="totalcol">${c}</td>`:`<td class="inningcol">${c}</td>`));const finalHomeRow=homeRow.map((c,i)=>i===0?`<td class="teamcol">${c}</td>`:(i===homeRow.length-1?`<td class="totalcol">${c}</td>`:`<td class="inningcol">${c}</td>`));return wrap(`<table class="tau-table tau-scoreboard"><caption>스코어보드</caption><thead><tr>${finalHeads.join('')}</tr></thead><tbody><tr>${finalAwayRow.join('')}</tr><tr>${finalHomeRow.join('')}</tr></tbody></table>`); }

  // ★ renderBatting (수정됨 - 주석 제거, 열 순서 변경)
  function renderBatting(side, list){
    list = Array.isArray(list) ? list : [];
    if (list.length === 0) return '<div class="empty">타격 기록이 없습니다.</div>';

    var heads = ['타순','선수','타석','타수','안타','2루타','3루타','홈런','타점','득점','4사구','도루','삼진']; // 열 순서

    var rows = list.map(function(p, idx){
      var bb = N(p?.bb);
      var hbp = N(p?.hbp);
      var fourBall = bb + hbp; // 4사구 합계
      var runs = N(p?.r ?? p?.run); // 득점

      var role = p?.role || '';
      var isSub = (role === '대타') || (role.toLowerCase() === 'ph') || !!(p?.pinch);
      var pos = p?.pos || '';
      var name = p?.name || '-';

      var subText = [];
      if (pos) subText.push(pos);
      if (isSub && !subText.includes('대타')) subText.push('대타'); // 중복 방지
      else if (role && role !== pos && role !== name && !subText.includes(role)) subText.push(role);

      var nameHtml = { html: '<div class="player"><div class="name">'+name+'</div><div class="sub">'+(subText.join(' · '))+'</div></div>' };

      // 순서에 맞게 데이터 배열 생성
      var cells = [
        safe(p?.bo, idx + 1), // 타순
        nameHtml,            // 선수
        safe(p?.pa, 0),      // 타석
        safe(p?.ab, 0),      // 타수
        safe(p?.hits, 0),    // 안타
        safe(p?.double, 0),  // 2루타
        safe(p?.triple, 0),  // 3루타
        safe(p?.hr, 0),      // 홈런
        safe(p?.rbi, 0),     // 타점
        runs,                // 득점
        fourBall,            // 4사구
        safe(p?.sb, 0),      // 도루
        safe(p?.so, 0)       // 삼진
      ];
      return { _sub: isSub, _cells: cells };
    });
    return table({ caption: `타자 (${side})`, heads: heads, rows: rows, stickyCols: true });
  }

  function ipToOuts(ip){ if(ip==null) return null; var s=String(ip).split('.'); var I=+s[0], F=+(s[1]||'0'); if(isNaN(I)||[0,1,2].indexOf(F)===-1) return null; return I*3+F; }
  function era7(er,ip){ var o=ipToOuts(ip); if(o==null || o <= 0) return null; var inn=o/3; return (7*(N(er)))/inn; }
  function renderPitching(side, list){ /* ... 이전 코드와 동일 ... */ list=Array.isArray(list)?list:[];if(list.length===0)return'<div class="empty">투구 기록이 없습니다.</div>';var heads=['투수','IP','H','R','ER','BB+HBP','SO','ERA(7)'];var rows=list.map(function(p){var nm=p?.name||'-';var pos=p?.pos||'투수';var nameHtml={html:'<div class="player"><div class="name">'+nm+'</div><div class="sub">'+pos+'</div></div>'};var bb=N(p?.bb);var hbp=N(p?.hbp);var fourBall=bb+hbp;var cells=[nameHtml,safe(p?.ip,'-'),safe(p?.h,0),safe(p?.r,0),safe(p?.er,0),fourBall,safe(p?.so,0),fmt(era7(p?.er,p?.ip),2)];return{_cells:cells};});return table({caption:`투수 (${side})`,heads:heads,rows:rows,stickyCols:false});}
  function renderPlaysFeed(plays, teams){ /* ... 이전 코드와 동일 ... */ plays=Array.isArray(plays)?plays:[];teams=teams||{};if(plays.length===0)return'<div class="empty">플레이 로그가 없습니다.</div>';var arr=plays.slice().sort(function(a,b){var c=(N(a.inning)-N(b.inning));if(c!==0)return c;if(a.half===b.half)return((N(a.no)||N(a.order)||0)-(N(b.no)||N(b.order)||0));return(a.half==='top')?-1:1;});var groups={},i;for(i=0;i<arr.length;i++){var p=arr[i];var key=String(p.inning||'?')+'-'+String(p.half||'unknown');if(!groups[key])groups[key]=[];groups[key].push(p);}function halfTxt(h){return h==='top'?'초':(h==='bottom'?'말':'');}function teamTxt(h){return h==='top'?(teams.away?.abbr||teams.away?.name||'원정'):(teams.home?.abbr||teams.home?.name||'홈');}var ordered=Object.keys(groups).sort(function(a,b){var ia=parseInt(a.split('-')[0],10),ib=parseInt(b.split('-')[0],10);if(ia!==ib)return ia-ib;var ha=a.split('-')[1],hb=b.split('-')[1];return(ha==='top')?-1:1;});var html='';for(i=0;i<ordered.length;i++){var key=ordered[i];var inn=key.split('-')[0],half=key.split('-')[1];var head=inn+'회 '+halfTxt(half)+' <span style="color:#555; font-weight: normal;">('+teamTxt(half)+')</span>';var list=groups[key];var items='';for(var j=0;j<list.length;j++){var it=list[j];var no=(it.no!=null?it.no:(it.order!=null?it.order:(j+1)));var desc=(it.desc==null?'':it.desc);items+='<li><span class="tau-feed-no">'+no+'</span>'+desc+'</li>';}html+='<div class="tau-feed-group"><div class="tau-feed-head">'+head+'</div><ol class="tau-feed-list">'+items+'</ol></div>';}return'<div class="tau-feed">'+html+'</div>';}

  // --- Main Execution ---
  (function run(){
    getJSON(DATA_URL).then(function(db){
      console.log("Data loaded successfully:", db); // 데이터 로딩 성공 로그
      var game = findGame(db);
      // ★ findGame 실패 시 명확한 오류 throw
      if (!game) {
          throw new Error(`'${detailId}' 상세 정보를 detail.json에서 찾을 수 없습니다. JSON 구조나 detailId를 확인하세요.`);
      }
      console.log("Found game data:", game); // 찾은 게임 데이터 로그

      var teams = game.teams || {};
      var away = teams.away || {};
      var home = teams.home || {};

      // Update header elements
      if ($('#title')) $('#title').textContent = (away.abbr || away.name || '원정') + ' vs ' + (home.abbr || home.name || '홈'); // title 수정
      if ($('#date')) $('#date').textContent = game.date || '';
      if ($('#venue')) $('#venue').textContent = game.venue || '';
      if ($('#status')) $('#status').textContent = game.status || '';

      // Render sections
      if ($('#scoreboard')) $('#scoreboard').innerHTML = renderScoreboard(teams, game.innings || []);
      if ($('#batting-home')) $('#batting-home').innerHTML = renderBatting('홈', game.batting?.home || []);
      if ($('#batting-away')) $('#batting-away').innerHTML = renderBatting('원정', game.batting?.away || []);
      if ($('#pitching-home')) $('#pitching-home').innerHTML = renderPitching('홈', game.pitching?.home || []);
      if ($('#pitching-away')) $('#pitching-away').innerHTML = renderPitching('원정', game.pitching?.away || []);
      if ($('#plays')) $('#plays').innerHTML = renderPlaysFeed(game.plays || [], teams);

      // Add/Update bottom bar
       const existingBar = document.querySelector('.tau-bottom');
       if(existingBar) existingBar.remove(); // 기존 바 제거 (중복 방지)

       let backYear = String(detailId).split('-')[0] || '';
       if(!backYear && game.date) backYear = String(game.date).slice(0,4);
       let href = 'schedule.html' + (backYear ? `?year=${encodeURIComponent(backYear)}&focus=${encodeURIComponent(detailId)}` : '');

       const bar = document.createElement('nav'); // Use nav element semantically
       bar.className = 'tau-bottom';
       bar.innerHTML = `<a class="tau-btn" id="backBtn" href="${href}">← 일정으로</a>
                        <button type="button" class="tau-btn primary" id="shareBtn">🔗 링크 복사</button>`;
       document.body.appendChild(bar);

       // Attach share button listener
       const shareBtnEl = document.getElementById('shareBtn');
       if (shareBtnEl) {
           shareBtnEl.addEventListener('click', function(){
               try {
                   navigator.clipboard.writeText(location.href).then(function(){
                       alert('링크가 복사되었습니다.');
                   }).catch(function(clipErr){
                       console.error("Clipboard API failed:", clipErr);
                       alert('복사 실패 (클립보드 권한 오류)');
                   });
               } catch(e) {
                   alert('클립보드 복사 기능이 지원되지 않는 브라우저입니다.');
                   console.error("Clipboard access error:", e);
               }
           });
       }

    }).catch(function(err){ // ★ 오류 처리 강화
      console.error("데이터 처리 중 오류 발생:", err); // 콘솔에 상세 오류 출력
      var main = $('main') || document.body;
      // 사용자에게 보여줄 메시지 개선
      let errorMsg = '기록을 불러오는 중 오류가 발생했습니다.';
      if (err.message.includes('찾을 수 없습니다')) {
          errorMsg = `경기 ID '${detailId}'에 해당하는 기록을 찾을 수 없습니다. ID를 확인하거나 관리자에게 문의하세요.`;
      } else if (err.message.includes('HTTP')) {
          errorMsg = `데이터 파일을 불러오는 데 실패했습니다 (${DATA_URL}). 파일 경로 및 네트워크 연결을 확인하세요.`;
      }
      main.innerHTML = `<div class="tau-wrap"><div class="empty" style="color: red;">${errorMsg}<br><small style='color:#888'>(${err.message})</small></div></div>`;
    });
  })();

})(); // End IIFE