// 조별 순위 계산 로직
// 순위 기준: 승점 → 득실차 → 다득점

function calcStandings(groupKey) {
  const teams = WORLD_CUP_2026.groups[groupKey].teams;
  const matches = WORLD_CUP_2026.matches.filter((m) => m.group === groupKey);

  // 각 팀의 통계를 초기화
  const stats = {};
  teams.forEach((team) => {
    stats[team] = { team, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
  });

  // 확정된 경기만 계산 (null이 아닌 경우)
  matches.forEach(({ home, away, homeScore, awayScore }) => {
    if (homeScore === null) return;

    stats[home].played++;
    stats[away].played++;
    stats[home].gf += homeScore;
    stats[home].ga += awayScore;
    stats[away].gf += awayScore;
    stats[away].ga += homeScore;

    if (homeScore > awayScore) {
      stats[home].win++;  stats[home].pts += 3;
      stats[away].loss++;
    } else if (homeScore < awayScore) {
      stats[away].win++;  stats[away].pts += 3;
      stats[home].loss++;
    } else {
      stats[home].draw++; stats[home].pts += 1;
      stats[away].draw++; stats[away].pts += 1;
    }
  });

  // 정렬: 승점 → 득실차 → 다득점
  return Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

function renderStandings(groupKey, container) {
  const rows = calcStandings(groupKey);

  const table = document.createElement("table");
  table.className = "standings-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th>
        <th>득점</th><th>실점</th><th>득실</th><th>승점</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:left">${r.team}</td>
          <td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td>
          <td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga}</td>
          <td><strong>${r.pts}</strong></td>
        </tr>
      `).join("")}
    </tbody>
  `;
  container.appendChild(table);
}
