// 시뮬레이션 탭 — 직접 점수를 입력해 순위 변화를 확인

// 시뮬레이션용 별도 데이터 (원본 WORLD_CUP_2026.matches를 건드리지 않음)
let simMatches = [];

function initSimulation() {
  // 깊은 복사(deep copy): 원본 배열을 복사해서 시뮬레이션 전용으로 사용
  simMatches = WORLD_CUP_2026.matches.map((m) => ({ ...m }));
  renderSimulation();
}

function renderSimulation() {
  const container = document.getElementById("subtab-sim-group");
  container.innerHTML = "";

  const groups = WORLD_CUP_2026.groups;

  for (const groupKey of Object.keys(groups)) {
    const groupMatches = simMatches.filter((m) => m.group === groupKey);

    const header = document.createElement("div");
    header.className = "group-header";
    header.textContent = groups[groupKey].name;
    container.appendChild(header);

    // 경기 입력 카드
    groupMatches.forEach((match, idx) => {
      const globalIdx = simMatches.indexOf(match);
      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <span class="match-team home">${match.home}</span>
        <input class="score-input" type="number" min="0" max="20"
               value="${match.homeScore ?? ""}"
               data-idx="${globalIdx}" data-side="home" />
        <span style="color:#555; padding:0 6px">:</span>
        <input class="score-input" type="number" min="0" max="20"
               value="${match.awayScore ?? ""}"
               data-idx="${globalIdx}" data-side="away" />
        <span class="match-team away">${match.away}</span>
      `;
      container.appendChild(card);
    });

    // 순위표
    const standingsContainer = document.createElement("div");
    standingsContainer.id = `sim-standings-${groupKey}`;
    container.appendChild(standingsContainer);
    renderSimStandings(groupKey, standingsContainer);
  }

  // 점수 입력 시 실시간 순위 업데이트
  container.addEventListener("input", (event) => {
    const input = event.target.closest(".score-input");
    if (!input) return;

    const idx = parseInt(input.dataset.idx);
    const side = input.dataset.side;
    const val = input.value === "" ? null : parseInt(input.value);

    simMatches[idx][side === "home" ? "homeScore" : "awayScore"] = val;

    // 해당 조의 순위만 다시 렌더링
    const groupKey = simMatches[idx].group;
    const sc = document.getElementById(`sim-standings-${groupKey}`);
    sc.innerHTML = "";
    renderSimStandings(groupKey, sc);
  });
}

function renderSimStandings(groupKey, container) {
  // calcStandings는 WORLD_CUP_2026.matches를 참조하므로
  // 시뮬레이션에서는 simMatches를 임시 교체 후 복원
  const original = WORLD_CUP_2026.matches;
  WORLD_CUP_2026.matches = simMatches;
  renderStandings(groupKey, container);
  WORLD_CUP_2026.matches = original;
}

document.addEventListener("DOMContentLoaded", initSimulation);
