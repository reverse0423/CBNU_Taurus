import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, push, update, onValue } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// ★★★ 설정값 (databaseURL 포함됨 확인 완료) ★★★
const firebaseConfig = {
    apiKey: "AIzaSyDMVkogwvzoQon3lo0_hiVewfoXxmvbYMU",
    authDomain: "taurus-cbnu.firebaseapp.com",
    databaseURL: "https://taurus-cbnu-default-rtdb.firebaseio.com",
    projectId: "taurus-cbnu",
    storageBucket: "taurus-cbnu.firebasestorage.app",
    messagingSenderId: "598393475132",
    appId: "1:598393475132:web:b266ef01509e6c20dd7339"
};

// 앱 초기화
let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("Firebase Connected Successfully");
} catch (e) {
    console.error("Firebase Connection Failed:", e);
    alert("파이어베이스 연결 실패! 콘솔 확인 필요.");
}

// === 전역 상태 ===
let gameState = {
    myTeam: 'away', // 'home' or 'away'
    oppName: '상대팀',
    inningStr: '1회초', // 문자열로 관리 (단순화)
    score: { away: 0, home: 0 },
    bso: { b:0, s:0, o:0 },
    runners: { b1: null, b2: null, b3: null },
    lineup: [],
    currentBatterIdx: 0
};

// === DOM 로드 후 이벤트 바인딩 ===
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 라인업 입력칸 생성
    const grid = document.getElementById('lineupInputs');
    if (grid) {
        for(let i=0; i<9; i++) {
            const div = document.createElement('div');
            div.className = 'lineup-row';
            div.innerHTML = `
                <span class="pos-badge">${i+1}번</span>
                <input type="text" id="pName${i}" class="lineup-name-input" placeholder="이름" style="width:100px; padding:6px;">
            `;
            grid.appendChild(div);
        }
    }

    // 2. 버튼 이벤트 연결 (addEventListener 사용)
    bindEvent('loginBtn', 'click', handleLogin);
    bindEvent('adminPw', 'keypress', (e) => { if(e.key==='Enter') handleLogin(); });
    bindEvent('startGameBtn', 'click', startGame);
    
    bindEvent('btnPrevInn', 'click', () => changeInning(-1));
    bindEvent('btnNextInn', 'click', () => changeInning(1));
    bindEvent('resetCountBtn', 'click', () => { resetCount(); syncAll(); renderBoard(); });
    bindEvent('sendTextBtn', 'click', sendManualText);
    bindEvent('resetGameBtn', 'click', resetGame);
    bindEvent('closeModalBtn', 'click', closeModal);

    // 액션 패드 버튼들 (위임 방식 말고 직접 바인딩)
    document.querySelectorAll('.act-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.act;
            handleAction(action);
        });
    });

    // 베이스 클릭 이벤트 (주자 삭제/변경)
    document.querySelectorAll('.base-plate').forEach(plate => {
        plate.addEventListener('click', (e) => {
            const base = plate.dataset.base;
            if(base) {
                if(gameState.runners[base]) {
                    if(confirm(`${gameState.runners[base]} 주자를 지우시겠습니까?`)) {
                        gameState.runners[base] = null;
                        syncAll(); renderBoard();
                    }
                } else {
                    const name = prompt("주자 이름 입력:");
                    if(name) {
                        gameState.runners[base] = name;
                        syncAll(); renderBoard();
                    }
                }
            }
        });
    });
});

// 유틸: 이벤트 바인딩 헬퍼
function bindEvent(id, type, handler) {
    const el = document.getElementById(id);
    if(el) el.addEventListener(type, handler);
}

// === 핸들러 함수들 ===

function handleLogin() {
    const pw = document.getElementById('adminPw').value;
    if(pw === 'taurus') {
        document.getElementById('loginLayer').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
    } else {
        alert('비밀번호 오류');
    }
}

function startGame() {
    const homeAwayRadio = document.querySelector('input[name="homeAway"]:checked');
    const isHome = homeAwayRadio ? (homeAwayRadio.value === 'home') : false;
    const opp = document.getElementById('oppName').value || '상대팀';
    
    gameState.myTeam = isHome ? 'home' : 'away';
    gameState.oppName = opp;
    gameState.inningStr = '1회초'; // 초기화
    
    // 라인업 읽기
    gameState.lineup = [];
    for(let i=0; i<9; i++) {
        const input = document.getElementById('pName' + i);
        const name = input ? input.value.trim() : '';
        gameState.lineup.push({ 
            name: name || `타자${i+1}`, 
            ab:0, h:0, rbi:0, run:0, bb:0, k:0 
        });
    }

    // UI 전환
    document.getElementById('setupSection').style.display = 'none';
    document.getElementById('gameSection').style.display = 'block';
    
    syncAll();
    renderBoard();
}

function handleAction(act) {
    if(act.includes('_menu')) {
        openModal(act);
    } else {
        processPlay(act);
    }
}

// 모달 열기
function openModal(menuType) {
    const m = document.getElementById('actionModal');
    const b = document.getElementById('amButtons');
    const t = document.getElementById('amTitle');
    b.innerHTML = ''; 
    m.style.display = 'flex';

    let btns = [];
    if(menuType === 'hit_menu') {
        t.textContent = '안타 상세';
        btns = [
            { txt: '1루타 (단타)', code: '1b' },
            { txt: '내야안타', code: 'inf_hit' }
        ];
    } else if (menuType === 'fc_menu') {
        t.textContent = '야수선택 / 병살';
        btns = [
            { txt: '타자 세이프 (선행주자 아웃)', code: 'fc_safe' },
            { txt: '병살타 (타자+주자 아웃)', code: 'dp' }
        ];
    } else if (menuType === 'err_menu') {
        t.textContent = '실책';
        btns = [
            { txt: '실책 출루 (타자 살음)', code: 'error_safe' },
            { txt: '주자만 진루 (타자 아웃)', code: 'error_adv' }
        ];
    } else if (menuType === 'etc_menu') {
        t.textContent = '기타';
        btns = [
            { txt: '도루 성공', code: 'sb' },
            { txt: '폭투/포일', code: 'wp' }
        ];
    }

    btns.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'am-btn';
        btn.textContent = item.txt;
        btn.onclick = () => { processPlay(item.code); closeModal(); };
        b.appendChild(btn);
    });
}

function closeModal() {
    document.getElementById('actionModal').style.display = 'none';
}

// === 핵심 로직: 플레이 처리 ===
function processPlay(code) {
    const batter = gameState.lineup[gameState.currentBatterIdx];
    let logText = `[${gameState.currentBatterIdx+1}번 ${batter.name}] : `;
    
    switch(code) {
        // --- 안타 ---
        case '1b': case 'inf_hit':
            batter.ab++; batter.h++;
            logText += (code==='1b' ? '좌전 안타!' : '내야 안타!');
            advanceRunners(1); 
            gameState.runners.b1 = batter.name;
            break;
        case '2b':
            batter.ab++; batter.h++;
            logText += '우중간 2루타!!';
            advanceRunners(2);
            gameState.runners.b2 = batter.name;
            break;
        case '3b':
            batter.ab++; batter.h++;
            logText += '3루타!!!';
            advanceRunners(3);
            gameState.runners.b3 = batter.name;
            break;
        case 'hr':
            batter.ab++; batter.h++; batter.rbi++; batter.run++;
            logText += '홈런~~~~!!!! ⚾️';
            advanceRunners(4);
            break;
        
        // --- 아웃 ---
        case 'go': case 'fo': case 'k':
            batter.ab++;
            if(code==='k') { batter.k++; logText += '삼진 아웃'; }
            else if(code==='fo') logText += '뜬공 아웃';
            else logText += '땅볼 아웃';
            addOut();
            break;
        
        // --- 사사구 ---
        case 'bb': case 'hbp':
            batter.bb++;
            logText += (code==='bb' ? '볼넷 출루' : '몸에 맞는 볼');
            pushRunners();
            gameState.runners.b1 = batter.name;
            break;

        // --- 특수 ---
        case 'fc_safe':
            batter.ab++;
            logText += '야수 선택으로 출루 (선행주자 아웃)';
            addOut();
            if(gameState.runners.b1) gameState.runners.b1 = null; // 단순화: 1루주자 아웃 가정
            gameState.runners.b1 = batter.name;
            break;
        case 'dp':
            batter.ab++;
            logText += '병살타...';
            addOut(); addOut();
            if(gameState.runners.b1) gameState.runners.b1 = null; 
            break;
        case 'error_safe':
            batter.ab++; 
            logText += '상대 실책으로 출루';
            pushRunners();
            gameState.runners.b1 = batter.name;
            break;
            
        case 'sb':
            logText = '도루 성공!';
            alert("도루 처리: 로그는 전송되었습니다.\n주자 위치는 베이스를 클릭하여 수동으로 이동해주세요.");
            break;
    }

    // 타자 교체 (도루 등 제외)
    if(!['sb','wp','error_adv'].includes(code)) {
        nextBatter();
        resetCount();
    }

    log(logText);
    syncAll();
    renderBoard();
}

// === 유틸 함수들 ===

function advanceRunners(bases) {
    let r = gameState.runners;
    let scored = 0;
    
    // 3루주자
    if(r.b3) { r.b3 = null; scored++; }
    
    // 2루주자
    if(r.b2) {
        if(bases >= 2) { r.b2 = null; scored++; }
        else { r.b3 = r.b2; r.b2 = null; }
    }
    
    // 1루주자
    if(r.b1) {
        if(bases >= 3) { r.b1 = null; scored++; }
        else if(bases === 2) { r.b3 = r.b1; r.b1 = null; }
        else { r.b2 = r.b1; r.b1 = null; }
    }

    if(scored > 0) {
        addScore(scored);
        // 타점 추가
        gameState.lineup[gameState.currentBatterIdx].rbi += scored;
    }
}

function pushRunners() {
    // 밀어내기 (간단 버전)
    let r = gameState.runners;
    if(r.b1) {
        if(r.b2) {
            if(r.b3) {
                addScore(1); // 만루 볼넷
                gameState.lineup[gameState.currentBatterIdx].rbi++;
            } else r.b3 = r.b2;
        } else r.b2 = r.b1;
    }
    // b1은 호출부에서 채움
}

function addOut() {
    gameState.bso.o++;
    if(gameState.bso.o >= 3) {
        alert("3아웃! 공수교대 타이밍입니다.\n이닝을 변경하고 주자를 비워주세요.");
        gameState.bso.o = 0;
        gameState.runners = {b1:null, b2:null, b3:null};
    }
}

function addScore(n) {
    if(gameState.myTeam === 'home') gameState.score.home += n;
    else gameState.score.away += n;
}

function nextBatter() {
    gameState.currentBatterIdx = (gameState.currentBatterIdx + 1) % 9;
}

function resetCount() {
    gameState.bso = { b:0, s:0, o: gameState.bso.o }; // 아웃은 유지
}

function changeInning(delta) {
    // 단순 문자열 처리 (1회초 -> 1회말 -> 2회초...)
    let s = gameState.inningStr;
    let num = parseInt(s);
    let isTop = s.includes('초');
    
    if(delta > 0) { // 다음
        if(isTop) gameState.inningStr = `${num}회말`;
        else gameState.inningStr = `${num+1}회초`;
    } else { // 이전
        if(num === 1 && isTop) return;
        if(!isTop) gameState.inningStr = `${num}회초`;
        else gameState.inningStr = `${num-1}회말`;
    }
    syncAll(); renderBoard();
}

function sendManualText() {
    const t = document.getElementById('comment').value;
    if(t) {
        log(t);
        document.getElementById('comment').value = '';
    }
}

function resetGame() {
    if(confirm("정말 초기화합니까? 모든 데이터가 사라집니다.")) {
        set(ref(db, 'status'), null);
        set(ref(db, 'logs'), null);
        alert("초기화 완료");
        location.reload();
    }
}

// === 파이어베이스 통신 ===
function syncAll() {
    const statusRef = ref(db, 'status');
    update(statusRef, {
        score: gameState.score,
        inning: gameState.inningStr,
        bso: gameState.bso,
        runners: gameState.runners,
        teams: { 
            home: (gameState.myTeam==='home' ? 'TAURUS' : gameState.oppName), 
            away: (gameState.myTeam==='away' ? 'TAURUS' : gameState.oppName) 
        },
        currentBatterIdx: gameState.currentBatterIdx,
        lineup: gameState.lineup
    });
}

function log(msg) {
    const now = new Date();
    push(ref(db, 'logs'), {
        text: msg,
        time: `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,
        notice: false
    });
}

function renderBoard() {
    // 텍스트 반영
    const g = gameState;
    document.getElementById('scAway').textContent = g.score.away;
    document.getElementById('scHome').textContent = g.score.home;
    document.getElementById('dispAway').textContent = (g.myTeam==='away'?'TAURUS':g.oppName);
    document.getElementById('dispHome').textContent = (g.myTeam==='home'?'TAURUS':g.oppName);
    document.getElementById('inningVal').textContent = g.inningStr;
    
    document.getElementById('cntB').value = g.bso.b;
    document.getElementById('cntS').value = g.bso.s;
    document.getElementById('cntO').value = g.bso.o;
    
    // 주자
    const setBase = (id, name) => {
        const el = document.getElementById(id);
        if(name) { el.classList.add('active'); el.title = name; }
        else { el.classList.remove('active'); el.title = ''; }
    };
    setBase('base1', g.runners.b1);
    setBase('base2', g.runners.b2);
    setBase('base3', g.runners.b3);
    
    // 현재 타자
    if(g.lineup[g.currentBatterIdx]) {
        document.getElementById('currentBatterDisplay').textContent = 
            `현재 타석: ${g.lineup[g.currentBatterIdx].name} (${g.currentBatterIdx+1}번)`;
    }
    
    // 라인업 표
    const tbody = document.getElementById('lineupTableBody');
    tbody.innerHTML = '';
    g.lineup.forEach((p, i) => {
        const isCur = (i === g.currentBatterIdx);
        // 타자 이름 클릭 시 강제 교체 기능 (editBatter)
        tbody.innerHTML += `
            <tr class="${isCur ? 'current-batter' : ''}" style="cursor:pointer;" onclick="changeBatter(${i})">
                <td>${i+1}</td>
                <td class="bs-name">${p.name}</td>
                <td>${p.ab}</td>
                <td style="color:red; font-weight:bold;">${p.h}</td>
                <td>${p.rbi}</td>
                <td>${p.run}</td>
                <td>${p.bb}</td>
                <td>${p.k}</td>
            </tr>
        `;
    });
}

// 전역 함수 노출 (HTML onclick 사용 시 대비, but addEventListener 권장)
window.changeBatter = (idx) => {
    if(confirm(`${idx+1}번 타자로 순서를 강제 변경하시겠습니까?`)) {
        gameState.currentBatterIdx = idx;
        syncAll(); renderBoard();
    }
};

// DB 데이터 복구 (새로고침 시)
onValue(ref(db, 'status'), (snap) => {
    const d = snap.val();
    if(d) {
        // 기존 상태 유지하며 덮어쓰기
        gameState = { ...gameState, ...d };
        // inningStr 변수명 매핑 (DB엔 inning으로 저장됐을 수 있음)
        if(d.inning) gameState.inningStr = d.inning;
        renderBoard();
        
        // 게임 섹션 보이기
        document.getElementById('setupSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
    }
});