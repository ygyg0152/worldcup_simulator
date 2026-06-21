// ─── 시뮬레이션 상태 ──────────────────────────────────────────────
// matchesData의 사본. 원본은 절대 수정하지 않음.
let simMatches = [];
let simKnockoutMatches = [];  // 토너먼트 경기 점수 저장용

// ─── 초기화 ───────────────────────────────────────────────────────
function initSim() {
  if (simMatches.length > 0) return;
  simMatches = matchesData
    .filter(m => m.type === 'group')
    .map(m => ({ ...m, sim_home_score: 0, sim_away_score: 0 }));
}

function initSimKnockout() {
  if (simKnockoutMatches.length > 0) return;
  simKnockoutMatches = matchesData
    .filter(m => m.type !== 'group')
    .map(m => ({ ...m, sim_home_score: 0, sim_away_score: 0 }));
}

// ─── 결과 확정 토글 ───────────────────────────────────────────────
function toggleSimPlayed(matchId) {
  const m = simMatches.find(m => m.id === matchId);
  if (!m) return;
  if (m.sim_played === true) m.sim_played = false;
  else m.sim_played = true;

  const btn = document.querySelector(`[data-confirm-id="${matchId}"]`);
  if (btn) {
    const confirmed = m.sim_played === true;
    btn.classList.toggle('confirmed', confirmed);
  }
  refreshSimTournamentIfVisible();
  refreshSimThirdsIfVisible();
}

// ─── 점수 변경 (▲▼ 버튼 핸들러) ──────────────────────────────────
function changeSimScore(matchId, side, delta) {
  const m = simMatches.find(m => m.id === matchId);
  if (!m) return;

  if (side === 'home') m.sim_home_score = Math.max(0, m.sim_home_score + delta);
  else                 m.sim_away_score = Math.max(0, m.sim_away_score + delta);

  // 해당 점수 표시만 업데이트 (전체 재렌더링 X)
  const el = document.querySelector(`[data-score-id="${matchId}-${side}"]`);
  if (el) el.textContent = side === 'home' ? m.sim_home_score : m.sim_away_score;

  // 해당 조 순위표만 업데이트
  const standingsEl = document.querySelector(`#sim-group-${m.group} .sim-standings`);
  if (standingsEl) standingsEl.innerHTML = simStandingsHtml(m.group);

  refreshSimTournamentIfVisible();
  refreshSimThirdsIfVisible();
}

// ─── 순위 계산 ────────────────────────────────────────────────────
function calcH2HSimPts(tiedTeams, allMatches) {
  const ids = tiedTeams.map(t => t.team_id);
  const h2h = {};
  ids.forEach(id => h2h[id] = 0);
  allMatches
    .filter(m => ids.includes(m.home_team_id) && ids.includes(m.away_team_id))
    .forEach(m => {
      const hs = m.sim_home_score, as = m.sim_away_score;
      if      (hs > as) h2h[m.home_team_id] += 3;
      else if (hs < as) h2h[m.away_team_id] += 3;
      else              { h2h[m.home_team_id]++; h2h[m.away_team_id]++; }
    });
  return h2h;
}

function sortSimTeams(teams, allMatches) {
  const sorted = [...teams].sort((a, b) => b.pts - a.pts);
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].pts === sorted[i].pts) j++;
    const tied = sorted.slice(i, j);
    if (tied.length > 1) {
      const h2h = calcH2HSimPts(tied, allMatches);
      tied.sort((a, b) => h2h[b.team_id] - h2h[a.team_id] || b.gd - a.gd || b.gf - a.gf);
    }
    result.push(...tied);
    i = j;
  }
  return result;
}

function calcSimGroupStandings(groupName) {
  const matches = simMatches.filter(m => m.group === groupName);
  const ids = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]))];

  const s = {};
  ids.forEach(id => { s[id] = { team_id: id, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });

  matches.forEach(m => {
    const hs = m.sim_home_score, as = m.sim_away_score;
    s[m.home_team_id].mp++; s[m.away_team_id].mp++;
    s[m.home_team_id].gf += hs; s[m.home_team_id].ga += as; s[m.home_team_id].gd += hs - as;
    s[m.away_team_id].gf += as; s[m.away_team_id].ga += hs; s[m.away_team_id].gd += as - hs;
    if      (hs > as) { s[m.home_team_id].w++; s[m.home_team_id].pts += 3; s[m.away_team_id].l++; }
    else if (hs < as) { s[m.away_team_id].w++; s[m.away_team_id].pts += 3; s[m.home_team_id].l++; }
    else              { s[m.home_team_id].d++; s[m.home_team_id].pts++; s[m.away_team_id].d++; s[m.away_team_id].pts++; }
  });

  return sortSimTeams(Object.values(s), matches);
}

// FIFA_THIRD_PLACE_TABLE은 third-place-table.js에서 로드됨

// ─── 진출팀 계산 ──────────────────────────────────────────────────
function getSimQualifiers() {
  const qual = {};
  const thirds = [];
  const groups = [...new Set(simMatches.map(m => m.group))].sort();

  groups.forEach(g => {
    const matches = simMatches.filter(m => m.group === g);
    if (matches.some(m => m.sim_played === false)) return;
    const st = calcSimGroupStandings(g);
    if (st[0]) qual[`Winner Group ${g}`]    = st[0].team_id;
    if (st[1]) qual[`Runner-up Group ${g}`] = st[1].team_id;
    if (st[2]) thirds.push({ group: g, ...st[2] });
  });

  // 3위팀 중 승점→득실→득점 순 상위 8팀
  const best8 = [...thirds]
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8);

  const groupToTeamId = {};
  best8.forEach(t => { groupToTeamId[t.group] = t.team_id; });

  // FIFA 공식 Annex C 테이블로 3위팀 배정
  const sortedKey = best8.map(t => t.group).sort().join('');
  const FIFA_SLOT_LABELS = [
    '3rd Group C/E/F/H/I',
    '3rd Group E/F/G/I/J',
    '3rd Group B/E/F/I/J',
    '3rd Group A/B/C/D/F',
    '3rd Group A/E/H/I/J',
    '3rd Group C/D/F/G/H',
    '3rd Group D/E/I/J/L',
    '3rd Group E/H/I/J/K',
  ];
  const thirdByLabel = {};
  const assignment = FIFA_THIRD_PLACE_TABLE[sortedKey];
  if (assignment) {
    FIFA_SLOT_LABELS.forEach((label, i) => {
      thirdByLabel[label] = groupToTeamId[assignment[i]];
    });
  }
  qual.__thirdByLabel = thirdByLabel;

  return qual;
}

// "Winner Group A" / "Runner-up Group B" / "3rd Group A/B/C" 라벨 → 팀 ID 변환
function resolveLabel(label, qual) {
  if (!label) return '0';
  if (label.startsWith('Winner Group '))    return qual[label] || '0';
  if (label.startsWith('Runner-up Group ')) return qual[label] || '0';
  if (label.startsWith('3rd Group '))       return qual.__thirdByLabel?.[label] || '0';
  return '0';
}

// ─── HTML 생성: 순위표 ────────────────────────────────────────────
function simStandingsHtml(groupName) {
  const st = calcSimGroupStandings(groupName);
  const rows = st.map((t, i) => {
    const team = teamsMap[t.team_id] || {};
    const flag = team.flag ? `<img src="${team.flag}" class="flag-icon">` : '';
    const name = team.name_ko || team.name_en || `팀 ${t.team_id}`;
    return `<tr>
      <td>${i + 1}</td>
      <td class="team-cell">${flag}<span>${name}</span></td>
      <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
      <td>${t.gd >= 0 ? '+' : ''}${t.gd}</td>
      <td><strong>${t.pts}</strong></td>
    </tr>`;
  }).join('');
  return `
    <table class="standings-table sim-standings-table">
      <thead><tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── HTML 생성: 경기 목록 (점수 입력) ────────────────────────────
function simMatchListHtml(groupName) {
  const matches = simMatches
    .filter(m => m.group === groupName)
    .sort((a, b) => new Date(a.local_date) - new Date(b.local_date));

  return matches.map(m => {
    const homeTeam = teamsMap[m.home_team_id] || {};
    const awayTeam = teamsMap[m.away_team_id] || {};
    const homeName = homeTeam.name_ko || m.home_team_name_en || '?';
    const awayName = awayTeam.name_ko || m.away_team_name_en || '?';
    const homeFlag = homeTeam.flag ? `<img src="${homeTeam.flag}" class="flag-icon">` : '';
    const awayFlag = awayTeam.flag ? `<img src="${awayTeam.flag}" class="flag-icon">` : '';
    const time = toKST(m.local_date, m.stadium_id);
    const isReal = m.finished === true || m.finished === 'TRUE';

    const confirmed = m.sim_played === true;
    return `
      <div class="sim-match-card ${isReal ? 'sim-real' : ''}">
        <span class="sim-match-time">${time}</span>
        <span class="sim-team home">${homeFlag}${homeName}</span>
        <div class="sim-score-ctrl">
          <button class="sim-btn" onclick="changeSimScore('${m.id}','home',1)">▲</button>
          <button class="sim-btn" onclick="changeSimScore('${m.id}','home',-1)">▼</button>
        </div>
        <div class="sim-score-center">
          <span class="sim-score-val" data-score-id="${m.id}-home">${m.sim_home_score}</span>
          <span class="sim-sep">-</span>
          <span class="sim-score-val" data-score-id="${m.id}-away">${m.sim_away_score}</span>
        </div>
        <div class="sim-score-ctrl">
          <button class="sim-btn" onclick="changeSimScore('${m.id}','away',1)">▲</button>
          <button class="sim-btn" onclick="changeSimScore('${m.id}','away',-1)">▼</button>
        </div>
        <span class="sim-team away">${awayName}${awayFlag}</span>
        <button class="sim-confirm-btn ${confirmed ? 'confirmed' : ''}"
                data-confirm-id="${m.id}"
                onclick="toggleSimPlayed('${m.id}')">확정</button>
      </div>`;
  }).join('');
}

// ─── 그룹 카드 HTML ───────────────────────────────────────────────
function simGroupCardHtml(groupName) {
  return `
    <div class="sim-group-card" id="sim-group-${groupName}">
      <div class="sim-group-title">${groupName}조</div>
      <div class="sim-standings">${simStandingsHtml(groupName)}</div>
      <div class="sim-match-list">${simMatchListHtml(groupName)}</div>
    </div>`;
}

// ─── 탭 렌더링: 조3위 순위 ───────────────────────────────────────
function renderSimThirdsTab() {
  const container = document.getElementById('subtab-sim-thirds');
  if (!simMatches.length) {
    container.innerHTML = '<p class="placeholder">데이터 로딩 중...</p>';
    return;
  }

  const groups = [...new Set(simMatches.map(m => m.group))].sort();
  const thirds = groups.map(g => {
    const st = calcSimGroupStandings(g);
    if (!st[2]) return null;
    return { group: g, ...st[2] };
  }).filter(Boolean);

  thirds.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf
  );

  const rows = thirds.map((t, i) => {
    const team = teamsMap[t.team_id] || {};
    const flag = team.flag ? `<img src="${team.flag}" class="flag-icon">` : '';
    const name = team.name_ko || team.name_en || `팀 ${t.team_id}`;
    const gd = t.gd;
    const qualified = i < 8 ? 'thirds-qualified' : '';
    return `<tr class="${qualified}">
      <td>${i + 1}</td>
      <td>${t.group}</td>
      <td class="team-cell">${flag}<span>${name}</span></td>
      <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
      <td>${t.gf}</td><td>${t.ga}</td>
      <td>${gd >= 0 ? '+' : ''}${gd}</td>
      <td><strong>${t.pts}</strong></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="padding: 16px; overflow-x: auto;">
      <table class="standings-table thirds-table">
        <thead>
          <tr><th>#</th><th>조</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득</th><th>실</th><th>차</th><th>승점</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── 탭 렌더링: 조별리그 ─────────────────────────────────────────
function renderSimGroupTab() {
  const container = document.getElementById('subtab-sim-group');
  if (!simMatches.length) {
    container.innerHTML = '<p class="placeholder">데이터 로딩 중...</p>';
    return;
  }
  const groups = [...new Set(simMatches.map(m => m.group))].sort();
  container.innerHTML = `<div class="sim-grid">${groups.map(g => simGroupCardHtml(g)).join('')}</div>`;
}

// ─── 토너먼트 점수 관련 ───────────────────────────────────────────

// 국가이름 최대 3글자로 자르기
function shortName(name) {
  if (!name) return '—';
  return name.length > 3 ? name.slice(0, 3) : name;
}

// r32 팀 배정 + 각 라운드 승자를 전파해서 전체 토너먼트 상태 계산
function buildSimKnockoutData() {
  const qual = getSimQualifiers();
  const sorted = simKnockoutMatches.map(m => ({ ...m })).sort((a, b) => Number(a.id) - Number(b.id));

  const r32   = sorted.filter(m => m.type === 'r32');
  const r16   = sorted.filter(m => m.type === 'r16');
  const qf    = sorted.filter(m => m.type === 'qf');
  const sf    = sorted.filter(m => m.type === 'sf');
  const finalM = sorted.find(m => m.type === 'final');
  const thirdM = sorted.find(m => m.type === 'third');

  // 레이블 "Winner/Loser Match X" → 해당 match 객체 참조
  const matchById = {};
  sorted.forEach(m => { matchById[String(m.id)] = m; });
  function src(label) {
    const m = label?.match(/(?:Winner|Loser) Match (\d+)/);
    return m ? matchById[m[1]] : null;
  }

  // r32: 조별 진출팀
  r32.forEach(m => {
    m.sim_home_team_id = resolveLabel(m.home_team_label, qual);
    m.sim_away_team_id = resolveLabel(m.away_team_label, qual);
  });

  // 동점이면 홈팀 승 (시뮬레이션 편의상). sim_played === false이면 미확정(0)
  const winner = m => m.sim_played === false ? '0' : (m.sim_home_score >= m.sim_away_score ? m.sim_home_team_id : m.sim_away_team_id);
  const loser  = m => m.sim_played === false ? '0' : (m.sim_home_score >= m.sim_away_score ? m.sim_away_team_id : m.sim_home_team_id);

  // r16~sf: "Winner Match X" 레이블로 실제 매치 참조해서 승자 전파
  [...r16, ...qf, ...sf].forEach(m => {
    const hm = src(m.home_team_label), am = src(m.away_team_label);
    if (hm) m.sim_home_team_id = winner(hm);
    if (am) m.sim_away_team_id = winner(am);
  });
  if (finalM) {
    const hm = src(finalM.home_team_label), am = src(finalM.away_team_label);
    if (hm) finalM.sim_home_team_id = winner(hm);
    if (am) finalM.sim_away_team_id = winner(am);
  }
  if (thirdM) {
    const hm = src(thirdM.home_team_label), am = src(thirdM.away_team_label);
    if (hm) thirdM.sim_home_team_id = loser(hm);
    if (am) thirdM.sim_away_team_id = loser(am);
  }

  return sorted;
}

// 시뮬 브라켓 팀 행: 국기 국가이름(max3) 점수 [▲▼]
function renderSimBracketTeam(match, side, isWinner) {
  const teamId = side === 'home' ? match.sim_home_team_id : match.sim_away_team_id;
  const score  = side === 'home' ? match.sim_home_score  : match.sim_away_score;

  let flagHtml = '';
  let nameHtml = '<span class="sim-bt-name tbd-label">—</span>';
  let confirmed = false;

  if (teamId && teamId !== '0') {
    const team = teamsMap[teamId];
    if (team) {
      flagHtml = `<img src="${team.flag}" class="flag-icon">`;
      nameHtml = `<span class="sim-bt-name">${shortName(team.name_ko || team.name_en)}</span>`;
      confirmed = true;
    }
  }

  const ctrlHtml = confirmed ? `
    <span class="sim-bt-score">${score}</span>
    <div class="sim-bt-ctrl">
      <button class="sim-bt-btn" onclick="changeSimKnockoutScore('${match.id}','${side}',1)">▲</button>
      <button class="sim-bt-btn" onclick="changeSimKnockoutScore('${match.id}','${side}',-1)">▼</button>
    </div>` : '';

  return `
    <div class="bracket-team sim-bracket-team ${isWinner ? 'winner' : ''} ${!confirmed ? 'unconfirmed' : ''}">
      ${flagHtml}${nameHtml}${ctrlHtml}
    </div>`;
}

// 시뮬 브라켓 경기 카드
function renderSimBracketMatch(match, matchLabel) {
  if (!match) return '<div class="bracket-match phantom"></div>';
  const hs = match.sim_home_score, as = match.sim_away_score;
  return `
    <div class="bracket-match">
      ${matchLabel ? `<div class="match-header">${matchLabel}</div>` : ''}
      ${renderSimBracketTeam(match, 'home', hs > as)}
      ${renderSimBracketTeam(match, 'away', as > hs)}
    </div>`;
}

// 토너먼트 점수 변경: simKnockoutMatches 업데이트 후 전체 재렌더
function changeSimKnockoutScore(matchId, side, delta) {
  const m = simKnockoutMatches.find(m => m.id === matchId);
  if (!m) return;
  if (side === 'home') m.sim_home_score = Math.max(0, m.sim_home_score + delta);
  else                 m.sim_away_score = Math.max(0, m.sim_away_score + delta);
  renderSimTournamentTab();
}

// ─── 탭 렌더링: 토너먼트 ─────────────────────────────────────────
function renderSimTournamentTab() {
  initSim();
  initSimKnockout();
  const simKnockout = buildSimKnockoutData();

  // 결승 승자 계산
  const finalM = simKnockout.find(m => m.type === 'final');
  let champion = null;
  if (finalM && finalM.sim_home_team_id && finalM.sim_home_team_id !== '0'
              && finalM.sim_away_team_id && finalM.sim_away_team_id !== '0') {
    const winnerId = finalM.sim_home_score >= finalM.sim_away_score
      ? finalM.sim_home_team_id
      : finalM.sim_away_team_id;
    const team = teamsMap[winnerId];
    if (team) champion = { name: team.name_ko || team.name_en, flag: team.flag };
  }

  document.getElementById('subtab-sim-tournament').innerHTML = buildBracketHtml(
    simKnockout,
    { renderMatch: renderSimBracketMatch, champion }
  );
}

function refreshSimTournamentIfVisible() {
  const el = document.getElementById('subtab-sim-tournament');
  if (el?.classList.contains('active')) renderSimTournamentTab();
}

function refreshSimThirdsIfVisible() {
  const el = document.getElementById('subtab-sim-thirds');
  if (el?.classList.contains('active')) renderSimThirdsTab();
}

// ─── 전체 점수 표시 갱신 ─────────────────────────────────────────
function rerenderAllSimGroups() {
  const groups = [...new Set(simMatches.map(m => m.group))].sort();
  groups.forEach(g => {
    document.querySelectorAll(`#sim-group-${g} [data-score-id]`).forEach(el => {
      const [id, side] = el.dataset.scoreId.split('-');
      const m = simMatches.find(m => m.id === id);
      if (m) el.textContent = side === 'home' ? m.sim_home_score : m.sim_away_score;
    });
    const standingsEl = document.querySelector(`#sim-group-${g} .sim-standings`);
    if (standingsEl) standingsEl.innerHTML = simStandingsHtml(g);
  });
  refreshSimTournamentIfVisible();
  refreshSimThirdsIfVisible();
}

// ─── 액션 버튼 ───────────────────────────────────────────────────
function clearSimPlayedFlags() {
  simMatches.forEach(m => { delete m.sim_played; });
  simKnockoutMatches.forEach(m => { delete m.sim_played; });
}

function syncConfirmButtons() {
  simMatches.forEach(m => {
    const btn = document.querySelector(`[data-confirm-id="${m.id}"]`);
    if (btn) btn.classList.toggle('confirmed', m.sim_played === true);
  });
}

function applyRealResults() {
  document.getElementById('apply-real-modal').classList.add('active');
}

function closeApplyRealModal() {
  document.getElementById('apply-real-modal').classList.remove('active');
}

function doApplyRealKeep() {
  closeApplyRealModal();
  initSimKnockout();
  simMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
      m.sim_played = true;
    } else {
      delete m.sim_played;
    }
  });
  simKnockoutMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
      m.sim_played = true;
    } else {
      delete m.sim_played;
    }
  });
  syncConfirmButtons();
  rerenderAllSimGroups();
}

function doApplyRealReset() {
  closeApplyRealModal();
  initSimKnockout();
  simMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
      m.sim_played = true;
    } else {
      m.sim_home_score = 0;
      m.sim_away_score = 0;
      m.sim_played = false;
    }
  });
  simKnockoutMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
      m.sim_played = true;
    } else {
      m.sim_home_score = 0;
      m.sim_away_score = 0;
      m.sim_played = false;
    }
  });
  syncConfirmButtons();
  rerenderAllSimGroups();
}

function applyRealAndRandom() {
  initSimKnockout();
  simMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    } else {
      const sc = randomScore();
      m.sim_home_score = sc.home;
      m.sim_away_score = sc.away;
    }
    m.sim_played = true;
  });
  simKnockoutMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    } else {
      const sc = randomScore();
      m.sim_home_score = sc.home;
      m.sim_away_score = sc.away;
    }
    m.sim_played = true;
  });
  syncConfirmButtons();
  rerenderAllSimGroups();
}

function fullRandom() {
  initSimKnockout();
  simMatches.forEach(m => {
    const sc = randomScore();
    m.sim_home_score = sc.home;
    m.sim_away_score = sc.away;
    m.sim_played = true;
  });
  simKnockoutMatches.forEach(m => {
    const sc = randomScore();
    m.sim_home_score = sc.home;
    m.sim_away_score = sc.away;
    m.sim_played = true;
  });
  syncConfirmButtons();
  rerenderAllSimGroups();
}

// 현실적인 축구 스코어 분포
function randomScore() {
  const pool = [0,0,0,1,1,1,1,1,2,2,2,3,3,4];
  return {
    home: pool[Math.floor(Math.random() * pool.length)],
    away: pool[Math.floor(Math.random() * pool.length)],
  };
}

// ─── 이벤트 등록 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tab="simulation"]').forEach(btn => {
    btn.addEventListener('click', () => {
      initSim();
      initSimKnockout();
      renderSimGroupTab();
    });
  });

  document.querySelectorAll('[data-subtab="sim-thirds"]').forEach(btn => {
    btn.addEventListener('click', () => { initSim(); renderSimThirdsTab(); });
  });

  document.querySelectorAll('[data-subtab="sim-tournament"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderSimTournamentTab, 100));
  });
});
