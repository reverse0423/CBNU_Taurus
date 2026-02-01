// schedule.js — FINAL (Anti-Cache + 2026 Auto Detect)
var scheduleData = {};

// ★ 수정된 부분: 뒤에 ?t=... 를 붙여서 무조건 최신 데이터를 가져옵니다.
fetch('./schedule.json?t=' + new Date().getTime())
  .then(function(res){ 
    if (!res.ok) throw new Error('파일을 찾을 수 없습니다.');
    return res.json(); 
  })
  .then(function(data){
    Object.assign(scheduleData, data);
    populateYearSelector();
    
    // URL 파라미터 처리
    var qs = new URLSearchParams(location.search);
    var yearParam  = qs.get('year');
    var focusParam = qs.get('focus');
    
    // URL에 특정 연도가 있거나, 2026년이 데이터에 있으면 보여줌
    if (yearParam && (scheduleData[yearParam] || yearParam === '2026')) {
      renderSchedule(yearParam, focusParam);
      var sel = document.getElementById('yearSelector');
      if (sel) sel.value = yearParam;
    } else {
      renderSchedule('전체');
    }
  })
  .catch(function(error){ 
    console.error('JSON 로딩 실패:', error);
    document.getElementById('scheduleContainer').innerHTML = 
      '<div style="text-align:center; padding:20px; color:red;">' +
      '데이터 로딩 실패! (JSON 문법을 확인해주세요)<br>' + error.message + 
      '</div>';
  });

function populateYearSelector() {
  var sel = document.getElementById('yearSelector');
  var years = Object.keys(scheduleData);
  
  // 2026년이 데이터에 없어도 강제로 목록에 추가 (혹시 몰라서 유지)
  if (years.indexOf('2026') === -1) {
    years.push('2026');
  }

  // 내림차순 정렬 (2026 -> 2025 -> ...)
  years.sort(function(a,b){ return b - a; });

  var all = document.createElement('option'); 
  all.value = '전체'; 
  all.textContent = '전체 요약'; 
  sel.appendChild(all);

  years.forEach(function(y){
    var opt = document.createElement('option'); 
    opt.value = y; 
    opt.textContent = y + '년'; 
    sel.appendChild(opt);
  });

  sel.addEventListener('change', function(){ renderSchedule(sel.value); });
}

function renderSchedule(year, focusId) {
  var container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  // 1. 전체 요약 보기
  if (year === '전체') {
    var years = Object.keys(scheduleData);
    if (years.indexOf('2026') === -1) years.push('2026');
    years.sort(function(a,b){ return b - a; });

    var summaryLines = years.map(function(y){
      var games = scheduleData[y] || []; 
      var w=0,l=0,t=0;
      games.forEach(function(g){ if(g.result==='승') w++; else if(g.result==='패') l++; else if(g.result==='무') t++; });
      
      var pct = (w+l>0) ? ((w/(w+l))*100).toFixed(1)+'%' : '-';
      return '<div>'+y+'년: '+w+'승 '+l+'패'+(t?' '+t+'무':'')+' / 승률: '+pct+'</div>';
    }).join('');
    
    var box=document.createElement('div'); 
    box.className='summary-box'; 
    box.innerHTML=summaryLines; 
    container.appendChild(box);
    return;
  }

  // 2. 특정 연도 상세 보기
  var games = scheduleData[year] || [];
  
  if (games.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">등록된 일정이 없습니다.</div>';
    return;
  }

  games.forEach(function(game){
    var box = document.createElement('div');
    box.className = 'game-box';

    var date = game.date || '날짜 미정';
    var time = game.time ? ' ' + game.time : '';
    var opponent = game.opponent || '상대팀';
    var score = game.score || '';
    var result = game.result ? ' (' + game.result + ')' : '';
    var location = game.location || '장소 미정';
    var league = game.type || game.league || '리그 미정';

    var detailId = game.detailId || game.id || '';
    // detailed가 true(혹은 "true")일 때만 상세 버튼 활성화
    var detailed = (game.detailed===true || game.detailed==='true' || game.detailed===1);
    var canOpen = detailed && !!detailId;

    var cardId = detailId ? ('game-' + detailId) : ('game-' + Math.random().toString(36).slice(2));
    box.id = cardId;

    var href = canOpen ? ('detail.html?detailId=' + encodeURIComponent(detailId)) : '';

    box.innerHTML =
      '<div class="date">'+date+time+'</div>'+
      '<div class="matchup">TAURUS vs '+opponent+'</div>'+
      '<div class="result">'+score+result+'</div>'+
      '<div class="details">'+location+'<br>'+league+'</div>'+
      '<div class="actions" style="margin-top:8px">'+
      (canOpen
        ? '<a class="detail-link" href="'+href+'">상세기록 보기</a>'
        : '<span class="detail-link" style="opacity:.55;cursor:not-allowed">업로드 예정</span>')+
      '</div>';

    container.appendChild(box);
  });

  // 스크롤 포커스 이동
  if (focusId) {
    var target = document.getElementById('game-' + focusId);
    if (target) {
      target.style.outline = '2px solid #7c2d8a';
      target.style.outlineOffset = '2px';
      setTimeout(function(){
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      setTimeout(function(){ target.style.outline=''; target.style.outlineOffset=''; }, 2500);
    }
  }
}