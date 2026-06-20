// 조별리그 화면 렌더링

// 동률 팀들의 직접 대결 승점 계산
function calcH2HPts(tiedTeams, allMatches) {
  const teamIds = tiedTeams.map(t => t.team_id);
  const h2hPts = {};
  teamIds.forEach(id => h2hPts[id] = 0);

  allMatches
    .filter(m =>
      teamIds.includes(m.home_team_id) &&
      teamIds.includes(m.away_team_id) &&
      (m.finished === true || m.finished === "TRUE")
    )
    .forEach(m => {
      const hs = Number(m.home_score);
      const as = Number(m.away_score);
      if (hs > as)      { h2hPts[m.home_team_id] += 3; }
      else if (hs < as) { h2hPts[m.away_team_id] += 3; }
      else              { h2hPts[m.home_team_id] += 1; h2hPts[m.away_team_id] += 1; }
    });

  return h2hPts;
}

// 1.승점 → 2.승자승 → 3.득실차 → 4.다득점 순으로 정렬
function sortTeams(teams) {
  const sorted = [...teams].sort((a, b) => Number(b.pts) - Number(a.pts));
  const result = [];
  let i = 0;

  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && Number(sorted[j].pts) === Number(sorted[i].pts)) j++;

    const tiedGroup = sorted.slice(i, j);
    if (tiedGroup.length > 1) {
      const h2hPts = calcH2HPts(tiedGroup, matchesData);
      tiedGroup.sort((a, b) => {
        if (h2hPts[b.team_id] !== h2hPts[a.team_id]) return h2hPts[b.team_id] - h2hPts[a.team_id];
        if (Number(b.gd) !== Number(a.gd)) return Number(b.gd) - Number(a.gd);
        return Number(b.gf) - Number(a.gf);
      });
    }
    result.push(...tiedGroup);
    i = j;
  }
  return result;
}

// 조 요약 카드 (그리드에 표시)
function renderGroupCard(group) {
  const card = document.createElement("div");
  card.className = "group-card";
  card.innerHTML = `
    <div class="group-card-header">${group.name}조</div>
    <table class="standings-table summary">
      <thead>
        <tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>승점</th></tr>
      </thead>
      <tbody>
        ${sortTeams(group.teams)
          .map((t, i) => {
            const team = teamsMap[t.team_id] || {};
            const flag = team.flag ? `<img src="${team.flag}" class="flag-icon">` : "";
            const name = team.name_ko || team.name_en || `팀 ${t.team_id}`;
            return `
              <tr>
                <td>${i + 1}</td>
                <td class="team-cell">${flag}<span>${name}</span></td>
                <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td><strong>${t.pts}</strong></td>
              </tr>`;
          }).join("")}
      </tbody>
    </table>
  `;
  card.addEventListener("click", () => openGroupModal(group));
  return card;
}

// 상세 모달 열기
function openGroupModal(group) {
  const modal = document.getElementById("group-modal");
  const modalBody = document.getElementById("modal-body");

  // 상세 순위표
  const sortedTeams = sortTeams(group.teams);

  let html = `
    <h2 class="modal-group-title">${group.name}조</h2>
    <table class="standings-table">
      <thead>
        <tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득점</th><th>실점</th><th>득실</th><th>승점</th></tr>
      </thead>
      <tbody>
        ${sortedTeams.map((t, i) => {
          const team = teamsMap[t.team_id] || {};
          const flag = team.flag ? `<img src="${team.flag}" class="flag-icon">` : "";
          const name = team.name_ko || team.name_en || `팀 ${t.team_id}`;
          return `
            <tr>
              <td>${i + 1}</td>
              <td class="team-cell">${flag}<span>${name}</span></td>
              <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
              <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td>
              <td><strong>${t.pts}</strong></td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="match-list">
  `;

  // 경기 목록 - 시간순 정렬
  const groupMatches = matchesData
    .filter(m => m.group === group.name && m.type === "group")
    .sort((a, b) => new Date(a.local_date) - new Date(b.local_date));
  groupMatches.forEach(match => {
    const homeTeam = teamsMap[match.home_team_id] || {};
    const awayTeam = teamsMap[match.away_team_id] || {};
    const homeFlag = homeTeam.flag ? `<img src="${homeTeam.flag}" class="flag-icon">` : "";
    const awayFlag = awayTeam.flag ? `<img src="${awayTeam.flag}" class="flag-icon">` : "";
    const isFinished = match.finished === true || match.finished === "TRUE";
    const score = isFinished ? `${match.home_score} - ${match.away_score}` : "VS";
    const homeName = homeTeam.name_ko || match.home_team_name_en;
    const awayName = awayTeam.name_ko || match.away_team_name_en;
    const matchTime = toKST(match.local_date, match.stadium_id);
    html += `
      <div class="match-card">
        <span class="match-datetime">${matchTime}</span>
        <span class="match-team home">${homeName} ${homeFlag}</span>
        <span class="match-score ${isFinished ? "finished" : ""}">${score}</span>
        <span class="match-team away">${awayFlag} ${awayName}</span>
      </div>`;
  });

  html += `</div>`;
  modalBody.innerHTML = html;
  modal.classList.add("active");
}

// 모달 닫기
function closeGroupModal() {
  document.getElementById("group-modal").classList.remove("active");
}

// 전체 그리드 렌더링
async function renderSchedule() {
  const container = document.getElementById("subtab-schedule-group");
  container.innerHTML = "<p>데이터 불러오는 중...</p>";

  try {
    await loadAllData();
    container.innerHTML = `
      <div class="groups-grid"></div>
      <div id="group-modal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" onclick="closeGroupModal()">✕</button>
          <div id="modal-body"></div>
        </div>
      </div>
    `;
    const grid = container.querySelector(".groups-grid");
    groupsData.forEach(group => grid.appendChild(renderGroupCard(group)));

    // 모달 바깥 클릭 시 닫기
    document.getElementById("group-modal").addEventListener("click", (e) => {
      if (e.target.id === "group-modal") closeGroupModal();
    });
  } catch (err) {
    container.innerHTML = `<p style="color:red">데이터 로드 실패: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", renderSchedule);
