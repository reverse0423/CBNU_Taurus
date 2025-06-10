let currentData = [];
let fullData = [];
let isQualifiedFilterOn = false;

function loadRecords(year) {
  fetch(`records_${year}.json`)
    .then(res => res.json())
    .then(data => {
      fullData = data;
      applyFilterAndRender();
    })
    .catch(err => {
      console.error(`기록 불러오기 실패 (${year}):`, err);
    });
}

function applyFilterAndRender() {
  if (isQualifiedFilterOn) {
    currentData = fullData.filter(player => parseInt(player.pa) >= 40);
  } else {
    currentData = [...fullData];
  }
  renderTable(currentData);
}

function toggleQualified() {
  isQualifiedFilterOn = !isQualifiedFilterOn;
  const btn = document.getElementById('toggleFilter');
  btn.textContent = isQualifiedFilterOn ? "전체 보기" : "규정타석 기준 적용";
  applyFilterAndRender();
}

function formatNumber(val) {
  const num = parseFloat(val);
  return isNaN(num) ? '-' : num.toFixed(3);
}

function renderTable(data) {
  const tbody = document.getElementById('record-body');
  tbody.innerHTML = '';

  data.forEach(player => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="sticky-col">
        <span class="player-name" onclick="goToProfile(${player.number})">${player.name}</span>
      </td>
      <td>${formatNumber(player.avg)}</td>
      <td>${player.pa}</td>
      <td>${player.ab}</td>
      <td>${player.hits}</td>
      <td>${player.double}</td>
      <td>${player.triple}</td>
      <td>${player.hr}</td>
      <td>${player.bb}</td>
      <td>${player.hbp}</td>
      <td>${formatNumber(player.obp)}</td>
      <td>${formatNumber(player.slg)}</td>
      <td>${formatNumber(player.ops)}</td>
      <td>${formatNumber(player.woba)}</td>
      <td>${formatNumber(player.babip)}</td>
      <td>${player.sb}</td>
    `;
    tbody.appendChild(tr);
  });
}

function sortTable(key) {
  const sorted = [...currentData].sort((a, b) => {
    const aVal = parseFloat(a[key]);
    const bVal = parseFloat(b[key]);
    return isNaN(aVal) || isNaN(bVal) ? 0 : bVal - aVal;
  });
  renderTable(sorted);
}

function changeYear() {
  const year = document.getElementById('year').value;
  const btn = document.getElementById('toggleFilter');

  if (year === 'career') {
    btn.style.display = 'inline-block';
  } else {
    btn.style.display = 'none';
    isQualifiedFilterOn = false;
    btn.textContent = '규정타석 기준 적용';
  }

  loadRecords(year);
}

function goToProfile(playerNumber) {
  window.location.href = `player.html?id=${playerNumber}`;
}

window.addEventListener('DOMContentLoaded', () => {
  loadRecords('2025');
});
