// schedule.js — FINAL (detailed gate + year/focus deep-link + focus scroll)
var scheduleData = {};

fetch('./schedule.json')
  .then(function(res){ return res.json(); })
  .then(function(data){
    Object.assign(scheduleData, data);
    populateYearSelector();
    // URL 파라미터 반영
    var qs = new URLSearchParams(location.search);
    var yearParam  = qs.get('year');
    var focusParam = qs.get('focus');
    if (yearParam && scheduleData[yearParam]) {
      renderSchedule(yearParam, focusParam);
      var sel = document.getElementById('yearSelector');
      if (sel) sel.value = yearParam;
    } else {
      renderSchedule('전체');
    }
  })
  .catch(function(error){ console.error('JSON 로딩 실패:', error); });

function populateYearSelector() {
  var sel = document.getElementById('yearSelector');
  var years = Object.keys(scheduleData).sort(function(a,b){ return b - a; });
  var all = document.createElement('option'); all.value='전체'; all.textContent='전체 요약'; sel.appendChild(all);
  years.forEach(function(y){
    var opt=document.createElement('option'); opt.value=y; opt.textContent=y+'년'; sel.appendChild(opt);
  });
  sel.addEventListener('change', function(){ renderSchedule(sel.value); });
}

function renderSchedule(year, focusId) {
  var container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  // 전체 요약
  if (year === '전체') {
    var years = Object.keys(scheduleData).sort(function(a,b){ return b - a; });
    var summaryLines = years.map(function(y){
      var games = scheduleData[y] || []; var w=0,l=0,t=0;
      games.forEach(function(g){ if(g.result==='승') w++; else if(g.result==='패') l++; else if(g.result==='무') t++; });
      var pct = (w+l>0) ? ((w/(w+l))*100).toFixed(1)+'%' : '-';
      return '<div>'+y+'년: '+w+'승 '+l+'패'+(t?' '+t+'무':'')+' / 승률: '+pct+'</div>';
    }).join('');
    var box=document.createElement('div'); box.className='summary-box'; box.innerHTML=summaryLines; container.appendChild(box);
    return;
  }

  // 특정 연도 상세
  (scheduleData[year] || []).forEach(function(game){
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
    var detailed = (game.detailed===true || game.detailed==='true' || game.detailed===1);
    var canOpen = detailed && !!detailId;

    // 카드 id 부여(스크롤 포커스용)
    var cardId = detailId ? ('game-' + detailId) : ('game-' + Math.random().toString(36).slice(2));
    box.id = cardId;

    // 링크: 상세 페이지에 연도/포커스 동봉
    var href = canOpen ? ('detail.html?detailId=' + encodeURIComponent(detailId)) : '';

    box.innerHTML =
      '<div class="date">'+date+time+'</div>'+
      '<div class="matchup">충북대학교 타우루스 vs '+opponent+'</div>'+
      '<div class="result">'+score+result+'</div>'+
      '<div class="details">'+location+'<br>'+league+'</div>'+
      '<div class="actions" style="margin-top:8px">'+
      (canOpen
        ? '<a class="detail-link" href="'+href+'">상세기록 보기</a>'
        : '<span class="detail-link" style="opacity:.55;cursor:not-allowed">업로드 예정</span>')+
      '</div>';

    container.appendChild(box);
  });

  // 포커스 스크롤
  if (focusId) {
    var target = document.getElementById('game-' + focusId);
    if (target) {
      target.style.outline = '2px solid #7c2d8a';
      target.style.outlineOffset = '2px';
      setTimeout(function(){
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      // 하이라이트 서서히 제거
      setTimeout(function(){ target.style.outline=''; target.style.outlineOffset=''; }, 2500);
    }
  }
}