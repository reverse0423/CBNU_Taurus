const aboutData = {
  "2025": {
    president: "홍길동",
    vicePresident: "이순신",
    generalManager: "김유신",
    amateurLeague: {
      rank: "2위",
      wins: 5,
      losses: 2
    },
    collegeLeague: "4강 진출"
  },
  "2024": {
    president: "강감찬",
    vicePresident: "최무선",
    generalManager: "장보고",
    amateurLeague: {
      rank: "1위",
      wins: 6,
      losses: 1
    },
    collegeLeague: "준우승"
  },
  "2023": {
    president: "신사임당",
    vicePresident: "유관순",
    generalManager: "김홍도",
    amateurLeague: {
      rank: "3위",
      wins: 4,
      losses: 3
    },
    collegeLeague: "8강 탈락"
  },
  "total": {
    president: "-",
    vicePresident: "-",
    generalManager: "-",
    amateurLeague: {
      rank: "-",
      wins: 15,
      losses: 6
    },
    collegeLeague: "통산 준우승 1회, 4강 1회"
  }
};

function loadYearData() {
  const year = document.getElementById("yearSelect").value;
  const data = aboutData[year];
  const content = document.getElementById("aboutContent");

  content.innerHTML = `
    <div class="about-box">
      <h3>${year === 'total' ? '통산 기록' : year + '년 주요 정보'}</h3>
      <p><strong>회장:</strong> ${data.president}</p>
      <p><strong>부회장:</strong> ${data.vicePresident}</p>
      <p><strong>총무:</strong> ${data.generalManager}</p>
      <p><strong>사회인 리그 성적:</strong> ${data.amateurLeague.rank} (${data.amateurLeague.wins}승 ${data.amateurLeague.losses}패)</p>
      <p><strong>대학부 대회 성적:</strong> ${data.collegeLeague}</p>
    </div>
  `;
}

window.onload = loadYearData;
