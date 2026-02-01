import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMVkogwvzoQon3lo0_hiVewfoXxmvbYMU",
    authDomain: "taurus-cbnu.firebaseapp.com",
    
    // ▼▼▼ 이 줄이 빠져있어서 안 되는 겁니다!!!! ▼▼▼
    databaseURL: "https://taurus-cbnu-default-rtdb.firebaseio.com", 
    // ▲▲▲ 이 줄이 꼭 있어야 합니다!!!! ▲▲▲
    
    projectId: "taurus-cbnu",
    storageBucket: "taurus-cbnu.firebasestorage.app",
    messagingSenderId: "598393475132",
    appId: "1:598393475132:web:b266ef01509e6c20dd7339"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 탭 전환
const tabLog = document.getElementById('tabLog');
const tabBox = document.getElementById('tabBox');
const logView = document.getElementById('logList');
const boxView = document.getElementById('boxScoreView');

tabLog.onclick = () => { tabLog.className='active'; tabBox.className=''; logView.style.display='block'; boxView.style.display='none'; };
tabBox.onclick = () => { tabBox.className='active'; tabLog.className=''; boxView.style.display='block'; logView.style.display='none'; };

// 상태 동기화
onValue(ref(db, 'status'), (snap) => {
    const d = snap.val();
    if(!d) return;

    // 점수 & 팀명
    document.getElementById('scAway').textContent = d.score.away;
    document.getElementById('scHome').textContent = d.score.home;
    document.getElementById('nameAway').textContent = d.teams.away;
    document.getElementById('nameHome').textContent = d.teams.home;
    document.getElementById('innDisplay').textContent = d.inning;
    
    // 주자 & BSO
    const setBase = (id, name) => {
        const el = document.getElementById(id);
        if(name) { el.classList.add('on'); el.title = name; }
        else { el.classList.remove('on'); el.title = ''; }
    };
    setBase('b1', d.runners.b1);
    setBase('b2', d.runners.b2);
    setBase('b3', d.runners.b3);
    document.getElementById('bsoText').textContent = `${d.bso.b}-${d.bso.s}-${d.bso.o}`;

    // 현재 타자
    if(d.lineup && d.currentBatterIdx != null) {
        const batter = d.lineup[d.currentBatterIdx];
        document.getElementById('currentBatterMsg').textContent = `타석: ${batter.name} (${d.currentBatterIdx+1}번)`;
    }

    // 기록지 렌더링
    if(d.lineup) {
        const tbody = document.getElementById('liveLineupBody');
        tbody.innerHTML = '';
        d.lineup.forEach((p, i) => {
            const isCur = (i === d.currentBatterIdx);
            tbody.innerHTML += `
                <tr class="${isCur ? 'current-batter' : ''}">
                    <td>${i+1}</td>
                    <td style="text-align:left; font-weight:bold;">${p.name}</td>
                    <td>${p.ab}</td>
                    <td style="color:#e11d48;">${p.h}</td>
                    <td>${p.rbi}</td>
                    <td>${p.bb}</td>
                </tr>
            `;
        });
    }
});

// 로그 추가
onChildAdded(ref(db, 'logs'), (snap) => {
    const d = snap.val();
    const div = document.createElement('div');
    div.className = `log-item ${d.notice ? 'notice' : ''}`;
    div.innerHTML = `<div class="log-time">${d.time}</div><div class="log-text">${d.text}</div>`;
    logView.prepend(div);
});