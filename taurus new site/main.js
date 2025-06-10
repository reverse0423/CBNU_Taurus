document.addEventListener('DOMContentLoaded', () => {
  const teamName = '충북대학교 타우루스';
  fetch('schedule.json')
    .then(response => {
      if (!response.ok) throw new Error(`네트워크 오류: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const year = new Date().getFullYear().toString();
      const matches = data[year] || [];
      const now = new Date();

      // 다음 경기 (가장 가까운 예정 경기)
      const upcoming = matches
        .filter(m => new Date(`${m.date}T${m.time}`) > now)
        .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
      const next = upcoming[0];

      // 최근 경기 (가장 최근 완료 경기)
      const past = matches
        .filter(m => new Date(`${m.date}T${m.time}`) < now)
        .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
      const recent = past[0];

      // 포맷 함수
      const formatUpcoming = m => `
        <p>${teamName} vs ${m.opponent}</p>
        <p>진행 예정</p>
        <p>${m.type}</p>
        <p>${m.location}</p>
      `;
      const formatRecent = m => `
        <p>${teamName} vs ${m.opponent}</p>
        <p>${m.score} (${m.result})</p>
        <p>${m.type}</p>
        <p>${m.location}</p>
      `;

      // DOM 요소
      const nextSection = document.querySelector('#next-match');
      const recentSection = document.querySelector('#recent-match');
      const nextBox = nextSection.querySelector('.match-info');
      const recentBox = recentSection.querySelector('.match-info');

      // 다음 경기 업데이트 & 가운데 정렬
      if (nextBox) {
        nextBox.innerHTML = next ? formatUpcoming(next) : '<p>예정된 경기가 없습니다.</p>';
        nextSection.style.textAlign = 'center';
      }
      // 최근 경기 업데이트 & 가운데 정렬
      if (recentBox) {
        recentBox.innerHTML = recent ? formatRecent(recent) : '<p>경기 기록이 없습니다.</p>';
        recentSection.style.textAlign = 'center';
      }
    })
    .catch(err => {
      console.error('데이터 로드 오류:', err);
      ['#next-match','#recent-match'].forEach(sel => {
        const section = document.querySelector(sel);
        if (section) {
          const box = section.querySelector('.match-info');
          box.innerHTML = '<p>경기 데이터를 불러올 수 없습니다.</p>';
          section.style.textAlign = 'center';
        }
      });
    });
});
